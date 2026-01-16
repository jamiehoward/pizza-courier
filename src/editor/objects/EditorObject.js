// EditorObject - Base class for editable objects in the level

import * as THREE from 'three';

let objectIdCounter = 0;

export class EditorObject {
    constructor(type, options = {}) {
        this.id = `obj_${++objectIdCounter}`;
        this.type = type;
        
        // Transform
        this.position = options.position || { x: 0, y: 0, z: 0 };
        this.scale = options.scale || { x: 10, y: 20, z: 10 };
        this.rotation = options.rotation || 0;
        
        // Appearance
        this.color = options.color || '#4a4a4a';
        
        // Behavior
        this.collision = options.collision !== false;
        this.uniformScale = options.uniformScale || false;
        
        // Three.js objects
        this.mesh = null;
        this.outlineMesh = null;
        
        // Selection state
        this.isSelected = false;
        
        // Materials
        this.material = null;
        this.outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.5
        });
    }

    /**
     * Create the mesh for this object
     */
    createMesh() {
        // Override in subclass
    }

    /**
     * Add to scene
     */
    addToScene(scene) {
        if (this.mesh) {
            scene.add(this.mesh);
        }
    }

    /**
     * Remove from scene
     */
    removeFromScene(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
        }
    }

    /**
     * Set position
     */
    setPosition(pos) {
        this.position = { ...pos };
        if (this.mesh) {
            this.mesh.position.set(pos.x, pos.y + this.scale.y / 2, pos.z);
        }
        this._updateOutline();
    }

    /**
     * Set scale
     */
    setScale(scale) {
        this.scale = { ...scale };
        if (this.mesh) {
            this.mesh.scale.set(scale.x, scale.y, scale.z);
            // Reposition to keep bottom at ground
            this.mesh.position.y = this.position.y + scale.y / 2;
        }
        this._updateOutline();
    }

    /**
     * Set rotation (around Y axis)
     */
    setRotation(radians) {
        this.rotation = radians;
        if (this.mesh) {
            this.mesh.rotation.y = radians;
        }
        this._updateOutline();
    }

    /**
     * Set color
     */
    setColor(color) {
        this.color = color;
        if (this.material) {
            this.material.color.set(color);
        }
    }

    /**
     * Set collision enabled
     */
    setCollision(enabled) {
        this.collision = enabled;
        // Could add visual indicator for collision-disabled objects
        if (this.material) {
            this.material.opacity = enabled ? 1 : 0.6;
            this.material.transparent = !enabled;
        }
    }

    /**
     * Set selected state
     */
    setSelected(selected) {
        this.isSelected = selected;
        
        if (selected) {
            this._showOutline();
        } else {
            this._hideOutline();
        }
    }

    _showOutline() {
        if (!this.mesh || this.outlineMesh) return;
        
        // Create outline by scaling up a duplicate mesh with back-face material
        this.outlineMesh = this.mesh.clone();
        this.outlineMesh.material = this.outlineMaterial;
        this.outlineMesh.scale.multiplyScalar(1.05);
        this.mesh.add(this.outlineMesh);
    }

    _hideOutline() {
        if (this.outlineMesh && this.mesh) {
            this.mesh.remove(this.outlineMesh);
            this.outlineMesh = null;
        }
    }

    _updateOutline() {
        if (this.isSelected && this.outlineMesh) {
            // Recreate outline to update scale
            this._hideOutline();
            this._showOutline();
        }
    }

    /**
     * Serialize to JSON
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            position: { ...this.position },
            scale: { ...this.scale },
            rotation: this.rotation,
            color: this.color,
            collision: this.collision
        };
    }

    /**
     * Deserialize from JSON
     */
    static deserialize(data) {
        const obj = new EditorObject(data.type, {
            position: data.position,
            scale: data.scale,
            rotation: data.rotation,
            color: data.color,
            collision: data.collision
        });
        obj.id = data.id;
        return obj;
    }

    /**
     * Clean up
     */
    dispose() {
        if (this.material) {
            this.material.dispose();
        }
        if (this.mesh) {
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
        }
        if (this.outlineMaterial) {
            this.outlineMaterial.dispose();
        }
    }
}
