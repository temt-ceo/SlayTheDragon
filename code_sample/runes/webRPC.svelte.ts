export class WebRPC {
    private socket: WebSocket | null = null;
    status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
    timestamp = $state<string>('');
    lastEvent = $state<any>(null);
    partyMemberCallers = $state<string[]>([]);
    roomInvites = $state<Record<string, string>>({});
    currentRoomId: string | null = null;
    activeOnRoom = $state(false);
    activeMembers = $state<string[]>([]);
    messages = $state<any[]>([]);

    connect(userID: string) {
        if (this.socket) return;
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${protocol}://${window.location.host}/api/users/ws?user_id=${userID}`;

        this.status = 'connecting';
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.status = 'connected';
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.lastEvent = data;
            if (data.type === 'CHAT_MESSAGE' && data.content === 'CONNECTED_TO_TERMINAL') {
                if (!this.activeMembers.includes(data.from)) {
                    this.activeMembers.push(data.from);
                }
            }
            // If it's a chat message, push it to the messages array
            if (data.type === 'CHAT_MESSAGE') {
                this.messages.push({
                    from: data.from,
                    text: data.content,
                    timestamp: new Date().toLocaleTimeString()
                });
                // Keep only last 50 messages for performance
                if (this.messages.length > 50) this.messages.shift();
            }
        };

        this.socket.onclose = () => {
            this.status = 'disconnected';
            this.socket = null;
        };
    }

    send(object: any) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            // Sending the raw string ID to Go
            this.socket.send(JSON.stringify(object));
        } else {
            console.error("Cannot send: PartyWS not connected");
        }
    }

    close() {
        this.socket?.close();
        this.activeOnRoom = false;
        this.currentRoomId = null;
    }

    startChat(roomId: string) {
        this.currentRoomId = roomId;
        
        // 1. Tell the server to subscribe us to the Redis Room channel
        this.send({
            type: "JOIN_ROOM",
            roomId: roomId
        });

        // 2. Announce to everyone ALREADY in the room that we have arrived
        // We send this as a CHAT_MESSAGE so it shows up in their terminal
        setTimeout(() => {
            this.send({
                type: "CHAT_MESSAGE",
                roomId: roomId,
                content: "CONNECTED_TO_TERMINAL",
                from: "SYSTEM"
            });
        }, 100); // Small delay to ensure Go has finished the Subscribe call
    }

    sendMessage(text: string) {
        if (!this.currentRoomId) return;
        
        const message = {
            type: "CHAT_MESSAGE",
            roomId: this.currentRoomId.toString(),
            content: text,
            from: "Me" // The Go backend will overwrite this with the real ID
        };
        this.send(message);
    }
}

export const webRPC = new WebRPC();