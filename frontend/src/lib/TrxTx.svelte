<script lang="ts">
  import * as fcl from "@onflow/fcl";
  // Assuming fcltx and uiFCL are imported from your store/lib
  // import { fcltx, uiFCL } from "$lib/flow/store";

  let user = $state<any>(null);
  let shopText = $state("Welcome to the Armory. What do you buy?");
  let isProcessing = $state(false);

  // Set this to the address that receives the payment/action
  const shopAddress = "0xUSER_OR_SHOP_ADDRESS"; 

  $effect(() => {
    fcl.currentUser().subscribe((newVal: any) => {
      user = newVal;
    });
  });

  type FclAuthz = any;
  const signer = fcl.authz as FclAuthz;

  async function handlePurchase() {
    isProcessing = true;
    shopText = "Initiating transaction... Please sign in your wallet.";
    
    try {
      const txId = await fcl.mutate({
        template: `https://blsqui.net/flix/registry/9a9663fd02dc6384999a56245e9917d6034c4e60973471562c57e020f3577439`,
        args: (arg: any, t: any) => [arg(shopAddress, t.Address)],
        proposer: signer,
        payer: signer,
        authorizations: [signer],
        limit: 1000,
      });

      // Using the txId returned from the mutation
      fcl.tx(txId).subscribe((res: any) => {
        if (res.status === 4 && !res.errorMessage) {
          shopText = "Transaction Sealed! The Fire Sword is yours.";
          alert("Game Start!");
        } else if (res.errorMessage) {
          shopText = "Transaction failed. Try again?";
          isProcessing = false;
        }
      });
    } catch (e) {
      shopText = "Transaction cancelled.";
      isProcessing = false;
    }
  }
</script>

<div class="screen bg-[#050505] text-white font-mono overflow-hidden">

  <!-- BACKGROUND DECOR -->
  <div class="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,#2a3b70,transparent)]"></div>

  <!-- TOP: GAME VIEWPORT -->
  <div class="viewport">

    <!-- LEFT: ARMSHOP KEEPER (g3) — full height, full left -->
    <div class="left-pane">
      <img
        src="https://blsqui.net/assets/pr/g3.png"
        alt="Shopkeeper"
        class="h-full w-full object-contain object-bottom drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]"
      />
    </div>

    <!-- RIGHT: CUSTOMERS (g1) — small, approaching -->
    <div class="right-pane">
      <img
        src="https://blsqui.net/assets/pr/g1_transparent.png"
        alt="Customers"
        class="max-h-[35%] max-w-full object-contain"
      />
    </div>

  </div>

  <!-- BOTTOM: DIALOG + BUTTONS -->
  <div class="bottom-ui">

    <!-- CONVERSATION BOX -->
    <div class="bg-[#0a0f1e] border-4 border-[#2a3b70] p-5 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] min-h-[90px] flex items-center mb-5">
      <p class="text-base tracking-tight leading-relaxed">
        <span class="text-emerald-500 mr-2">▶</span>
        {shopText}
      </p>
    </div>

    <!-- BUTTONS -->
    <div class="flex gap-4">
      {#if !user?.addr}
        <button onclick={fcl.authenticate} class="game-btn game-btn--blue">
          <span class="btn-bracket">[</span>
          ⚡ CONNECT WALLET
          <span class="btn-bracket">]</span>
        </button>
      {:else}
        <button
          onclick={handlePurchase}
          disabled={isProcessing}
          class="game-btn game-btn--gold"
          class:disabled={isProcessing}
        >
          <span class="btn-bracket">[</span>
          🔥 {isProcessing ? "PROCESSING..." : "BUY FIRE SWORD"}
          <span class="btn-bracket">]</span>
        </button>

        <button onclick={() => window.history.back()} class="game-btn game-btn--red">
          <span class="btn-bracket">[</span>
          ✖ LEAVE
          <span class="btn-bracket">]</span>
        </button>
      {/if}
    </div>

    {#if user?.addr}
      <div class="mt-3 text-center">
        <span class="text-[10px] text-slate-600 uppercase tracking-tighter">Connected: {user.addr}</span>
      </div>
    {/if}
  </div>

</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
  }

  /* TOP viewport takes remaining space */
  .viewport {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .left-pane {
    width: 50%;
    height: 100%;
    overflow: hidden;
  }

  .right-pane {
    width: 50%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 16px;
  }

  /* BOTTOM UI */
  .bottom-ui {
    padding: 20px 32px 24px;
    background: #050505;
    border-top: 2px solid #2a3b70;
  }

  /* GAME BUTTONS */
  .game-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 14px 20px;
    font-family: ui-monospace, monospace;
    font-weight: 900;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.2s, filter 0.2s;
    position: relative;
  }
  .game-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.15);
  }
  .game-btn:active {
    transform: translateY(1px);
  }
  .game-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .game-btn--gold {
    background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%);
    color: #000;
    box-shadow: 0 4px 0 #78350f, 0 0 20px rgba(245,158,11,0.4);
  }
  .game-btn--gold:hover {
    box-shadow: 0 4px 0 #78350f, 0 0 30px rgba(245,158,11,0.6);
  }

  .game-btn--blue {
    background: linear-gradient(180deg, #38bdf8 0%, #0369a1 100%);
    color: #000;
    box-shadow: 0 4px 0 #075985, 0 0 20px rgba(56,189,248,0.4);
  }
  .game-btn--blue:hover {
    box-shadow: 0 4px 0 #075985, 0 0 30px rgba(56,189,248,0.6);
  }

  .game-btn--red {
    background: linear-gradient(180deg, #f87171 0%, #b91c1c 100%);
    color: #000;
    box-shadow: 0 4px 0 #7f1d1d, 0 0 20px rgba(248,113,113,0.3);
  }
  .game-btn--red:hover {
    box-shadow: 0 4px 0 #7f1d1d, 0 0 30px rgba(248,113,113,0.5);
  }

  .btn-bracket {
    opacity: 0.6;
    font-size: 1.1em;
  }
</style>