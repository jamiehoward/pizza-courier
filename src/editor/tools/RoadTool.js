// RoadTool - Draw road paths by clicking points

import * as THREE from 'three';
import { BaseTool } from './BaseTool.js';
import { Road } from '../objects/Road.js';

export class RoadTool extends BaseTool {
    constructor() {
        super('road');
        
        // Current road being drawn
        this.currentRoad = null;
        this.isDrawing = false;
        
        // Preview elements
        this.previewLine = null;
        this.previewPoint = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        // Bind handlers
        this._onClick = this._onClick.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
    }

    onActivate() {
        this._createPreviewElements();
        
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.addEventListener('click', this._onClick);
            renderer.domElement.addEventListener('mousemove', this._onMouseMove);
            renderer.domElement.addEventListener('contextmenu', this._onContextMenu);
            renderer.domElement.style.cursor = 'crosshair';
        }
        
        window.addEventListener('keydown', this._onKeyDown);
        
        if (this.editorManager?.editorUI) {
            this.editorManager.editorUI.showHint('Click to add points, Right-click to finish road', 3000);
        }
    }

    onDeactivate() {
        // Finish any road in progress
        this._finishRoad();
        
        this._removePreviewElements();
        
        const renderer = this.editorManager?.getRenderer();
        if (renderer) {
            renderer.domElement.removeEventListener('click', this._onClick);
            renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
            renderer.domElement.removeEventListener('contextmenu', this._onContextMenu);
            renderer.domElement.style.cursor = 'default';
        }
        
        window.removeEventListener('keydown', this._onKeyDown);
    }

    _createPreviewElements() {
        const scene = this.editorManager?.getScene();
        if (!scene) return;
        
        // Preview point (sphere at cursor)
        const pointGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const pointMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7
        });
        this.previewPoint = new THREE.Mesh(pointGeometry, pointMaterial);
        this.previewPoint.visible = false;
        scene.add(this.previewPoint);
        
        // Preview line (from last point to cursor)
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7
        });
        this.previewLine = new THREE.Line(lineGeometry, lineMaterial);
        this.previewLine.visible = false;
        scene.add(this.previewLine);
    }

    _removePreviewElements() {
        const scene = this.editorManager?.getScene();
        if (!scene) return;
        
        if (this.previewPoint) {
            scene.remove(this.previewPoint);
            this.previewPoint.geometry.dispose();
            this.previewPoint.material.dispose();
            this.previewPoint = null;
        }
        
        if (this.previewLine) {
            scene.remove(this.previewLine);
            this.previewLine.geometry.dispose();
            this.previewLine.material.dispose();
            this.previewLine = null;
        }
    }

    _onClick(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.editor-container')) return;
        
        const worldPos = this._getWorldPosition(e);
        if (!worldPos) return;
        
        const x = this.editorManager.snapToGrid(worldPos.x);
        const z = this.editorManager.snapToGrid(worldPos.z);
        
        if (!this.isDrawing) {
            // Start new road
            this.currentRoad = new Road({
                points: [{ x, z }]
            });
            this.isDrawing = true;
            
            if (this.editorManager?.editorUI) {
                this.editorManager.editorUI.showHint('Click to add more points, Right-click or Escape to finish', 2000);
            }
        } else {
            // Add point to current road
            this.currentRoad.addPoint(x, z);
            
            // Update mesh if we have enough points
            if (this.currentRoad.points.length >= 2) {
                const scene = this.editorManager?.getScene();
                if (scene && !this.currentRoad.mesh?.parent) {
                    this.currentRoad.createMesh();
                    scene.add(this.currentRoad.mesh);
                }
            }
        }
    }

    _onMouseMove(e) {
        const worldPos = this._getWorldPosition(e);
        
        if (!worldPos) {
            if (this.previewPoint) this.previewPoint.visible = false;
            if (this.previewLine) this.previewLine.visible = false;
            return;
        }
        
        const x = this.editorManager.snapToGrid(worldPos.x);
        const z = this.editorManager.snapToGrid(worldPos.z);
        
        // Update preview point
        if (this.previewPoint) {
            this.previewPoint.position.set(x, 0.5, z);
            this.previewPoint.visible = !e.target.closest('.editor-container');
        }
        
        // Update preview line
        if (this.previewLine && this.isDrawing && this.currentRoad) {
            const lastPoint = this.currentRoad.points[this.currentRoad.points.length - 1];
            if (lastPoint) {
                const positions = this.previewLine.geometry.attributes.position.array;
                positions[0] = lastPoint.x;
                positions[1] = 0.3;
                positions[2] = lastPoint.z;
                positions[3] = x;
                positions[4] = 0.3;
                positions[5] = z;
                this.previewLine.geometry.attributes.position.needsUpdate = true;
                this.previewLine.visible = true;
            }
        } else if (this.previewLine) {
            this.previewLine.visible = false;
        }
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') {
            this._finishRoad();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            // Remove last point
            if (this.currentRoad && this.currentRoad.points.length > 1) {
                this.currentRoad.removeLastPoint();
            }
        }
    }

    _onContextMenu(e) {
        e.preventDefault();
        this._finishRoad();
    }

    _finishRoad() {
        if (!this.isDrawing || !this.currentRoad) return;
        
        if (this.currentRoad.points.length >= 2) {
            // Add road to editor
            const scene = this.editorManager?.getScene();
            if (scene && this.currentRoad.mesh) {
                // Already added during drawing
            } else if (scene) {
                this.currentRoad.createMesh();
                scene.add(this.currentRoad.mesh);
            }
            
            this.editorManager.addObject(this.currentRoad);
            
            // Update UI
            if (this.editorManager?.editorUI) {
                this.editorManager.editorUI.updateCounts(
                    this.editorManager.objects.length,
                    this.editorManager.selectedObjects.length
                );
                this.editorManager.editorUI.showHint('Road created', 1500);
            }
        } else {
            // Not enough points - remove the partial road
            if (this.currentRoad.mesh) {
                const scene = this.editorManager?.getScene();
                if (scene) scene.remove(this.currentRoad.mesh);
            }
        }
        
        this.currentRoad = null;
        this.isDrawing = false;
    }

    _getWorldPosition(e) {
        this._updateMouse(e);
        
        const camera = this.editorManager?.getCamera();
        if (!camera) return null;
        
        this.raycaster.setFromCamera(this.mouse, camera);
        
        const intersectPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
            return intersectPoint;
        }
        
        return null;
    }

    _updateMouse(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    destroy() {
        this._finishRoad();
        this._removePreviewElements();
    }
}
