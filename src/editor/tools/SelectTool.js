// SelectTool - Select and move objects

import * as THREE from 'three';
import { BaseTool } from './BaseTool.js';

export class SelectTool extends BaseTool {
    constructor() {
        super('select');
        
        this.isDragging = false;
        this.dragObject = null;
        this.dragOffset = new THREE.Vector3();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Bind handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
    }

    onActivate() {
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.addEventListener('mousedown', this._onMouseDown);
            renderer.domElement.addEventListener('mousemove', this._onMouseMove);
            renderer.domElement.addEventListener('mouseup', this._onMouseUp);
        }
        
        if (this.editorManager?.editorUI) {
            this.editorManager.editorUI.showHint('Click to select, drag to move', 2000);
        }
    }

    onDeactivate() {
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.removeEventListener('mousedown', this._onMouseDown);
            renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
            renderer.domElement.removeEventListener('mouseup', this._onMouseUp);
        }
        
        this.isDragging = false;
        this.dragObject = null;
    }

    _onMouseDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.editor-container')) return;
        
        this._updateMouse(e);
        
        const camera = this.editorManager.getCamera();
        if (!camera) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        // Check if we clicked on a selected object
        const selected = this.editorManager.selectedObjects;
        if (selected.length > 0) {
            const meshes = selected.map(obj => obj.mesh).filter(m => m);
            const intersects = this.raycaster.intersectObjects(meshes, true);
            
            if (intersects.length > 0) {
                // Start dragging
                this.isDragging = true;
                this.dragObject = selected[0];
                
                // Set drag plane at object height
                this.dragPlane.constant = -this.dragObject.position.y;
                
                // Calculate offset
                const intersectPoint = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
                this.dragOffset.subVectors(
                    new THREE.Vector3(this.dragObject.position.x, 0, this.dragObject.position.z),
                    intersectPoint
                );
                
                // Store initial position for undo
                this.dragStartPos = { ...this.dragObject.position };
                
                return;
            }
        }
    }

    _onMouseMove(e) {
        if (!this.isDragging || !this.dragObject) return;
        
        this._updateMouse(e);
        
        const camera = this.editorManager.getCamera();
        if (!camera) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        const intersectPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            let newX = intersectPoint.x + this.dragOffset.x;
            let newZ = intersectPoint.z + this.dragOffset.z;
            
            // Snap to grid
            newX = this.editorManager.snapToGrid(newX);
            newZ = this.editorManager.snapToGrid(newZ);
            
            this.dragObject.setPosition({
                x: newX,
                y: this.dragObject.position.y,
                z: newZ
            });
        }
    }

    _onMouseUp(e) {
        if (e.button !== 0) return;
        
        if (this.isDragging && this.dragObject) {
            // Add to history if position changed
            if (this.dragStartPos && 
                (this.dragStartPos.x !== this.dragObject.position.x ||
                 this.dragStartPos.z !== this.dragObject.position.z)) {
                if (this.editorManager.historyManager) {
                    this.editorManager.historyManager.push({
                        type: 'move',
                        object: this.dragObject,
                        oldPosition: this.dragStartPos,
                        newPosition: { ...this.dragObject.position }
                    });
                }
            }
        }
        
        this.isDragging = false;
        this.dragObject = null;
        this.dragStartPos = null;
    }

    _updateMouse(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
}
