<script lang="ts">
  import { battle } from './runes/battleState.svelte'
  import type { ActionType, Hero } from './runes/battleState.svelte'

  let logEl = $state<HTMLDivElement | undefined>()

  $effect(() => {
    battle.log  // reactive dependency
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  })

  // ── Action menus ─────────────────────────────────────────
  type MenuEntry = { label: string; type: ActionType; mpCost?: number; needsEnemyTarget?: boolean; needsHeroTarget?: boolean }

  function actionsFor(heroIdx: number): MenuEntry[] {
    const role = battle.heroes[heroIdx].role
    const map: Record<string, MenuEntry[]> = {
      fighter: [
        { label: '⚔️ Attack',       type: 'attack',      needsEnemyTarget: true },
        { label: '🛡️ Defend',       type: 'defend' },
        { label: '🔥 Charge Sword', type: 'charge_sword' },
      ],
      magician: [
        { label: '🔥 Fireball',     type: 'fireball',      mpCost: 12, needsEnemyTarget: true },
        { label: '💥 Meteor Rain',  type: 'fireball_aoe',  mpCost: 25 },
        { label: '✨ Infuse Magic', type: 'infuse_magic',  mpCost: 15 },
      ],
      healer: [
        { label: '💚 Heal',         type: 'heal',       mpCost: 18, needsHeroTarget: true },
        { label: '🌟 Group Heal',   type: 'group_heal', mpCost: 35 },
        { label: '🔰 Barrier',      type: 'barrier',    mpCost: 20 },
      ],
    }
    const base: MenuEntry[] = map[role] ?? []

    if (battle.fireSwordForged && (role === 'fighter' || role === 'magician')) {
      base.push({ label: '🔥⚔️ FIRE SWORD', type: 'fire_sword', mpCost: 30 })
    }
    return base
  }

  // Pending selection state
  let pendingHero  = $state<number | null>(null)
  let pendingAction = $state<MenuEntry | null>(null)

  function onActionBtn(heroIdx: number, entry: MenuEntry) {
    if (battle.phase !== 'select') return
    if (entry.needsEnemyTarget) {
      pendingHero   = heroIdx
      pendingAction = entry
      return
    }
    if (entry.needsHeroTarget) {
      pendingHero   = heroIdx
      pendingAction = entry
      return
    }
    battle.setAction(heroIdx, { type: entry.type })
    pendingHero   = null
    pendingAction = null
  }

  function onEnemyTarget(enemyId: number) {
    if (pendingHero === null || !pendingAction?.needsEnemyTarget) return
    battle.setAction(pendingHero, { type: pendingAction.type, targetEnemy: enemyId })
    pendingHero   = null
    pendingAction = null
  }

  function onHeroTarget(heroIdx: number) {
    if (pendingHero === null || !pendingAction?.needsHeroTarget) return
    battle.setAction(pendingHero, { type: pendingAction.type, targetHero: heroIdx })
    pendingHero   = null
    pendingAction = null
  }

  function cancelPending() {
    pendingHero = null
    pendingAction = null
  }

  function barPct(cur: number, max: number) { return Math.max(0, Math.min(100, (cur / max) * 100)) }

  const roleColor: Record<string, string> = {
    fighter: '#f59e0b',
    magician: '#818cf8',
    healer: '#34d399',
  }
</script>

