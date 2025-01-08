from chatollama import Engine, Conversation
from .base import DataSocket, Node, socket, node, NodeInstance
from typing import Dict

# Built-in socket types


@socket()
class StringSocket(DataSocket):
    """Built-in string socket type for text data."""
    color = "#ADD8E6"  # Light pastel blue

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other string sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                'value': ''  # Default value
            },
            'content': {
                'html': '''
                    <div class="string-input">
                        <input type="text">
                    </div>
                ''',
                'css': '''
                    .string-input {
                        padding: 2px 8px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                    }
                    .string-input input {
                        height: 20px;
                        width: 100%;
                        text-align: left;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        border-radius: 4px;
                        color: #ffffff;
                        cursor: text;
                        caret-color: #ffffff;
                        user-select: text;
                        -webkit-user-select: text;
                    }
                    .string-input input:focus {
                        background-color: var(--node-header-color);
                        border-color: #007acc;
                        color: #ffffff;
                        box-shadow: none;
                        outline: none;
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const input = element.querySelector('input');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Set initial value
                    input.value = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || '';
                    
                    // Handle changes
                    input.onchange = (e) => {
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', e.target.value);
                    };
                '''
            }
        }


@socket()
class TextSocket(DataSocket):
    """Built-in text socket type for multi-line text data with a popup editor."""
    color = "#6BB1E4"  # Sky blue, slightly different from StringSocket

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other text sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                'value': ''  # Default value
            },
            'content': {
                'html': '''
                    <div class="text-input">
                        <button class="text-button">Edit Text</button>
                    </div>
                ''',
                'css': '''
                    .text-input {
                        padding: 2px 8px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                    }
                    .text-input .text-button {
                        height: 20px;
                        width: 100%;
                        text-align: center;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        background-color: var(--node-header-color);
                        border: 1px solid var(--node-header-color);
                        border-radius: 4px;
                        color: #ffffff;
                        cursor: pointer;
                        user-select: none;
                    }
                    .text-input .text-button:hover {
                        background-color: #007acc;
                        border-color: #007acc;
                    }
                    .text-editor {
                        position: fixed;
                        z-index: 10000;
                        background: #1e1e1e;
                        border: 1px solid #454545;
                        border-radius: 4px;
                        padding: 8px;
                        display: none;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        min-width: 400px;
                        min-height: 300px;
                        flex-direction: column;
                    }
                    .text-editor.visible {
                        display: flex;
                    }
                    .text-editor .editor-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                        user-select: none;
                        cursor: move;
                    }
                    .text-editor .editor-title {
                        color: #ffffff;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .text-editor textarea {
                        width: 100%;
                        min-height: 250px;
                        margin-bottom: 8px;
                        background-color: #252526;
                        border: 1px solid #454545;
                        border-radius: 4px;
                        color: #ffffff;
                        padding: 8px;
                        font-family: monospace;
                        font-size: 12px;
                        resize: both;
                    }
                    .text-editor textarea:focus {
                        outline: none;
                        border-color: #007acc;
                    }
                    .text-editor .editor-buttons {
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                    }
                    .text-editor button {
                        padding: 4px 12px;
                        border-radius: 4px;
                        border: 1px solid #454545;
                        background-color: #252526;
                        color: #ffffff;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .text-editor button:hover {
                        background-color: #2d2d2d;
                        border-color: #007acc;
                    }
                    .text-editor button.primary {
                        background-color: #007acc;
                        border-color: #007acc;
                    }
                    .text-editor button.primary:hover {
                        background-color: #0098ff;
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const button = element.querySelector('.text-button');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Helper function to update button text with line and char counts
                    function updateButtonText(text) {
                        const lines = text.split('\\n').length;
                        const chars = text.length;
                        button.textContent = `Text (Ln ${lines}, Char ${chars})`;
                    }
                    
                    let editor = null;
                    let isDragging = false;
                    let dragStartX = 0;
                    let dragStartY = 0;
                    let editorStartLeft = 0;
                    let editorStartTop = 0;
                    
                    function createEditor() {
                        // Remove any existing editor first
                        if (editor) {
                            editor.remove();
                        }
                        
                        editor = document.createElement('div');
                        editor.className = 'text-editor';
                        editor.innerHTML = `
                            <div class="editor-header">
                                <div class="editor-title">Text Editor</div>
                            </div>
                            <textarea spellcheck="false"></textarea>
                            <div class="editor-buttons">
                                <button class="cancel-button">Cancel</button>
                                <button class="save-button primary">Save</button>
                            </div>
                        `;
                        
                        const textarea = editor.querySelector('textarea');
                        const header = editor.querySelector('.editor-header');
                        
                        // Set up drag handling
                        header.addEventListener('mousedown', (e) => {
                            if (e.target === header || header.contains(e.target)) {
                                isDragging = true;
                                dragStartX = e.clientX;
                                dragStartY = e.clientY;
                                const rect = editor.getBoundingClientRect();
                                editorStartLeft = rect.left;
                                editorStartTop = rect.top;
                                e.preventDefault();
                            }
                        });
                        
                        // Stop propagation of clicks inside editor
                        editor.addEventListener('mousedown', (e) => {
                            e.stopPropagation();
                        });
                        
                        // Handle save button
                        editor.querySelector('.save-button').addEventListener('click', () => {
                            ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', textarea.value);
                            updateButtonText(textarea.value);
                            closeEditor();
                        });
                        
                        // Handle cancel button
                        editor.querySelector('.cancel-button').addEventListener('click', closeEditor);
                        
                        return editor;
                    }
                    
                    function closeEditor() {
                        if (editor) {
                            editor.remove();
                            editor = null;
                        }
                    }
                    
                    // Handle document-level events for dragging
                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging || !editor) return;
                        
                        const deltaX = e.clientX - dragStartX;
                        const deltaY = e.clientY - dragStartY;
                        
                        editor.style.left = `${editorStartLeft + deltaX}px`;
                        editor.style.top = `${editorStartTop + deltaY}px`;
                        e.preventDefault();
                    });
                    
                    document.addEventListener('mouseup', () => {
                        isDragging = false;
                    });
                    
                    // Handle clicks outside editor
                    document.addEventListener('mousedown', (e) => {
                        if (editor && !isDragging && !editor.contains(e.target) && e.target !== button) {
                            closeEditor();
                        }
                    });
                    
                    // Handle button click to show editor
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Create and add the editor
                        editor = createEditor();
                        document.body.appendChild(editor);
                        
                        // Set the text value
                        const textarea = editor.querySelector('textarea');
                        textarea.value = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || '';
                        
                        // Show and position the editor
                        editor.classList.add('visible');
                        
                        // Center the editor
                        const rect = editor.getBoundingClientRect();
                        editor.style.left = `${(window.innerWidth - rect.width) / 2}px`;
                        editor.style.top = `${(window.innerHeight - rect.height) / 2}px`;
                        
                        textarea.focus();
                    });
                    
                    // Set initial button text
                    const initialValue = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || '';
                    updateButtonText(initialValue);
                    
                    // Clean up when the socket is destroyed
                    return () => {
                        closeEditor();
                    };
                '''
            }
        }


