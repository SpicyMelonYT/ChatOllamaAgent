# Socket Interface Definition Guide

## Overview
This document outlines how to create custom socket interfaces in the ChatOllamaAgent node system. Socket interfaces define how data inputs and outputs are displayed and interacted with in the node editor.

## Interface Definition Structure
The `get_interface_definition()` method must return a dictionary with the following structure:

```python
{
    'height': int,              # Height in rows (1 is default)
    'stored_values': dict,      # Default values for the socket
    'content': {
        'html': str,            # HTML template for the interface
        'css': str,             # CSS styles for the interface
        'js': str              # JavaScript for interface behavior
    }
}
```

### Height
- Specifies how many rows the socket interface should occupy
- Default is 1 for simple inputs
- Use larger values for complex interfaces (e.g., Vector3 uses 3)

### Stored Values
- Dictionary of default values the socket should maintain
- Keys are value identifiers
- Values are the default values for each field
- Example:
```python
'stored_values': {
    'value': ''     # Single value storage
    # or multiple values
    'x': 0,
    'y': 0,
    'z': 0
}
```

### Content

#### HTML
- Defines the structure of the interface
- Should use semantic HTML
- Must contain elements that correspond to the stored values
- Example:
```html
<div class="input-container">
    <input type="text" class="form-control">
</div>
```

#### CSS
- Defines the styling of the interface
- Should follow the dark theme aesthetic
- Common style patterns:
  - Dark backgrounds (#2a2a2a)
  - Light text (#ffffff)
  - Accent colors for focus (#007acc)
  - Consistent padding and sizing
  - Hover and focus states

#### JavaScript
- Handles interface behavior and data management
- Has access to the following globals:
  - `element`: The root element of the interface
  - `socket_id`: The unique ID of the socket
  - `ChatOllamaAgentNodeAPI`: API for interacting with the node system

## ChatOllamaAgentNodeAPI Reference

The `ChatOllamaAgentNodeAPI` is a global object that provides methods for interacting with the node system. It's available in the JavaScript context of socket interfaces and provides the following functionality:

### Methods

#### `getNode(socketId)`
- Returns the node object that owns the specified socket
- Parameters:
  - `socketId`: String - The unique identifier of the socket
- Returns: Node object containing all node data including sockets and position

#### `getValue(nodeId, socketId, key)`
- Retrieves a stored value from a socket
- Parameters:
  - `nodeId`: String - The unique identifier of the node
  - `socketId`: String - The unique identifier of the socket
  - `key`: String - The key of the value to retrieve
- Returns: The stored value or null if not found
- Example:
```javascript
const value = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value');
```

#### `setValue(nodeId, socketId, key, value)`
- Stores a value in a socket
- Parameters:
  - `nodeId`: String - The unique identifier of the node
  - `socketId`: String - The unique identifier of the socket
  - `key`: String - The key to store the value under
  - `value`: Any - The value to store
- Example:
```javascript
ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', newValue);
```

#### `getSocket(socketId)`
- Returns the socket object for the specified ID
- Parameters:
  - `socketId`: String - The unique identifier of the socket
- Returns: Socket object containing socket configuration and interface definition

#### `getConnections(socketId)`
- Returns all connections involving the specified socket
- Parameters:
  - `socketId`: String - The unique identifier of the socket
- Returns: Array of connection objects

#### `getConfig(key, defaultValue)`
- Retrieves a configuration value
- Parameters:
  - `key`: String - The configuration key to retrieve
  - `defaultValue`: Any - Value to return if key not found
- Returns: The configuration value or defaultValue if not found

#### `setConfig(key, value)`
- Sets a configuration value
- Parameters:
  - `key`: String - The configuration key to set
  - `value`: Any - The value to store

### Best Practices for Using the API

1. **Value Management**
   - Always check for existing values before setting defaults
   - Use null checks when retrieving values
   ```javascript
   const value = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || defaultValue;
   ```

2. **Connection Handling**
   - Check for existing connections before modifying socket interfaces
   ```javascript
   const connections = ChatOllamaAgentNodeAPI.getConnections(socket_id);
   if (connections.length === 0) {
       // Handle unconnected state
   }
   ```

3. **Node Access**
   - Cache node references when needed in event handlers
   ```javascript
   const node = ChatOllamaAgentNodeAPI.getNode(socket_id);
   element.onclick = () => {
       // Use cached node reference
       updateNodeValue(node);
   };
   ```

4. **Configuration Usage**
   - Use configuration for feature flags and customization
   ```javascript
   const showDebug = ChatOllamaAgentNodeAPI.getConfig('debug_mode', false);
   if (showDebug) {
       // Add debug visualization
   }
   ```

## Best Practices

### Value Management
- Always initialize with default values
- Update stored values when input changes
- Validate input before storing
- Format values appropriately for display

### User Experience
- Provide immediate feedback for user actions
- Include hover and focus states
- Handle keyboard navigation
- Support copy/paste operations
- Select text on focus for easy editing

### Styling
- Use consistent sizing (20px height for inputs)
- Follow the dark theme color scheme
- Ensure good contrast for readability
- Use appropriate cursor styles
- Include smooth transitions for interactions

### Error Handling
- Validate input values
- Provide fallbacks for invalid input
- Handle special cases (infinity, NaN, etc.)
- Maintain valid state in stored values

## Example Implementation
Here's a minimal example of a custom number input socket:

```python
@classmethod
def get_interface_definition(cls) -> Dict:
    return {
        'height': 1,
        'stored_values': {
            'value': 0
        },
        'content': {
            'html': '''
                <div class="number-input">
                    <input type="text" class="form-control">
                </div>
            ''',
            'css': '''
                .number-input {
                    padding: 2px 8px;
                    height: 20px;
                }
                .number-input input {
                    height: 20px;
                    width: 100%;
                    background: #2a2a2a;
                    color: #ffffff;
                    border: 1px solid #454545;
                }
            ''',
            'js': '''
                const node = ChatOllamaAgentNodeAPI.getNode(socket_id);
                const input = element.querySelector('input');
                
                // Set initial value
                input.value = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || 0;
                
                // Handle changes
                input.onchange = (e) => {
                    const value = parseFloat(e.target.value) || 0;
                    ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                };
            '''
        }
    } 