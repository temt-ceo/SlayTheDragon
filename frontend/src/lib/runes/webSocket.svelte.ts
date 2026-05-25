export class WS {
    private socket: WebSocket | null = null;
    status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
    timestamp = $state<string>('');
    lastEvent = $state<any>(null);

    connect() {
        if (this.socket) return;
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${protocol}://${window.location.host}/ws`;

        this.status = 'connecting';
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.status = 'connected';
            console.log('Connected to Go Backend');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.lastEvent = data;
            this.status = data.status ?? this.status;
            this.timestamp = data.timestamp ?? '';
        };

        this.socket.onclose = () => {
            this.status = 'disconnected';
            this.socket = null;
        };
    }

    send(message: any) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('WS not open');
        }
    }

    close() {
        this.socket?.close();
    }
}

export const ws = new WS();