@socket()
class IntSocket(DataSocket):
    """Built-in integer socket type for whole number data."""
    color = "#2E8B57"  # Mid green

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other integer sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                'value': 0  # Default value
            },
            'content': {
                'html': '''
                    <div class="int-input">
                        <div class="input-group">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-dash" style="pointer-events: none"></span>
                            </button>
                            <input type="text" class="form-control text-center">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-plus" style="pointer-events: none"></span>
                            </button>
                        </div>
                    </div>
                ''',
                'css': '''
                    .int-input {
                        padding: 2px 8px;
                        height: 20px;
                    }
                    .int-input .input-group {
                        height: 20px;
                        display: flex;
                        align-items: center;
                    }
                    .int-input .btn {
                        padding: 0;
                        width: 20px;
                        height: 20px;
                        min-width: 20px;
                        color: #cccccc;
                        border-color: var(--node-header-color);
                        background-color: var(--node-header-color);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1;
                    }
                    .int-input .btn:hover {
                        color: #ffffff;
                        border-color: #007acc;
                        filter: brightness(110%);
                    }
                    .int-input .btn:active {
                        color: #ffffff;
                        border-color: #007acc;
                        filter: brightness(90%);
                    }
                    .int-input .btn .bi {
                        font-size: 12px;
                        line-height: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                    }
                    .int-input input {
                        height: 20px;
                        min-width: 60px;
                        text-align: center;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        color: #ffffff;
                        cursor: text;
                        caret-color: #ffffff;
                        user-select: text;
                        -webkit-user-select: text;
                        z-index: 2;
                    }
                    .int-input input:focus {
                        background-color: var(--node-header-color);
                        border-color: #007acc;
                        color: #ffffff;
                        box-shadow: none;
                        outline: none;
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const input = element.querySelector('input');
                    const decrementBtn = element.querySelector('button:first-child');
                    const incrementBtn = element.querySelector('button:last-child');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Helper function to parse special numeric values
                    function parseSpecialNumber(value) {
                        // Convert to lowercase for case-insensitive comparison
                        const val = value.toLowerCase().trim();
                        
                        // Handle infinity
                        if (val === 'inf') return Infinity;
                        if (val === '-inf') return -Infinity;
                        
                        // Try to parse as integer, but first parse as float and round to handle decimal inputs
                        const num = parseFloat(val);
                        return isNaN(num) ? 0 : Math.round(num);
                    }
                    
                    // Helper function to format special numbers for display
                    function formatNumber(value) {
                        if (value === Infinity) return 'inf';
                        if (value === -Infinity) return '-inf';
                        return Math.round(value).toString();  // Round to ensure proper integer display
                    }
                    
                    // Helper function to handle value updates
                    function updateValue() {
                        const value = parseSpecialNumber(input.value);
                        input.value = formatNumber(value);
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                    }
                    
                    // Set initial value
                    const initialValue = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || 0;
                    input.value = formatNumber(initialValue);
                    
                    // Handle direct input changes
                    input.onchange = updateValue;
                    
                    // Add input event for real-time updates
                    input.oninput = (e) => {
                        // Don't parse during typing to allow for special values
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', parseSpecialNumber(e.target.value));
                    };
                    
                    // Handle keyboard focus
                    input.onfocus = () => {
                        input.select();  // Select all text when focused
                    };
                    
                    // Handle losing focus
                    input.onblur = updateValue;
                    input.onfocusout = updateValue;
                    
                    // Handle increment/decrement
                    decrementBtn.onclick = () => {
                        const value = parseSpecialNumber(input.value) - 1;
                        input.value = formatNumber(value);
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                    };
                    
                    incrementBtn.onclick = () => {
                        const value = parseSpecialNumber(input.value) + 1;
                        input.value = formatNumber(value);
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                    };
                '''
            }
        }


@socket()
class FloatSocket(DataSocket):
    """Built-in float socket type for decimal number data."""
    color = "#32CD32"  # Lime green - brighter than IntSocket

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other float sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                'value': 0.0  # Default value
            },
            'content': {
                'html': '''
                    <div class="float-input">
                        <div class="input-group">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-dash" style="pointer-events: none"></span>
                            </button>
                            <input type="text" class="form-control text-center">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-plus" style="pointer-events: none"></span>
                            </button>
                        </div>
                    </div>
                ''',
                'css': '''
                    .float-input {
                        padding: 2px 8px;
                        height: 20px;
                    }
                    .float-input .input-group {
                        height: 20px;
                        display: flex;
                        align-items: center;
                    }
                    .float-input .btn {
                        padding: 0;
                        width: 20px;
                        height: 20px;
                        min-width: 20px;
                        color: #cccccc;
                        border-color: var(--node-header-color);
                        background-color: var(--node-header-color);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1;
                    }
                    .float-input .btn:hover {
                        color: #ffffff;
                        border-color: #007acc;
                        filter: brightness(110%);
                    }
                    .float-input .btn:active {
                        color: #ffffff;
                        border-color: #007acc;
                        filter: brightness(90%);
                    }
                    .float-input .btn .bi {
                        font-size: 12px;
                        line-height: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                    }
                    .float-input input {
                        height: 20px;
                        min-width: 60px;
                        text-align: center;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        color: #ffffff;
                        cursor: text;
                        caret-color: #ffffff;
                        user-select: text;
                        -webkit-user-select: text;
                        z-index: 2;
                    }
                    .float-input input:focus {
                        background-color: var(--node-header-color);
                        border-color: #007acc;
                        color: #ffffff;
                        box-shadow: none;
                        outline: none;
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const input = element.querySelector('input');
                    const decrementBtn = element.querySelector('button:first-child');
                    const incrementBtn = element.querySelector('button:last-child');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Helper function to parse special numeric values
                    function parseSpecialNumber(value) {
                        // Convert to lowercase for case-insensitive comparison
                        const val = value.toLowerCase().trim();
                        
                        // Handle infinity
                        if (val === 'inf') return Infinity;
                        if (val === '-inf') return -Infinity;
                        
                        // Handle pi and tau
                        if (val === 'pi') return Math.PI;
                        if (val === '-pi') return -Math.PI;
                        if (val === 'tau') return Math.PI * 2;
                        if (val === '-tau') return -Math.PI * 2;
                        
                        // Try to parse as float
                        const num = parseFloat(val);
                        return isNaN(num) ? 0 : num;
                    }
                    
                    // Helper function to format special numbers for display
                    function formatNumber(value) {
                        if (value === Infinity) return 'inf';
                        if (value === -Infinity) return '-inf';
                        // Ensure decimal point is shown for whole numbers
                        return Number.isInteger(value) ? value.toFixed(1) : value.toString();
                    }
                    
                    // Helper function to handle value updates
                    function updateValue() {
                        const value = parseSpecialNumber(input.value);
                        input.value = formatNumber(value);
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                    }
                    
                    // Set initial value
                    const initialValue = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || 0;
                    input.value = formatNumber(initialValue);
                    
                    // Handle direct input changes
                    input.onchange = updateValue;
                    
                    // Add input event for real-time updates
                    input.oninput = (e) => {
                        // Don't parse during typing to allow for special values
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', parseSpecialNumber(e.target.value));
                    };
                    
                    // Handle keyboard focus
                    input.onfocus = () => {
                        input.select();  // Select all text when focused
                    };
                    
                    // Handle losing focus
                    input.onblur = updateValue;
                    input.onfocusout = updateValue;
                    
                    // Handle increment/decrement
                    decrementBtn.onclick = () => {
                        const value = parseSpecialNumber(input.value) - 1;
                        input.value = formatNumber(value);
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                    };
                    
                    incrementBtn.onclick = () => {
                        const value = parseSpecialNumber(input.value) + 1;
                        input.value = formatNumber(value);
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', value);
                    };
                '''
            }
        }


