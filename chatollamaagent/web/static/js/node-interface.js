class ConfigManager {
    constructor() {
        this.config = {};
        
        // Wait for WebSocket connection before loading config
        window.wsManager.addMessageListener('connection_ready', () => {
            this.loadFromBackend();
        });
        
        // Listen for config responses
        window.wsManager.addMessageListener('config_response', (data) => {
            if (data.config) {
                this.config = data.config;
            }
        });

        // Listen for config update confirmations
        window.wsManager.addMessageListener('config_updated', (data) => {
            if (data.key && data.value !== undefined) {
                this.config[data.key] = data.value;
            }
        });
    }

    loadFromBackend() {
        window.wsManager.send({
            type: 'get_config',
            key: null  // null key means get all config
        });
    }

    saveToBackend() {
        // Send each config value individually to match backend expectations
        Object.entries(this.config).forEach(([key, value]) => {
            window.wsManager.send({
                type: 'set_config',
                key: key,
                value: value
            });
        });
    }

    get(key, defaultValue = null) {
        return this.config[key] ?? defaultValue;
    }

    set(key, value) {
        this.config[key] = value;
        // Send individual update to backend
        window.wsManager.send({
            type: 'set_config',
            key: key,
            value: value
        });
    }
}

class NodeInterfaceManager {
    constructor(editor) {
        this.editor = editor;
        this.nodeInstances = new Map();
        this.configManager = new ConfigManager();
        this.currentNode = null;  // Add current node tracking
    }
    
    getNodeFromSocketId(socketId) {
        return this.editor.findNodeBySocketId(socketId);
    }
    
    getSocket(socketId) {
        return this.editor.findSocketById(socketId);
    }
    
    getConnections(socketId) {
        return Array.from(this.editor.connections).filter(conn => 
            conn.from.id === socketId || conn.to.id === socketId
        );
    }
    
    getStoredValue(nodeId, socketId, key) {
        const storageKey = `${nodeId}.${socketId}.${key}`;
        const value = this.editor.socketValues.get(storageKey);
        return value !== undefined ? value : null;
    }
    
    setStoredValue(nodeId, socketId, key, value) {
        const storageKey = `${nodeId}.${socketId}.${key}`;
        this.editor.socketValues.set(storageKey, value);
    }

    getCurrentNode() {
        return this.currentNode;
    }

    createInterface(node, socket, interfaceDef, parentElement) {
        if (!interfaceDef?.content) return;
        
        // Store the current node being rendered
        this.currentNode = node;
        
        // Create a style element for CSS if provided
        if (interfaceDef.content.css) {
            const style = document.createElement('style');
            style.textContent = interfaceDef.content.css;
            parentElement.appendChild(style);
        }
        
        // Create HTML content
        if (interfaceDef.content.html) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = interfaceDef.content.html;
            parentElement.appendChild(wrapper);
            
            // Execute JavaScript if provided
            if (interfaceDef.content.js) {
                const element = wrapper; // Reference for the JS code to use
                const socket_id = socket.id; // Template variable
                
                // Create and execute the JS code
                const jsCode = interfaceDef.content.js;
                try {
                    (new Function('element', 'socket_id', jsCode))(element, socket_id);
                } catch (error) {
                    console.error('Error executing interface JS:', error);
                }
            }
        }

        // Clear the current node after interface creation
        this.currentNode = null;
    }
}

// Create global API
window.ChatOllamaAgentNodeAPI = {
    getNode: (socketId) => window.nodeInterfaceManager.getNodeFromSocketId(socketId),
    getCurrentNode: () => window.nodeInterfaceManager.getCurrentNode(),
    getValue: (nodeId, socketId, key) => window.nodeInterfaceManager.getStoredValue(nodeId, socketId, key),
    setValue: (nodeId, socketId, key, value) => window.nodeInterfaceManager.setStoredValue(nodeId, socketId, key, value),
    getSocket: (socketId) => window.nodeInterfaceManager.getSocket(socketId),
    getConnections: (socketId) => window.nodeInterfaceManager.getConnections(socketId),
    getConfig: (key, defaultValue) => window.nodeInterfaceManager.configManager.get(key, defaultValue),
    setConfig: (key, value) => window.nodeInterfaceManager.configManager.set(key, value)
}; 