class SettingsManager {
    constructor() {
        this.settingsModal = document.getElementById('settingsModal');
        this.settingsBody = this.settingsModal.querySelector('.modal-body');
        this.saveButton = this.settingsModal.querySelector('.btn-primary');
        
        // Get config manager from the global nodeInterfaceManager
        this.configManager = window.nodeInterfaceManager.configManager;
        
        // Bind event listeners
        this.saveButton.addEventListener('click', () => this.saveSettings());
        
        // Listen for modal show event to load settings
        this.settingsModal.addEventListener('show.bs.modal', () => this.loadSettings());
    }

    createSettingElement(key, value) {
        const settingItem = document.createElement('div');
        settingItem.className = 'setting-item';
        
        switch(typeof value) {
            case 'boolean':
                settingItem.innerHTML = `
                    <div class="form-check form-switch">
                        <input type="checkbox" class="form-check-input" id="setting-${key}" 
                               ${value ? 'checked' : ''} data-setting-key="${key}">
                        <label class="form-check-label" for="setting-${key}">
                            ${this.formatLabel(key)}
                        </label>
                    </div>`;
                break;
                
            case 'number':
                settingItem.innerHTML = `
                    <div class="mb-3">
                        <label class="form-label" for="setting-${key}">
                            ${this.formatLabel(key)}
                        </label>
                        <input type="number" class="form-control" id="setting-${key}" 
                               value="${value}" data-setting-key="${key}">
                    </div>`;
                break;

            case 'object':
                if (value === null) {
                    // Handle null values with a string input that can be set to "null"
                    settingItem.innerHTML = `
                        <div class="mb-3">
                            <label class="form-label" for="setting-${key}">
                                ${this.formatLabel(key)} (null)
                            </label>
                            <input type="text" class="form-control" id="setting-${key}" 
                                   value="" placeholder="Enter value or leave empty for null" 
                                   data-setting-key="${key}" data-value-type="null">
                        </div>`;
                } else if (Array.isArray(value)) {
                    // Handle arrays with a dynamic list editor
                    const listItems = value.map((item, index) => 
                        this.createListItemElement(item, index)).join('');
                    
                    settingItem.innerHTML = `
                        <div class="mb-3">
                            <label class="form-label" for="setting-${key}">
                                ${this.formatLabel(key)} (List)
                            </label>
                            <div class="list-editor" id="setting-${key}" data-setting-key="${key}">
                                <div class="list-items">
                                    ${listItems}
                                </div>
                                <button type="button" class="btn btn-sm btn-secondary mt-2 add-item-btn">
                                    <i class="bi bi-plus"></i> Add Item
                                </button>
                            </div>
                        </div>`;

                    // Add event listeners after the element is added to the DOM
                    setTimeout(() => {
                        const listEditor = settingItem.querySelector('.list-editor');
                        this.setupListEditor(listEditor, value);
                    }, 0);
                } else {
                    // Handle objects with a key-value editor
                    const objectEntries = Object.entries(value).map(([k, v], index) => 
                        this.createObjectEntryElement(k, v, index)).join('');
                    
                    settingItem.innerHTML = `
                        <div class="mb-3">
                            <label class="form-label" for="setting-${key}">
                                ${this.formatLabel(key)} (Object)
                            </label>
                            <div class="object-editor" id="setting-${key}" data-setting-key="${key}">
                                <div class="object-entries">
                                    ${objectEntries}
                                </div>
                                <button type="button" class="btn btn-sm btn-secondary mt-2 add-entry-btn">
                                    <i class="bi bi-plus"></i> Add Entry
                                </button>
                            </div>
                        </div>`;

                    // Add event listeners after the element is added to the DOM
                    setTimeout(() => {
                        const objectEditor = settingItem.querySelector('.object-editor');
                        this.setupObjectEditor(objectEditor, value);
                    }, 0);
                }
                break;
                
            default: // strings and everything else
                settingItem.innerHTML = `
                    <div class="mb-3">
                        <label class="form-label" for="setting-${key}">
                            ${this.formatLabel(key)}
                        </label>
                        <input type="text" class="form-control" id="setting-${key}" 
                               value="${value || ''}" data-setting-key="${key}">
                    </div>`;
        }
        
        return settingItem;
    }

    createListItemElement(value, index) {
        return `
            <div class="list-item input-group mb-2">
                <input type="text" class="form-control" value="${value}" 
                       placeholder="Enter value">
                <button class="btn btn-outline-danger remove-item-btn" type="button">
                    <i class="bi bi-trash"></i>
                </button>
            </div>`;
    }

