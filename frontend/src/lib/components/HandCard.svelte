<script lang="ts">
  import type { Card } from '../runes/gameState.svelte'

  interface Props { card: Card; selected?: boolean }
  let { card, selected = false }: Props = $props()

  let canvas = $state<HTMLCanvasElement>()

  $effect(() => {
    const c = card
    if (!canvas) return
    const img = new Image()
    img.src = `/${c.sprite}.png`
    img.onload = () => {
      if (!canvas) return
      const frameW = Math.floor(img.naturalWidth / 10)
      const frameH = Math.floor(img.naturalHeight / 2)
      canvas.width  = frameW
      canvas.height = frameH
      const ctx = canvas.getContext('2d')!
      // Static thumbnail: top-left frame [row=0, col=0]
      ctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, frameW, frameH)
    }
  })

  function abilityDesc(card: Card): string {
    if (!card.abilities?.length) return ''
    return card.abilities.map(ab => {
      switch (ab.type) {
        case 2:  return `On ${ab.trigger === 2 ? 'atk' : 'blk'}: +${ab.amount}BP`
        case 1:  return ab.ask === 3 ? `Enter: ${ab.amount} all`
                      : ab.ask === 2 ? `Enter: ${ab.amount} to slept`
                      : ab.ask === 1 ? `Enter: ${ab.amount} chosen`
                      : `Atk: ${ab.amount} chosen`
        case 5:  return 'Enter: Stun'
        case 7:  return 'Enter: Draw'
        case 8:  return 'End: Restore'
        case 11: return 'Speed Move'
        case 12: return 'Unblockable'
        default: return ''
      }
    }).filter(Boolean).join(' · ')
  }
</script>

<div class="hand-card" class:selected>
  <canvas bind:this={canvas}></canvas>
  <div class="info">
    <span class="name">{card.name}</span>
    <div class="stats">
      <span class="bp">{card.bp.toLocaleString()} BP</span>
      <span class="cost">Cost {card.cost}</span>
    </div>
    {#if card.abilities?.length}
      <span class="ability">{abilityDesc(card)}</span>
    {/if}
  </div>
</div>

<style>
  .hand-card {
    background: linear-gradient(160deg, #0d1530, #1a2560);
    border: 2px solid #2a3b70;
    border-radius: 10px;
    padding: 6px;
    display: flex; flex-direction: column;
    align-items: center; gap: 4px;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    min-width: 80px;
  }
  .hand-card:hover    { transform: translateY(-6px); }
  .hand-card.selected {
    transform: translateY(-14px);
    border-color: #ffdd00;
    box-shadow: 0 0 14px rgba(255,221,0,0.4);
  }

  canvas { border-radius: 6px; display: block; }

  .info  { width: 100%; }
  .name  { display: block; font-size: 8px; color: #fff; font-weight: 700;
           text-align: center; letter-spacing: 0.05em;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stats { display: flex; justify-content: space-between; font-size: 7px; margin-top: 2px; }
  .bp    { color: #ffdd00; }
  .cost  { color: #00ffcc; }
  .ability { display: block; font-size: 6.5px; color: #aaa;
             margin-top: 2px; text-align: center; line-height: 1.3; }
</style>
