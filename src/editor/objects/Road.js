// Road - Editable road path with variable width

import * as THREE from 'three';
import { EditorObject } from './EditorObject.js';

export class Road extends EditorObject {
    constructor(options = {}) {
        super('road', options);
        
        // Road points (array of {x, z} coordinates)
        this.points = options.points || [];
        this.width = options.width || 12;
        this.color = options.color || '#333333';
        
        // Visual settings
        this.lineColor = 0xffff00; // Yellow center line
        
        // Mesh components
        this.roadMesh = null;
        this.lineMesh = null;
        
        if (this.points.length >= 2) {
            this.createMesh();
        }
    }

    /**
     * Add a point to the road
     */
    addPoint(x, z) {
        this.points.push({ x, z });
        this.updateMesh();
    }

    /**
     * Remove the last point
     */
    removeLastPoint() {
        if (this.points.length > 0) {
            this.points.pop();
            this.updateMesh();
        }
    }

    /**
     * Create or update the road mesh
     */
    createMesh() {
        if (this.points.length < 2) return;
        
        // Clean up existing meshes
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.roadMesh && this.roadMesh.geometry) this.roadMesh.geometry.dispose();
            if (this.lineMesh && this.lineMesh.geometry) this.lineMesh.geometry.dispose();
        }
        
        // Create the road surface
        const shape = this._createRoadShape();
        const roadGeometry = new THREE.ShapeGeometry(shape);
        
        // Rotate to lay flat
        roadGeometry.rotateX(-Math.PI / 2);
        
        this.material = new THREE.MeshStandardMaterial({
            color: this.color,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        
        this.roadMesh = new THREE.Mesh(roadGeometry, this.material);
        this.roadMesh.position.y = 0.01; // Slightly above ground
        this.roadMesh.receiveShadow = true;
        
        // Create center line
        const linePoints = this.points.map(p => new THREE.Vector3(p.x, 0.02, p.z));
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: this.lineColor,
            linewidth: 2
        });
        this.lineMesh = new THREE.Line(lineGeometry, lineMaterial);
        
        // Group everything
        this.mesh = new THREE.Group();
        this.mesh.add(this.roadMesh);
        this.mesh.add(this.lineMesh);
        
        // Add point markers
        this._createPointMarkers();
        
        this.mesh.userData.editorObject = this;
    }

    /**
     * Update mesh when points change
     */
    updateMesh() {
        const scene = this.mesh?.parent;
        
        if (scene && this.mesh) {
            scene.remove(this.mesh);
        }
        
        if (this.points.length >= 2) {
            this.createMesh();
            if (scene) {
                scene.add(this.mesh);
            }
        } else {
            this.mesh = null;
        }
    }

    /**
     * Create the road shape from points
     */
    _createRoadShape() {
        const shape = new THREE.Shape();
        const halfWidth = this.width / 2;
        
        if (this.points.length < 2) return shape;
        
        // Calculate perpendicular offsets for each point
        const leftPoints = [];
        const rightPoints = [];
        
        for (let i = 0; i < this.points.length; i++) {
            const current = this.points[i];
            
            // Calculate direction
            let dx, dz;
            if (i === 0) {
                const next = this.points[i + 1];
                dx = next.x - current.x;
                dz = next.z - current.z;
            } else if (i === this.points.length - 1) {
                const prev = this.points[i - 1];
                dx = current.x - prev.x;
                dz = current.z - prev.z;
            } else {
                const prev = this.points[i - 1];
                const next = this.points[i + 1];
                dx = next.x - prev.x;
                dz = next.z - prev.z;
            }
            
            // Normalize and get perpendicular
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len === 0) continue;
            
            const perpX = -dz / len;
            const perpZ = dx / len;
            
            leftPoints.push({
                x: current.x + perpX * halfWidth,
                z: current.z + perpZ * halfWidth
            });
            rightPoints.push({
                x: current.x - perpX * halfWidth,
                z: current.z - perpZ * halfWidth
            });
        }
        
        // Create shape path
        if (leftPoints.length > 0) {
            shape.moveTo(leftPoints[0].x, leftPoints[0].z);
            
            for (let i = 1; i < leftPoints.length; i++) {
                shape.lineTo(leftPoints[i].x, leftPoints[i].z);
            }
            
            for (let i = rightPoints.length - 1; i >= 0; i--) {
                shape.lineTo(rightPoints[i].x, rightPoints[i].z);
            }
            
            shape.closePath();
        }
        
        return shape;
    }

    /**
     * Create visual markers for each point
     */
    _createPointMarkers() {
        const markerGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        
        this.points.forEach((point, index) => {
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(point.x, 0.5, point.z);
            marker.userData.pointIndex = index;
            marker.visible = false; // Only show when selected
            this.mesh.add(marker);
        });
    }

    /**
     * Set road width
     */
    setWidth(width) {
        this.width = width;
        this.updateMesh();
    }

    /**
     * Override setSelected to show/hide point markers
     */
    setSelected(selected) {
        super.setSelected(selected);
        
        if (this.mesh) {
            this.mesh.children.forEach(child => {
                if (child.userData.pointIndex !== undefined) {
                    child.visible = selected;
                }
            });
        }
    }

    /**
     * Override position - roads don't really have a single position
     */
    setPosition(pos) {
        // Move all points by the delta
        if (this.position) {
            const dx = pos.x - this.position.x;
            const dz = pos.z - this.position.z;
            
            this.points.forEach(point => {
                point.x += dx;
                point.z += dz;
            });
        }
        
        this.position = { ...pos };
        this.updateMesh();
    }

    /**
     * Get center position of road
     */
    getCenter() {
        if (this.points.length === 0) return { x: 0, y: 0, z: 0 };
        
        let sumX = 0, sumZ = 0;
        this.points.forEach(p => {
            sumX += p.x;
            sumZ += p.z;
        });
        
        return {
            x: sumX / this.points.length,
            y: 0,
            z: sumZ / this.points.length
        };
    }

    /**
     * Serialize
     */
    serialize() {
        return {
            id: this.id,
            type: 'road',
            points: this.points.map(p => ({ ...p })),
            width: this.width,
            color: this.color,
            collision: this.collision
        };
    }

    /**
     * Deserialize
     */
    static deserialize(data) {
        const road = new Road({
            points: data.points || [],
            width: data.width || 12,
            color: data.color || '#333333',
            collision: data.collision
        });
        road.id = data.id;
        return road;
    }
}
