<script lang="ts">
  import * as PIXI from 'pixi.js'
  import type { FieldUnit } from '../runes/gameState.svelte'

  interface Props {
    unit: FieldUnit | null
    canPlace?: boolean
    isAttackTarget?: boolean
    isAbilityTarget?: boolean
    isAttackerSelected?: boolean
    isAttacking?: boolean
    onclick?: () => void
  }

  let { unit, canPlace = false, isAttackTarget = false, isAbilityTarget = false,
        isAttackerSelected = false, isAttacking = false, onclick }: Props = $props()

  let container = $state<HTMLDivElement>()

  // PixiJS objects — not reactive state
  let pixiApp: PIXI.Application | undefined
  let animSprite: PIXI.AnimatedSprite | undefined
  let idleFrames: PIXI.Texture[] = []
  let attackFrames: PIXI.Texture[] = []
  let currentSprite = ''

  $effect(() => {
    const u = unit
    if (!u) {
      pixiApp?.destroy(true)
      pixiApp = undefined
      animSprite = undefined
      idleFrames = []
      attackFrames = []
      currentSprite = ''
      return
    }
    if (u.sprite === currentSprite) return  // same card, skip re-init

    pixiApp?.destroy(true)
    pixiApp = undefined
    animSprite = undefined

    const sprite = u.sprite
    let cancelled = false

    ;(async () => {
      if (!container) return

      const src = `/${sprite}.png`
      const img = new Image()
      img.src = src
      await new Promise<void>(r => { img.onload = () => r() })
      if (cancelled || !container) return

      const frameW = Math.floor(img.naturalWidth / 10)
      const frameH = Math.floor(img.naturalHeight / 2)
      const scale  = 1.2

      const app = new PIXI.Application()
      await app.init({ width: frameW * scale, height: frameH * scale, background: 0x0a0f1e, antialias: true })
      if (cancelled) { app.destroy(true); return }
      container.innerHTML = ''
      container.appendChild(app.canvas as HTMLCanvasElement)
      pixiApp = app

      await PIXI.Assets.load(src)
      const base = PIXI.Texture.from(src)

      const row0 = Array.from({ length: 10 }, (_, i) =>
        new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(i * frameW, 0, frameW, frameH) })
      )
      const row1 = Array.from({ length: 10 }, (_, i) =>
        new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(i * frameW, frameH, frameW, frameH) })
      )

      idleFrames   = row0.slice(0, 6)
      attackFrames = [...row0.slice(5, 9), ...row1.slice(4, 10)]

      const sp = new PIXI.AnimatedSprite(idleFrames)
      sp.animationSpeed = 0.12
      sp.loop  = true
      sp.width  = frameW * scale
      sp.height = frameH * scale
      sp.play()
      app.stage.addChild(sp)
      animSprite   = sp
      currentSprite = sprite
    })()

    return () => { cancelled = true }
  })

  $effect(() => {
    const attacking = isAttacking
    if (!animSprite || !idleFrames.length || !attackFrames.length) return
    if (attacking) {
      const sp = animSprite
      sp.textures = attackFrames
      sp.loop = false
      sp.gotoAndPlay(0)
      sp.onComplete = () => {
        sp.textures = idleFrames
        sp.loop = true
        sp.play()
        sp.onComplete = undefined as any
      }
    }
  })
</script>

<div
  class="slot"
  class:can-place={canPlace}
  class:occupied={!!unit}
  class:attack-target={isAttackTarget}
  class:ability-target={isAbilityTarget}
  class:attacker={isAttackerSelected}
  class:no-action={unit && !unit.hasAction}
  onclick={onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick?.()}
  role="button"
  tabindex="0"
>
  {#if unit}
    <div bind:this={container}></div>
    <div class="unit-info">
      <span class="bp">{(unit.bp + unit.bpMod).toLocaleString()}</span>
      {#if !unit.hasAction}<span class="zzz">zzz</span>{/if}
    </div>
  {:else if canPlace}
    <span class="hint">▼ PLACE</span>
  {:else if isAttackTarget}
    <span class="hint">⚡ HIT</span>
  {:else if isAbilityTarget}
    <span class="hint">🎯</span>
  {/if}
</div>

<style>
  .slot {
    width: 100px; height: 120px;
    border: 2px dashed #2a3b70;
    border-radius: 10px;
    background: rgba(42,59,112,0.1);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative; cursor: default;
  }
  .slot.can-place {
    border-color: #ffdd00;
    box-shadow: 0 0 12px rgba(255,221,0,0.3);
    cursor: pointer;
    animation: pulse-yellow 1s infinite;
  }
  .slot.occupied {
    border-color: #00ffcc;
    border-style: solid;
    cursor: pointer;
  }
  .slot.attacker {
    border-color: #ffdd00 !important;
    box-shadow: 0 0 18px rgba(255,221,0,0.6) !important;
  }
  .slot.attack-target {
    border-color: #ff4444;
    box-shadow: 0 0 14px rgba(255,68,68,0.5);
    cursor: pointer;
    animation: pulse-red 0.8s infinite;
  }
  .slot.ability-target {
    border-color: #aa44ff;
    box-shadow: 0 0 14px rgba(170,68,255,0.5);
    cursor: pointer;
    animation: pulse-purple 0.8s infinite;
  }
  .slot.no-action { opacity: 0.55; }

  .unit-info {
    display: flex; align-items: center; gap: 4px;
    margin-top: 2px;
  }
  .bp   { font-size: 9px; color: #ffdd00; font-family: ui-monospace, monospace; }
  .zzz  { font-size: 8px; color: #888; }
  .hint { font-size: 9px; color: #ffdd00; letter-spacing: 0.15em; font-family: ui-monospace, monospace; }

  @keyframes pulse-yellow {
    0%,100% { box-shadow: 0 0 8px rgba(255,221,0,0.3); }
    50%      { box-shadow: 0 0 20px rgba(255,221,0,0.6); }
  }
  @keyframes pulse-red {
    0%,100% { box-shadow: 0 0 8px rgba(255,68,68,0.3); }
    50%      { box-shadow: 0 0 20px rgba(255,68,68,0.7); }
  }
  @keyframes pulse-purple {
    0%,100% { box-shadow: 0 0 8px rgba(170,68,255,0.3); }
    50%      { box-shadow: 0 0 20px rgba(170,68,255,0.7); }
  }
</style>
