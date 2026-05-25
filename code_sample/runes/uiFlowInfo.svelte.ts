import * as fcl from '@onflow/fcl';
import getResourcesScript from '../../../flow_blockchain/cadence/scripts/get_all_resources.cdc?raw';
import { uiResponse } from './uiResponse.svelte';
import { users } from './users.svelte';

class UIFlowInfo {
    balance = $state<string>("0.00");
    recentTransactions = $state<{id: string, status: string, time: number, delta: string}[]>([]);
    isSyncing = $state(false);
    timingSyncing = $state(false);
    resources = $state<any[]>([]);
    active_party_members = $state<any[]>([]);

    initialize(network: string) {
        if (network === 'mainnet') {
            fcl.config({
                "discovery.wallet": "https://wallet.blsqui.net/authn",
                "accessNode.api": "https://rest-mainnet.onflow.org",
                "flow.network": "mainnet",
                "app.detail.title": "Blsqui eSports Platform",
                "app.detail.icon": "https://blsqui.net/assets/favicon.png",
            });
        } else {
            fcl.config({
                "discovery.wallet": "https://lab.blsqui.net/authn",
                "accessNode.api": "https://rest-testnet.onflow.org",
                "flow.network": "testnet",
                "app.detail.title": "Blsqui eSports Platform",
                "app.detail.icon": "https://blsqui.net/assets/favicon.png",
            });
        }
    }

    // Main Sync Logic
    async sync(address: string, balanceOnly: boolean) {
        if (!address || this.isSyncing) return;
        this.isSyncing = true;

        try {
            // Get Balance (Fast)
            const account = await fcl.send([fcl.getAccount(address)]).then(fcl.decode);
            this.balance = (account.balance / 100000000).toString(); // Convert uFLOW to FLOW
            // Get possess Resources
            await this.syncPossessResources(address);

            // Get Recent Transactions (via FlowScan/Indexer API)
            this.timingSyncing = !this.timingSyncing;
            if (this.timingSyncing && !balanceOnly) {
                const txHistory = await this.fetchHistoryFromIndexer(address);
                // Merge logic: keep local "SEALING" txs until they appear in history
                this.mergeTransactions(txHistory, address);
            }
        } catch (err) {
            console.error("Failed to sync Flow info:", err);
        } finally {
            this.isSyncing = false;
        }
    }

    private mergeTransactions(history: any[], address: string) {
        const historyIds = new Set(history.map(tx => tx.id));
        
        // Keep ALL local transactions
        const localPending = this.recentTransactions.filter(tx => !historyIds.has(tx.id));

        // Create a map of existing transactions to avoid duplicates
        const existingIds = new Set();
        const combined = [...localPending, ...history];

        // Final filter to ensure absolute uniqueness and sort by time
        this.recentTransactions = combined
            .filter(tx => {
                if (existingIds.has(tx.id)) return false;
                existingIds.add(tx.id);
                return true;
            })
            .sort((a, b) => b.time - a.time)
            .slice(0, 50);

        this.recentTransactions.forEach(tx => {
            this.fetchDelta(tx.id, address).then(value => {
                console.log(value, 77777)
                // Find by ID and update the reactive property
                const target = this.recentTransactions.find(t => t.id === tx.id);
                if (target) {
                    target.delta = value;
                    console.log(`Updated ${tx.id} with delta: ${value}`);
                }
            });
        });
    }

    async fetchDelta(txId: string, syncAddress: string) {
        try {
            const txStatus = await fcl.tx(txId).snapshot();
            // 1. Look for both Deposit and Withdraw events
            const deposit = txStatus.events.find((e: any) => 
                e.type.includes("TokensDeposited") && e.data.to === syncAddress
            );
            const withdraw = txStatus.events.find((e: any) => 
                e.type.includes("TokensWithdrawn") && e.data.from === syncAddress
            );
            
            // 2. Logic: If it's a withdrawal, make it negative.
            // If both exist (like a transfer), we show the "net" change for the account.
            if (withdraw) {
                return `-${withdraw.data.amount}`; 
            } else if (deposit) {
                return deposit.data.amount.toString();
            }
        } catch {
            return "0.00";
        }
        return "0.00";
    }

    private async fetchHistoryFromIndexer(address: string) {
        const network = await fcl.config().get("flow.network");
        try {
            const response = await fetch(`/api/flix/tx_history?address=${address}&network=${network}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
                },
                body: JSON.stringify({
                    party_members: uiResponse.intentIDConfirm?.party_members.map(d => users.getCleanUserID(d.user_id)) || []
                })
            });
            const data = await response.json();
            this.active_party_members = data.active_party_members;
            
            // The Go backend returns the array directly. 
            // If it's not an array, default to empty.
            if (!Array.isArray(data.tx_list)) return [];

            return data.tx_list.map((tx: any) => ({
                id: tx.id,
                status: tx.status,
                // The Go backend sends a Unix timestamp (seconds), 
                // JS needs milliseconds.
                time: tx.time * 1000
            }));
        } catch (e) {
            console.warn("🔍 Sync Failed:", e);
            return [];
        }
    }

    private async syncPossessResources(address: string) {
        const network = await fcl.config().get("flow.network");
        const terminalAddress = network === 'testnet' ? '0xc8a193c62e32c45b' : '0xba1d02c78c0e9506'; 
        const cadenceScript = getResourcesScript.replace(
            'import "BlsquiTerminal"', 
            `import BlsquiTerminal from ${terminalAddress}`
        );
        try {
            const result = await fcl.query({
                cadence: cadenceScript,
                args: (arg: any, t: any) => [arg(address, t.Address)],
            });
            this.resources = result;
        } catch (e) {
            console.error("Sync Failed", e);
        }
    }

}

export const uiFlowInfo = new UIFlowInfo();