class NetworkStatistics {
    constructor(editor) {
        this.editor = editor;
        this.socketChart = null;
        this.categoryChart = null;
        this.initCharts();
        this.setupUpdateEvents();
    }

    initCharts() {
        // Socket Type Chart
        const socketCtx = document.getElementById('socket-type-chart').getContext('2d');
        this.socketChart = new Chart(socketCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff'
                        }
                    }
                }
            }
        });

        // Node Type Chart (formerly Category Chart)
        const categoryCtx = document.getElementById('category-chart').getContext('2d');
        this.categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }

    setupUpdateEvents() {
        // Update statistics when switching to console tab
        const consoleTab = document.querySelector('a[data-tab="console-tab"]');
        if (consoleTab) {
            consoleTab.addEventListener('click', () => this.updateAll());
        }
    }

    updateAll() {
        this.updateNodeStats();
        this.updateConnectionStats();
        this.updateSocketTypeChart();
        this.updateCategoryChart();
        this.updateHealthWarnings();
    }

    updateNodeStats() {
        document.getElementById('stat-total-nodes').textContent = this.editor.nodes.size;
        document.getElementById('stat-selected-nodes').textContent = this.editor.selectedNodes.size;
    }

    updateConnectionStats() {
        let flowCount = 0;
        let dataCount = 0;

        this.editor.connections.forEach(conn => {
            if (conn.from.type === 'flow') {
                flowCount++;
            } else {
                dataCount++;
            }
        });

        document.getElementById('stat-flow-connections').textContent = flowCount;
        document.getElementById('stat-data-connections').textContent = dataCount;
    }

    updateSocketTypeChart() {
        const socketTypes = new Map();
        const socketColors = new Map();

        // Collect socket types and their colors from the registry
        this.editor.nodes.forEach(node => {
            node.inputSockets.forEach(socket => {
                socketTypes.set(socket.socket_class, (socketTypes.get(socket.socket_class) || 0) + 1);
                socketColors.set(socket.socket_class, socket.color);
            });
            node.outputSockets.forEach(socket => {
                socketTypes.set(socket.socket_class, (socketTypes.get(socket.socket_class) || 0) + 1);
                socketColors.set(socket.socket_class, socket.color);
            });
        });

        const labels = Array.from(socketTypes.keys());
        this.socketChart.data.labels = labels;
        this.socketChart.data.datasets[0].data = Array.from(socketTypes.values());
        this.socketChart.data.datasets[0].backgroundColor = labels.map(type => socketColors.get(type));
        this.socketChart.update();
    }

    updateCategoryChart() {
        const nodeTypes = new Map();
        const nodeColors = new Map();
        
        this.editor.nodes.forEach(node => {
            const def = this.editor.registry.getDefinition(node.type);
            if (def) {
                nodeTypes.set(def.title, (nodeTypes.get(def.title) || 0) + 1);
                nodeColors.set(def.title, def.header_color);
            }
        });

        const labels = Array.from(nodeTypes.keys());
        this.categoryChart.data.labels = labels;
        this.categoryChart.data.datasets[0].data = Array.from(nodeTypes.values());
        this.categoryChart.data.datasets[0].backgroundColor = labels.map(type => nodeColors.get(type));
        this.categoryChart.update();
    }

    updateHealthWarnings() {
        const warnings = [];
        const healthList = document.getElementById('health-warnings');

        // Only check for completely disconnected (orphaned) nodes
        this.editor.nodes.forEach(node => {
            const hasAnyConnections = [
                ...node.flowSockets.inputs,
                ...node.flowSockets.outputs,
                ...node.inputSockets,
                ...node.outputSockets
            ].some(socket => this.editor.hasExistingConnection(socket));

            if (!hasAnyConnections) {
                warnings.push(`Node "${node.type}" is disconnected from the network`);
            }
        });

        // Update the warnings display
        if (warnings.length > 0) {
            healthList.innerHTML = warnings.map(w => `<div class="warning">${w}</div>`).join('');
        } else {
            healthList.innerHTML = '<div class="text-muted">No orphaned nodes detected</div>';
        }
    }
}

// Initialize statistics when the editor is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for editor to be available
    const checkAndInitStats = () => {
        if (window.editor) {
            window.networkStatistics = new NetworkStatistics(window.editor);
        } else {
            setTimeout(checkAndInitStats, 50);
        }
    };
    checkAndInitStats();
}); 