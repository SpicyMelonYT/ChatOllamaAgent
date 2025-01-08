class WebSocketManager {
    constructor(url = 'ws://localhost:8765') {
        this.url = url;
        this.socket = null;
        this.messageListeners = new Map();
        this.connect();

        // Add unload handler to send close message
        window.addEventListener('beforeunload', () => {
            this.closeImmediately();
        });
    }

    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('New WebSocket connection established');
            document.getElementById('status-bar').textContent = 'Connected to server';
            document.getElementById('status-bar').classList.add('connected');
            document.getElementById('status-bar').classList.remove('disconnected');
            
            // Emit connection ready event
            if (this.messageListeners.has('connection_ready')) {
                this.messageListeners.get('connection_ready').forEach(callback => callback());
            }
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
            document.getElementById('status-bar').textContent = 'Disconnected from server';
            document.getElementById('status-bar').classList.remove('connected');
            document.getElementById('status-bar').classList.add('disconnected');
            
            // Try to reconnect after 5 seconds
            setTimeout(() => this.connect(), 5000);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type && this.messageListeners.has(data.type)) {
                    this.messageListeners.get(data.type).forEach(callback => callback(data));
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    addMessageListener(type, callback) {
        if (!this.messageListeners.has(type)) {
            this.messageListeners.set(type, new Set());
        }
        this.messageListeners.get(type).add(callback);
    }

    removeMessageListener(type, callback) {
        if (this.messageListeners.has(type)) {
            this.messageListeners.get(type).delete(callback);
        }
    }

    closeImmediately() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                // Send the CLOSE message before closing
                this.socket.send('CLOSE');
                // Disable auto-reconnect and close
                this.socket.onclose = null;
                this.socket.close();
            } catch (e) {
                console.error('Error during immediate close:', e);
            }
        }
    }
}

// Create global WebSocket manager instance
window.wsManager = new WebSocketManager(); 