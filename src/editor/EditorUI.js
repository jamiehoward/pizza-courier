// EditorUI - Toolbar, property panel, and other UI elements for the editor

import { EditorTool, EditorEvents } from './EditorManager.js';

export class EditorUI {
    constructor(editorManager) {
        this.editorManager = editorManager;
        
        // UI elements
        this.container = null;
        this.toolbar = null;
        this.propertyPanel = null;
        this.statusBar = null;
        
        // Building shape dropdown state
        this.currentBuildingShape = 'box';
        
        // Create UI
        this._createStyles();
        this._createContainer();
        this._createToolbar();
        this._createPropertyPanel();
        this._createStatusBar();
        
        // Initially hidden
        this.hide();
    }

    _createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .editor-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 1000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .editor-toolbar {
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30, 30, 35, 0.95);
                border: 1px solid #444;
                border-radius: 8px;
                padding: 8px 12px;
                display: flex;
                gap: 8px;
                align-items: center;
                pointer-events: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            
            .editor-toolbar-group {
                display: flex;
                gap: 4px;
                padding-right: 8px;
                border-right: 1px solid #444;
            }
            
            .editor-toolbar-group:last-child {
                border-right: none;
                padding-right: 0;
            }
            
            .editor-btn {
                background: #3a3a40;
                border: 1px solid #555;
                color: #ddd;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .editor-btn:hover {
                background: #4a4a55;
                border-color: #666;
            }
            
            .editor-btn.active {
                background: #0088ff;
                border-color: #0099ff;
                color: white;
            }
            
            .editor-btn.danger:hover {
                background: #aa3333;
                border-color: #cc4444;
            }
            
            .editor-btn.success {
                background: #2a6a2a;
            }
            
            .editor-btn.success:hover {
                background: #3a8a3a;
            }
            
