// SelectionManager - Handle click selection with raycasting

import * as THREE from 'three';
import { EditorMode, EditorTool } from './EditorManager.js';

export class SelectionManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        
        // Raycaster for click detection
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // State
        this.enabled = false;
        this.isDragging = false;
        this.dragStartPos = new THREE.Vector2();
        this.dragThreshold = 5; // Pixels
        
        // Bind event handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
    }

    /**
     * Enable selection
     */
    enable() {
        this.enabled = true;
        
        const renderer = this.editorManager.getRenderer();
        if (renderer) {
            renderer.domElement.addEventListener('mousedown', this._onMouseDown);
            renderer.domElement.addEventListener('mousemove', this._onMouseMove);
            renderer.domElement.addEventListener('mouseup', this._onMouseUp);
        }
    }

    /**
     * Disable selection
     */
    disable() {
        this.enabled = false;
        
        const renderer = this.editorManager.getRenderer();
        if (renderer) {
            renderer.domElement.removeEventListener('mousedown', this._onMouseDown);
            renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
            renderer.domElement.removeEventListener('mouseup', this._onMouseUp);
        }
    }

    _onMouseDown(e) {
        if (e.button !== 0) return; // Left click only
        if (this.editorManager.mode !== EditorMode.EDIT) return;
        
        this.dragStartPos.set(e.clientX, e.clientY);
        this.isDragging = false;
    }

    _onMouseMove(e) {
        if (e.buttons !== 1) return; // Left button held
        
        const dx = e.clientX - this.dragStartPos.x;
        const dy = e.clientY - this.dragStartPos.y;
        
        if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) {
            this.isDragging = true;
        }
    }

    _onMouseUp(e) {
        if (e.button !== 0) return;
        if (this.editorManager.mode !== EditorMode.EDIT) return;
        
        // If we were dragging, don't select
        if (this.isDragging) {
            this.isDragging = false;
            return;
        }
        
        // Check if click was on UI element
        if (e.target.closest('.editor-container')) return;
        
        // Update mouse coordinates
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // Perform raycast
        const camera = this.editorManager.getCamera();
        const scene = this.editorManager.getScene();
        
        if (!camera || !scene) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        // Get all editor object meshes
        const meshes = this.editorManager.objects
            .filter(obj => obj.mesh)
            .map(obj => obj.mesh);
        
        const intersects = this.raycaster.intersectObjects(meshes, true);
        
        if (intersects.length > 0) {
            // Find the editor object that owns this mesh
            const hitMesh = intersects[0].object;
            const editorObject = this._findEditorObject(hitMesh);
            
            if (editorObject) {
                // Shift-click for multi-select
                const addToSelection = e.shiftKey;
                this.editorManager.selectObject(editorObject, addToSelection);
            }
        } else {
            // Clicked on nothing - clear selection (unless shift is held)
            if (!e.shiftKey) {
                this.editorManager.clearSelection();
            }
        }
    }

    /**
     * Find the editor object that owns a mesh
     */
    _findEditorObject(mesh) {
        // Walk up the parent chain to find the root mesh
        let current = mesh;
        while (current.parent && current.parent.type !== 'Scene') {
            current = current.parent;
        }
        
        // Find the editor object with this mesh
        for (const obj of this.editorManager.objects) {
            if (obj.mesh === current || obj.mesh === mesh) {
                return obj;
            }
        }
        
        return null;
    }

    /**
     * Get world position from mouse coordinates
     */
    getWorldPosition(mouseX, mouseY, groundY = 0) {
        this.mouse.x = (mouseX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(mouseY / window.innerHeight) * 2 + 1;
        
        const camera = this.editorManager.getCamera();
        if (!camera) return null;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        // Create a ground plane to intersect with
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
        const intersection = new THREE.Vector3();
        
        if (this.raycaster.ray.intersectPlane(groundPlane, intersection)) {
            return intersection;
        }
        
        return null;
    }

    /**
     * Raycast against editor objects
     */
    raycastObjects(mouseX, mouseY) {
        this.mouse.x = (mouseX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(mouseY / window.innerHeight) * 2 + 1;
        
        const camera = this.editorManager.getCamera();
        const scene = this.editorManager.getScene();
        
        if (!camera || !scene) return null;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        const meshes = this.editorManager.objects
            .filter(obj => obj.mesh)
            .map(obj => obj.mesh);
        
        const intersects = this.raycaster.intersectObjects(meshes, true);
        
        if (intersects.length > 0) {
            const editorObject = this._findEditorObject(intersects[0].object);
            return {
                object: editorObject,
                point: intersects[0].point,
                distance: intersects[0].distance
            };
        }
        
        return null;
    }

    /**
     * Clean up
     */
    destroy() {
        this.disable();
    }
}