@socket()
class BooleanSocket(DataSocket):
    """Built-in boolean socket type for true/false values."""
    color = "#FF69B4"  # Light pastel pink

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other boolean sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                'value': False  # Default value
            },
            'content': {
                'html': '''
                    <div class="boolean-input">
                        <label class="switch">
                            <input type="checkbox">
                            <span class="slider"></span>
                        </label>
                    </div>
                ''',
                'css': '''
                    .boolean-input {
                        height: 24px;
                        padding: 2px 8px;
                        display: flex;
                        align-items: center;
                    }
                    .boolean-input .switch {
                        position: relative;
                        display: inline-block;
                        width: 32px;
                        height: 16px;
                    }
                    .boolean-input .switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    .boolean-input .slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        transition: .2s;
                        border-radius: 16px;
                    }
                    .boolean-input .slider:before {
                        position: absolute;
                        content: "";
                        height: 12px;
                        width: 12px;
                        left: 1px;
                        bottom: 1px;
                        background-color: var(--node-header-color);
                        transition: .2s;
                        border-radius: 50%;
                    }
                    .boolean-input input:checked + .slider {
                        background-color: #FF69B4;
                        border-color: #FF69B4;
                    }
                    .boolean-input input:checked + .slider:before {
                        transform: translateX(16px);
                        background-color: #ffffff;
                    }
                    .boolean-input input:focus + .slider {
                        box-shadow: 0 0 0 1px rgba(255, 105, 180, 0.25);
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const checkbox = element.querySelector('input[type="checkbox"]');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Set initial value
                    checkbox.checked = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || false;
                    
                    // Handle changes
                    checkbox.onchange = (e) => {
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', e.target.checked);
                    };
                '''
            }
        }


@socket()
class Vector3Socket(DataSocket):
    """Built-in vector3 socket type for 3D vector data."""
    color = "#98FB98"  # Light pastel green

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other vector3 sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 3,  # Three rows for X, Y, Z
            'stored_values': {
                'x': 0,  # Default x value
                'y': 0,  # Default y value
                'z': 0   # Default z value
            },
            'content': {
                'html': '''
                    <div class="vector3-input">
                        <div class="input-group">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-dash" style="pointer-events: none"></span>
                            </button>
                            <input type="text" class="form-control text-center" placeholder="X">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-plus" style="pointer-events: none"></span>
                            </button>
                        </div>
                        <div class="input-group">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-dash" style="pointer-events: none"></span>
                            </button>
                            <input type="text" class="form-control text-center" placeholder="Y">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-plus" style="pointer-events: none"></span>
                            </button>
                        </div>
                        <div class="input-group">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-dash" style="pointer-events: none"></span>
                            </button>
                            <input type="text" class="form-control text-center" placeholder="Z">
                            <button class="btn btn-outline-secondary" type="button">
                                <span class="bi bi-plus" style="pointer-events: none"></span>
                            </button>
                        </div>
                    </div>
                ''',
                'css': '''
                    .vector3-input {
                        padding: 2px 8px;
                        height: 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .vector3-input .input-group {
                        height: 20px;
                        display: flex;
                        align-items: center;
                    }
                    .vector3-input .btn {
                        padding: 0;
                        width: 20px;
                        height: 20px;
                        min-width: 20px;
                        color: #cccccc;
                        border-color: var(--node-header-color);
                        background-color: var(--node-header-color);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1;
                    }
                    .vector3-input .btn:hover {
                        color: #ffffff;
                        border-color: #007acc;
                        filter: brightness(110%);
                    }
                    .vector3-input .btn:active {
                        color: #ffffff;
                        border-color: #007acc;
                        filter: brightness(90%);
                    }
                    .vector3-input .btn .bi {
                        font-size: 12px;
                        line-height: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                    }
                    .vector3-input input {
                        height: 20px;
                        min-width: 60px;
                        text-align: center;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        color: #ffffff;
                        cursor: text;
                        caret-color: #ffffff;
                        user-select: text;
                        -webkit-user-select: text;
                        z-index: 2;
                    }
                    .vector3-input input:focus {
                        background-color: var(--node-header-color);
                        border-color: #007acc;
                        color: #ffffff;
                        box-shadow: none;
                        outline: none;
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const groups = element.querySelectorAll('.input-group');
                    const axes = ['x', 'y', 'z'];
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Helper function to parse special numeric values
                    function parseSpecialNumber(value) {
                        // Convert to lowercase for case-insensitive comparison
                        const val = value.toLowerCase().trim();
                        
                        // Handle infinity
                        if (val === 'inf') return Infinity;
                        if (val === '-inf') return -Infinity;
                        
                        // Handle pi and tau
                        if (val === 'pi') return Math.PI;
                        if (val === '-pi') return -Math.PI;
                        if (val === 'tau') return Math.PI * 2;
                        if (val === '-tau') return -Math.PI * 2;
                        
                        // Try to parse as regular number
                        const num = parseFloat(val);
                        return isNaN(num) ? 0 : num;
                    }
                    
                    // Helper function to format special numbers for display
                    function formatNumber(value) {
                        if (value === Infinity) return 'inf';
                        if (value === -Infinity) return '-inf';
                        return value.toString();
                    }
                    
                    // Setup each axis
                    groups.forEach((group, index) => {
                        const axis = axes[index];
                        const input = group.querySelector('input');
                        const decrementBtn = group.querySelector('button:first-child');
                        const incrementBtn = group.querySelector('button:last-child');
                        
                        // Helper function to handle value updates
                        function updateValue() {
                            const value = parseSpecialNumber(input.value);
                            input.value = formatNumber(value);
                            ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, axis, value);
                        }
                        
                        // Set initial value
                        const initialValue = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, axis) || 0;
                        input.value = formatNumber(initialValue);
                        
                        // Handle direct input changes
                        input.onchange = updateValue;
                        
                        // Add input event for real-time updates
                        input.oninput = (e) => {
                            // Don't parse during typing to allow for special values
                            ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, axis, parseSpecialNumber(e.target.value));
                        };
                        
                        // Handle keyboard focus
                        input.onfocus = () => {
                            input.select();  // Select all text when focused
                        };
                        
                        // Handle losing focus
                        input.onblur = updateValue;
                        input.onfocusout = updateValue;
                        
                        // Handle increment/decrement
                        decrementBtn.onclick = () => {
                            const value = parseSpecialNumber(input.value) - 1;
                            input.value = formatNumber(value);
                            ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, axis, value);
                        };
                        
                        incrementBtn.onclick = () => {
                            const value = parseSpecialNumber(input.value) + 1;
                            input.value = formatNumber(value);
                            ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, axis, value);
                        };
                    });
                '''
            }
        }


