import { uiResponse } from './uiResponse.svelte';

export class Users {
    userName = $state<string>('');
    inputUserName = $state<string>('');
    isUserNameUpdating = $state<boolean>(false);
    showNameUpdateSuccess = $state<boolean>(false);
    showAddUserSuccess = $state<boolean>(false);
    isAddUserProcessing = $state(false);
    isCheckingCredentials = $state<boolean>(false);
    hasPasskey = $state<boolean>(false);
    credentials = $state<string[]>([]);
    credentialObj = $state<any[]>([]);

    setUserName(name: string) {
        this.userName = name;
    }

    async updateUserName() {
        if (this.inputUserName.length == 0 || this.isUserNameUpdating) return;

        this.isUserNameUpdating = true;

        try {
            const response = await fetch('/api/users/update_user_name', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
                },
                body: JSON.stringify({
                    network: uiResponse.intentIDConfirm?.network,
                    flow_address: uiResponse.intentIDConfirm?.flow_address,
                    user_name: this.inputUserName,
                })
            });
            if (response.ok) {
                this.userName = this.inputUserName
                this.showNameUpdateSuccess = true;
                setTimeout(() => {
                    this.showNameUpdateSuccess = false;
                }, 3000);
            }
        } catch (error) {
            console.error(error);
        } finally {
            this.isUserNameUpdating = false;
        }
    }

    async addUserToParty(targetUserId: string) {
        if (this.isAddUserProcessing) return;
        this.isAddUserProcessing = true;

        try {
            const response = await fetch('/api/users/add_to_party', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
                },
                body: JSON.stringify({
                    member_user_id: targetUserId,
                    leader_user_id: uiResponse.intentIDConfirm?.user_id,
                })
            });
            if (response.ok) {
                this.showAddUserSuccess = true;
                setTimeout(() => {
                    this.showAddUserSuccess = false;
                }, 4000);
                const data = await response.json();
                uiResponse.setNewPartyMembers(data.party_members);
                return true;
            }
        } catch (error) {
            console.error(error);
        } finally {
            this.isAddUserProcessing = false;
        }
        return false;
    }

    async requestManualSignFlow1(destination: string) {
        const response = await fetch('/api/signer/test-tx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
        },
        body: JSON.stringify({
            network: uiResponse.intentIDConfirm?.network,
            destination: destination,
            payload: "",
        })
        });
        if (response.ok) {
        const res = await response.json();
        }
    }

    async requestManualSignFlow10(destination: string) {
        const response = await fetch('/api/signer/test-tx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
        },
        body: JSON.stringify({
            network: uiResponse.intentIDConfirm?.network,
            destination: destination,
            payload: "",
        })
        });
        if (response.ok) {
        const res = await response.json();
        }
    }

    async getUserAddress(userId: string): Promise<string> {
        let address = '';
        try {
            const response = await fetch(`/api/users/get_address?target=${userId}`, {
                headers: {
                    'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                address = data.address;
            }
        } catch (e) {
            console.error("Get addr failed", e);
        } finally {
            return address
        }
    }

    /**
     * Checks the Go backend to see if the user has
     * registered any Passkey credentials.
     */
    async checkCredentialStatus(token: string | undefined) {
        this.isCheckingCredentials = true;
        try {
            // This endpoint will check the passkey_credentials JSONB in Supabase
            const response = await fetch('/api/users/credentials', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            // If the array is not empty, security is active
            this.hasPasskey = data.has_passkey;
            this.credentials = data.credentials;
            this.credentialObj = data.credential_obj;
        } catch (error) {
            console.error("Security Status Check Failed:", error);
            this.hasPasskey = false;
        } finally {
            this.isCheckingCredentials = false;
        }
    }

    /**
     * Formats and sends the WebAuthn credential to the Go backend
     */
    saveCredentialToBackend = async (credential: any) => {
        // 1. We must convert ArrayBuffers to Base64 strings
        // Credential ID is usually in credential.rawId
        const rawId = new Uint8Array(credential.rawId);
        const credentialIdBase64 = btoa(String.fromCharCode(...rawId));

        // 2. Extract the Public Key (this varies slightly by browser,
        // but typically it's in the response.getPublicKey() or attestationObject)
        // For simplicity in this flow, we take the raw response
        const response = credential.response;
        const clientDataJSON = btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON)));

        // Note: For a "Sony-grade" production app, you'd parse the attestationObject here.
        // For now, we'll send the ID and a placeholder or the raw public key if available.
        const publicKey = response.getPublicKey ?
            btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey()))) :
            "hardware-backed-key";

        const payload = {
            credential_id: credentialIdBase64,
            public_key: publicKey,
            client_data: clientDataJSON
        };

        const res = await fetch('/api/users/register/credential', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to save credential");
    }

    /**
     * Refined registration flow
     */
    registerNewPasskey = async() => {
        try {
            // Get Challenge
            const challengeRes = await fetch(`/api/users/register/challenge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${uiResponse.intentIDConfirm?.token}`
                },
            });
            const { challenge, user_id } = await challengeRes.json();
            // Create Credential
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: Uint8Array.from(atob(challenge), (c: string) => c.charCodeAt(0)),
                    rp: {
                        name: "Blsqui Protocol",
                        id: window.location.hostname // The domain must match
                    },
                    user: {
                        id: Uint8Array.from(user_id, (c: string) => c.charCodeAt(0)),
                        name: this.userName || uiResponse.intentIDConfirm?.user_id!,
                        displayName: this.userName || uiResponse.intentIDConfirm?.user_id!
                    },
                    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                    authenticatorSelection: { userVerification: "required" },
                    timeout: 60000
                }
            });

            // Save to Backend
            await this.saveCredentialToBackend(credential);
            // Refresh local state
            await this.checkCredentialStatus(uiResponse.intentIDConfirm?.token);
            uiResponse.closeSecuritySettings();
        } catch (err) {
            console.error("Passkey Registration Failed", err);
        }
    }

    getCleanUserID(fullUserId: string): string {
        if (fullUserId.length <= 4) {
            return fullUserId;
        }
        return fullUserId.substring(4);
    }
}

export const users = new Users();