<main>
  <!-- ── TOP: enemies ─────────────────────────────── -->
  <section class="enemy-zone">
    <div class="zone-label">ENEMY</div>
    <div class="enemy-row">
      {#each battle.enemies as enemy (enemy.id)}
        <button
          class="enemy-card"
          class:dead={!enemy.alive}
          class:boss={enemy.isBoss}
          class:targeted={battle.animEnemy === enemy.id}
          class:clickable={pendingAction?.needsEnemyTarget && enemy.alive}
          onclick={() => onEnemyTarget(enemy.id)}
          disabled={!pendingAction?.needsEnemyTarget || !enemy.alive}
        >
          <div class="enemy-icon">{enemy.icon}</div>
          <div class="enemy-name">{enemy.alive ? enemy.name : '💀'}</div>
          {#if enemy.alive}
            <div class="bar-wrap">
              <div class="bar hp-bar" style="width:{barPct(enemy.hp, enemy.maxHp)}%"></div>
            </div>
            <div class="bar-label">{enemy.hp}/{enemy.maxHp}</div>
          {/if}
        </button>
      {/each}
    </div>
  </section>

  <!-- ── MIDDLE: log + status ──────────────────────── -->
  <section class="mid-zone">
    <div class="wave-badge">
      WAVE {battle.wave + 1} / {3}
      {#if battle.wave === 2}<span class="boss-alert"> ⚠ BOSS</span>{/if}
    </div>

    {#if battle.fireSwordForged}
      <div class="fire-sword-banner">🔥⚔️ FIRE SWORD READY — Capability Transfer Active!</div>
    {:else if battle.heroes[0].swordCharged || battle.heroes[1].magicCharged}
      <div class="charge-status">
        {battle.heroes[0].swordCharged ? '⚔️ Sword charged' : '⚔️ Sword uncharged'}
        &nbsp;·&nbsp;
        {battle.heroes[1].magicCharged ? '🔮 Magic charged' : '🔮 Magic uncharged'}
      </div>
    {/if}

    <div class="battle-log" bind:this={logEl}>
      {#each battle.log as entry}
        <div class="log-line {entry.kind}">{entry.text}</div>
      {/each}
    </div>

    {#if pendingAction}
      <div class="targeting-hint">
        {pendingAction.needsEnemyTarget ? '👆 Click an enemy to target' : '👆 Click a hero to target'}
        <button class="btn-cancel" onclick={cancelPending}>✕</button>
      </div>
    {/if}
  </section>

  <!-- ── BOTTOM: party ──────────────────────────────── -->
  <section class="party-zone">
    {#each battle.heroes as hero, i}
      {@const selected = battle.actions[i] !== null}
      {@const acting   = battle.animHero === i}
      {@const targeting = pendingAction?.needsHeroTarget && hero.alive}
      <div
        class="hero-card"
        class:dead={!hero.alive}
        class:selected
        class:acting
        class:targeting
        style="--role-color:{roleColor[hero.role]}"
        role="none"
        onclick={() => { if (targeting) onHeroTarget(i) }}
      >
        <!-- Header -->
        <div class="hero-header">
          <span class="hero-icon">{hero.icon}</span>
          <span class="hero-name">{hero.name}</span>
          <span class="hero-role">{hero.role.toUpperCase()}</span>
          {#if hero.barrierTurns > 0}<span class="badge barrier">🔰×{hero.barrierTurns}</span>{/if}
          {#if hero.defending}<span class="badge defend">🛡️</span>{/if}
        </div>

        <!-- Bars -->
        <div class="stat-bars">
          <div class="bar-row">
            <span class="bar-lbl">HP</span>
            <div class="bar-track"><div class="bar hp-bar" style="width:{barPct(hero.hp,hero.maxHp)}%"></div></div>
            <span class="bar-val">{hero.hp}/{hero.maxHp}</span>
          </div>
          <div class="bar-row">
            <span class="bar-lbl">MP</span>
            <div class="bar-track"><div class="bar mp-bar" style="width:{barPct(hero.mp,hero.maxMp)}%"></div></div>
            <span class="bar-val">{hero.mp}/{hero.maxMp}</span>
          </div>
        </div>

        <!-- Action status -->
        {#if selected && battle.actions[i]}
          <div class="action-chosen">✓ {battle.actions[i]!.type.replace(/_/g,' ')}</div>
        {/if}

        <!-- Action buttons -->
        {#if hero.alive && battle.phase === 'select' && !selected}
          <div class="action-grid">
            {#each actionsFor(i) as entry}
              <button
                class="act-btn"
                class:fire-sword-btn={entry.type === 'fire_sword'}
                disabled={entry.mpCost !== undefined && hero.mp < entry.mpCost}
                onclick={() => onActionBtn(i, entry)}
              >{entry.label}{entry.mpCost ? ` (${entry.mpCost}MP)` : ''}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </section>

  <!-- ── CONFIRM / PHASE DISPLAY ──────────────────── -->
  <div class="control-bar">
    {#if battle.phase === 'select'}
      <button
        class="btn-confirm"
        disabled={!battle.allActionsSelected}
        onclick={() => battle.executeTurn()}
      >
        {battle.allActionsSelected ? '▶ EXECUTE TURN' : `Select actions (${battle.actions.filter((a,i)=>a!==null||!battle.heroes[i].alive).length}/${battle.livingHeroes.length})`}
      </button>
    {:else if battle.phase === 'executing' || battle.phase === 'enemy_turn'}
      <div class="phase-msg blink">{battle.phase === 'enemy_turn' ? '🐉 Enemy turn…' : '⚡ Executing…'}</div>
    {:else if battle.phase === 'victory'}
      <div class="end-screen win">
        <div>🏆 VICTORY!</div>
        <div class="end-sub">The dragons are defeated. Fire Sword prevails.</div>
        <button class="btn-confirm" onclick={() => battle.reset()}>▶ Play Again</button>
      </div>
    {:else if battle.phase === 'defeat'}
      <div class="end-screen lose">
        <div>💀 DEFEATED</div>
        <div class="end-sub">The dragons won this time.</div>
        <button class="btn-confirm" onclick={() => battle.reset()}>▶ Try Again</button>
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    height: 100svh;
    background: #060810;
    background-image:
      linear-gradient(rgba(24,30,56,0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(24,30,56,0.4) 1px, transparent 1px);
    background-size: 40px 40px;
    display: flex; flex-direction: column;
    font-family: ui-monospace, monospace;
    color: #fff;
    padding: 8px;
    gap: 6px;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* ── ENEMY ZONE ────────────────────────────────── */
  .enemy-zone {
    flex: 0 0 auto;
    padding: 8px;
    border: 1px solid #2a3b70;
    border-radius: 10px;
    background: rgba(10,5,20,0.6);
  }
  .zone-label {
    font-size: 8px; letter-spacing: 0.4em;
    text-transform: uppercase; color: #2a3b70;
    margin-bottom: 6px;
  }
  .enemy-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

  .enemy-card {
    background: rgba(30,10,10,0.8);
    border: 1px solid #4a1010;
    border-radius: 8px;
    padding: 8px 12px;
    min-width: 90px;
    text-align: center;
    cursor: default;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  }
  .enemy-card.boss {
    border-color: #ff4400;
    box-shadow: 0 0 16px rgba(255,68,0,0.3);
    min-width: 130px;
  }
  .enemy-card.clickable {
    cursor: pointer;
    border-color: #ff6666;
    box-shadow: 0 0 12px rgba(255,100,100,0.4);
  }
  .enemy-card.clickable:hover { transform: scale(1.06); }
  .enemy-card.targeted { transform: scale(1.1); border-color: #ffdd00; }
  .enemy-card.dead { opacity: 0.2; }

  .enemy-icon { font-size: 1.8rem; }
  .enemy-name { font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #ff6666; margin: 2px 0; }
  .bar-label  { font-size: 7px; color: #aaa; }

  /* ── MID ZONE ──────────────────────────────────── */
  .mid-zone {
    flex: 0 0 auto;
    display: flex; flex-direction: column; gap: 4px;
    padding: 6px 8px;
  }
  .wave-badge {
    font-size: 9px; letter-spacing: 0.3em;
    text-transform: uppercase; color: #00ffcc;
  }
  .boss-alert { color: #ff4400; font-weight: 900; animation: blink 0.8s infinite; }

  .fire-sword-banner {
    background: linear-gradient(90deg, rgba(255,68,0,0.2), rgba(255,170,0,0.2));
    border: 1px solid #ff6600;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 10px; font-weight: 900;
    color: #ffaa00;
    text-align: center;
    animation: glow 1.2s ease-in-out infinite alternate;
  }
  .charge-status {
    font-size: 9px; color: #888;
    text-align: center;
  }

  .battle-log {
    height: 72px;
    overflow-y: auto;
    background: rgba(0,0,0,0.5);
    border: 1px solid #1a2340;
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 9px;
    line-height: 1.5;
    scrollbar-width: thin;
    scrollbar-color: #2a3b70 transparent;
  }
  .log-line { padding: 0; }
  .log-line.player { color: #00ffcc; }
  .log-line.enemy  { color: #ff7777; }
  .log-line.fire   { color: #ffaa00; font-weight: bold; }
  .log-line.system { color: #888; }

  .targeting-hint {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 9px; color: #ffdd00; letter-spacing: 0.1em;
    padding: 3px;
  }
  .btn-cancel {
    background: transparent; border: 1px solid #ff6666;
    color: #ff6666; border-radius: 4px; padding: 1px 6px;
    font-size: 8px; cursor: pointer;
  }

  /* ── PARTY ZONE ────────────────────────────────── */
  .party-zone {
    flex: 1;
    display: flex; gap: 8px;
    min-height: 0;
  }

  .hero-card {
    flex: 1;
    border: 1px solid var(--role-color, #2a3b70);
    border-radius: 10px;
    background: rgba(5,10,25,0.8);
    padding: 8px;
    display: flex; flex-direction: column; gap: 4px;
    transition: box-shadow 0.2s, transform 0.15s;
    overflow: hidden;
  }
  .hero-card.selected { box-shadow: 0 0 10px rgba(0,255,204,0.25); }
  .hero-card.acting   { transform: scale(1.03); box-shadow: 0 0 16px rgba(255,221,0,0.4); }
  .hero-card.targeting { cursor: pointer; box-shadow: 0 0 14px rgba(0,255,204,0.5); animation: pulse-green 0.8s ease-in-out infinite alternate; }
  .hero-card.dead { opacity: 0.2; }

  .hero-header {
    display: flex; align-items: center; gap: 4px;
    flex-wrap: wrap;
  }
  .hero-icon { font-size: 1.1rem; }
  .hero-name { font-size: 10px; font-weight: 900; color: #fff; }
  .hero-role { font-size: 7px; letter-spacing: 0.2em; color: var(--role-color); margin-left: auto; }
  .badge {
    font-size: 8px; padding: 1px 3px;
    border-radius: 3px; background: rgba(255,255,255,0.1);
  }
  .badge.barrier { color: #34d399; }
  .badge.defend  { color: #f59e0b; }

  .stat-bars { display: flex; flex-direction: column; gap: 3px; }
  .bar-row { display: flex; align-items: center; gap: 4px; }
  .bar-lbl  { font-size: 7px; color: #666; width: 14px; flex-shrink: 0; }
  .bar-val  { font-size: 7px; color: #aaa; width: 36px; text-align: right; flex-shrink: 0; }
  .bar-track {
    flex: 1; height: 5px;
    background: #111; border-radius: 3px; overflow: hidden;
  }
  .bar { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  .hp-bar { background: #00ef8b; }
  .mp-bar { background: #818cf8; }
  .enemy-card .bar-wrap { height: 4px; background: #111; border-radius: 2px; overflow: hidden; margin: 3px 0 1px; }
  .enemy-card .hp-bar { background: #ef4444; }

  .action-chosen {
    font-size: 8px; color: #00ffcc;
    text-align: center; letter-spacing: 0.05em;
    background: rgba(0,255,204,0.08);
    border-radius: 4px; padding: 2px 4px;
  }

  .action-grid {
    display: flex; flex-direction: column; gap: 3px;
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .act-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12);
    color: #ccc; font-size: 8px; font-family: inherit;
    letter-spacing: 0.04em;
    padding: 4px 6px; border-radius: 5px; cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    text-align: left;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .act-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    color: #fff; border-color: rgba(255,255,255,0.3);
  }
  .act-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .act-btn.fire-sword-btn {
    background: rgba(255,100,0,0.15);
    border-color: #ff6600;
    color: #ffaa00;
    font-weight: 900;
    animation: glow 1s ease-in-out infinite alternate;
  }

  /* ── CONTROL BAR ───────────────────────────────── */
  .control-bar {
    flex: 0 0 auto;
    display: flex; justify-content: center; align-items: center;
    padding: 4px 0;
    min-height: 36px;
  }
  .btn-confirm {
    padding: 8px 28px;
    background: linear-gradient(135deg, #00ef8b, #01af66);
    color: #000; font-weight: 900; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.2em;
    border: none; border-radius: 8px; cursor: pointer;
    transition: transform 0.1s, box-shadow 0.15s;
  }
  .btn-confirm:hover:not(:disabled) {
    transform: scale(1.04);
    box-shadow: 0 0 20px rgba(0,239,139,0.4);
  }
  .btn-confirm:disabled {
    background: #1a2340; color: #444; cursor: not-allowed;
  }

  .phase-msg {
    font-size: 11px; color: #ffdd00; letter-spacing: 0.2em;
  }

  .end-screen {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    font-size: 1.2rem; font-weight: 900; letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .end-screen.win  { color: #ffdd00; }
  .end-screen.lose { color: #ff4444; }
  .end-sub { font-size: 9px; color: #aaa; font-weight: 400; letter-spacing: 0.1em; }

  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  @keyframes glow  { from { box-shadow: 0 0 4px rgba(255,100,0,0.3); } to { box-shadow: 0 0 16px rgba(255,150,0,0.7); } }
  @keyframes pulse-green { from { box-shadow: 0 0 6px rgba(0,255,200,0.3); } to { box-shadow: 0 0 18px rgba(0,255,200,0.7); } }
</style>