@socket()
class ColorSocket(DataSocket):
    """Built-in color socket type for RGB/RGBA color values."""
    color = "#FFB6C1"  # Light pink

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other color sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                'value': '#000000'  # Default black color
            },
            'content': {
                'html': '''
                    <div class="color-input">
                        <div class="color-preview"></div>
                        <input type="text" class="color-hex" spellcheck="false">
                    </div>
                ''',
                'css': '''
                    .color-input {
                        padding: 2px 8px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .color-input .color-preview {
                        width: 20px;
                        height: 20px;
                        border-radius: 4px;
                        border: 1px solid var(--node-header-color);
                        background-color: #000000;
                        cursor: pointer;
                    }
                    .color-input .color-hex {
                        flex: 1;
                        height: 20px;
                        min-width: 70px;
                        text-align: left;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        font-family: monospace;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        border-radius: 4px;
                        color: #ffffff;
                        cursor: text;
                        caret-color: #ffffff;
                    }
                    .color-input .color-hex:focus {
                        background-color: var(--node-header-color);
                        border-color: #007acc;
                        outline: none;
                    }
                    #floating-color-picker {
                        position: fixed;
                        z-index: 10000;
                        background: #1e1e1e;
                        border: 1px solid var(--node-header-color);
                        border-radius: 4px;
                        padding: 8px;
                        display: none;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    }
                    #floating-color-picker.visible {
                        display: block;
                    }
                    #floating-color-picker .sv-picker {
                        width: 200px;
                        height: 150px;
                        border-radius: 4px;
                        border: 1px solid var(--node-header-color);
                        margin-bottom: 8px;
                        position: relative;
                        cursor: crosshair;
                    }
                    #floating-color-picker .sv-picker::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(to right, #fff, transparent);
                        pointer-events: none;
                    }
                    #floating-color-picker .sv-picker::after {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(to bottom, transparent, #000);
                        pointer-events: none;
                    }
                    #floating-color-picker .sv-cursor {
                        position: absolute;
                        width: 12px;
                        height: 12px;
                        border: 2px solid #fff;
                        border-radius: 50%;
                        transform: translate(-50%, -50%);
                        pointer-events: none;
                        z-index: 2;
                        box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
                    }
                    #floating-color-picker .hue-slider {
                        width: 200px;
                        height: 12px;
                        border-radius: 6px;
                        border: 1px solid var(--node-header-color);
                        background: linear-gradient(to right, 
                            #ff0000 0%,
                            #ffff00 17%,
                            #00ff00 33%,
                            #00ffff 50%,
                            #0000ff 67%,
                            #ff00ff 83%,
                            #ff0000 100%
                        );
                        position: relative;
                        cursor: ew-resize;
                    }
                    #floating-color-picker .hue-cursor {
                        position: absolute;
                        width: 12px;
                        height: 16px;
                        background: #fff;
                        border: 1px solid var(--node-header-color);
                        border-radius: 3px;
                        transform: translate(-50%, -2px);
                        pointer-events: none;
                        box-shadow: 0 0 3px rgba(0,0,0,0.3);
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const preview = element.querySelector('.color-preview');
                    const hexInput = element.querySelector('.color-hex');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Create floating picker if it doesn't exist
                    let floatingPicker = document.getElementById('floating-color-picker');
                    if (!floatingPicker) {
                        floatingPicker = document.createElement('div');
                        floatingPicker.id = 'floating-color-picker';
                        floatingPicker.innerHTML = `
                            <div class="sv-picker">
                                <div class="sv-cursor"></div>
                            </div>
                            <div class="hue-slider">
                                <div class="hue-cursor"></div>
                            </div>
                        `;
                        document.body.appendChild(floatingPicker);
                    }
                    
                    const svPicker = floatingPicker.querySelector('.sv-picker');
                    const svCursor = floatingPicker.querySelector('.sv-cursor');
                    const hueSlider = floatingPicker.querySelector('.hue-slider');
                    const hueCursor = floatingPicker.querySelector('.hue-cursor');
                    
                    // State is now specific to this socket instance
                    const state = {
                        hue: 0,
                        saturation: 0,
                        value: 0,
                        isDragging: false,
                        activeElement: null
                    };
                    
                    // Helper function to convert HSV to RGB
                    function hsvToRgb(h, s, v) {
                        h = h / 360;
                        let r, g, b;
                        let i = Math.floor(h * 6);
                        let f = h * 6 - i;
                        let p = v * (1 - s);
                        let q = v * (1 - f * s);
                        let t = v * (1 - (1 - f) * s);
                        
                        switch (i % 6) {
                            case 0: r = v; g = t; b = p; break;
                            case 1: r = q; g = v; b = p; break;
                            case 2: r = p; g = v; b = t; break;
                            case 3: r = p; g = q; b = v; break;
                            case 4: r = t; g = p; b = v; break;
                            case 5: r = v; g = p; b = q; break;
                        }
                        
                        return {
                            r: Math.round(r * 255),
                            g: Math.round(g * 255),
                            b: Math.round(b * 255)
                        };
                    }
                    
                    // Helper function to convert RGB to Hex
                    function rgbToHex(r, g, b) {
                        return '#' + [r, g, b].map(x => {
                            const hex = x.toString(16);
                            return hex.length === 1 ? '0' + hex : hex;
                        }).join('').toUpperCase();
                    }
                    
                    // Helper function to convert Hex to RGB
                    function hexToRgb(hex) {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result ? {
                            r: parseInt(result[1], 16),
                            g: parseInt(result[2], 16),
                            b: parseInt(result[3], 16)
                        } : null;
                    }
                    
                    // Helper function to convert RGB to HSV
                    function rgbToHsv(r, g, b) {
                        r /= 255;
                        g /= 255;
                        b /= 255;
                        
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        let h, s, v = max;
                        
                        const d = max - min;
                        s = max === 0 ? 0 : d / max;
                        
                        if (max === min) {
                            h = 0;
                        } else {
                            switch (max) {
                                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                case g: h = (b - r) / d + 2; break;
                                case b: h = (r - g) / d + 4; break;
                            }
                            h /= 6;
                        }
                        
                        return {
                            h: h * 360,
                            s: s,
                            v: v
                        };
                    }
                    
                    // Helper function to update color from HSV values
                    function updateColorFromHsv() {
                        const rgb = hsvToRgb(state.hue, state.saturation, state.value);
                        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                        
                        // Only update the picker UI if it's currently being shown for this socket
                        if (floatingPicker.dataset.socketId === socket_id) {
                            // Update the saturation/value picker background
                            svPicker.style.backgroundColor = `hsl(${state.hue}, 100%, 50%)`;
                            
                            // Update cursors
                            svCursor.style.left = `${state.saturation * 100}%`;
                            svCursor.style.top = `${(1 - state.value) * 100}%`;
                            hueCursor.style.left = `${(state.hue / 360) * 100}%`;
                        }
                        
                        // Update this socket's preview and input
                        preview.style.backgroundColor = hex;
                        hexInput.value = hex;
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'value', hex);
                    }
                    
                    // Helper function to handle mouse/touch events
                    function handlePointerEvent(e, element) {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        
                        const rect = element.getBoundingClientRect();
                        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                        
                        if (element === svPicker) {
                            state.saturation = x;
                            state.value = 1 - y;
                        } else if (element === hueSlider) {
                            state.hue = x * 360;
                        }
                        
                        updateColorFromHsv();
                    }
                    
                    // Set up event listeners for dragging
                    function startDragging(e, element) {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        
                        state.isDragging = true;
                        state.activeElement = element;
                        handlePointerEvent(e, element);
                        
                        function moveHandler(e) {
                            if (state.isDragging) {
                                handlePointerEvent(e, state.activeElement);
                            }
                        }
                        
                        function upHandler() {
                            state.isDragging = false;
                            state.activeElement = null;
                            document.removeEventListener('mousemove', moveHandler);
                            document.removeEventListener('mouseup', upHandler);
                        }
                        
                        document.addEventListener('mousemove', moveHandler);
                        document.addEventListener('mouseup', upHandler);
                    }
                    
                    // Set up click handlers
                    svPicker.addEventListener('mousedown', (e) => startDragging(e, svPicker));
                    hueSlider.addEventListener('mousedown', (e) => startDragging(e, hueSlider));
                    
                    // Handle preview click to toggle color picker
                    preview.onclick = (e) => {
                        e.stopPropagation();
                        
                        // Position the picker near the preview
                        const rect = preview.getBoundingClientRect();
                        floatingPicker.style.left = rect.left + 'px';
                        floatingPicker.style.top = (rect.bottom + 4) + 'px';
                        
                        // Store the current socket_id in the picker
                        floatingPicker.dataset.socketId = socket_id;
                        
                        floatingPicker.classList.toggle('visible');
                        
                        if (floatingPicker.classList.contains('visible')) {
                            // Convert current hex to HSV when opening
                            const hex = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || '#000000';
                            const rgb = hexToRgb(hex);
                            if (rgb) {
                                const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                                state.hue = hsv.h;
                                state.saturation = hsv.s;
                                state.value = hsv.v;
                                updateColorFromHsv();
                            }
                        }
                    };
                    
                    // Close picker when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!floatingPicker.contains(e.target) && e.target !== preview) {
                            if (floatingPicker.dataset.socketId === socket_id) {
                                floatingPicker.classList.remove('visible');
                            }
                        }
                    });
                    
                    // Handle hex input changes
                    hexInput.onchange = (e) => {
                        const rgb = hexToRgb(e.target.value);
                        if (rgb) {
                            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                            state.hue = hsv.h;
                            state.saturation = hsv.s;
                            state.value = hsv.v;
                            updateColorFromHsv();
                        }
                    };
                    
                    // Handle hex input focus
                    hexInput.onfocus = () => {
                        hexInput.select();
                    };
                    
                    // Set initial color from stored value
                    const initialColor = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'value') || '#000000';
                    hexInput.value = initialColor;
                    preview.style.backgroundColor = initialColor;
                    
                    // Clean up when the socket is destroyed
                    return () => {
                        if (floatingPicker && floatingPicker.parentNode && floatingPicker.dataset.socketId === socket_id) {
                            floatingPicker.parentNode.removeChild(floatingPicker);
                        }
                    };
                '''
            }
        }


