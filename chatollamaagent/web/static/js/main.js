document.addEventListener('DOMContentLoaded', () => {
    // Use the global WebSocket manager instance
    const wsManager = window.wsManager;

    // Initialize Node Registry and Palette
    const registry = new NodeRegistry();
    const palette = new NodePalette(registry);

    // Initialize Node Editor with registry and make it globally available
    window.editor = new NodeEditor(registry);

    // Wait for nodeInterfaceManager to be available
    const checkAndInitSettings = () => {
        if (window.nodeInterfaceManager) {
            window.settingsManager = new SettingsManager();
        } else {
            setTimeout(checkAndInitSettings, 50);
        }
    };
    checkAndInitSettings();

    // Handle File menu actions
    document.getElementById('menu-new').addEventListener('click', () => {
        // Clear all nodes from the editor
        editor.clearAllNodes();
    });

    document.getElementById('menu-open').addEventListener('click', () => {
        // Create a file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.coa';
        
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = readerEvent => {
                try {
                    const network = JSON.parse(readerEvent.target.result);
                    editor.deserialize_node_network(network);
                } catch (error) {
                    console.error('Error loading network file:', error);
                    alert('Error loading network file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    });

    document.getElementById('menu-save').addEventListener('click', async () => {
        try {
            // Serialize the network
            const network = editor.serialize_node_network();
            const jsonString = JSON.stringify(network, null, 2);

            // Use the showSaveFilePicker API if available
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'network.coa',
                    types: [{
                        description: 'Chat Ollama Agent Network',
                        accept: {
                            'application/json': ['.coa']
                        }
                    }]
                });
                
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
            } else {
                // Fallback for browsers that don't support showSaveFilePicker
                const blob = new Blob([jsonString], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'network.coa';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {  // Don't show error if user just cancelled
                console.error('Error saving network file:', error);
                alert('Error saving network file: ' + error.message);
            }
        }
    });

    // Handle View menu actions
    document.getElementById('menu-reset-view').addEventListener('click', () => {
        editor.resetView();
    });

    document.getElementById('menu-center-selected').addEventListener('click', () => {
        editor.centerSelectedNodes();
    });

    // Handle tab switching - only select tabs that have data-tab attribute
    const tabs = document.querySelectorAll('.nav-link[data-tab]');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all tabs and panes
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding pane
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (wsManager && wsManager.socket) {
            wsManager.closeImmediately();
        }
    });
}); 