    createObjectEntryElement(key, value, index) {
        return `
            <div class="object-entry input-group mb-2">
                <input type="text" class="form-control key-input" value="${key}" 
                       placeholder="Enter key">
                <input type="text" class="form-control value-input" value="${value}" 
                       placeholder="Enter value">
                <button class="btn btn-outline-danger remove-entry-btn" type="button">
                    <i class="bi bi-trash"></i>
                </button>
            </div>`;
    }

    setupListEditor(listEditor, initialValue) {
        const key = listEditor.dataset.settingKey;
        const itemsContainer = listEditor.querySelector('.list-items');
        const addButton = listEditor.querySelector('.add-item-btn');

        // Add new item
        addButton.addEventListener('click', () => {
            const newItem = document.createElement('div');
            newItem.innerHTML = this.createListItemElement('', itemsContainer.children.length);
            itemsContainer.appendChild(newItem.firstElementChild);
        });

        // Handle remove buttons
        listEditor.addEventListener('click', (e) => {
            if (e.target.closest('.remove-item-btn')) {
                e.target.closest('.list-item').remove();
            }
        });
    }

    setupObjectEditor(objectEditor, initialValue) {
        const key = objectEditor.dataset.settingKey;
        const entriesContainer = objectEditor.querySelector('.object-entries');
        const addButton = objectEditor.querySelector('.add-entry-btn');

        // Add new entry
        addButton.addEventListener('click', () => {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = this.createObjectEntryElement('', '', entriesContainer.children.length);
            entriesContainer.appendChild(newEntry.firstElementChild);
        });

        // Handle remove buttons
        objectEditor.addEventListener('click', (e) => {
            if (e.target.closest('.remove-entry-btn')) {
                e.target.closest('.object-entry').remove();
            }
        });
    }

    formatLabel(key) {
        // Convert camelCase or snake_case to Title Case with spaces
        return key
            .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
            .replace(/_/g, ' ') // Replace underscores with spaces
            .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
            .trim();
    }

    loadSettings() {
        // Clear existing settings
        this.settingsBody.innerHTML = '';
        
        // Get all config from the config manager
        const config = this.configManager.config;
        
        // Group settings by category (if no category, use 'General')
        const categories = {};
        
        for (const [key, value] of Object.entries(config)) {
            const category = key.includes('.') ? key.split('.')[0] : 'General';
            if (!categories[category]) {
                categories[category] = {};
            }
            const settingKey = key.includes('.') ? key.split('.').slice(1).join('.') : key;
            categories[category][settingKey] = value;
        }
        
        // Create sections for each category
        for (const [category, settings] of Object.entries(categories)) {
            const section = document.createElement('div');
            section.className = 'settings-section';
            section.innerHTML = `<h6>${this.formatLabel(category)}</h6>`;
            
            for (const [key, value] of Object.entries(settings)) {
                const settingElement = this.createSettingElement(key, value);
                if (settingElement) {
                    section.appendChild(settingElement);
                }
            }
            
            this.settingsBody.appendChild(section);
        }
    }

    saveSettings() {
        // Collect all setting inputs
        const inputs = this.settingsBody.querySelectorAll('[data-setting-key]');
        
        inputs.forEach(input => {
            const key = input.dataset.settingKey;
            let value;
            
            if (input.classList.contains('list-editor')) {
                // Handle lists
                value = Array.from(input.querySelectorAll('.list-item input'))
                    .map(input => {
                        const val = input.value.trim();
                        // Try to parse numbers if possible
                        return !isNaN(val) ? Number(val) : val;
                    });
            } else if (input.classList.contains('object-editor')) {
                // Handle objects
                value = {};
                input.querySelectorAll('.object-entry').forEach(entry => {
                    const keyInput = entry.querySelector('.key-input');
                    const valueInput = entry.querySelector('.value-input');
                    if (keyInput.value.trim()) {
                        const val = valueInput.value.trim();
                        // Try to parse numbers if possible
                        value[keyInput.value.trim()] = !isNaN(val) ? Number(val) : val;
                    }
                });
            } else if (input.dataset.valueType === 'null' && !input.value.trim()) {
                // Handle null values
                value = null;
            } else if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.type === 'number') {
                value = parseFloat(input.value);
            } else {
                value = input.value;
            }
            
            // Save to config manager
            this.configManager.set(key, value);
        });
        
        // Close the modal
        bootstrap.Modal.getInstance(this.settingsModal).hide();
    }
} 