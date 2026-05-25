<script lang="ts">
  import CardSprite from './components/CardSprite.svelte';

  const cards = [
    { src: '/card_1.png', name: 'Hound',   bp: 1000, cost: 0 },
    { src: '/card_2.png', name: 'Fighter', bp: 3000, cost: 1 },
  ];
</script>

<main>
  <header>
    <a href="/" class="back">← Back</a>
    <h1>⚔ Card Roster</h1>
  </header>

  <div class="grid">
    {#each cards as card}
      <div class="card-slot">
        <CardSprite src={card.src} row={0} scale={1.5} />
        <div class="card-info">
          <span class="name">{card.name}</span>
          <span class="bp">BP {card.bp.toLocaleString()}</span>
          <span class="cost">Cost {card.cost}</span>
        </div>
      </div>
    {/each}
  </div>
</main>

<style>
  main {
    min-height: 100svh;
    background: #060810;
    background-image:
      linear-gradient(rgba(24,30,56,0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(24,30,56,0.4) 1px, transparent 1px);
    background-size: 40px 40px;
    font-family: ui-monospace, monospace;
    padding: 32px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 40px;
  }
  .back {
    color: #00ffcc;
    font-size: 0.8rem;
    text-decoration: none;
    letter-spacing: 0.1em;
  }
  .back:hover { text-decoration: underline; }
  h1 {
    font-size: 2rem;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    color: #fff;
    margin: 0;
    text-shadow: 0 0 30px rgba(0,255,204,0.4);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    width: 100%;
    height: calc(100svh - 120px);
  }
  .card-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(10,15,30,0.7);
    border: 2px solid #2a3b70;
    border-radius: 16px;
    padding: 24px;
    transition: border-color 0.2s, box-shadow 0.2s;
    cursor: pointer;
  }
  .card-slot:hover {
    border-color: #00ffcc;
    box-shadow: 0 0 30px rgba(0,255,204,0.2);
  }
  .card-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .name {
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    color: #fff;
  }
  .bp {
    font-size: 10px;
    color: #ffdd00;
    font-weight: bold;
  }
  .cost {
    font-size: 9px;
    color: #2a3b70;
    text-transform: uppercase;
  }
</style>
