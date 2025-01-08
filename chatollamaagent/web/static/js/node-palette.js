class NodePalette {
    constructor(registry) {
        this.registry = registry;
        this.container = document.getElementById('node-palette');
        this.searchInput = document.getElementById('node-search');
        this.categoryStates = new Map();
        this.categoryPriorities = new Map();
        
        this.setupEventListeners();
        
        // Wait for node definitions to be loaded, then populate the palette
        this.registry.loadNodesFromServer().then(() => {
            this.populatePalette('');  // Initial population with empty search
        });
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => {
            this.populatePalette(e.target.value.trim().toLowerCase());
        });

        // Handle node dragging
        this.container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('node-item')) {
                try {
                    const nodeType = e.target.dataset.nodeType;
                    if (!nodeType) {
                        console.error('No node type found for dragged element');
                        return;
                    }
                    
                    // Use application-specific MIME type
                    e.dataTransfer.setData('application/x-node-type', nodeType);
                    
                    // Set a fallback for browsers that don't support custom MIME types
                    e.dataTransfer.setData('text/plain', nodeType);
                    
                    // Set drag effect
                    e.dataTransfer.effectAllowed = 'copy';
                } catch (error) {
                    console.error('Error starting drag operation:', error);
                }
            }
        });
    }

    findMatchingPaths(searchQuery, tree) {
        const matchingPaths = new Set();
        const searchLower = searchQuery.toLowerCase();
        
        // Helper function to check if a category or its descendants match
        const categoryMatches = (category) => {
            // Check if category name matches
            if (category.name.toLowerCase().includes(searchLower)) {
                return true;
            }

            // Check if any nodes in this category match
            if (category.nodes.some(node => 
                node.title.toLowerCase().includes(searchLower) ||
                node.category.toLowerCase().includes(searchLower)
            )) {
                return true;
            }

            // Check if any subcategories match
            return Array.from(category.subcategories).some(subcatPath => {
                const subcat = tree.get(subcatPath);
                return subcat && categoryMatches(subcat);
            });
        };

        // Helper function to add a category and all its parents to matching paths
        const addCategoryChain = (categoryPath) => {
            let current = categoryPath;
            while (current) {
                matchingPaths.add(current);
                const category = tree.get(current);
                current = category ? category.parent : null;
            }
        };

        // Go through all categories
        for (const [path, category] of tree) {
            if (categoryMatches(category)) {
                addCategoryChain(path);
            }
        }

        return matchingPaths;
    }

    // Extract priority from a category name
    getPriority(name) {
        const match = name.match(/:(-?\d+)$/);
        return match ? parseInt(match[1]) : 0;
    }

    // Get the highest priority for a full category path
    getHighestPriority(path) {
        if (this.categoryPriorities.has(path)) {
            return this.categoryPriorities.get(path);
        }

        const parts = path.split('/');
        let highestPriority = 0;
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const priority = this.getPriority(part);
            highestPriority = Math.max(highestPriority, priority);
        }

        this.categoryPriorities.set(path, highestPriority);
        return highestPriority;
    }

    // Compare categories for sorting
    compareCategories(categoryA, categoryB) {
        const hasExclamationA = categoryA.name.includes('!');
        const hasExclamationB = categoryB.name.includes('!');

        // First sort by ! flag
        if (hasExclamationA !== hasExclamationB) {
            return hasExclamationA ? -1 : 1;
        }

        // Within each group (! or no !), sort by priority
        const priorityA = this.getPriority(categoryA.name);
        const priorityB = this.getPriority(categoryB.name);

        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority comes first
        }

        // If priorities are equal, sort alphabetically
        const nameA = categoryA.name.replace('!', '').replace(/:\-?\d+$/, '');
        const nameB = categoryB.name.replace('!', '').replace(/:\-?\d+$/, '');
        return nameA.localeCompare(nameB);
    }

    populatePalette(searchQuery) {
        const tree = this.registry.getCategoryTree();
        this.container.innerHTML = '';
        this.categoryPriorities.clear();

        // If there's a search query, find all matching paths
        const matchingPaths = searchQuery ? this.findMatchingPaths(searchQuery, tree) : null;

        // Get root categories and sort them
        const rootCategories = Array.from(tree.entries())
            .filter(([path, category]) => !category.parent)
            .sort(([pathA, categoryA], [pathB, categoryB]) => 
                this.compareCategories(categoryA, categoryB)
            );

        // Render sorted root categories
        for (const [path, category] of rootCategories) {
            if (!searchQuery || matchingPaths.has(path)) {
                const rootCategory = this.renderCategory(category, tree, searchQuery, 0, matchingPaths);
                this.container.appendChild(rootCategory);
            }
        }
    }

    renderCategory(category, tree, searchQuery, depth, matchingPaths) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'node-category';

        // Create category header
        const header = document.createElement('div');
        header.className = 'category-header';
        
        const arrow = document.createElement('span');
        arrow.className = 'category-arrow' + (category.isExpanded ? ' expanded' : '');
        arrow.innerHTML = '▶';
        header.appendChild(arrow);

        const title = document.createElement('span');
        // Remove "!" and priority number from display name but keep them for sorting
        title.textContent = category.name.replace('!', '').replace(/:\-?\d+$/, '');
        header.appendChild(title);

        categoryDiv.appendChild(header);

        // Create content container
        const content = document.createElement('div');
        content.className = 'category-content' + (category.isExpanded ? '' : ' collapsed');

        // Sort and add subcategories
        const sortedSubcategories = Array.from(category.subcategories)
            .map(subcatPath => tree.get(subcatPath))
            .sort((a, b) => this.compareCategories(a, b));

        sortedSubcategories.forEach(subcat => {
            if (subcat) {
                // Only render subcategory if it's in matching paths or there's no search
                if (!searchQuery || matchingPaths.has(subcat.fullPath)) {
                    const subcatDiv = document.createElement('div');
                    subcatDiv.className = 'subcategory';
                    const renderedSubcat = this.renderCategory(subcat, tree, searchQuery, depth + 1, matchingPaths);
                    subcatDiv.appendChild(renderedSubcat);
                    content.appendChild(subcatDiv);
                }
            }
        });

        // Add nodes belonging to this category
        const filteredNodes = category.nodes.filter(node => {
            if (!searchQuery) return true;
            return node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   node.category.toLowerCase().includes(searchQuery.toLowerCase());
        });

        filteredNodes.forEach(node => {
            const nodeItem = document.createElement('div');
            nodeItem.className = 'node-item';
            nodeItem.draggable = true;
            nodeItem.dataset.nodeType = node.type;
            nodeItem.textContent = node.title;
            content.appendChild(nodeItem);
        });

        categoryDiv.appendChild(content);

        // Add click handler for category expansion
        header.addEventListener('click', () => {
            this.registry.toggleCategory(category.fullPath);
            arrow.classList.toggle('expanded');
            content.classList.toggle('collapsed');
        });

        return categoryDiv;
    }
} 