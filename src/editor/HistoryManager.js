// HistoryManager - Undo/Redo stack for editor actions

import { Building } from './objects/Building.js';

export class HistoryManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        
        // History stacks
        this.undoStack = [];
        this.redoStack = [];
        
        // Max history size
        this.maxHistory = 50;
    }

    /**
     * Push an action to the history
     */
    push(action) {
        this.undoStack.push(action);
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
        
        // Limit history size
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        console.log(`History: ${action.type} (${this.undoStack.length} items)`);
    }

    /**
     * Undo the last action
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.log('Nothing to undo');
            return;
        }
        
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        
        this._reverseAction(action);
        
        // Update UI
        if (this.editorManager.editorUI) {
            this.editorManager.editorUI.updatePropertyPanel(this.editorManager.selectedObjects);
            this.editorManager.editorUI.showHint('Undo: ' + action.type, 1000);
        }
    }

    /**
     * Redo the last undone action
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('Nothing to redo');
            return;
        }
        
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        
        this._applyAction(action);
        
        // Update UI
        if (this.editorManager.editorUI) {
            this.editorManager.editorUI.updatePropertyPanel(this.editorManager.selectedObjects);
            this.editorManager.editorUI.showHint('Redo: ' + action.type, 1000);
        }
    }

    /**
     * Reverse an action (for undo)
     */
    _reverseAction(action) {
        switch (action.type) {
            case 'create':
                this._undoCreate(action);
                break;
            case 'delete':
                this._undoDelete(action);
                break;
            case 'move':
                this._undoMove(action);
                break;
            case 'scale':
                this._undoScale(action);
                break;
            case 'rotate':
                this._undoRotate(action);
                break;
            case 'property':
                this._undoProperty(action);
                break;
        }
    }

    /**
     * Apply an action (for redo)
     */
    _applyAction(action) {
        switch (action.type) {
            case 'create':
                this._redoCreate(action);
                break;
            case 'delete':
                this._redoDelete(action);
                break;
            case 'move':
                this._redoMove(action);
                break;
            case 'scale':
                this._redoScale(action);
                break;
            case 'rotate':
                this._redoRotate(action);
                break;
            case 'property':
                this._redoProperty(action);
                break;
        }
    }

    // Undo handlers
    _undoCreate(action) {
        const obj = action.object;
        
        // Remove from scene
        const scene = this.editorManager.getScene();
        if (scene && obj.mesh) {
            scene.remove(obj.mesh);
        }
        
        // Remove from objects array
        const index = this.editorManager.objects.indexOf(obj);
        if (index > -1) {
            this.editorManager.objects.splice(index, 1);
        }
        
        // Clear selection if this was selected
        this.editorManager.deselectObject(obj);
    }

    _undoDelete(action) {
        // Recreate the object from serialized data
        const data = action.data;
        let obj;
        
        if (data.shape || data.type === 'box' || data.type === 'cylinder' || 
            data.type === 'cone' || data.type === 'wedge') {
            obj = Building.deserialize(data);
        } else {
            // Generic object - use the stored object
            obj = action.object;
        }
        
        if (!obj.mesh) {
            obj.createMesh();
        }
        
        // Add to scene
        const scene = this.editorManager.getScene();
        if (scene) {
            obj.addToScene(scene);
        }
        
        // Add to objects array
        this.editorManager.objects.push(obj);
        
        // Store recreated object for potential redo
        action.object = obj;
    }

    _undoMove(action) {
        action.object.setPosition(action.oldPosition || action.oldValue);
    }

    _undoScale(action) {
        action.object.setScale(action.oldScale || action.oldValue);
    }

    _undoRotate(action) {
        action.object.setRotation(action.oldRotation);
    }

    _undoProperty(action) {
        const obj = action.object;
        
        if (action.property === 'color') {
            obj.setColor(action.oldValue);
        } else if (action.property === 'collision') {
            obj.setCollision(action.oldValue);
        }
    }

    // Redo handlers
    _redoCreate(action) {
        const obj = action.object;
        
        if (!obj.mesh) {
            obj.createMesh();
        }
        
        // Add to scene
        const scene = this.editorManager.getScene();
        if (scene) {
            obj.addToScene(scene);
        }
        
        // Add to objects array
        this.editorManager.objects.push(obj);
    }

    _redoDelete(action) {
        const obj = action.object;
        
        // Remove from scene
        const scene = this.editorManager.getScene();
        if (scene && obj.mesh) {
            scene.remove(obj.mesh);
        }
        
        // Remove from objects array
        const index = this.editorManager.objects.indexOf(obj);
        if (index > -1) {
            this.editorManager.objects.splice(index, 1);
        }
        
        // Clear selection
        this.editorManager.deselectObject(obj);
    }

    _redoMove(action) {
        action.object.setPosition(action.newPosition || action.newValue);
    }

    _redoScale(action) {
        action.object.setScale(action.newScale || action.newValue);
    }

    _redoRotate(action) {
        action.object.setRotation(action.newRotation);
    }

    _redoProperty(action) {
        const obj = action.object;
        
        if (action.property === 'color') {
            obj.setColor(action.newValue);
        } else if (action.property === 'collision') {
            obj.setCollision(action.newValue);
        }
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
}