@socket()
class DateTimeSocket(DataSocket):
    """Built-in datetime socket type for date and time values."""
    color = "#4169E1"  # Royal Blue

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other datetime sockets."""
        cls.add_to_white_list(cls)

    @classmethod
    def get_interface_definition(cls) -> Dict:
        return {
            'height': 1,
            'stored_values': {
                # Default value (Unix timestamp in milliseconds)
                'timestamp': 0
            },
            'content': {
                'html': '''
                    <div class="datetime-input">
                        <input type="text" class="datetime-display" readonly>
                    </div>
                ''',
                'css': '''
                    .datetime-input {
                        padding: 2px 8px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                    }
                    .datetime-input .datetime-display {
                        height: 20px;
                        width: 100%;
                        text-align: left;
                        padding: 0 4px;
                        line-height: 20px;
                        font-size: 12px;
                        background-color: var(--node-background-color);
                        border: 1px solid var(--node-header-color);
                        border-radius: 4px;
                        color: #ffffff;
                        cursor: pointer;
                        user-select: none;
                    }
                    .datetime-input .datetime-display:hover {
                        background-color: var(--node-header-color);
                        border-color: #007acc;
                    }
                ''',
                'js': r'''
                    const node = ChatOllamaAgentNodeAPI.getCurrentNode();
                    const display = element.querySelector('.datetime-display');
                    
                    // Set CSS variables for node colors
                    element.style.setProperty('--node-background-color', node.background_color);
                    element.style.setProperty('--node-header-color', node.header_color);
                    
                    // Create floating picker if it doesn't exist
                    let floatingPicker = document.getElementById('floating-datetime-picker');
                    if (!floatingPicker) {
                        floatingPicker = document.createElement('div');
                        floatingPicker.id = 'floating-datetime-picker';
                        floatingPicker.style.position = 'fixed';
                        floatingPicker.style.zIndex = '10000';
                        floatingPicker.style.background = '#1e1e1e';
                        floatingPicker.style.border = '1px solid #454545';
                        floatingPicker.style.borderRadius = '4px';
                        floatingPicker.style.padding = '8px';
                        floatingPicker.style.display = 'none';
                        floatingPicker.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                        floatingPicker.style.width = '220px';
                        
                        floatingPicker.innerHTML = `
                            <div class="datetime-picker-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <button class="prev-month" style="background: none; border: none; color: #cccccc; cursor: pointer; padding: 4px 8px;">◀</button>
                                <span class="current-month" style="color: #ffffff; font-size: 14px;"></span>
                                <button class="next-month" style="background: none; border: none; color: #cccccc; cursor: pointer; padding: 4px 8px;">▶</button>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <input type="text" class="datetime-text" style="width: 100%; height: 20px; text-align: left; padding: 0 4px; line-height: 20px; font-size: 12px; background-color: var(--node-background-color); border: 1px solid var(--node-header-color); border-radius: 4px; color: #ffffff; font-family: monospace;">
                            </div>
                            <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 8px;">
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">Su</div>
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">Mo</div>
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">Tu</div>
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">We</div>
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">Th</div>
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">Fr</div>
                                <div class="weekday" style="color: #808080; font-size: 12px; text-align: center; padding: 4px;">Sa</div>
                            </div>
                            <div class="time-picker" style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #454545;">
                                <input type="number" class="hour" min="0" max="23" step="1" style="width: 40px; height: 20px; text-align: center; background-color: var(--node-background-color); border: 1px solid var(--node-header-color); border-radius: 4px; color: #ffffff; font-size: 12px;">
                                <span style="color: #ffffff;">:</span>
                                <input type="number" class="minute" min="0" max="59" step="1" style="width: 40px; height: 20px; text-align: center; background-color: var(--node-background-color); border: 1px solid var(--node-header-color); border-radius: 4px; color: #ffffff; font-size: 12px;">
                            </div>
                        `;
                        
                        document.body.appendChild(floatingPicker);
                    }
                    
                    const state = {
                        currentDate: new Date(),
                        selectedDate: new Date()
                    };
                    
                    // Helper function to format date for display
                    function formatDateTime(date) {
                        return date.toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });
                    }
                    
                    // Helper function to parse datetime string
                    function parseDateTimeString(str) {
                        // Try to parse the string as a date
                        const date = new Date(str);
                        
                        // Check if the date is valid
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                        
                        return null;
                    }
                    
                    // Helper function to update the stored value
                    function updateValue() {
                        const timestamp = state.selectedDate.getTime();
                        ChatOllamaAgentNodeAPI.setValue(node.id, socket_id, 'timestamp', timestamp);
                        display.value = formatDateTime(state.selectedDate);
                        
                        // Update the text input if it exists and picker is visible
                        if (floatingPicker.style.display === 'block') {
                            const textInput = floatingPicker.querySelector('.datetime-text');
                            if (textInput) {
                                textInput.value = formatDateTime(state.selectedDate);
                            }
                        }
                    }
                    
                    // Helper function to render calendar
                    function renderCalendar() {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        
                        const currentMonthSpan = floatingPicker.querySelector('.current-month');
                        const calendarGrid = floatingPicker.querySelector('.calendar-grid');
                        
                        // Update month display
                        currentMonthSpan.textContent = state.currentDate.toLocaleString('en-US', {
                            month: 'long',
                            year: 'numeric'
                        });
                        
                        // Clear existing calendar days
                        const days = calendarGrid.querySelectorAll('.calendar-day');
                        days.forEach(day => day.remove());
                        
                        // Get first day of month and number of days
                        const firstDay = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
                        const lastDay = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0);
                        
                        // Add padding days from previous month
                        const padding = firstDay.getDay();
                        const prevMonth = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 0);
                        for (let i = padding - 1; i >= 0; i--) {
                            const dayDiv = document.createElement('div');
                            dayDiv.className = 'calendar-day other-month';
                            dayDiv.style.cssText = 'color: #666666; font-size: 12px; text-align: center; padding: 4px; cursor: pointer; border-radius: 2px;';
                            dayDiv.textContent = prevMonth.getDate() - i;
                            calendarGrid.appendChild(dayDiv);
                        }
                        
                        // Add days of current month
                        const today = new Date();
                        for (let i = 1; i <= lastDay.getDate(); i++) {
                            const dayDiv = document.createElement('div');
                            dayDiv.className = 'calendar-day';
                            dayDiv.style.cssText = 'color: #ffffff; font-size: 12px; text-align: center; padding: 4px; cursor: pointer; border-radius: 2px;';
                            
                            if (
                                i === today.getDate() &&
                                state.currentDate.getMonth() === today.getMonth() &&
                                state.currentDate.getFullYear() === today.getFullYear()
                            ) {
                                dayDiv.style.border = '1px solid #007acc';
                            }
                            if (
                                i === state.selectedDate.getDate() &&
                                state.currentDate.getMonth() === state.selectedDate.getMonth() &&
                                state.currentDate.getFullYear() === state.selectedDate.getFullYear()
                            ) {
                                dayDiv.style.backgroundColor = '#007acc';
                            }
                            
                            dayDiv.textContent = i;
                            dayDiv.onclick = () => {
                                if (floatingPicker.dataset.socketId !== socket_id) return;
                                state.selectedDate.setFullYear(state.currentDate.getFullYear());
                                state.selectedDate.setMonth(state.currentDate.getMonth());
                                state.selectedDate.setDate(i);
                                updateValue();
                                renderCalendar();
                            };
                            calendarGrid.appendChild(dayDiv);
                        }
                        
                        // Add padding days from next month
                        const remainingCells = 42 - (padding + lastDay.getDate());
                        for (let i = 1; i <= remainingCells; i++) {
                            const dayDiv = document.createElement('div');
                            dayDiv.className = 'calendar-day other-month';
                            dayDiv.style.cssText = 'color: #666666; font-size: 12px; text-align: center; padding: 4px; cursor: pointer; border-radius: 2px;';
                            dayDiv.textContent = i;
                            calendarGrid.appendChild(dayDiv);
                        }
                    }
                    
                    // Set up event listeners
                    display.onclick = (e) => {
                        e.stopPropagation();
                        
                        // Position the picker near the input
                        const rect = display.getBoundingClientRect();
                        floatingPicker.style.left = rect.left + 'px';
                        floatingPicker.style.top = (rect.bottom + 4) + 'px';
                        
                        // Store the current socket_id in the picker
                        floatingPicker.dataset.socketId = socket_id;
                        
                        floatingPicker.style.display = floatingPicker.style.display === 'none' ? 'block' : 'none';
                        
                        if (floatingPicker.style.display === 'block') {
                            renderCalendar();
                            
                            // Update time inputs
                            const hourInput = floatingPicker.querySelector('.hour');
                            const minuteInput = floatingPicker.querySelector('.minute');
                            const textInput = floatingPicker.querySelector('.datetime-text');
                            
                            hourInput.value = state.selectedDate.getHours().toString().padStart(2, '0');
                            minuteInput.value = state.selectedDate.getMinutes().toString().padStart(2, '0');
                            textInput.value = formatDateTime(state.selectedDate);
                        }
                    };
                    
                    // Month navigation
                    floatingPicker.querySelector('.prev-month').onclick = () => {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
                        renderCalendar();
                    };
                    
                    floatingPicker.querySelector('.next-month').onclick = () => {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
                        renderCalendar();
                    };
                    
                    // Time input handlers
                    floatingPicker.querySelector('.hour').onchange = (e) => {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        const hour = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                        e.target.value = hour.toString().padStart(2, '0');
                        state.selectedDate.setHours(hour);
                        updateValue();
                    };
                    
                    floatingPicker.querySelector('.minute').onchange = (e) => {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        const minute = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        e.target.value = minute.toString().padStart(2, '0');
                        state.selectedDate.setMinutes(minute);
                        updateValue();
                    };
                    
                    // Handle text input changes
                    floatingPicker.querySelector('.datetime-text').onchange = (e) => {
                        if (floatingPicker.dataset.socketId !== socket_id) return;
                        
                        const newDate = parseDateTimeString(e.target.value);
                        if (newDate) {
                            state.selectedDate = newDate;
                            state.currentDate = new Date(newDate);
                            updateValue();
                            renderCalendar();
                        } else {
                            // If invalid, revert to current value
                            e.target.value = formatDateTime(state.selectedDate);
                        }
                    };
                    
                    // Select all text when focusing the text input
                    floatingPicker.querySelector('.datetime-text').onfocus = (e) => {
                        e.target.select();
                    };
                    
                    // Close picker when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!floatingPicker.contains(e.target) && e.target !== display) {
                            if (floatingPicker.dataset.socketId === socket_id) {
                                floatingPicker.style.display = 'none';
                            }
                        }
                    });
                    
                    // Set initial value
                    const initialTimestamp = ChatOllamaAgentNodeAPI.getValue(node.id, socket_id, 'timestamp') || Date.now();
                    state.selectedDate = new Date(initialTimestamp);
                    state.currentDate = new Date(initialTimestamp);
                    display.value = formatDateTime(state.selectedDate);
                    
                    // Clean up when the socket is destroyed
                    return () => {
                        if (floatingPicker && floatingPicker.parentNode && floatingPicker.dataset.socketId === socket_id) {
                            floatingPicker.parentNode.removeChild(floatingPicker);
                        }
                    };
                '''
            }
        }


# Built-in nodes


@node()
class StartNode(Node):
    """The starting point of execution. This node has no flow input socket."""
    _title = "Start"
    _category = "Flow:3"
    _include_flow_input = False  # Hide the flow input socket
    _header_color = "#2e7d33"  # Lighter green header
    _background_color = "#23571D"  # Dark green background

    def __init__(self):
        super().__init__()
        self.add_socket("Name", "input", StringSocket,
                        include_socket=False, center_text=True)


@node()
class EndNode(Node):
    """The end point of execution. This node has no flow output socket."""
    _title = "End"
    _category = "Flow:3"
    _include_flow_output = False  # Hide the flow output socket
    _header_color = "#7d2e2e"  # Lighter red header
    _background_color = "#571D1D"  # Dark red background

    def __init__(self):
        super().__init__()
        self.add_socket("Name", "input", StringSocket, center_text=True)


@node()
class ColorNode(Node):
    """Node for testing color input and output."""
    _title = "Color"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Color", "input", ColorSocket, include_socket=False)
        self.add_socket("Color", "output", ColorSocket)


@node()
class StringNode(Node):
    """Node for string input and output."""
    _title = "String"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("String", "input", StringSocket, include_socket=False)
        self.add_socket("String", "output", StringSocket)


@node()
class IntNode(Node):
    """Node for integer input and output."""
    _title = "Integer"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Integer", "input", IntSocket, include_socket=False)
        self.add_socket("Integer", "output", IntSocket)


@node()
class FloatNode(Node):
    """Node for float input and output."""
    _title = "Float"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Float", "input", FloatSocket, include_socket=False)
        self.add_socket("Float", "output", FloatSocket)


@node()
class BooleanNode(Node):
    """Node for boolean input and output."""
    _title = "Boolean"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Boolean", "input", BooleanSocket,
                        include_socket=False)
        self.add_socket("Boolean", "output", BooleanSocket)


@node()
class Vector3Node(Node):
    """Node for vector3 input and output."""
    _title = "Vector3"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Vector3", "input", Vector3Socket,
                        include_socket=False)
        self.add_socket("Vector3", "output", Vector3Socket)


@node()
class DateTimeNode(Node):
    """Node for datetime input and output."""
    _title = "DateTime"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Datetime", "input", DateTimeSocket,
                        include_socket=False)
        self.add_socket("Datetime", "output", DateTimeSocket)


@node()
class TextNode(Node):
    """Node for text input and output."""
    _title = "Text"
    _category = "Literals:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Text", "input", TextSocket, include_socket=False)
        self.add_socket("Text", "output", TextSocket)


@node()
class StringToTextNode(Node):
    """Node for converting a string to text."""
    _title = "String to Text"
    _category = "Conversion:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("String", "input", StringSocket)
        self.add_socket("Text", "output", TextSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        """Convert string input to text output."""
        string_value = node_instance.get_socket_value("String", "input")
        if string_value is not None:
            # String and Text are compatible, so we can just pass the value through
            node_instance.set_socket_value("Text", "output", string_value)


@node()
class TextToStringNode(Node):
    """Node for converting a text to a string."""
    _title = "Text to String"
    _category = "Conversion:1"
    _header_color = "#2E5C7D"
    _background_color = "#1D4057"

    def __init__(self):
        super().__init__()
        self.add_socket("Text", "input", TextSocket)
        self.add_socket("String", "output", StringSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        """Convert text input to string output."""
        text_value = node_instance.get_socket_value("Text", "input")
        if text_value is not None:
            # Text and String are compatible, so we can just pass the value through
            node_instance.set_socket_value("String", "output", text_value)


@socket()
class EngineSocket(DataSocket):
    """Built-in engine socket type for Engine class instance."""
    color = "#662B9C"  # Light pastel blue

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other string sockets."""
        cls.add_to_white_list(cls)


