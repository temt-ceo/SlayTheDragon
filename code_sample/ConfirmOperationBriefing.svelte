<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { uiStatus } from './runes/uiStatus.svelte';
  import { uiLang } from './runes/uiLang.svelte';
  import { uiI18n } from './runes/uiI18n.svelte';
  import { uiFCL } from './runes/uiFCL.svelte';
  import { uiFlowInfo } from './runes/uiFlowInfo.svelte';
  import { uiResponse } from './runes/uiResponse.svelte';
  import { authWS } from './runes/authWS.svelte';
  import { webRPC } from './runes/webRPC.svelte';
  import { users } from './runes/users.svelte';
  import SearchPopup from './components/SearchPopup.svelte'
  import SecurityTerminal from './components/SecurityTerminal.svelte'
  import { memberSearch } from './runes/search.svelte';

  interface VaultResponse {
      status: string;
  }
  let intentCheckProgress = $state(0);
  let pinLogin = $state('');
  let regAgreed = $state(false);
  let isLocked = $state(true);
  let isEntryFading = $state(false);
  let vaultProgress = $state(0);
  let vaultStatusTitle = $state('');
  let generatedFlowAddress = $state('');
  let intentId = $state('');
  let destination = $state('');
  let isPickerOpen = $state(false);
  let selectedAmount = $state(0);
  let vaultResp: VaultResponse;
  let authzFrame: HTMLIFrameElement;
  let signable: any; // RuneにするとpostMessageができなくなる
  let showAuthz = $state(false);
  let isProcessingSignUp = $state(false);
  let isProcessingSignIn = $state(false);
  let isProcessingTransmission = $state(false);
  let flowInterval: number | undefined;
  let remainingMinutes = $state<number | null>(null);
  let currentProcessingTransmission = $state<string | null>(null);
  let windowWidth = $state(0);
  let userInputMessage = $state("");
  const messages = [
    "Accessing Sovereign Vault...",
    "Decrypting Handshake...",
    "Authorizing eSports Node...",
    "System Ready."
  ];
  let currentMsg = $derived.by(() => {
    if (uiStatus.status === 'error') return uiI18n.s.linkExpiredReason;
    if (intentCheckProgress >= 100) return messages[3];
    if (intentCheckProgress > 60) return messages[2];
    if (intentCheckProgress > 25) return messages[1];
    return messages[0];
  });
  let flowAddr = $derived(
    uiResponse.intentIDConfirm?.flow_address && !uiResponse.intentIDConfirm?.flow_address.startsWith("0x") ?
        "0x" + uiResponse.intentIDConfirm?.flow_address : uiResponse.intentIDConfirm?.flow_address
  );
  let flowscanUrl = $derived(
    flowAddr
    ? `https://testnet.flowscan.io/account/${flowAddr}`
    : '#'
  );
  let securityColor = $derived(users.hasPasskey ? 'text-emerald-500' : 'text-red-500');
  $effect(() => {
      if (authWS.data) {
          handleWsMessage();
      }
  });
  function startCountdown() {
      remainingMinutes = 60;
      let countdownInterval: number;
      countdownInterval = setInterval(() => {
          if (remainingMinutes != null && remainingMinutes > 0) {
              remainingMinutes -= 1;
              if (remainingMinutes <= 1) {
                isLocked = true;
                uiStatus.signUpStep = 0;
                currentMsg = uiI18n.s.authzText1;
                console.log("> BRIEFING ROOM: LOCKED.");
              }
          } else {
              isLocked = true;
              uiStatus.signUpStep = 0;
              currentMsg = uiI18n.s.authzText1;
              console.log("> BRIEFING ROOM: LOCKED.");
              clearInterval(countdownInterval);
          }
      }, 60000);
  }

  /* IntentId Chack */
  const init = async () => {
    const params = new URLSearchParams(window.location.search);
    intentId = params.get('intent') || '';

    if (intentId === '') {
      uiStatus.setStatus('error');
      return;
    }
    try {
      const response = await fetch('/api/auth/confirm-intent-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent_id: intentId })
      });
      if (response.ok) {
        uiStatus.setStatus('success');
        const data = await response.json();
        uiResponse.setIntentIDConfirmResponse(data);
        users.setUserName(uiResponse.intentIDConfirm!.user_name);
        startCountdown();
        await users.checkCredentialStatus(uiResponse.intentIDConfirm?.token);
      } else {
        uiStatus.setStatus('error');
      }
    } catch (e) {
      uiStatus.setStatus('error');
    }
  };

  onMount(() => {
    if (uiStatus.signUpStep !== 0) return;

    if (typeof navigator !== 'undefined') {
      const userLangs = navigator.languages || [navigator.language];
      if (userLangs.some(l => l.startsWith('ja'))) {
          uiLang.lang ='ja';
      }
    }

    init();

    const interval = setInterval(() => {
      if (uiStatus.status != 'error') intentCheckProgress += Math.random() * 15;
      if (intentCheckProgress > 100) intentCheckProgress = 100;
      if (uiStatus.status === 'error') {
        clearInterval(interval);
      } else if (intentCheckProgress > 90 && uiStatus.status == 'verifying') {
        intentCheckProgress = 90;
      }
      if (intentCheckProgress === 100 && uiStatus.status === 'success') {
        clearInterval(interval);
        setTimeout(() => {
          isEntryFading = true; // Triggers the .fade-out class
          // Wait for fade animation, then move to Step 1 (PIN Entry)
          setTimeout(() => {
            if (uiStatus.status === 'error') return;
            if (!uiResponse.intentIDConfirm?.flow_address) {
              uiStatus.signUpStep = 1;
            } else {
              uiStatus.signUpStep = 7;
            }
          }, 1000);
        }, 500);
      }
    }, 150);

    window.addEventListener("message", async (event) => {
      // Security check
      if (event.origin !== 'https://lab.blsqui.net' && event.origin !== 'https://wallet.blsqui.net') return;

      // Listen for Authz telling us it's ready
      if (event.data.type === "FCL:VIEW:READY") {
        if (authzFrame && authzFrame.contentWindow) {
          signable = JSON.parse(JSON.stringify(uiFCL.manualSignable));
          authzFrame.contentWindow?.postMessage({
            type: "FCL:VIEW:READY:RESPONSE",
            body: signable,
          }, window.location.origin);
        }
      }
      // Listen for the Signature result
      if (event.data.type === "FCL:VIEW:RESPONSE") {
        if (event.data.status === "APPROVED") {
          showAuthz = false;
          try {
            const signature = event.data.data.signature;
            // Call the execute endpoint (we will write this next)
            const executeRes = await fetch(`/api/signer/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}` },
                body: JSON.stringify({ 
                    signature, 
                    message: signable.message,
                    network: uiResponse.intentIDConfirm?.network,
                    address: uiResponse.intentIDConfirm?.flow_address,
                })
            });
            const txResult = await executeRes.json();
            if (txResult.status === 'OK') {
              await uiFlowInfo.sync(flowAddr!, true);
              setTimeout(() => {
                uiFlowInfo.recentTransactions = [{
                    id: txResult.txId,
                    status: txResult.status === 'OK' ? 'SEALED' : 'FAILED',
                    time: Date.now(),
                    delta: currentProcessingTransmission!
                }, ...uiFlowInfo.recentTransactions].slice(0, 50);
              }, 1500);
              alert('Transaction Sealed. Check the Transmission Log.');
            }
          } catch (err) {
            console.error(err);
          } finally {
            isProcessingTransmission = false; // FINALLY reset the button
            currentProcessingTransmission = null;
            showAuthz = false;
          }
        }
        if (event.data.status === "REJECTED") {
          showAuthz = false;
          isProcessingTransmission = false;
        }
      }
    });
    windowWidth = window.innerWidth;
    const handleResize = () => {
        windowWidth = window.innerWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      // Cleanup if component unmounts
      clearInterval(interval);
      if (flowInterval) clearInterval(flowInterval);
      window.removeEventListener('resize', handleResize);
    }
  });

  async function finalize() {
    if (isProcessingSignUp) return;
    isProcessingSignUp = true;
    if (uiStatus.pin1 === uiStatus.pin2) {
      try {
        const response = await fetch(`${uiResponse.intentIDConfirm?.s2_uri}/api/vault/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
          },
          body: JSON.stringify({
            pin: uiStatus.pin1,
            network: uiResponse.intentIDConfirm?.network,
            s2_uri: uiResponse.intentIDConfirm?.s2_uri,
          })
        });
        if (response.ok) {
          vaultResp = await response.json();
          uiStatus.signUpStep = 4;
          vaultProgress = 10;
          vaultStatusTitle = `${vaultResp.status}...`;
          authWS.connect(intentId);
        } else {
          isProcessingSignUp = false;
        }
      } catch (e) {
        console.error(e);
        isProcessingSignUp = false;
      }
    } else {
      alert(uiI18n.s.notMatchPin);
      isProcessingSignUp = false;
    }
  }

  /*
   * WebSocket 受信データ処理
   */
  function handleWsMessage() {
    if (authWS.data.authenticated) {
        vaultProgress = 100;
        authWS.close();
        generatedFlowAddress = authWS.data.address;
        uiResponse.setGeneratedFlowAddress(generatedFlowAddress);
        vaultStatusTitle = "SYNCING";
    } else if (authWS.data.status === 'PinAccepted') {
        vaultProgress = 60;
        vaultStatusTitle = "SYNCING...";
    } else if (authWS.data.status === 'AccountOnGenerating') {
        vaultProgress = 90;
        vaultStatusTitle = "SYNCING...";
    }
  }

  async function authConfirm() {
    if (pinLogin.length !== 6) return;
    if (isProcessingSignIn) return;
    isProcessingSignIn = true;

    try {
      const response = await fetch(`${uiResponse.intentIDConfirm?.s2_uri}/api/auth/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
        },
        body: JSON.stringify({
          pin: pinLogin,
          network: uiResponse.intentIDConfirm?.network,
          s2_uri: uiResponse.intentIDConfirm?.s2_uri,
        })
      });
      if (response.ok) {
        unlock();
      } else {
        isProcessingSignIn = false;
        const data = await response.json();
        if (data.status === 'ERROR_INVALID_PIN') {
          alert(`Incorrect PIN.`);
        } else if (data.status === 'ERROR_LOCKED_OUT') {
          alert("Too many failed attempts. Access locked for 1 hour.");
        }
      }
    } catch (e) {
      console.error(e);
      isProcessingSignIn = false;
    }
  }

  async function unlock() {
    isLocked = false;
    console.log("> BRIEFING ROOM: UNLOCKED.");
    uiFlowInfo.initialize(uiResponse.intentIDConfirm?.network!);

    if (!flowAddr) return;
    await uiFlowInfo.sync(flowAddr, false);
    flowInterval = setInterval(() => {
        uiFlowInfo.sync(flowAddr!, false);
    }, 10000);
  }

  function selectTarget(member: any) {
    destination = member.user_id; 
    isPickerOpen = false;
  }

  async function openAuthz(templateid: string) {
    if (isProcessingTransmission) return; // Prevent double-clicks
    
    isProcessingTransmission = true;
    try {
      let signer: string;
      let cadenceCode: string;
      let target: string;

      switch (templateid) {
        case 'b405c2ee81cac92107129dff5a18fb5282341fbeaec26b63cfc65ef38f9820df':
          currentProcessingTransmission = '-1.0';
          signer = uiResponse.intentIDConfirm?.flow_address!;
          if (uiResponse.intentIDConfirm?.network === 'mainnet') {
            cadenceCode = uiFCL.blsquiMainnetCadenceCode1;
          } else {
            cadenceCode = uiFCL.blsquiTestnetCadenceCode1;
          }
          target = await users.getUserAddress(destination);
          if (target != '') {
            await uiFCL.setManualSignable(signer, templateid, cadenceCode, target, uiResponse.intentIDConfirm?.network!);
            showAuthz = true;
          }
          break;
        case '602e6f9383fac142a55441260ef13276900ad836b8803e75acac4e1a29a739ae':
          currentProcessingTransmission = '-10.0';
          signer = uiResponse.intentIDConfirm?.flow_address!;
          if (uiResponse.intentIDConfirm?.network === 'mainnet') {
            cadenceCode = uiFCL.blsquiMainnetCadenceCode2;
          } else {
            cadenceCode = uiFCL.blsquiTestnetCadenceCode2;
          }
          target = await users.getUserAddress(destination);
          if (target != '') {
            await uiFCL.setManualSignable(signer, templateid, cadenceCode, target, uiResponse.intentIDConfirm?.network!);
            showAuthz = true;
          }
          break;
      }
    } catch (e) {
      console.error(e);
      isProcessingTransmission = false;
    }
  }

  $effect(() => {
    const hasActiveMembers = uiFlowInfo.active_party_members?.length > 0;
    
    // Only init if we have someone to talk to AND we haven't started yet
    if (hasActiveMembers) {
        console.log("Mutual party members detected. Initializing Web-RPC bridge...");
        webRPC.connect(users.getCleanUserID(uiResponse.intentIDConfirm?.user_id!));
    }
    
    // Optional: Teardown if the party becomes empty to save more battery
    if (!hasActiveMembers) {
        console.log("No active members. Putting Janus to sleep.");
        webRPC.close();
    }
  });

  $effect(() => {
    if (webRPC.lastEvent?.type === "ROOM_INVITE") {
        webRPC.roomInvites[webRPC.lastEvent.from] = webRPC.lastEvent.roomId;
    }
  });
  function userHandleSend() {
      if (userInputMessage.trim()) {
          console.log(0, userInputMessage, webRPC.currentRoomId);
          webRPC.sendMessage(userInputMessage);
          userInputMessage = ""; // Clear input
      }
  }

