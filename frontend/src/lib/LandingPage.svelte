<main>
  <div class="hero">
    <h1>⚔ SLAY THE DRAGON</h1>
    <p class="sub">A blockchain card game on Flow</p>
    <a href="/cards" class="btn">View Card Roster →</a>
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
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-monospace, monospace;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  h1 {
    font-size: 3rem;
    font-weight: 900;
    font-style: italic;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #fff;
    margin: 0;
    text-shadow: 0 0 40px rgba(0,255,204,0.5);
  }
  .sub {
    color: #00ffcc;
    font-size: 0.75rem;
    letter-spacing: 0.4em;
    text-transform: uppercase;
  }
  .btn {
    margin-top: 24px;
    padding: 14px 36px;
    background: linear-gradient(135deg, #00ef8b, #01af66);
    color: #000;
    font-weight: 900;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    border-radius: 12px;
    text-decoration: none;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .btn:hover {
    transform: scale(1.03);
    box-shadow: 0 0 24px rgba(0,239,139,0.4);
  }
</style>