            .editor-select {
                background: #3a3a40;
                border: 1px solid #555;
                color: #ddd;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            }
            
            .editor-property-panel {
                position: absolute;
                top: 70px;
                right: 10px;
                width: 280px;
                background: rgba(30, 30, 35, 0.95);
                border: 1px solid #444;
                border-radius: 8px;
                padding: 16px;
                pointer-events: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            
            .editor-property-panel h3 {
                margin: 0 0 12px 0;
                color: #0af;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .editor-property-row {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .editor-property-label {
                width: 80px;
                color: #aaa;
                font-size: 12px;
            }
            
            .editor-property-value {
                flex: 1;
                display: flex;
                gap: 4px;
            }
            
            .editor-input {
                background: #2a2a30;
                border: 1px solid #444;
                color: #fff;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 12px;
                width: 100%;
            }
            
            .editor-input:focus {
                outline: none;
                border-color: #0088ff;
            }
            
            .editor-input-small {
                width: 55px;
            }
            
            .editor-checkbox {
                width: 18px;
                height: 18px;
                cursor: pointer;
            }
            
            .editor-color-input {
                width: 50px;
                height: 30px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                padding: 0;
            }
            
            .editor-status-bar {
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: rgba(30, 30, 35, 0.9);
                border: 1px solid #444;
                border-radius: 4px;
                padding: 8px 12px;
                color: #888;
                font-size: 12px;
                pointer-events: auto;
            }
            
            .editor-status-bar span {
                margin-right: 16px;
            }
            
            .editor-status-bar .mode {
                color: #0f0;
                font-weight: bold;
            }
            
            .editor-hint {
                position: absolute;
                bottom: 50px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 136, 255, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                font-size: 13px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            .editor-hint.visible {
                opacity: 1;
            }

            .editor-link-btn {
                background: #3a3a40;
                border: 1px solid #555;
                color: #888;
                padding: 4px 6px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            }

            .editor-link-btn.active {
                color: #0af;
                border-color: #0af;
            }
        `;
        document.head.appendChild(style);
    }

    _createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'editor-container';
        this.container.id = 'editor-ui';
        document.body.appendChild(this.container);
    }

    _createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'editor-toolbar';
        
        // Tool buttons group
        const toolGroup = document.createElement('div');
        toolGroup.className = 'editor-toolbar-group';
        
        this.toolButtons = {};
        
        // Select tool
        this.toolButtons.select = this._createButton('Select', () => {
            this.editorManager.setTool(EditorTool.SELECT);
        }, 'V');
        toolGroup.appendChild(this.toolButtons.select);
        
        // Building dropdown
        const buildingSelect = document.createElement('select');
        buildingSelect.className = 'editor-select';
        buildingSelect.innerHTML = `
            <option value="box">Box</option>
            <option value="cylinder">Cylinder</option>
            <option value="wedge">Wedge</option>
            <option value="cone">Cone</option>
        `;
        buildingSelect.addEventListener('change', (e) => {
            this.currentBuildingShape = e.target.value;
        });
        this.buildingSelect = buildingSelect;
        
        this.toolButtons.building = this._createButton('Building', () => {
            this.editorManager.setTool(EditorTool.BUILDING);
        }, 'B');
        toolGroup.appendChild(this.toolButtons.building);
        toolGroup.appendChild(buildingSelect);
        
        // Road tool
        this.toolButtons.road = this._createButton('Road', () => {
            this.editorManager.setTool(EditorTool.ROAD);
        }, 'R');
        toolGroup.appendChild(this.toolButtons.road);
        
        // Delete tool
        this.toolButtons.delete = this._createButton('Delete', () => {
            this.editorManager.deleteSelected();
        }, 'Del');
        this.toolButtons.delete.classList.add('danger');
        toolGroup.appendChild(this.toolButtons.delete);
        
        this.toolbar.appendChild(toolGroup);
        
        // History group
        const historyGroup = document.createElement('div');
        historyGroup.className = 'editor-toolbar-group';
        
        const undoBtn = this._createButton('↶ Undo', () => this.editorManager.undo(), 'Ctrl+Z');
        const redoBtn = this._createButton('↷ Redo', () => this.editorManager.redo(), 'Ctrl+Y');
        historyGroup.appendChild(undoBtn);
        historyGroup.appendChild(redoBtn);
        this.toolbar.appendChild(historyGroup);
        
        // File group
        const fileGroup = document.createElement('div');
        fileGroup.className = 'editor-toolbar-group';
        
        const saveBtn = this._createButton('💾 Save', () => this.editorManager.save(), 'Ctrl+S');
        const loadBtn = this._createButton('📂 Load', () => this._showLoadDialog());
        saveBtn.classList.add('success');
        fileGroup.appendChild(saveBtn);
        fileGroup.appendChild(loadBtn);
        this.toolbar.appendChild(fileGroup);
        
        // Mode group
        const modeGroup = document.createElement('div');
        modeGroup.className = 'editor-toolbar-group';
        
        const playBtn = this._createButton('▶ Play', () => this.editorManager.enterPlayMode(), 'F1');
        playBtn.style.background = '#228822';
        
        this.gridBtn = this._createButton('Grid: On', () => this.editorManager.toggleGrid(), 'G');
        
        modeGroup.appendChild(playBtn);
        modeGroup.appendChild(this.gridBtn);
        this.toolbar.appendChild(modeGroup);
        
        this.container.appendChild(this.toolbar);
    }

    _createButton(text, onClick, shortcut = '') {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.innerHTML = text;
        if (shortcut) {
            btn.title = shortcut;
        }
        btn.addEventListener('click', onClick);
        return btn;
    }

    _createPropertyPanel() {
        this.propertyPanel = document.createElement('div');
        this.propertyPanel.className = 'editor-property-panel';
        this.propertyPanel.style.display = 'none';
        
        this.propertyPanel.innerHTML = `
            <h3>Properties</h3>
            <div id="property-content">
                <p style="color: #666; font-size: 12px;">Select an object to edit its properties</p>
            </div>
        `;
        
        this.container.appendChild(this.propertyPanel);
    }

    _createStatusBar() {
        this.statusBar = document.createElement('div');
        this.statusBar.className = 'editor-status-bar';
        this.statusBar.innerHTML = `
            <span class="mode">EDIT MODE</span>
            <span>Objects: <span id="object-count">0</span></span>
            <span>Selected: <span id="selected-count">0</span></span>
            <span>Grid: <span id="grid-size">5</span></span>
        `;
        this.container.appendChild(this.statusBar);
        
        // Hint element
        this.hint = document.createElement('div');
        this.hint.className = 'editor-hint';
        this.container.appendChild(this.hint);
    }

    /**
     * Show the editor UI
     */
    show() {
        this.container.style.display = 'block';
        this.setActiveTool(EditorTool.SELECT);
    }

    /**
     * Hide the editor UI
     */
    hide() {
        this.container.style.display = 'none';
    }

    /**
     * Set the active tool button
     */
    setActiveTool(tool) {
        // Remove active from all tool buttons
        for (const btn of Object.values(this.toolButtons)) {
            btn.classList.remove('active');
        }
        
        // Set active on current tool
        if (this.toolButtons[tool]) {
            this.toolButtons[tool].classList.add('active');
        }
    }

    /**
     * Update grid button text
     */
    updateGridButton(enabled) {
        this.gridBtn.innerHTML = `Grid: ${enabled ? 'On' : 'Off'}`;
    }

    /**
     * Update the property panel with selected object(s)
     */
    updatePropertyPanel(selectedObjects) {
        const content = document.getElementById('property-content');
        
        if (selectedObjects.length === 0) {
            content.innerHTML = `<p style="color: #666; font-size: 12px;">Select an object to edit its properties</p>`;
            this.propertyPanel.style.display = 'none';
            return;
        }
        
        this.propertyPanel.style.display = 'block';
        
        if (selectedObjects.length === 1) {
            const obj = selectedObjects[0];
            content.innerHTML = this._createPropertyHTML(obj);
            this._attachPropertyListeners(obj);
        } else {
            content.innerHTML = `<p style="color: #aaa; font-size: 12px;">${selectedObjects.length} objects selected</p>`;
        }
    }

    _createPropertyHTML(obj) {
        const pos = obj.position || { x: 0, y: 0, z: 0 };
        const scale = obj.scale || { x: 1, y: 1, z: 1 };
        const rotation = obj.rotation || 0;
        const color = obj.color || '#4a4a4a';
        const collision = obj.collision !== false;
        
        return `
            <div class="editor-property-row">
                <span class="editor-property-label">Type</span>
                <span class="editor-property-value" style="color: #0af;">${obj.type || 'Unknown'}</span>
            </div>
            
            <div class="editor-property-row">
                <span class="editor-property-label">Position</span>
                <div class="editor-property-value">
                    <input type="number" class="editor-input editor-input-small" id="prop-pos-x" value="${pos.x.toFixed(1)}" step="1">
                    <input type="number" class="editor-input editor-input-small" id="prop-pos-y" value="${pos.y.toFixed(1)}" step="1">
                    <input type="number" class="editor-input editor-input-small" id="prop-pos-z" value="${pos.z.toFixed(1)}" step="1">
                </div>
            </div>
            
            <div class="editor-property-row">
                <span class="editor-property-label">Scale</span>
                <div class="editor-property-value">
                    <input type="number" class="editor-input editor-input-small" id="prop-scale-x" value="${scale.x.toFixed(1)}" step="0.5" min="0.1">
                    <input type="number" class="editor-input editor-input-small" id="prop-scale-y" value="${scale.y.toFixed(1)}" step="0.5" min="0.1">
                    <input type="number" class="editor-input editor-input-small" id="prop-scale-z" value="${scale.z.toFixed(1)}" step="0.5" min="0.1">
                    <button class="editor-link-btn ${obj.uniformScale ? 'active' : ''}" id="prop-scale-link" title="Uniform scale">🔗</button>
                </div>
            </div>
            
            <div class="editor-property-row">
                <span class="editor-property-label">Rotation</span>
                <div class="editor-property-value">
                    <input type="number" class="editor-input" id="prop-rotation" value="${(rotation * 180 / Math.PI).toFixed(0)}" step="15">
                    <span style="color: #666; padding-left: 4px;">°</span>
                </div>
            </div>
            
            <div class="editor-property-row">
                <span class="editor-property-label">Color</span>
                <div class="editor-property-value">
                    <input type="color" class="editor-color-input" id="prop-color" value="${color}">
                </div>
            </div>
            
            <div class="editor-property-row">
                <span class="editor-property-label">Collision</span>
                <div class="editor-property-value">
                    <input type="checkbox" class="editor-checkbox" id="prop-collision" ${collision ? 'checked' : ''}>
                </div>
            </div>
            
            <div style="margin-top: 16px; border-top: 1px solid #444; padding-top: 12px;">
                <button class="editor-btn danger" id="prop-delete" style="width: 100%;">Delete Object</button>
            </div>
        `;
    }

    _attachPropertyListeners(obj) {
        // Position inputs
        ['x', 'y', 'z'].forEach(axis => {
            const input = document.getElementById(`prop-pos-${axis}`);
            if (input) {
                input.addEventListener('change', () => {
                    const value = parseFloat(input.value) || 0;
                    obj.setPosition({ ...obj.position, [axis]: value });
                    this.editorManager.eventBus.emit(EditorEvents.OBJECT_MODIFIED, obj);
                });
            }
        });
        
        // Scale inputs
        const scaleLink = document.getElementById('prop-scale-link');
        if (scaleLink) {
            scaleLink.addEventListener('click', () => {
                obj.uniformScale = !obj.uniformScale;
                scaleLink.classList.toggle('active', obj.uniformScale);
            });
        }
        
        ['x', 'y', 'z'].forEach(axis => {
            const input = document.getElementById(`prop-scale-${axis}`);
            if (input) {
                input.addEventListener('change', () => {
                    const value = parseFloat(input.value) || 1;
                    if (obj.uniformScale) {
                        obj.setScale({ x: value, y: value, z: value });
                        document.getElementById('prop-scale-x').value = value.toFixed(1);
                        document.getElementById('prop-scale-y').value = value.toFixed(1);
                        document.getElementById('prop-scale-z').value = value.toFixed(1);
                    } else {
                        obj.setScale({ ...obj.scale, [axis]: value });
                    }
                    this.editorManager.eventBus.emit(EditorEvents.OBJECT_MODIFIED, obj);
                });
            }
        });
        
        // Rotation
        const rotInput = document.getElementById('prop-rotation');
        if (rotInput) {
            rotInput.addEventListener('change', () => {
                const degrees = parseFloat(rotInput.value) || 0;
                obj.setRotation(degrees * Math.PI / 180);
                this.editorManager.eventBus.emit(EditorEvents.OBJECT_MODIFIED, obj);
            });
        }
        
        // Color
        const colorInput = document.getElementById('prop-color');
        if (colorInput) {
            colorInput.addEventListener('change', () => {
                obj.setColor(colorInput.value);
                this.editorManager.eventBus.emit(EditorEvents.OBJECT_MODIFIED, obj);
            });
        }
        
        // Collision
        const collisionInput = document.getElementById('prop-collision');
        if (collisionInput) {
            collisionInput.addEventListener('change', () => {
                obj.setCollision(collisionInput.checked);
                this.editorManager.eventBus.emit(EditorEvents.OBJECT_MODIFIED, obj);
            });
        }
        
        // Delete button
        const deleteBtn = document.getElementById('prop-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.editorManager.removeObject(obj);
            });
        }
    }

    /**
     * Update status bar counts
     */
    updateCounts(objectCount, selectedCount) {
        const objEl = document.getElementById('object-count');
        const selEl = document.getElementById('selected-count');
        if (objEl) objEl.textContent = objectCount;
        if (selEl) selEl.textContent = selectedCount;
    }

    /**
     * Show a hint message
     */
    showHint(message, duration = 2000) {
        this.hint.textContent = message;
        this.hint.classList.add('visible');
        
        setTimeout(() => {
            this.hint.classList.remove('visible');
        }, duration);
    }

    /**
     * Get the currently selected building shape
     */
    getBuildingShape() {
        return this.currentBuildingShape;
    }

    _showLoadDialog() {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (this.editorManager.levelSerializer) {
                            this.editorManager.levelSerializer.loadFromData(data);
                        }
                    } catch (err) {
                        console.error('Failed to load level:', err);
                        this.showHint('Failed to load level file', 3000);
                    }
                };
                reader.readAsText(file);
            }
        });
        input.click();
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
