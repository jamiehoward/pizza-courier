// GizmoManager - Transform gizmos for move and scale operations

import * as THREE from 'three';
import { EditorTool } from './EditorManager.js';

export class GizmoManager {
    constructor(editorManager) {
        this.editorManager = editorManager;
        
        // Gizmo group
        this.gizmoGroup = new THREE.Group();
        this.gizmoGroup.visible = false;
        
        // Currently attached object
        this.attachedObject = null;
        
        // Gizmo mode
        this.mode = 'move'; // 'move' or 'scale'
        
        // Axis colors
        this.colors = {
            x: 0xff4444,
            y: 0x44ff44,
            z: 0x4444ff,
            hover: 0xffff00
        };
        
        // Gizmo components
        this.axes = {};
        this.scaleHandles = {};
        
        // Interaction state
        this.enabled = false;
        this.isDragging = false;
        this.dragAxis = null;
        this.dragPlane = new THREE.Plane();
        this.dragStartPoint = new THREE.Vector3();
        this.dragStartValue = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Create gizmos
        this._createMoveGizmo();
        this._createScaleGizmo();
        
        // Add to scene
        const scene = this.editorManager?.getScene();
        if (scene) {
            scene.add(this.gizmoGroup);
        }
        
        // Bind handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
    }

    _createMoveGizmo() {
        const arrowLength = 3;
        const arrowHeadLength = 0.5;
        const arrowHeadWidth = 0.3;
        
        this.moveGroup = new THREE.Group();
        
        // Create arrows for each axis
        ['x', 'y', 'z'].forEach(axis => {
            const dir = new THREE.Vector3();
            dir[axis] = 1;
            
            const arrow = new THREE.ArrowHelper(
                dir,
                new THREE.Vector3(0, 0, 0),
                arrowLength,
                this.colors[axis],
                arrowHeadLength,
                arrowHeadWidth
            );
            
            // Create a larger invisible cylinder for easier clicking
            const hitGeometry = new THREE.CylinderGeometry(0.3, 0.3, arrowLength, 8);
            const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
            
            // Position and rotate hit mesh
            if (axis === 'x') {
                hitMesh.rotation.z = -Math.PI / 2;
                hitMesh.position.x = arrowLength / 2;
            } else if (axis === 'y') {
                hitMesh.position.y = arrowLength / 2;
            } else {
                hitMesh.rotation.x = Math.PI / 2;
                hitMesh.position.z = arrowLength / 2;
            }
            
            hitMesh.userData.axis = axis;
            hitMesh.userData.gizmoType = 'move';
            
            this.axes[axis] = { arrow, hitMesh };
            this.moveGroup.add(arrow);
            this.moveGroup.add(hitMesh);
        });
        
        this.gizmoGroup.add(this.moveGroup);
    }

