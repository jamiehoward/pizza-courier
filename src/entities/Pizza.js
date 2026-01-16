import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSETS } from '../constants.js';

/**
 * Pizza object that can be picked up and delivered
 */
export class Pizza {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        
        this.group = new THREE.Group();
        this.model = null;
        this.isLoaded = false;
        this.isPickedUp = false;
        this.isActive = false;
        
        // Animation
        this.hoverOffset = 0;
        this.rotationSpeed = 0.02;
        this.hoverSpeed = 2;
        this.hoverAmount = 0.15;
        this.baseY = 1.5; // Height above ground
        
        // Glow effect
        this.glow = null;
        
        // Pickup range
        this.pickupRange = 3;
    }

    async load() {
        const loader = new GLTFLoader();
        
        try {
            const gltf = await loader.loadAsync('assets/objects/pizza-box.glb');
            this.model = gltf.scene;
            
            // Scale appropriately
            this.model.scale.setScalar(0.8);
            
            // Enable shadows
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            this.group.add(this.model);
            
            // Add glow effect
            this._createGlow();
            
            this.isLoaded = true;
            console.log('Pizza box loaded!');
        } catch (error) {
            console.error('Failed to load pizza box:', error);
            // Create fallback box
            const geometry = new THREE.BoxGeometry(0.4, 0.1, 0.4);
            const material = new THREE.MeshStandardMaterial({ color: 0xff6600 });
            this.model = new THREE.Mesh(geometry, material);
            this.model.castShadow = true;
            this.group.add(this.model);
            this._createGlow();
            this.isLoaded = true;
        }
    }

    _createGlow() {
        // Create a glowing ring/disc under the pizza
        const glowGeometry = new THREE.RingGeometry(0.3, 0.6, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glow.rotation.x = -Math.PI / 2;
        this.glow.position.y = -0.3;
        this.group.add(this.glow);
    }

    /**
     * Spawn the pizza at a position
     */
    spawn(position) {
        this.group.position.set(position.x, this.baseY, position.z);
        this.isActive = true;
        this.isPickedUp = false;
        
        if (!this.group.parent) {
            this.scene.add(this.group);
        }
        
        this.group.visible = true;
    }

    /**
     * Hide the pizza (when picked up or delivered)
     */
    hide() {
        this.group.visible = false;
        this.isActive = false;
    }

    /**
     * Check if player can pick up pizza
     */
    canPickup(playerPosition) {
        if (!this.isActive || this.isPickedUp) return false;
        
        const distance = this.group.position.distanceTo(playerPosition);
        return distance < this.pickupRange;
    }

    /**
     * Pick up the pizza
     */
    pickup() {
        this.isPickedUp = true;
        this.hide();
        return true;
    }

    /**
     * Get current position
     */
    getPosition() {
        return this.group.position.clone();
    }

    /**
     * Update animation
     */
    update(deltaTime) {
        if (!this.isActive || !this.isLoaded) return;
        
        // Gentle rotation
        this.group.rotation.y += this.rotationSpeed;
        
        // Hover animation
        this.hoverOffset += this.hoverSpeed * deltaTime;
        const hoverY = Math.sin(this.hoverOffset) * this.hoverAmount;
        this.group.position.y = this.baseY + hoverY;
        
        // Glow pulse
        if (this.glow) {
            const pulse = 0.3 + Math.sin(this.hoverOffset * 2) * 0.2;
            this.glow.material.opacity = pulse;
            this.glow.scale.setScalar(1 + Math.sin(this.hoverOffset) * 0.1);
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        if (this.group.parent) {
            this.scene.remove(this.group);
        }
    }
}
