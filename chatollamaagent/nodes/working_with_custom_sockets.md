# Socket Implementation Guide

When implementing new sockets in this system, there are two critical concepts to understand:

## 1. Socket Value Storage System

Each socket instance maintains its own independent state through a 'stored_values' system. This is defined in the socket's interface definition and accessed through the ChatOllamaAgentNodeAPI:

### Define default values in the interface:
```javascript
'stored_values': {
    'value': defaultValue  // or multiple values if needed
}
```

### Access values using the API:
```javascript
// Get a stored value
const value = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'key')

// Set a stored value
ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'key', value)
```

> **Important:** Always use these API methods rather than maintaining state in variables, as multiple instances of the same socket type can exist in the network simultaneously.

## 2. UI Component Isolation

If your socket needs a floating UI component (like a picker or dropdown), it should be implemented as a shared element while maintaining instance isolation:

### Create and track shared elements:
```javascript
// Create a single shared UI element to avoid duplicates
const floatingUI = document.createElement('div');
floatingUI.id = 'your-floating-ui';
document.body.appendChild(floatingUI);

// Track the active socket using data attributes
floatingUI.dataset.socketId = socket_id;
```

### Guard interactions:
```javascript
// Guard all interactions with socket ID checks
if (floatingUI.dataset.socketId === socket_id) {
    // Perform updates
}
```

### Clean up properly:
```javascript
// Clean up when appropriate
if (floatingUI.dataset.socketId === socket_id) {
    floatingUI.parentNode.removeChild(floatingUI);
}
```

This approach ensures that even with shared UI elements, each socket instance maintains its own state and behavior.

## Key Points to Remember

- ✨ Multiple instances of your socket can exist simultaneously
- 🔌 Sockets can be both inputs and outputs on nodes
- 💾 Always use the ChatOllamaAgentNodeAPI for value storage
- 🔒 Isolate UI interactions to the active socket instance
- 🧹 Clean up any shared resources when sockets are destroyed