    _createScaleGizmo() {
        this.scaleGroup = new THREE.Group();
        this.scaleGroup.visible = false;
        
        const boxSize = 0.4;
        const offset = 2.5;
        
        ['x', 'y', 'z'].forEach(axis => {
            const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
            const material = new THREE.MeshBasicMaterial({ color: this.colors[axis] });
            const box = new THREE.Mesh(geometry, material);
            
            if (axis === 'x') box.position.x = offset;
            if (axis === 'y') box.position.y = offset;
            if (axis === 'z') box.position.z = offset;
            
            box.userData.axis = axis;
            box.userData.gizmoType = 'scale';
            
            this.scaleHandles[axis] = box;
            this.scaleGroup.add(box);
        });
        
        // Center cube for uniform scale
        const centerGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const centerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const centerBox = new THREE.Mesh(centerGeo, centerMat);
        centerBox.userData.axis = 'uniform';
        centerBox.userData.gizmoType = 'scale';
        this.scaleHandles.uniform = centerBox;
        this.scaleGroup.add(centerBox);
        
        // Lines connecting handles
        ['x', 'y', 'z'].forEach(axis => {
            const points = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(
                    axis === 'x' ? offset : 0,
                    axis === 'y' ? offset : 0,
                    axis === 'z' ? offset : 0
                )
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: this.colors[axis] });
            const line = new THREE.Line(geometry, material);
            this.scaleGroup.add(line);
        });
        
        this.gizmoGroup.add(this.scaleGroup);
    }

    /**
     * Enable gizmo interaction
     */
    enable() {
        this.enabled = true;
        
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.addEventListener('mousedown', this._onMouseDown);
            renderer.domElement.addEventListener('mousemove', this._onMouseMove);
            renderer.domElement.addEventListener('mouseup', this._onMouseUp);
        }
    }

    /**
     * Disable gizmo interaction
     */
    disable() {
        this.enabled = false;
        this.gizmoGroup.visible = false;
        
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.removeEventListener('mousedown', this._onMouseDown);
            renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
            renderer.domElement.removeEventListener('mouseup', this._onMouseUp);
        }
    }

    /**
     * Attach gizmo to an object
     */
    attachTo(object) {
        this.attachedObject = object;
        this.gizmoGroup.visible = true;
        this._updatePosition();
    }

    /**
     * Detach gizmo
     */
    detach() {
        this.attachedObject = null;
        this.gizmoGroup.visible = false;
    }

    /**
     * Set gizmo mode
     */
    setMode(mode) {
        this.mode = mode;
        this.moveGroup.visible = mode === 'move';
        this.scaleGroup.visible = mode === 'scale';
    }

    _updatePosition() {
        if (!this.attachedObject) return;
        
        const pos = this.attachedObject.position;
        const scale = this.attachedObject.scale;
        
        this.gizmoGroup.position.set(pos.x, pos.y + scale.y / 2, pos.z);
    }

    _onMouseDown(e) {
        if (e.button !== 0) return;
        if (!this.attachedObject) return;
        
        this._updateMouse(e);
        
        const camera = this.editorManager?.getCamera();
        if (!camera) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        // Get all gizmo hit meshes
        const hitMeshes = [
            ...Object.values(this.axes).map(a => a.hitMesh),
            ...Object.values(this.scaleHandles)
        ];
        
        const intersects = this.raycaster.intersectObjects(hitMeshes);
        
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            this.dragAxis = hit.userData.axis;
            this.isDragging = true;
            
            // Set up drag plane
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            
            if (this.dragAxis === 'y') {
                this.dragPlane.normal.set(cameraDir.x, 0, cameraDir.z).normalize();
            } else if (this.dragAxis === 'x') {
                this.dragPlane.normal.set(0, 0, 1);
            } else {
                this.dragPlane.normal.set(1, 0, 0);
            }
            
            this.dragPlane.constant = -this.gizmoGroup.position.dot(this.dragPlane.normal);
            
            // Store start point
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            
            // Store start value
            if (hit.userData.gizmoType === 'move') {
                this.dragStartValue = { ...this.attachedObject.position };
            } else {
                this.dragStartValue = { ...this.attachedObject.scale };
            }
            
            e.stopPropagation();
        }
    }

    _onMouseMove(e) {
        if (!this.isDragging || !this.attachedObject || !this.dragAxis) return;
        
        this._updateMouse(e);
        
        const camera = this.editorManager?.getCamera();
        if (!camera) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        const intersectPoint = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) return;
        
        const delta = intersectPoint.clone().sub(this.dragStartPoint);
        
        // Determine if we're moving or scaling
        const gizmoType = this.dragAxis === 'uniform' ? 'scale' : 
            (this.mode === 'move' ? 'move' : 'scale');
        
        if (gizmoType === 'move') {
            let newPos = { ...this.dragStartValue };
            
            if (this.dragAxis === 'x') {
                newPos.x = this.editorManager.snapToGrid(this.dragStartValue.x + delta.x);
            } else if (this.dragAxis === 'y') {
                newPos.y = Math.max(0, this.editorManager.snapToGrid(this.dragStartValue.y + delta.y));
            } else if (this.dragAxis === 'z') {
                newPos.z = this.editorManager.snapToGrid(this.dragStartValue.z + delta.z);
            }
            
            this.attachedObject.setPosition(newPos);
            this._updatePosition();
        } else {
            // Scale
            const scaleFactor = 0.1;
            let newScale = { ...this.dragStartValue };
            
            if (this.dragAxis === 'uniform') {
                const avgDelta = (delta.x + delta.y + delta.z) / 3;
                const factor = 1 + avgDelta * scaleFactor;
                newScale.x = Math.max(1, this.dragStartValue.x * factor);
                newScale.y = Math.max(1, this.dragStartValue.y * factor);
                newScale.z = Math.max(1, this.dragStartValue.z * factor);
            } else {
                const axisDelta = delta[this.dragAxis];
                newScale[this.dragAxis] = Math.max(1, this.dragStartValue[this.dragAxis] + axisDelta);
            }
            
            this.attachedObject.setScale(newScale);
            this._updatePosition();
        }
    }

    _onMouseUp(e) {
        if (this.isDragging && this.attachedObject) {
            // Add to history
            if (this.editorManager.historyManager) {
                const actionType = this.mode === 'move' ? 'move' : 'scale';
                this.editorManager.historyManager.push({
                    type: actionType,
                    object: this.attachedObject,
                    oldValue: this.dragStartValue,
                    newValue: actionType === 'move' 
                        ? { ...this.attachedObject.position }
                        : { ...this.attachedObject.scale }
                });
            }
        }
        
        this.isDragging = false;
        this.dragAxis = null;
        this.dragStartValue = null;
    }

    _updateMouse(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Update gizmo (called each frame)
     */
    update() {
        if (!this.attachedObject) return;
        
        // Keep gizmo at object position
        this._updatePosition();
        
        // Scale gizmo based on camera distance for consistent screen size
        const camera = this.editorManager?.getCamera();
        if (camera) {
            const distance = camera.position.distanceTo(this.gizmoGroup.position);
            const scale = distance * 0.1;
            this.gizmoGroup.scale.setScalar(Math.max(1, scale));
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this.disable();
        
        const scene = this.editorManager?.getScene();
        if (scene) {
            scene.remove(this.gizmoGroup);
        }
    }
}