@node()
class EngineNode(Node):
    """Node for datetime input and output."""
    _title = "Engine"
    _category = "Chatollama:2/Engine:2"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Model", "input", StringSocket)
        self.add_socket("Engine", "output", EngineSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        model = node_instance.get_socket_value("Model", "input")
        node_instance.stored_engine = None
        if model is not None:
            node_instance.stored_engine = Engine(model=model)

        node_instance.set_socket_value("Engine", "output", node_instance.stored_engine)


@node()
class EngineGetConversationNode(Node):
    """Node for getting the conversation of the engine."""
    _title = "Get Conversation"
    _category = "Chatollama:2/Engine:2"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Engine In", "input", EngineSocket)
        self.add_socket("Engine Out", "output", EngineSocket)
        self.add_socket("Conversation", "output", ConversationSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        engine: Engine = node_instance.get_socket_value("Engine In", "input")
        if engine is not None:
            node_instance.set_socket_value("Conversation", "output", engine.conversation)
        else:
            node_instance.set_socket_value("Conversation", "output", None)

        node_instance.set_socket_value("Engine Out", "output", engine)


@node()
class EngineSetConversationNode(Node):
    """Node for setting the conversation of the engine."""
    _title = "Set Conversation"
    _category = "Chatollama:2/Engine:2"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Engine In", "input", EngineSocket)
        self.add_socket("Conversation", "input", ConversationSocket)
        self.add_socket("Engine Out", "output", EngineSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        engine: Engine = node_instance.get_socket_value("Engine In", "input")
        conversation: Conversation = node_instance.get_socket_value("Conversation", "input")
        if engine is not None and conversation is not None:
            engine.conversation = conversation
        node_instance.set_socket_value("Engine Out", "output", engine)


@node()
class EngineChatNode(Node):
    """Node for chatting with the engine."""
    _title = "Chat"
    _category = "Chatollama:2/Engine:2"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Engine In", "input", EngineSocket)
        self.add_socket("Engine Out", "output", EngineSocket)
        self.add_socket("Response", "output", TextSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        engine: Engine = node_instance.get_socket_value("Engine In", "input")
        if engine is not None:
            engine.chat()
            response = engine.response
            node_instance.set_socket_value("Response", "output", response)
        else:
            node_instance.set_socket_value("Response", "output", None)
        node_instance.set_socket_value("Engine Out", "output", engine)


@node()
class ConversationNode(Node):
    """Node for datetime input and output."""
    _title = "Conversation"
    _category = "Chatollama:2/Conversation:1"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Conversation", "output", ConversationSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        node_instance.set_socket_value("Conversation", "output", Conversation())


@socket()
class ConversationSocket(DataSocket):
    """Built-in conversation socket type for Conversation class instance."""
    color = "#9014A9"  # Light pastel blue

    @classmethod
    def init_socket(cls):
        """Initialize socket to only connect with other string sockets."""
        cls.add_to_white_list(cls)


@node()
class ConversationSetSystemNode(Node):
    """Node for setting the system message of the conversation."""
    _title = "Set System Message"
    _category = "Chatollama:2/Conversation:1"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Conversation In", "input", ConversationSocket)
        self.add_socket("System", "input", TextSocket)
        self.add_socket("Conversation Out", "output", ConversationSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        conversation: Conversation = node_instance.get_socket_value("Conversation In", "input")
        system: str = node_instance.get_socket_value("System", "input")
        if conversation is not None and system is not None:
            conversation.system(system)
        node_instance.set_socket_value("Conversation Out", "output", conversation)


@node()
class ConversationAddAssistantNode(Node):
    """Node for adding an assistant message to the conversation."""
    _title = "Add Assistant Message"
    _category = "Chatollama:2/Conversation:1"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Conversation In", "input", ConversationSocket)
        self.add_socket("Assistant", "input", TextSocket)
        self.add_socket("Conversation Out", "output", ConversationSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        conversation: Conversation = node_instance.get_socket_value("Conversation In", "input")
        assistant: str = node_instance.get_socket_value("Assistant", "input")
        if conversation is not None and assistant is not None:
            conversation.assistant(assistant)
        node_instance.set_socket_value("Conversation Out", "output", conversation)


@node()
class ConversationAddUserNode(Node):
    """Node for adding a user message to the conversation."""
    _title = "Add User Message"
    _category = "Chatollama:2/Conversation:1"
    _header_color = "#612E7D"
    _background_color = "#3B1D57"

    def __init__(self):
        super().__init__()
        self.add_socket("Conversation In", "input", ConversationSocket)
        self.add_socket("User", "input", TextSocket)
        self.add_socket("Conversation Out", "output", ConversationSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        conversation: Conversation = node_instance.get_socket_value("Conversation In", "input")
        user: str = node_instance.get_socket_value("User", "input")
        if conversation is not None and user is not None:
            conversation.user(user)
        node_instance.set_socket_value("Conversation Out", "output", conversation)


@node()
class UserInputNode(Node):
    """Node for getting user input."""
    _title = "User Input"
    _category = "I//O:2"
    _header_color = "#86652D"
    _background_color = "#5F471E"

    def __init__(self):
        super().__init__()
        self.add_socket("User", "output", TextSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        """Get user input and set it as the output value."""
        user_input = input("Enter text: ")
        node_instance.set_socket_value("User", "output", user_input)


@node()
class PrintNode(Node):
    """Node for printing a message."""
    _title = "Print"
    _category = "I//O:2"
    _header_color = "#86652D"
    _background_color = "#5F471E"

    def __init__(self):
        super().__init__()
        self.add_socket("Text", "input", TextSocket)

    def execute(self, node_instance: NodeInstance) -> None:
        """Print the input text value."""
        text = node_instance.get_socket_value("Text", "input")
        if text is not None:
            print(text)
