// EditorManager - Toggle between edit and play modes, coordinate editor tools

import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';

export const EditorMode = {
    PLAY: 'play',
    EDIT: 'edit'
};

export const EditorTool = {
    SELECT: 'select',
    MOVE: 'move',
    SCALE: 'scale',
    BUILDING: 'building',
    ROAD: 'road',
    DELETE: 'delete'
};

export const EditorEvents = {
    MODE_CHANGED: 'editor:mode:changed',
    TOOL_CHANGED: 'editor:tool:changed',
    SELECTION_CHANGED: 'editor:selection:changed',
    OBJECT_CREATED: 'editor:object:created',
    OBJECT_DELETED: 'editor:object:deleted',
    OBJECT_MODIFIED: 'editor:object:modified',
    LEVEL_LOADED: 'editor:level:loaded',
    LEVEL_SAVED: 'editor:level:saved'
};

export class EditorManager {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.eventBus = new EventBus();
        
        // State
        this.mode = EditorMode.PLAY;
        this.currentTool = EditorTool.SELECT;
        this.isEnabled = false;
        
        // Editor objects (buildings, roads, etc.)
        this.objects = [];
        this.selectedObjects = [];
        
        // Level data
        this.levelData = {
            version: 1,
            name: 'Untitled',
            spawnPoint: { x: 0, y: 2, z: 0 },
            buildings: [],
            roads: []
        };
        
        // Grid settings
        this.gridEnabled = true;
        this.gridSize = 5;
        
        // Sub-managers (will be set later)
        this.editorCamera = null;
        this.editorUI = null;
        this.selectionManager = null;
        this.historyManager = null;
        this.gizmoManager = null;
        this.levelSerializer = null;
        
        // Tools
        this.tools = {};
        
        // Bind methods
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * Initialize the editor
     */
    init() {
        // Add keyboard listener for F1 toggle
        window.addEventListener('keydown', this._onKeyDown);
        
        console.log('EditorManager initialized. Press F1 to toggle edit mode.');
    }

    /**
     * Set sub-managers after they're created
     */
    setManagers({ editorCamera, editorUI, selectionManager, historyManager, gizmoManager, levelSerializer }) {
        if (editorCamera) this.editorCamera = editorCamera;
        if (editorUI) this.editorUI = editorUI;
        if (selectionManager) this.selectionManager = selectionManager;
        if (historyManager) this.historyManager = historyManager;
        if (gizmoManager) this.gizmoManager = gizmoManager;
        if (levelSerializer) this.levelSerializer = levelSerializer;
    }

    /**
     * Register a tool
     */
    registerTool(name, tool) {
        this.tools[name] = tool;
        tool.setEditorManager(this);
    }

