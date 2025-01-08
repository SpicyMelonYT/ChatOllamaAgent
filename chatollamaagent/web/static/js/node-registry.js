class NodeDefinition {
    constructor(type, title, category, inputs = [], outputs = [], background_color = "#252525", header_color = "#353535") {
        this.type = type;
        this.title = title;
        this.category = category;
        this.inputs = inputs;
        this.outputs = outputs;
        this.background_color = background_color;
        this.header_color = header_color;
    }
}

class NodeRegistry {
    constructor() {
        this.definitions = new Map();
        this.categoryTree = new Map();
        this.categoryStates = new Map();
    }

    // Normalize a category name by removing priority numbers
    normalizeCategoryName(name) {
        return name.replace(/:\-?\d+$/, '');
    }

    // Get the normalized path for a category
    getNormalizedPath(parts, currentIndex) {
        return parts
            .slice(0, currentIndex + 1)
            .map(part => this.normalizeCategoryName(part.replace(/\/\//g, '/')))
            .join('/');
    }

    async loadNodesFromServer() {
        return new Promise((resolve, reject) => {
            const wsManager = window.wsManager;

            // Function to send the request once we're sure the connection is ready
            const sendRequest = () => {
                wsManager.send({
                    type: 'get_node_definitions'
                });

                wsManager.addMessageListener('node_definitions', (data) => {
                    this.definitions.clear();
                    this.categoryTree.clear();
                    
                    // Process and store node definitions
                    data.nodes.forEach(nodeDef => {
                        // Store the definition as is - no need to modify socket types
                        this.definitions.set(nodeDef.type, nodeDef);
                        this.addToCategory(nodeDef);
                    });
                    
                    resolve();
                });
            };

            // If WebSocket is already connected, send request immediately
            if (wsManager.socket && wsManager.socket.readyState === WebSocket.OPEN) {
                sendRequest();
            } else {
                // Otherwise wait for the connection to be established
                wsManager.addMessageListener('connection_ready', () => {
                    sendRequest();
                });
            }
        });
    }

    addToCategory(nodeDef) {
        const categoryPath = nodeDef.category || 'Uncategorized';
        
        // Split by single slashes but preserve double slashes
        // This regex splits on single slashes that aren't preceded or followed by another slash
        const parts = categoryPath.split(/(?<!\/)\/(?!\/)/);
        
        // Remove the double slashes in the parts
        const cleanParts = parts.map(part => part.replace(/\/\//g, '/'));
        
        let parentPath = null;

        cleanParts.forEach((part, index) => {
            const isLast = index === cleanParts.length - 1;
            const normalizedPath = this.getNormalizedPath(cleanParts, index);

            // If this category doesn't exist yet, create it
            if (!this.categoryTree.has(normalizedPath)) {
                this.categoryTree.set(normalizedPath, {
                    name: part, // Keep original name with priority for sorting
                    fullPath: normalizedPath,
                    parent: parentPath,
                    subcategories: new Set(),
                    nodes: [],
                    isExpanded: false
                });

                if (parentPath) {
                    const parentCategory = this.categoryTree.get(parentPath);
                    if (parentCategory) {
                        parentCategory.subcategories.add(normalizedPath);
                    }
                }
            } else {
                // Update the name if this one has a higher priority
                const existingCategory = this.categoryTree.get(normalizedPath);
                const existingPriority = this.getPriority(existingCategory.name);
                const newPriority = this.getPriority(part);
                if (newPriority > existingPriority) {
                    existingCategory.name = part;
                }
            }

            if (isLast) {
                const category = this.categoryTree.get(normalizedPath);
                category.nodes.push(nodeDef);
            }

            parentPath = normalizedPath;
        });
    }

    // Extract priority from a category name
    getPriority(name) {
        const match = name.match(/:(-?\d+)$/);
        return match ? parseInt(match[1]) : 0;
    }

    getDefinition(type) {
        return this.definitions.get(type);
    }

    getCategoryTree() {
        return this.categoryTree;
    }

    toggleCategory(path) {
        const category = this.categoryTree.get(path);
        if (category) {
            category.isExpanded = !category.isExpanded;
        }
    }
} 