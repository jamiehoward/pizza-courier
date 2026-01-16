// BuildingTool - Place basic geometry buildings

import * as THREE from 'three';
import { BaseTool } from './BaseTool.js';
import { Building } from '../objects/Building.js';

export class BuildingTool extends BaseTool {
    constructor() {
        super('building');
        
        this.previewMesh = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        // Default building settings
        this.defaultScale = { x: 15, y: 30, z: 15 };
        this.defaultColor = '#5a5a6a';
        
        // Bind handlers
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onClick = this._onClick.bind(this);
    }

    onActivate() {
        this._createPreview();
        
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.addEventListener('mousemove', this._onMouseMove);
            renderer.domElement.addEventListener('click', this._onClick);
            renderer.domElement.style.cursor = 'crosshair';
        }
        
        if (this.editorManager?.editorUI) {
            this.editorManager.editorUI.showHint('Click to place building', 2000);
        }
    }

    onDeactivate() {
        this._removePreview();
        
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
            renderer.domElement.removeEventListener('click', this._onClick);
            renderer.domElement.style.cursor = 'default';
        }
    }

    _createPreview() {
        const shape = this.editorManager?.editorUI?.getBuildingShape() || 'box';
        
        let geometry;
        switch (shape) {
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(0.5, 1, 16);
                break;
            case 'wedge':
                // Simple wedge preview
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: this.defaultColor,
            transparent: true,
            opacity: 0.5,
            flatShading: true
        });
        
        this.previewMesh = new THREE.Mesh(geometry, material);
        this.previewMesh.scale.set(this.defaultScale.x, this.defaultScale.y, this.defaultScale.z);
        this.previewMesh.visible = false;
        
        const scene = this.editorManager?.getScene();
        if (scene) {
            scene.add(this.previewMesh);
        }
    }

    _removePreview() {
        if (this.previewMesh) {
            const scene = this.editorManager?.getScene();
            if (scene) {
                scene.remove(this.previewMesh);
            }
            this.previewMesh.geometry.dispose();
            this.previewMesh.material.dispose();
            this.previewMesh = null;
        }
    }

    _onMouseMove(e) {
        if (!this.previewMesh) return;
        if (e.target.closest('.editor-container')) {
            this.previewMesh.visible = false;
            return;
        }
        
        this._updateMouse(e);
        
        const camera = this.editorManager?.getCamera();
        if (!camera) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        const intersectPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
            // Snap to grid
            const x = this.editorManager.snapToGrid(intersectPoint.x);
            const z = this.editorManager.snapToGrid(intersectPoint.z);
            
            this.previewMesh.position.set(x, this.defaultScale.y / 2, z);
            this.previewMesh.visible = true;
            
            // Update preview shape if changed
            const currentShape = this.editorManager?.editorUI?.getBuildingShape() || 'box';
            if (this.currentShape !== currentShape) {
                this.currentShape = currentShape;
                this._removePreview();
                this._createPreview();
            }
        }
    }

    _onClick(e) {
        if (e.target.closest('.editor-container')) return;
        
        this._updateMouse(e);
        
        const camera = this.editorManager?.getCamera();
        if (!camera) return;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        const intersectPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
            // Get position snapped to grid
            const x = this.editorManager.snapToGrid(intersectPoint.x);
            const z = this.editorManager.snapToGrid(intersectPoint.z);
            
            // Get current shape from UI
            const shape = this.editorManager?.editorUI?.getBuildingShape() || 'box';
            
            // Create building
            const building = new Building(shape, {
                position: { x, y: 0, z },
                scale: { ...this.defaultScale },
                color: this.defaultColor
            });
            
            // Add to scene
            const scene = this.editorManager?.getScene();
            if (scene) {
                building.addToScene(scene);
            }
            
            // Add to editor
            this.editorManager.addObject(building);
            
            // Select the new building
            this.editorManager.selectObject(building);
            
            // Update UI
            if (this.editorManager?.editorUI) {
                this.editorManager.editorUI.updateCounts(
                    this.editorManager.objects.length,
                    this.editorManager.selectedObjects.length
                );
            }
        }
    }

    _updateMouse(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    destroy() {
        this._removePreview();
    }
}