    /**
     * Handle keyboard input
     */
    _onKeyDown(e) {
        // F1 toggles edit mode
        if (e.key === 'F1') {
            e.preventDefault();
            this.toggleMode();
            return;
        }
        
        // Only handle editor shortcuts in edit mode
        if (this.mode !== EditorMode.EDIT) return;
        
        // Tool shortcuts
        switch (e.key.toLowerCase()) {
            case 'v': // Select tool
                this.setTool(EditorTool.SELECT);
                break;
            case 'g': // Toggle grid
                this.toggleGrid();
                break;
            case 'b': // Building tool
                this.setTool(EditorTool.BUILDING);
                break;
            case 'r': // Road tool
                this.setTool(EditorTool.ROAD);
                break;
            case 'delete':
            case 'backspace':
                this.deleteSelected();
                break;
        }
        
        // Undo/Redo
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                e.preventDefault();
                this.redo();
            } else if (e.key === 's') {
                e.preventDefault();
                this.save();
            }
        }
    }

    /**
     * Toggle between play and edit modes
     */
    toggleMode() {
        if (this.mode === EditorMode.PLAY) {
            this.enterEditMode();
        } else {
            this.enterPlayMode();
        }
    }

    /**
     * Enter edit mode
     */
    enterEditMode() {
        this.mode = EditorMode.EDIT;
        this.isEnabled = true;
        
        // Pause the game
        if (this.gameManager) {
            this.gameManager.pause();
        }
        
        // Switch to editor camera
        if (this.editorCamera) {
            this.editorCamera.enable();
        }
        
        // Show editor UI
        if (this.editorUI) {
            this.editorUI.show();
        }
        
        // Show grid
        this._showGrid();
        
        // Enable gizmos
        if (this.gizmoManager) {
            this.gizmoManager.enable();
        }
        
        this.eventBus.emit(EditorEvents.MODE_CHANGED, EditorMode.EDIT);
        console.log('Entered EDIT mode');
    }

    /**
     * Enter play mode
     */
    enterPlayMode() {
        this.mode = EditorMode.PLAY;
        this.isEnabled = false;
        
        // Clear selection
        this.clearSelection();
        
        // Hide editor UI
        if (this.editorUI) {
            this.editorUI.hide();
        }
        
        // Hide grid
        this._hideGrid();
        
        // Disable gizmos
        if (this.gizmoManager) {
            this.gizmoManager.disable();
        }
        
        // Switch back to game camera
        if (this.editorCamera) {
            this.editorCamera.disable();
        }
        
        // Resume the game
        if (this.gameManager) {
            this.gameManager.resume();
        }
        
        this.eventBus.emit(EditorEvents.MODE_CHANGED, EditorMode.PLAY);
        console.log('Entered PLAY mode');
    }

    /**
     * Set the current tool
     */
    setTool(tool) {
        // Deactivate current tool
        if (this.tools[this.currentTool]) {
            this.tools[this.currentTool].deactivate();
        }
        
        this.currentTool = tool;
        
        // Activate new tool
        if (this.tools[tool]) {
            this.tools[tool].activate();
        }
        
        // Update UI
        if (this.editorUI) {
            this.editorUI.setActiveTool(tool);
        }
        
        this.eventBus.emit(EditorEvents.TOOL_CHANGED, tool);
    }

    /**
     * Toggle grid visibility and snapping
     */
    toggleGrid() {
        this.gridEnabled = !this.gridEnabled;
        if (this.gridEnabled) {
            this._showGrid();
        } else {
            this._hideGrid();
        }
        
        if (this.editorUI) {
            this.editorUI.updateGridButton(this.gridEnabled);
        }
    }

    /**
     * Snap a value to the grid
     */
    snapToGrid(value) {
        if (!this.gridEnabled) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }

    /**
     * Snap a vector to the grid
     */
    snapVectorToGrid(vector) {
        if (!this.gridEnabled) return vector;
        return new THREE.Vector3(
            this.snapToGrid(vector.x),
            this.snapToGrid(vector.y),
            this.snapToGrid(vector.z)
        );
    }

    _showGrid() {
        // Grid is handled in the scene setup - just mark as visible
        // The actual grid helper is in the GameManager scene
    }

    _hideGrid() {
        // Grid visibility toggle
    }

    /**
     * Add an object to the editor
     */
    addObject(object) {
        this.objects.push(object);
        this.eventBus.emit(EditorEvents.OBJECT_CREATED, object);
        
        // Add to history
        if (this.historyManager) {
            this.historyManager.push({
                type: 'create',
                object: object,
                data: object.serialize()
            });
        }
        
        // Update UI counts
        if (this.editorUI) {
            this.editorUI.updateCounts(
                this.objects.length,
                this.selectedObjects.length
            );
        }
    }

    /**
     * Remove an object from the editor
     */
    removeObject(object) {
        const index = this.objects.indexOf(object);
        if (index > -1) {
            // Store serialized data before removing
            const serializedData = object.serialize();
            
            this.objects.splice(index, 1);
            
            // Remove from selection
            this.deselectObject(object);
            
            // Remove from scene
            if (object.mesh && this.gameManager) {
                this.gameManager.scene.remove(object.mesh);
            }
            
            this.eventBus.emit(EditorEvents.OBJECT_DELETED, object);
            
            // Add to history
            if (this.historyManager) {
                this.historyManager.push({
                    type: 'delete',
                    object: object,
                    data: serializedData
                });
            }
            
            // Update UI counts
            if (this.editorUI) {
                this.editorUI.updateCounts(
                    this.objects.length,
                    this.selectedObjects.length
                );
            }
        }
    }

    /**
     * Select an object
     */
    selectObject(object, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }
        
        if (!this.selectedObjects.includes(object)) {
            this.selectedObjects.push(object);
            object.setSelected(true);
        }
        
        this.eventBus.emit(EditorEvents.SELECTION_CHANGED, this.selectedObjects);
        
        // Update property panel and counts
        if (this.editorUI) {
            this.editorUI.updatePropertyPanel(this.selectedObjects);
            this.editorUI.updateCounts(
                this.objects.length,
                this.selectedObjects.length
            );
        }
        
        // Update gizmo
        if (this.gizmoManager && this.selectedObjects.length > 0) {
            this.gizmoManager.attachTo(this.selectedObjects[0]);
        }
    }

    /**
     * Deselect an object
     */
    deselectObject(object) {
        const index = this.selectedObjects.indexOf(object);
        if (index > -1) {
            this.selectedObjects.splice(index, 1);
            object.setSelected(false);
        }
        
        this.eventBus.emit(EditorEvents.SELECTION_CHANGED, this.selectedObjects);
        
        // Update gizmo
        if (this.gizmoManager) {
            if (this.selectedObjects.length > 0) {
                this.gizmoManager.attachTo(this.selectedObjects[0]);
            } else {
                this.gizmoManager.detach();
            }
        }
    }

    /**
     * Clear all selection
     */
    clearSelection() {
        for (const obj of this.selectedObjects) {
            obj.setSelected(false);
        }
        this.selectedObjects = [];
        
        this.eventBus.emit(EditorEvents.SELECTION_CHANGED, this.selectedObjects);
        
        // Update property panel and counts
        if (this.editorUI) {
            this.editorUI.updatePropertyPanel([]);
            this.editorUI.updateCounts(
                this.objects.length,
                0
            );
        }
        
        // Detach gizmo
        if (this.gizmoManager) {
            this.gizmoManager.detach();
        }
    }

    /**
     * Delete selected objects
     */
    deleteSelected() {
        const toDelete = [...this.selectedObjects];
        for (const obj of toDelete) {
            this.removeObject(obj);
        }
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.historyManager) {
            this.historyManager.undo();
        }
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyManager) {
            this.historyManager.redo();
        }
    }

    /**
     * Save level
     */
    save() {
        if (this.levelSerializer) {
            this.levelSerializer.save();
        }
    }

    /**
     * Load level
     */
    load() {
        if (this.levelSerializer) {
            this.levelSerializer.load();
        }
    }

    /**
     * Get the Three.js scene
     */
    getScene() {
        return this.gameManager ? this.gameManager.scene : null;
    }

    /**
     * Get the renderer
     */
    getRenderer() {
        return this.gameManager ? this.gameManager.renderer : null;
    }

    /**
     * Get the current camera (editor or game)
     */
    getCamera() {
        if (this.mode === EditorMode.EDIT && this.editorCamera) {
            return this.editorCamera.camera;
        }
        return this.gameManager ? this.gameManager.cameraController.getCamera() : null;
    }

    /**
     * Update (called each frame)
     */
    update(deltaTime) {
        if (this.mode !== EditorMode.EDIT) return;
        
        // Update editor camera
        if (this.editorCamera) {
            this.editorCamera.update(deltaTime);
        }
        
        // Update current tool
        if (this.tools[this.currentTool]) {
            this.tools[this.currentTool].update(deltaTime);
        }
        
        // Update gizmos
        if (this.gizmoManager) {
            this.gizmoManager.update();
        }
    }

    /**
     * Clean up
     */
    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        
        // Clean up tools
        for (const tool of Object.values(this.tools)) {
            if (tool.destroy) tool.destroy();
        }
        
        // Clean up sub-managers
        if (this.editorUI) this.editorUI.destroy();
        if (this.editorCamera) this.editorCamera.destroy();
        if (this.selectionManager) this.selectionManager.destroy();
        if (this.gizmoManager) this.gizmoManager.destroy();
    }
}
