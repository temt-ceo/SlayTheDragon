<script lang="ts">
  import { gameState } from './runes/gameState.svelte'
  import HandCard from './components/HandCard.svelte'
  import FieldSlot from './components/FieldSlot.svelte'

  const MAX_HP = 5

  // ─── Opponent slot click handler ──────────────────
  function onOpponentSlotClick(i: number) {
    if (gameState.pendingAttack !== null) {
      gameState.attackWithAbilityTarget(i)
    } else if (gameState.pendingPlacement !== null) {
      if (gameState.isValidAbilityTarget(i)) gameState.placeWithAbilityTarget(i)
    } else if (gameState.attackerSlot !== null) {
      gameState.attack(i)
    }
  }

  // ─── My slot click handler ─────────────────────────
  function onMySlotClick(i: number) {
    if (gameState.selectedCardIdx !== null && gameState.myField[i] === null) {
      gameState.placeCard(i)
    } else if (gameState.myField[i] !== null) {
      gameState.selectAttacker(i)
    }
  }
</script>

<main>

  <!-- OPPONENT ZONE -->
  <div class="zone opponent-zone">
    <div class="zone-header">
      <span class="zone-label">
        {gameState.status === 'playing' ? gameState.opponentName : 'OPPONENT'}
      </span>
      <div class="hp-bar">
        {#each Array(MAX_HP) as _, i}
          <div class="hp-pip" class:full={i < gameState.opponentHP}></div>
        {/each}
        <span class="hp-text">{gameState.opponentHP}/{MAX_HP}</span>
      </div>
    </div>

    <!-- Opponent hand (face-down) -->
    <div class="hand-row">
      {#each Array(4) as _}
        <div class="card-back"></div>
      {/each}
    </div>

    <!-- Opponent field -->
    <div class="field-row">
      {#each gameState.opponentField as unit, i}
        <FieldSlot
          {unit}
          isAttackTarget={gameState.attackerSlot !== null && gameState.pendingAttack === null}
          isAbilityTarget={
            (gameState.pendingPlacement !== null || gameState.pendingAttack !== null)
            && gameState.isValidAbilityTarget(i)
          }
          isAttacking={gameState.oppAttackingSlot === i}
          onclick={() => onOpponentSlotClick(i)}
        />
      {/each}
    </div>
  </div>

  <!-- CENTER BAR -->
  <div class="center-bar">
    {#if gameState.status === 'idle'}
      <button class="btn-find" onclick={() => gameState.findMatch()}>⚔ FIND MATCH</button>

    {:else if gameState.status === 'searching'}
      <span class="blink">Searching for opponent…</span>

    {:else if gameState.status === 'matched'}
      <span class="blink">Match found! Dealing cards…</span>

    {:else if gameState.status === 'playing'}
      <div class="game-info">
        <span class="turn-badge" class:my-turn={gameState.isMyTurn}>
          {gameState.isMyTurn ? '⚡ YOUR TURN' : '⏳ OPPONENT'}
        </span>
        <span>T<b>{gameState.turn}</b></span>
        {#if gameState.isMyTurn}
          <span class="cp">CP <b>{gameState.cpRemaining}</b>/<b>{gameState.cp}</b></span>
        {/if}
        <span class="mode-label">{gameState.modeLabel}</span>
        {#if gameState.attackerSlot !== null || gameState.pendingAttack !== null || gameState.pendingPlacement !== null}
          <button class="btn-cancel" onclick={() => { gameState.cancelAttack(); gameState.cancelPendingPlacement() }}>
            ✕ Cancel
          </button>
        {/if}
        {#if gameState.isMyTurn}
          <button class="btn-end" onclick={() => gameState.endTurn()}>END →</button>
        {/if}
      </div>

    {:else if gameState.status === 'won'}
      <div class="game-over win">🏆 YOU WIN!</div>

    {:else if gameState.status === 'lost'}
      <div class="game-over lose">💀 YOU LOSE</div>
    {/if}

    {#if gameState.notification}
      <div class="notification">{gameState.notification}</div>
    {/if}
  </div>

  <!-- MY ZONE -->
  <div class="zone player-zone">
    <!-- My field -->
    <div class="field-row">
      {#each gameState.myField as unit, i}
        <FieldSlot
          {unit}
          canPlace={
            gameState.isMyTurn &&
            gameState.selectedCardIdx !== null &&
            unit === null &&
            gameState.attackerSlot === null &&
            gameState.pendingPlacement === null &&
            gameState.pendingAttack === null &&
            (gameState.hand[gameState.selectedCardIdx]?.cost ?? 999) <= gameState.cpRemaining
          }
          isAttackerSelected={gameState.attackerSlot === i}
          isAttacking={gameState.myAttackingSlot === i}
          onclick={() => onMySlotClick(i)}
        />
      {/each}
    </div>
    <div class="zone-label">YOUR FIELD</div>

    <!-- My hand -->
    <div class="hand-row">
      {#if gameState.status === 'playing'}
        {#each gameState.hand as card, i}
          <div
            class="card-wrap"
            onclick={() => gameState.selectCard(i)}
            onkeydown={(e) => e.key === 'Enter' && gameState.selectCard(i)}
            role="button"
            tabindex="0"
          >
            <HandCard {card} selected={gameState.selectedCardIdx === i} />
          </div>
        {/each}
      {:else}
        {#each Array(4) as _}
          <div class="card-back dim"></div>
        {/each}
      {/if}
    </div>

    <!-- My status bar -->
    <div class="my-status">
      <div class="hp-bar">
        {#each Array(MAX_HP) as _, i}
          <div class="hp-pip" class:full={i < gameState.myHP}></div>
        {/each}
        <span class="hp-text">{gameState.myHP}/{MAX_HP}</span>
      </div>
      <span class="zone-label">YOU · DECK {gameState.deckRemaining}</span>
    </div>
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
    padding: 10px;
    gap: 6px;
    box-sizing: border-box;
  }

  .zone {
    flex: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-around;
    gap: 8px; padding: 8px;
    border: 1px solid #2a3b70;
    border-radius: 12px;
    background: rgba(10,15,30,0.4);
  }

  .zone-header {
    width: 100%; display: flex;
    align-items: center; justify-content: space-between;
    padding: 0 4px;
  }

  .zone-label {
    font-size: 9px; letter-spacing: 0.3em;
    text-transform: uppercase; color: #2a3b70;
  }

  /* HP Bar */
  .hp-bar {
    display: flex; align-items: center; gap: 3px;
  }
  .hp-pip {
    width: 14px; height: 10px;
    border: 1px solid #2a3b70;
    border-radius: 3px;
    background: #111;
    transition: background 0.3s;
  }
  .hp-pip.full { background: #00ef8b; box-shadow: 0 0 6px rgba(0,239,139,0.4); }
  .hp-text { font-size: 9px; color: #00ffcc; margin-left: 4px; }

  .field-row { display: flex; gap: 14px; justify-content: center; }
  .hand-row  { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

  .card-wrap { cursor: pointer; }

  .card-back {
    width: 72px; height: 100px;
    background: linear-gradient(135deg, #1a2040, #2a3b70);
    border: 2px solid #2a3b70;
    border-radius: 10px;
  }
  .card-back.dim { opacity: 0.2; }

  /* Center bar */
  .center-bar {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 60px; padding: 6px; gap: 4px;
  }

  .game-info {
    display: flex; align-items: center;
    gap: 12px; flex-wrap: wrap;
    font-size: 10px; color: #00ffcc;
    letter-spacing: 0.06em;
  }

  .turn-badge {
    padding: 4px 10px; border-radius: 20px;
    font-weight: 900; font-size: 10px;
    border: 1px solid #2a3b70; color: #2a3b70;
  }
  .turn-badge.my-turn {
    border-color: #ffdd00; color: #ffdd00;
    box-shadow: 0 0 10px rgba(255,221,0,0.3);
  }

  .cp { color: #00ffcc; font-size: 11px; }
  .cp b { color: #ffdd00; }

  .mode-label {
    font-size: 9px; color: #aaa;
    letter-spacing: 0.05em; max-width: 200px;
  }

  .btn-find {
    padding: 10px 30px;
    background: linear-gradient(135deg, #00ef8b, #01af66);
    color: #000; font-weight: 900; font-size: 0.9rem;
    text-transform: uppercase; letter-spacing: 0.2em;
    border: none; border-radius: 10px; cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .btn-find:hover { transform: scale(1.04); box-shadow: 0 0 20px rgba(0,239,139,0.4); }

  .btn-end {
    padding: 5px 14px;
    background: #ffdd00; color: #000;
    font-weight: 900; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.12em;
    border: none; border-radius: 6px; cursor: pointer;
    transition: transform 0.1s;
  }
  .btn-end:hover { transform: scale(1.06); }

  .btn-cancel {
    padding: 4px 10px;
    background: transparent; color: #ff6666;
    font-size: 9px; letter-spacing: 0.1em;
    border: 1px solid #ff6666; border-radius: 6px; cursor: pointer;
    transition: background 0.15s;
  }
  .btn-cancel:hover { background: rgba(255,100,100,0.15); }

  .notification {
    font-size: 11px; color: #ffdd00;
    letter-spacing: 0.1em; animation: fadeNotif 2.5s forwards;
  }
  @keyframes fadeNotif {
    0%,60%  { opacity: 1; }
    100%    { opacity: 0; }
  }

  .game-over {
    font-size: 1.4rem; font-weight: 900;
    letter-spacing: 0.25em; text-transform: uppercase;
  }
  .game-over.win  { color: #ffdd00; text-shadow: 0 0 20px rgba(255,221,0,0.5); }
  .game-over.lose { color: #ff4444; text-shadow: 0 0 20px rgba(255,68,68,0.5); }

  .my-status {
    width: 100%; display: flex;
    align-items: center; justify-content: space-between;
    padding: 0 4px;
  }

  .blink {
    font-size: 12px; color: #ffdd00;
    letter-spacing: 0.2em; animation: blink 1s infinite;
  }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
</style>
