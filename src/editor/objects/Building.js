// Building - Editable building object with various geometry shapes

import * as THREE from 'three';
import { EditorObject } from './EditorObject.js';

export class Building extends EditorObject {
    constructor(shape = 'box', options = {}) {
        super(shape, options);
        this.shape = shape;
        this.createMesh();
    }

    /**
     * Create the mesh based on shape type
     */
    createMesh() {
        let geometry;
        
        switch (this.shape) {
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(0.5, 1, 16);
                break;
            case 'wedge':
                geometry = this._createWedgeGeometry();
                break;
            case 'box':
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
        }
        
        this.material = new THREE.MeshStandardMaterial({
            color: this.color,
            roughness: 0.7,
            metalness: 0.1,
            flatShading: true
        });
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        
        // Apply transforms
        this.mesh.scale.set(this.scale.x, this.scale.y, this.scale.z);
        this.mesh.position.set(
            this.position.x,
            this.position.y + this.scale.y / 2, // Bottom at position.y
            this.position.z
        );
        this.mesh.rotation.y = this.rotation;
        
        // Enable shadows
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Store reference back to editor object
        this.mesh.userData.editorObject = this;
    }

    /**
     * Create wedge (ramp) geometry
     */
    _createWedgeGeometry() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(1, 0);
        shape.lineTo(0, 1);
        shape.lineTo(0, 0);
        
        const extrudeSettings = {
            depth: 1,
            bevelEnabled: false
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Center the geometry
        geometry.translate(-0.5, -0.5, -0.5);
        
        return geometry;
    }

    /**
     * Override setScale for wedge shape adjustments
     */
    setScale(scale) {
        this.scale = { ...scale };
        if (this.mesh) {
            this.mesh.scale.set(scale.x, scale.y, scale.z);
            // Keep bottom at ground level
            this.mesh.position.y = this.position.y + scale.y / 2;
        }
        this._updateOutline();
    }

    /**
     * Serialize to JSON
     */
    serialize() {
        return {
            ...super.serialize(),
            shape: this.shape
        };
    }

    /**
     * Deserialize from JSON
     */
    static deserialize(data) {
        const building = new Building(data.shape || data.type, {
            position: data.position,
            scale: data.scale,
            rotation: data.rotation,
            color: data.color,
            collision: data.collision
        });
        building.id = data.id;
        return building;
    }
}