</script>

<div class="data-stream-bg fixed inset-0 z-0 pointer-events-none"></div>

<div class="w-full bg-[#0a0f1e] border-b-2 border-[#2a3b70] h-20 flex items-center justify-center top-0 z-50 -panel !border-l-0 !border-r-0 !border-t-0 !rounded-none sticky">
  <div class="text-emerald-500 text-[10px] tracking-widest uppercase mb-1 absolute top-1 font-mono">
    PARTNER ADV.
  </div>
  <div class="w-full max-w-5xl h-12 bg-[#060810] rounded flex items-center justify-center border-2 border-emerald-500/40 hover:border-emerald-500 transition-all cursor-pointer group hover:scale-[1.01]">
    <span class="text-emerald-500 font-black tracking-tight italic text-base group-hover:text-white transition-colors">
      &gt;&gt; VIRTUAL ARCADE ACCESS: DEPLOY NEW TEMPLATES [LINK] &lt;&lt;
    </span>
  </div>
</div>

{#if isLocked}
  {#if uiStatus.signUpStep === 0}
    <div class="background-transition">
      <div class="decryption-overlay" class:fade-out={isEntryFading}>
          {#if uiStatus.status === 'error'}
            <h2 class="mb-4" style="color: #ff4757;">◈ Link Expired</h2>
          {/if}
          <div class="status-text glitch-text max-w-[80vw]">{currentMsg}</div>
          <div class="decrypt-bar-container">
              <div class="decrypt-bar-progress" style="width: {intentCheckProgress}%"></div>
          </div>
          <div class="mt-4 text-[8px] text-zinc-600 font-mono tracking-widest uppercase">
              Syncing Nodes: Tokyo | Frankfurt | Stockholm
          </div>
      </div>
    </div>
  {/if}
  <div
    id="auth-overlay"
    class="fixed inset-0 z-40 flex items-center justify-center p-4 auth-overlay text-slate-300"
  >
    <div
      class="glass-panel p-8 rounded-3xl w-full max-w-sm text-center sentinel-glow"
    >

      {#if uiStatus.signUpStep === 1}
        <div>
          <div class="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mt-4 mb-4 border border-emerald-500/30">
              <i class="fas fa-key text-emerald-400 text-xl"></i>
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">{uiI18n.s.regTitle}</h2>
          <p class="text-slate-400 text-sm mb-4 mt-4">{uiI18n.s.regSub}</p>
          <p class="text-slate-400 text-sm mb-8">{uiI18n.s.regSub2}</p>

          <div class="space-y-6">
              <input type="password" bind:value={uiStatus.pin1} maxlength="6" placeholder="••••••"
                  class="w-full bg-slate-900/50 border-2 border-emerald-500/50 rounded-2xl py-3 text-center text-4xl tracking-[0.8em] placeholder:text-slate-600/50 focus:border-emerald-500 focus:outline-none transition-all mb-6">

              <button
                onclick={() => uiStatus.handleNextStep()}
                class="w-full py-4 flow-gradient text-slate-900 font-black rounded-xl uppercase tracking-widest hover:scale-[1.02] transition-transform"
                class:opacity-50={uiStatus.pin1.length !== 6}
                class:cursor-not-allowed={uiStatus.pin1.length !== 6}
              >
                  Continue / 次へ
              </button>
          </div>
        </div>
      {:else if uiStatus.signUpStep === 2}
        <div>
          <h2 class="text-2xl font-bold text-white mb-2">Confirm PIN</h2>
            <p class="text-slate-400 text-sm mb-8">Please re-enter your code to verify.</p>
            <input type="password" bind:value={uiStatus.pin2} maxlength="6" placeholder="••••••"
                class="w-full bg-slate-900/50 border-2 {uiStatus.pin2.length != uiStatus.pin1.length || uiStatus.pin1 === uiStatus.pin2 ? 'border-emerald-500/50' : 'border-rose-500/50'} rounded-2xl py-3 text-center text-4xl tracking-[0.8em] placeholder:text-slate-600/50 focus:border-emerald-500 focus:outline-none transition-all mb-6">
            <p class="text-slate-400 text-xs mb-8">{uiI18n.s.caution}</p>
            <div class="flex items-start gap-2.5">
                <input
                    type="checkbox"
                    id="reg-checkbox"
                    bind:checked={regAgreed}
                    class="accent-emerald-500 w-4 h-4 shrink-0 cursor-pointer mt-0.5"
                >
                <label
                    for="reg-checkbox"
                    class="text-slate-400 text-xs p-1 cursor-pointer select-none"
                >
                    {uiI18n.s.checkboxText}
                </label>
            </div>
            <div class="flex gap-3">
              <button onclick={() => uiStatus.handlePrevStep()} class="flex-1 py-4 bg-slate-800 text-slate-400 font-bold rounded-xl uppercase text-xs tracking-widest">Back</button>
              <button
                onclick={() => uiStatus.handleNextStep()}
                class="flex-[2] py-4 flow-gradient text-slate-900 font-black rounded-xl uppercase tracking-widest"
                class:opacity-50={!regAgreed || uiStatus.pin2.length !== 6}
                class:cursor-not-allowed={!regAgreed || uiStatus.pin2.length !== 6}
              >Continue / 次へ</button>
            </div>
        </div>
      {:else if uiStatus.signUpStep === 3}
        <div>
          <h2 class="text-2xl font-bold text-white mb-2">Initialize MPC Vault</h2>
          <p class="text-slate-400 text-sm mb-8">Distribute fragments between Frankfurt and Stockholm.</p>
          <div class="custom-select mb-6">
            <span class="node-status"></span> blsqui-signer.net (Stockholm)
          </div>
          <div class="flex gap-3">
            <button onclick={() => uiStatus.handlePrevStep()} class="flex-1 py-4 bg-slate-800 text-slate-400 font-bold rounded-xl uppercase text-xs tracking-widest btn-back">Back</button>
            <button
              onclick={finalize}
              class:opacity-50={isProcessingSignUp}
              class:cursor-not-allowed={isProcessingSignUp}
              class="flex-[2] py-4 flow-gradient text-slate-900 font-black rounded-xl uppercase tracking-widest">
                <span>Complete / 登録</span>
            </button>
          </div>
        </div>
      {:else if uiStatus.signUpStep === 4}
        <div class="animate-fade-in text-center max-w-md mx-auto">
            <div class="flex flex-col items-center gap-1 mb-8">
                <div class="step-indicator tracking-[0.3em] text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.4)]">
                    EXECUTING HANDSHAKE
                </div>
                <div class="text-[10px] font-mono text-zinc-500 uppercase">
                    MPC-TSS(CMP) Shard Distribution { generatedFlowAddress ? 'Complete' : 'in Progress' }
                </div>
            </div>
            
            <div class="relative py-6 px-2">
                <div class="h-[2px] w-full bg-zinc-900 rounded-full overflow-hidden relative">
                    <div 
                        class="h-full bg-[#00ffcc] transition-all duration-500 ease-out shadow-[0_0_15px_#00ffcc]"
                        style="width: {vaultProgress}%"
                    ></div>
                </div>
                <div class="progress-track sync-active">
                    <div class="progress-fill" style="width: {vaultProgress}%"></div>
                </div>
                
                <div class="mt-3 flex justify-between items-center font-mono text-[9px]">
                    <span class="text-zinc-600">DISTRIBUTION:</span>
                    <span class="text-[#00ffcc] font-bold">{vaultProgress}%</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-8 mt-2 border-t border-zinc-900 pt-6">
                <div class="text-left">
                    <div class="text-[8px] text-zinc-600 font-bold tracking-widest mb-1">NODE_01 (S1)</div>
                    <div class="text-[10px] text-[#00ffcc] font-mono flex items-center gap-2">
                        <span class="w-1 h-1 rounded-full bg-[#00ffcc] animate-pulse"></span>
                        READY: FRANKFURT
                    </div>
                </div>
                <div class="text-left border-l border-zinc-800 pl-8">
                    <div class="text-[8px] text-zinc-600 font-bold tracking-widest mb-1">NODE_02 (S2)</div>
                    <div class="text-[10px] font-mono flex items-center gap-2" class:text-[#00ffcc]={vaultProgress > 0} class:text-zinc-700={vaultProgress === 0}>
                        <span class="w-1 h-1 rounded-full" class:bg-[#00ffcc]={vaultProgress > 0} class:bg-zinc-800={vaultProgress === 0} class:animate-pulse={vaultProgress > 0}></span>
                        {vaultStatusTitle}
                    </div>
                </div>
            </div>

            {#if generatedFlowAddress != ''}
              <div class="mt-10 animate-scale-up">
                <div class="bg-gradient-to-b from-[#00ffcc]/10 to-transparent border border-[#00ffcc]/20 p-8 rounded-3xl backdrop-blur-sm">
                    <h3 class="text-white font-black italic text-xl uppercase tracking-tighter leading-none">
                      IDENTITY INITIALIZED
                    </h3>
                    <p class="text-[#00ffcc] font-mono text-[9px] mt-4 opacity-70 selection:bg-[#00ffcc] selection:text-slate-900">
                      <a 
                          href={`https://${uiResponse.intentIDConfirm?.network === 'testnet' ? 'testnet.' : ''}flowscan.io/account/${generatedFlowAddress}` } 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="group/link flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 transition-all hover:bg-white/10 hover:border-[#00ffcc]/30"
                      >
                        Blockchain Address: {generatedFlowAddress}
                        <svg class="w-2.5 h-2.5 text-white/20 group-hover/link:text-[#00ffcc] transition-all transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </p>
                    <div class="mt-6 py-3 px-4 border-y border-white/5 bg-white/[0.02] flex items-center justify-center gap-3">
                      <div class="flex flex-col items-center">
                          <span class="text-[10px] font-black text-[#00ffcc] uppercase tracking-[0.15em]">
                              Setup Complete
                          </span>
                          <p class="text-[11px] text-zinc-400 font-medium mt-0.5">
                              Please return to the <span class="text-[#00ffcc] font-bold">Game Tab</span> to continue.
                          </p>
                      </div>
                    </div>
                    <button onclick={unlock} class="group w-full mt-8 py-2 bg-white text-slate-900 font-black rounded-xl uppercase tracking-[0.2em] text-[10px] transition-all hover:bg-[#00ffcc] hover:scale-[1.02] active:scale-[0.98]">
                      Enter Blsqui Interface
                    </button>
                </div>
              </div>
            {/if}
        </div>
      {:else if uiStatus.signUpStep === 7}
        <div>
          <div class="mb-6">
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50"
            >
              <img
                src="https://blsqui.net/assets/logo.png"
                alt="Blsqui"
                class="w-16 h-16 mx-auto mb-4"
              />
            </div>
            <h2 class="text-2xl font-bold tracking-tight">
              Access Briefing Room
            </h2>
            <p class="text-slate-400 text-sm mt-2">
              Enter your 6-digit Security PIN
            </p>
          </div>

          <input
            type="password"
            maxlength="6"
            bind:value={pinLogin}
            id="pin-input"
            placeholder="••••••"
            class="w-full bg-slate-800 border-2 border-slate-700 rounded-xl py-4 text-center text-3xl tracking-[1em] focus:border-emerald-500 focus:outline-none transition-all mb-6"
          />

          <button
            onclick={authConfirm}
            class:opacity-50={pinLogin.length !== 6 || isProcessingSignIn}
            class:cursor-not-allowed={pinLogin.length !== 6 || isProcessingSignIn}
            class="w-full flow-gradient text-slate-900 font-black py-4 rounded-xl uppercase tracking-widest hover:brightness-110 transition-all active:scale-95">
              <span>Decrypt Vault</span>
          </button>
          <p class="mt-4 text-xs text-slate-500">
            Secured by Blsqui Hybrid-MPC Engine (Frankfurt)
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<main class="main-content relative z-10 max-w-7xl mx-auto p-6 mt-6 transition-all duration-1000 text-slate-100 {isLocked ? 'locked' : 'unlocked'}">
  <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6 border-b-2 border-[#2a3b70] pb-8">
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <h1 class="text-4xl font-black italic tracking-tighter uppercase text-white leading-none">
          Virtual Ops <span class="text-emerald-500">Briefing</span>
        </h1>
        <span class={(uiResponse.intentIDConfirm?.network === 'testnet' ? "text-[#FFDD00]" : "text-[#00EF8B]") + " px-2 py-0.5 bg-[#2a3b70] text-[8px] font-bold rounded uppercase tracking-tighter"}>
          { uiResponse.intentIDConfirm?.network }
        </span>
      </div>
      <!-- Security Integrity Badge -->
      <div class="flex items-center gap-2 mt-2">
          {#if users.hasPasskey}
              <div class="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/50 rounded-md">
                  <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span class="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Credential Security Active</span>
              </div>
          {:else}
              <div class="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/50 rounded-md">
                  <div class="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                  <span class="text-[9px] font-black text-red-500 uppercase tracking-tighter">No Credentials Set : READ ONLY MODE</span>
              </div>
          {/if}
          <!-- Security Settings Entry -->
          <button
            onclick={() => uiResponse.openSecuritySettings()}
            class="bg-[#0a122a] border border-[#2a3b70] px-3 py-2 rounded-xl hover:border-emerald-500 transition-all group"
          >
              <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 {securityColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span class="text-white font-bold text-xs uppercase">Manage Devices</span>
              </div>
          </button>
      </div>

      <div class="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] mt-2">
        <span class="text-slate-500">ID:</span>
        <span class="text-white">{ uiResponse.intentIDConfirm?.user_id }</span>
        <span class="text-slate-500">| </span>
        <span class="text-slate-500">User Name:</span>
        <span class="text-emerald-500">{ users.userName }</span>
      </div>
    </div>

    <div class="flex-1 max-w-md w-full">
      <div class="relative group">
        <div class="absolute -top-5 left-0 flex items-center gap-2">
          <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Set User Name</span>
          {#if users.showNameUpdateSuccess}
            <span class="text-[9px] text-emerald-400 font-black uppercase tracking-widest animate-bounce">
              ✓ IDENTITY UPDATED
            </span>
          {/if}
        </div>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <input
              type="text"
              bind:value={users.inputUserName}
              disabled={users.isUserNameUpdating}
              placeholder="ASSIGN USER NAME..."
              class="w-full bg-[#0a122a] border rounded-xl py-4 px-5 text-white font-black text-xs md:text-sm uppercase tracking-widest transition-all duration-500
                {users.showNameUpdateSuccess ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-[#2a3b70]'}
                {users.isUserNameUpdating ? 'opacity-50 cursor-wait' : ''}"
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-500/30 font-mono uppercase">
              { users.userName }
            </div>
          </div>
          <button
            onclick={() => users.updateUserName()}
            disabled={users.inputUserName.length == 0 || users.isUserNameUpdating}
            class="px-6 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95
                    {users.isUserNameUpdating ? 'bg-slate-800 text-slate-600' : 'bg-[#00EF8B] text-black hover:brightness-110'}"
          >
            Update
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div>
        <p class="text-slate-400 text-xs mb-2 text-center">
            <i class="fas fa-hourglass"></i>Session: {remainingMinutes} MIN ACTIVE
        </p>
        <p>
          <a 
            href={flowscanUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            class="group/link flex items-center gap-2 px-3 py-1 rounded-md bg-white/5 border border-white/10 transition-all hover:bg-white/10 hover:border-[#00ffcc]/30"
          >
          {#if flowAddr}
            <span class="text-[10px] font-mono tracking-tighter text-white/80">
                {windowWidth >= 768 ? 'Addr: ' : ''}{flowAddr.slice(0, 6)}...{flowAddr.slice(-4)}
            </span>
            <svg class="w-2.5 h-2.5 text-white/20 group-hover/link:text-[#00ffcc] transition-all transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          {/if}
          </a>
        </p>
      </div>
      <div class="bg-[#0a122a] border border-[#2a3b70] px-6 py-3 rounded-xl min-w-[180px] relative overflow-hidden group">
        <div class="text-[9px] text-[#FFDD00] uppercase font-black tracking-[0.2em] mb-1 flex justify-between">
          <span>Vault Balance</span>
        </div>
        <div class="flex items-baseline justify-end gap-1">
          <span class="text-white font-black text-2xl tracking-tighter">{windowWidth >= 768 ? uiFlowInfo.balance : parseFloat(uiFlowInfo.balance).toFixed(3) }</span>
          <span class="text-[#FFDD00] text-[10px] font-bold">FLOW</span>
        </div>
      </div>
    </div>
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
    <div class="lg:col-span-1 space-y-8">
      <div class="-panel p-7 rounded-lg border-l-4 border-l-emerald-500 !overflow-visible">
        <h3 class="text-xl font-black mb-5 flex items-center text-white italic">
          <i class="fas fa-satellite mr-3 text-[#FFDD00]"></i> LIMITED TRANSMISSION
        </h3>
        <p class="text-xs text-slate-400 mb-7 leading-relaxed font-mono">
          Regional Protocol: Fixed template transfers required.
        </p>

        <div class="grid grid-cols-2 gap-5 mb-7">
          <button
              onclick={() => selectedAmount = 1}
              class="py-5 rounded-xl transition-all group border-2
              {selectedAmount === 1
                ? 'bg-emerald-500/20 border-[#FFDD00] shadow-[0_0_15px_rgba(255,221,0,0.2)]'
                : 'bg-[#060810] border-[#2a3b70] hover:bg-emerald-500/20 hover:border-[#FFDD00]'}"
            >
              <span class="block text-3xl font-black
                {selectedAmount === 1 ? 'text-[#FFDD00]' : 'text-white group-hover:text-[#FFDD00]'}">
                1
              </span>
              <span class="text-[11px] uppercase font-bold
                {selectedAmount === 1 ? 'text-emerald-500' : 'text-[#2a3b70] group-hover:text-emerald-500'}">
                FLOW [FIX]
              </span>
            </button>

            <button
              onclick={() => selectedAmount = 10}
              class="py-5 rounded-xl transition-all group border-2
              {selectedAmount === 10
                ? 'bg-emerald-500/20 border-[#FFDD00] shadow-[0_0_15px_rgba(255,221,0,0.2)]'
                : 'bg-[#060810] border-[#2a3b70] hover:bg-emerald-500/20 hover:border-[#FFDD00]'}"
            >
              <span class="block text-3xl font-black
                {selectedAmount === 10 ? 'text-[#FFDD00]' : 'text-white group-hover:text-[#FFDD00]'}">
                10
              </span>
              <span class="text-[11px] uppercase font-bold
                {selectedAmount === 10 ? 'text-emerald-500' : 'text-[#2a3b70] group-hover:text-emerald-500'}">
                10 FLOW [FIX]
              </span>
            </button>
        </div>
        <div class="relative">
          <input
            type="text"
            bind:value={destination}
            onfocus={() => isPickerOpen = true}
            placeholder="0B... OR SELECT MEMBER"
            class="w-full bg-[#060810] border-2 {isPickerOpen ? 'border-emerald-500' : 'border-[#2a3b70]'} rounded-lg p-4 text-sm mb-5 focus:border-[#FFDD00] outline-none font-mono text-white transition-all"
          />
          {#if isPickerOpen}
            <div class="absolute z-20 top-[60px] left-0 w-full bg-[#0a0f1e] border-2 border-emerald-500/50 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
              {#if uiResponse.intentIDConfirm?.party_members.length && uiResponse.intentIDConfirm?.party_members.length > 0}
                <div class="p-2 bg-[#00EF8B]/10 border-b border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                    // Authorized_Party_Members
                </div>
                
                {#each uiResponse.intentIDConfirm.party_members as member}
                  <button 
                    onclick={() => selectTarget(member)}
                    class="w-full flex items-center justify-between p-3 hover:bg-emerald-500/10 border-b border-white/5 last:border-0 transition-colors group"
                  >
                    <div class="flex flex-col text-left">
                      <span class="text-xs font-black text-white group-hover:text-emerald-400">
                        {member.user_name || 'UNKNOWN'}
                      </span>
                      <span class="text-[9px] font-mono text-slate-500 tracking-tighter">
                        {member.user_id}
                      </span>
                    </div>
                    <i class="fas fa-chevron-right text-[10px] text-slate-700 group-hover:text-emerald-500"></i>
                  </button>
                {/each}
              {:else}
                <div class="p-5 text-center bg-[#0a0f1e]">
                  <p class="text-[10px] font-mono text-slate-500 leading-relaxed uppercase">
                    // No Data Detected<br/>
                    <span class="text-emerald-500/80">{uiI18n.s.addPartyMemberForConvenience}</span>
                  </p>
                </div>
              {/if}
            </div>
            <button
              class="fixed inset-0 z-10 bg-transparent cursor-default"
              onclick={() => isPickerOpen = false}
            ></button>
          {/if}
        </div>
        <button
          onclick={() => {
            openAuthz(selectedAmount === 1 ? 'b405c2ee81cac92107129dff5a18fb5282341fbeaec26b63cfc65ef38f9820df' : '602e6f9383fac142a55441260ef13276900ad836b8803e75acac4e1a29a739ae');
          }}
          disabled={!selectedAmount || !destination || destination.length != 11}
          class="relative w-full py-4 font-black rounded-lg transition-all overflow-hidden -action-gradient active:scale-95 hover:shadow-[0_0_15px_rgba(255,153,0,0.4)]
          {isProcessingTransmission || !selectedAmount || !destination || destination.length != 11
              ? 'cursor-not-allowed opacity-50'
              : ''}">
            {#if isProcessingTransmission}
                <div class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-3 w-3 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                </div>
            {:else}
                <span>Execute FLIX Template</span>
            {/if}
        </button>
      </div>

      <div class="-panel p-7 rounded-lg border-l-4 border-l-orange-500 bg-[#0a0f1e]/80">
          <h3 class="flex justify-between text-xl font-black mb-5 flex items-center text-white italic">
              <span style="min-width: 245px;"><i class="fas fa-list-ul mr-2 text-orange-500 text-sm"></i> TRANSMISSION LOG</span>
              <span class="text-[8px] font-mono text-slate-400 uppercase tracking-tighter">
                  *250 BLOCK WINDOW
              </span>
          </h3>
          <!-- SCROLL CONTAINER -->
          <div class="space-y-3 max-h-[320px] overflow-y-auto pr-2 
            scrollbar-thin scrollbar-thumb-orange-500/20 scrollbar-track-transparent">
              {#each uiFlowInfo.recentTransactions as tx (tx.id)}
                  {#if tx.delta !== null && Math.abs(parseFloat(tx.delta)) > 0.0001}
                    <div
                        // animate:flip={{ duration: 400 }}
                        in:slide={{ duration: 300 }}
                        class="group p-3 bg-[#060810] border border-[#2a3b70] rounded hover:border-emerald-500 transition-all"
                    >
                        <a href="https://{uiResponse.intentIDConfirm?.network === 'testnet' ? 'testnet.' : ''}flowscan.io/tx/{tx.id}" 
                          target="_blank" 
                          class="flex items-center justify-between"
                        >
                            <!-- Left Section: Activity Dot & ID -->
                            <div class="flex items-center gap-3">
                                <!-- Sealed dot remains as a status indicator without text -->
                                <div class="w-2 h-2 rounded-full {tx.status === 'SEALING' ? 'bg-orange-500 animate-ping' : 'bg-emerald-500'}"></div>
                                <div class="flex flex-col">
                                    <span class="text-xs font-mono text-white leading-none">
                                        {tx.id.slice(0, 10)}...{tx.id.slice(-4)}
                                    </span>
                                    {#if tx.time}
                                        <span class="text-[8px] text-[#2a3b70] font-mono mt-1 uppercase tracking-tighter">
                                            PROCESSED_AT_{new Date(tx.time).toLocaleTimeString()}
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Right Section: The Delta Movement -->
                            <div class="flex items-center gap-4">
                                <span class="text-[11px] font-black font-mono {parseFloat(tx.delta) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
                                    {parseFloat(tx.delta) >= 0 ? '↗︎' : '↘︎'} 
                                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(Math.abs(parseFloat(tx.delta)))}
                                </span>
                            </div>
                        </a>
                    </div>
                  {/if}
              {/each}

              {#if uiFlowInfo.recentTransactions.length === 0}
                  <div class="py-10 text-center opacity-20 italic text-xs font-mono tracking-widest">
                      NO RECENT TRANSMISSIONS DETECTED
                  </div>
              {/if}
          </div>
      </div>
      <div class="-panel p-7 rounded-lg">
        <h3 class="text-xl font-black mb-5 flex items-center text-white italic">
          <i class="fas fa-users mr-3 text-blue-400 text-sm"></i> Party Members
        </h3>
        <div class="space-y-5">
          {#each uiResponse.intentIDConfirm?.party_members as party}
            {@const cleanPartyId = users.getCleanUserID(party.user_id)}
            <!-- We check if there is an invite specifically from this user -->
            {@const incomingInvite = webRPC.roomInvites[cleanPartyId]}

            <div class="flex items-center justify-between p-4 bg-[#060810] rounded border-2 border-[#2a3b70]">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                  {party.user_name[0]}
                </div>
                <div class="flex flex-col text-left">
                  <span class="text-sm font-black uppercase text-white">{party.user_name}</span>
                  <span class="text-[10px] font-mono text-slate-600">{party.user_id}</span>
                </div>
              </div>

              {#if webRPC.currentRoomId === cleanPartyId || (webRPC.currentRoomId && incomingInvite === webRPC.currentRoomId)}
                <!-- STATE: ACTIVE LINK (CLOSE BUTTON) -->
                <!-- This shows if I am hosting a room (cleanPartyId matches currentRoomId) 
                    OR if I joined their room -->
                <button
                  onclick={() => webRPC.close()}
                  class="relative flex items-center gap-2 text-[11px] bg-red-500/10 text-red-400 px-4 py-1.5 rounded uppercase font-black border border-red-500/50 hover:bg-red-500 hover:text-white transition-all group"
                >
                  <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span>Close Call</span>
                </button>

              {:else if incomingInvite}
                <!-- STATE: INCOMING INVITE (JOIN BUTTON) -->
                <button
                  onclick={() => {
                    if (webRPC.currentRoomId) webRPC.close();
                    webRPC.startChat(incomingInvite.toString());
                  }}
                  class="relative text-[11px] bg-emerald-500 text-black px-3 py-1.5 rounded font-black animate-pulse shadow-[0_0_10px_#10b981]"
                >
                  JOIN {incomingInvite}
                </button>

              {:else if uiFlowInfo.active_party_members.includes(cleanPartyId)}
                <!-- STATE: ONLINE (CONNECT BUTTON) -->
                <button
                  onclick={() => {
                    const myUID = users.getCleanUserID(uiResponse.intentIDConfirm?.user_id!);
                    webRPC.send({
                      type: "ROOM_INVITE",
                      target: cleanPartyId,
                      roomId: myUID,
                      from: myUID
                    });
                    webRPC.startChat(myUID);
                  }}
                  class="relative overflow-hidden text-[11px] bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 rounded uppercase font-black text-white group"
                >
                  <div class="flex items-center gap-1.5 relative z-10">
                    <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span>Connect</span>
                  </div>
                </button>
              {:else}
                <button class="text-[11px] bg-[#2a3b70] px-3 py-1.5 rounded uppercase font-bold opacity-50 cursor-not-allowed">
                  Offline
                </button>
              {/if}
            </div>
          {/each}
          <!-- <div
            class="flex items-center justify-between p-4 bg-[#060810] rounded border-2 border-[#2a3b70] opacity-50"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30"
              >
                M
              </div>
              <span class="text-sm font-black uppercase text-slate-400"
                >Mage_Class_A</span
              >
            </div>
            <span
              class="text-[11px] uppercase text-slate-600 font-bold italic font-mono"
              >[OFFLINE]</span
            >
          </div> -->
          <button
            onclick={() => memberSearch.toggle()}
            class="w-full mt-4 text-xs text-emerald-500 border border-emerald-500/20 py-2 rounded-lg hover:bg-emerald-500/10 transition-all"
          >
            + Add Party Member
          </button>
          <SearchPopup />
          {#if users.showAddUserSuccess}
              <div
                  transition:fade
                  class="fixed bottom-10 right-10 z-[100] bg-[#00EF8B] text-black px-6 py-4 rounded-2xl font-black uppercase italic tracking-tighter shadow-[0_0_30px_rgba(0,239,139,0.3)] flex items-center gap-3"
              >
                  <i class="fas fa-user-check"></i>
                  Party Member Linked Successfully
              </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="lg:col-span-2 space-y-8">
      <div class="-panel p-8 rounded-lg">
        <div class="flex justify-between items-center mb-8 border-b-2 border-[#2a3b70] pb-5">
          <h3 class="text-2xl font-black italic tracking-tighter uppercase text-white">
            Network-Synced Resources
          </h3>
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">
              Status: {uiFlowInfo.isSyncing ? 'Scanning...' : 'Synced'}
            </span>
            <button 
              onclick={() => uiFlowInfo.sync(flowAddr!, false)}
              class="text-[#2a3b70] hover:text-[#FFDD00] transition-colors {uiFlowInfo.isSyncing ? 'animate-spin' : ''}"
              title="Sync Flow Resources"
            >
              <i class="fas fa-sync-alt text-sm"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {#if uiFlowInfo.resources && uiFlowInfo.resources.length > 0}
            {#each uiFlowInfo.resources as item}
              <div
                class="bg-[#060810] border-2 border-[#2a3b70] p-5 rounded hover:border-emerald-500 transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(255,153,0,0.2)]"
              >
                <div
                  class="aspect-[3/4] bg-[#0a0f1e] rounded-sm mb-4 flex items-center justify-center border border-[#2a3b70] overflow-hidden group-hover:bg-[#060810]"
                >
                  {#if item.thumbnail}
                    <img 
                      src={item.thumbnail} 
                      alt={item.name} 
                      class="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  {:else}
                    <i class="fas fa-cube text-slate-700 text-4xl"></i>
                  {/if}
                </div>
                <div
                  class="text-[11px] font-black uppercase text-white truncate font-mono mb-1"
                >
                  {item.name || 'UNKNOWN_RESOURCE'}
                </div>
                <div
                  class="text-[9px] text-[#2a3b70] font-bold group-hover:text-[#FFDD00] uppercase tracking-tighter"
                >
                  <div class="text-[9px] text-[#2a3b70] font-bold group-hover:text-[#FFDD00] uppercase tracking-tighter">
                    {#if item.id}
                      REF_ID: 0x{item.id.toString(16).toUpperCase()}
                    {:else}
                      REF_ID: UNKNOWN
                    {/if}
                    | {item.remaining === -1 ? 'INFINITE' : 'QTY: ' + item.remaining}
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <div class="col-span-full py-10 text-center opacity-30 font-mono text-[10px]">
                NO_RESOURCES_DETECTED
            </div>
          {/if}
        </div>
      </div>

      <div class="-panel p-10 rounded-lg">
        <div
          class="absolute top-2 right-2 text-[#2a3b70] font-mono text-[9px]"
        >
          > [OPERATIONS_TYPE: CAPABILITY]
        </div>
        <h3 class="text-2xl font-black mb-3 italic uppercase text-white">
          Delegate Resource Capability
        </h3>
        <p class="text-xs text-slate-400 mb-8 leading-relaxed font-mono">
          // Execute off-chain 'borrowing' logic for Fighter_Class members.
        </p>

        <div class="flex flex-col md:flex-row items-center gap-8">
          <div
            class="flex-1 w-full p-5 bg-[#060810] rounded border-2 border-[#2a3b70] text-center"
          >
            <div
              class="text-[11px] uppercase text-[#2a3b70] font-bold mb-3 font-mono"
            >
              Source_Agent
            </div>
            <div class="text-base font-black uppercase text-white">
              Magician_Account
            </div>
          </div>
          <i
            class="fas fa-exchange-alt text-emerald-500 text-2xl animate-pulse hidden md:block"
          ></i>
          <div
            class="flex-1 w-full p-5 bg-[#060810] rounded border-2 border-[#2a3b70] text-center"
          >
            <div
              class="text-[11px] uppercase text-[#2a3b70] font-bold mb-3 font-mono"
            >
              Target_Party_Member
            </div>
            <div
              class="text-base font-black uppercase text-blue-400 underline decoration-dotted"
            >
              Fighter_Zero
            </div>
          </div>
        </div>

        <button
          class="w-full mt-10 py-5 -action-gradient font-black rounded-lg shadow-lg hover:shadow-[0_5px_20px_rgba(255,153,0,0.5)]"
        >
          CONFIRM OPERATION: DELEGATE CAPABILITY
        </button>
      </div>

      <!-- Web-RPC Real-time Communication Bridge -->
      <div class="-panel p-8 rounded-lg mt-8 border-t-4 border-t-emerald-500/30">
        <div class="absolute top-2 right-2 text-[#2a3b70] font-mono text-[9px]">
          > [SYSTEM_MODE: RPC_COMM_STREAM]
        </div>
        
        <div class="flex items-center gap-3 mb-6">
          <div class="node-status !bg-emerald-500 animate-pulse"></div>
          <h3 class="text-xl font-black italic uppercase text-white tracking-tighter">
            Web-RPC Messenger
          </h3>
          <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-mono rounded border border-emerald-500/20">
            PENDING
          </span>
        </div>

        <!-- Chat Log / RPC Stream -->
        <div class="bg-[#060810] border-2 border-[#2a3b70] rounded-lg h-48 mb-5 overflow-y-hidden relative group">
          <div class="absolute inset-0 bg-gradient-to-t from-[#060810] to-transparent pointer-events-none z-10"></div>
          
          <div class="p-4 font-mono text-[11px] space-y-3 opacity-60 group-hover:opacity-100 transition-opacity">
            {#each webRPC.messages as msg}
            <div class="flex gap-2">
              <span class="text-[#2a3b70]">[15:24:01]</span>
              <span class="text-emerald-500">{msg.from}:</span>
              <span class="text-slate-400">{msg.text}</span>
            </div>
            {/each}
            <!--
            <div class="flex gap-2">
              <span class="text-[#2a3b70]">[15:24:01]</span>
              <span class="text-emerald-500">SYS:</span>
              <span class="text-slate-400">Initializing Janus TextRoom handle...</span>
            </div>
            <div class="flex gap-2">
              <span class="text-[#2a3b70]">[15:24:03]</span>
              <span class="text-blue-400">MAGI_1:</span>
              <span class="text-white">Requesting permission to borrow Fire Sword capabilities.</span>
            </div>
            <div class="flex gap-2">
              <span class="text-[#2a3b70]">[15:24:05]</span>
              <span class="text-emerald-500">RPC:</span>
              <span class="text-emerald-400">Handshake established. Peer: 0x6a9...9ad</span>
            </div>
            <div class="flex gap-2 animate-pulse">
              <span class="text-[#2a3b70]">[15:24:08]</span>
              <span class="text-orange-500">>>></span>
              <span class="text-orange-400">Awaiting user input for RPC broadcast...</span>
            </div>
            -->
          </div>
        </div>

        <!-- Input Field -->
        <div class="relative">
          <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span class="{webRPC.currentRoomId ? 'text-emerald-500' : 'text-red-500'} font-mono text-xs">></span>
          </div>
          
          <input 
            bind:value={userInputMessage} 
            onkeydown={(e) => e.key === 'Enter' && userHandleSend()}
            type="text" 
            placeholder={webRPC.currentRoomId ? "BROADCASTING TO " + webRPC.currentRoomId + "..." : "TERMINAL_OFFLINE: CONNECT TO PARTY"}
            class="w-full bg-[#0a0f1e] border-2 {webRPC.currentRoomId ? 'border-emerald-500/50' : 'border-[#2a3b70]'} rounded-lg py-4 pl-10 pr-4 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none transition-all"
            disabled={!webRPC.currentRoomId}
          />

          <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <!-- LINK STATUS INDICATOR -->
            <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/40 border border-[#2a3b70]">
                <span class="w-1.5 h-1.5 rounded-full {webRPC.currentRoomId ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}"></span>
                <span class="text-[9px] font-mono {webRPC.currentRoomId ? 'text-emerald-400' : 'text-red-400'}">
                    {webRPC.currentRoomId ? 'STABLE_LINK' : 'NO_ACTIVE_LINK'}
                </span>
            </div>
            <i class="fas fa-signal {webRPC.currentRoomId ? 'text-emerald-500' : 'text-[#2a3b70]'} text-[10px]"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
{#if showAuthz}
<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
  <div class="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden border-2 border-[#2a3b70] shadow-[0_0_80px_rgba(0,0,0,0.8)] z-50 animate-in zoom-in duration-300">
    <iframe
        bind:this={authzFrame}
        src="/authz?_intent_id={intentId}"
        allow="publickey-credentials-get; publickey-credentials-create"
        class="w-full h-full border-none"
        title="Authorization HUD"
    ></iframe>
  </div>
</div>
{/if}
<!-- THE OVERLAY LAYER -->
{#if uiResponse.showSecuritySettings}
    <SecurityTerminal />
{/if}
<style>
  .progress-track { width: 100%; height: 8px; background: #f1f5f9; border-radius: 10px; box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1); margin: 30px 0 10px 0; overflow: hidden; position: relative; }
  .progress-fill {  height: 100%; width: 0%; background: linear-gradient(90deg, darkblue, #00ffcc); box-shadow: 0 0 12px rgba(0, 255, 204, 0.4); transition: width 0.8s cubic-bezier(0.65, 0, 0.35, 1); }
  .sync-active { animation: sync-pulse 1.5s infinite ease-in-out; }
  @keyframes sync-pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
  button { cursor: pointer; }
  .background-transition { position: fixed; inset: 0; background: #fff; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: opacity 1.0s ease-out; }
  .data-stream-bg {
    background-color: #060810;
    background-image:
      linear-gradient(rgba(24, 30, 56, 0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(24, 30, 56, 0.4) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position: center;
  }
  .data-stream-bg::after { content: ""; position: fixed; inset: 0; background: linear-gradient(rgba(10, 15, 30, 0) 50%, rgba(0, 0, 0, 0.1) 50%); background-size: 100% 4px; pointer-events: none; opacity: 0.2; z-index: -1; }
  .glass-panel { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
  .locked { filter: blur(25px); pointer-events: none; opacity: 0.3; }
  .auth-overlay { transition: all 0.5s ease; }
  .flow-gradient { background: linear-gradient(135deg, #00ef8b 0%, #01af66 100%); }
  .sentinel-glow { box-shadow: 0 0 15px rgba(0, 239, 139, 0.4); }
  .-panel { background: rgba(10, 15, 30, 0.7); border: 2px solid #2a3b70; box-shadow: 0 0 15px rgba(42, 59, 112, 0.3); position: relative; overflow: hidden; }
  .-panel::before { content: ""; position: absolute; top: 0; right: 0; width: 30px; height: 30px; background: linear-gradient( 135deg, transparent 50%, #01af66 50% ); }
  .main-content {
    transition:
      filter 1s ease,
      opacity 1s ease,
      transform 1s ease;
  }
  .locked { filter: blur(20px); opacity: 0.1; transform: scale(0.98); pointer-events: none; }
  .unlocked { filter: blur(0); opacity: 1; transform: scale(1); }
  .auth-overlay { transition: all 0.6s ease; }
  .-action-gradient { background: linear-gradient( 135deg, #ffdd00 0%, #01af66 50%, #ff6600 100% ); color: #000; }
  .hidden { display: none; }
  @keyframes dataStream {
    0% {
      background-position: 0% 0%;
    }
    100% {
      background-position: 0% 100%;
    }
  }
  .data-stream-bg { animation: dataStream 60s linear infinite; }
  .node-status { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 10px; box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); }
  .decryption-overlay { position: fixed; inset: 0; background: #050505; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: opacity 0.8s ease-out; }
  .decrypt-bar-container { width: 280px; height: 2px; background: rgba(0, 255, 204, 0.1); position: relative; overflow: hidden; margin-top: 20px; }
  .decrypt-bar-progress { position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: #00ffcc; box-shadow: 0 0 15px #00ffcc; }
  .status-text { font-family: 'JetBrains Mono', monospace; font-variant-ligatures: none; font-feature-settings: "liga" 0; font-size: 10px; color: #00ffcc; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 10px; }
  .glitch-text { animation: text-pulse 0.1s infinite alternate; }
  @keyframes text-pulse {
      from { opacity: 0.8; }
      to { opacity: 1; text-shadow: 0 0 8px #00ffcc; }
  }
  .fade-out { opacity: 0; pointer-events: none; }
  @keyframes shimmer {
    100% { transform: translateX(100%); }
  }
</style>