// Hoverboard - The player's vehicle

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSETS, PLAYER } from '../constants.js';

export class Hoverboard {
    constructor() {
        this.model = null;
        this.isLoaded = false;
    }

    /**
     * Load the hoverboard model
     * @param {THREE.Group} parent - Parent group to attach to
     * @returns {Promise<THREE.Group>}
     */
    load(parent) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            loader.load(
                ASSETS.HOVERBOARD,
                (gltf) => {
                    this.model = gltf.scene;
                    
                    // Scale appropriately
                    const boardScale = 1.2;
                    this.model.scale.set(boardScale, boardScale, boardScale);
                    
                    // Position at the base of the group (Jen's feet will be on top)
                    this.model.position.set(0, 1, 0);
                    
                    // Rotate to align with direction of movement
                    this.model.rotation.y = Math.PI / 2;

                    // Enable shadows
                    this.model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    parent.add(this.model);
                    this.isLoaded = true;
                    console.log('Hoverboard loaded!');
                    resolve(this.model);
                },
                undefined,
                (error) => {
                    console.error('Error loading hoverboard:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Update hoverboard tilt based on movement and player lean
     * @param {THREE.Vector3} velocity - Current velocity
     * @param {number} aimYaw - Player's aim direction
     * @param {number} leanAngle - Player's lean angle (from turning)
     */
    update(velocity, aimYaw, leanAngle = 0) {
        if (!this.model) return;

        // Tilt forward/back based on forward velocity (nose dips when accelerating)
        const forwardSpeed = velocity.z * Math.cos(aimYaw) + velocity.x * Math.sin(aimYaw);
        const targetPitch = -forwardSpeed * 0.4;
        
        // The board's roll follows the player's lean (banked turns)
        // Since the board is rotated 90 degrees, we apply lean to X axis
        const targetLeanTilt = leanAngle * 0.6;  // Board tilts with Jen but slightly less
        
        // Smooth interpolation
        this.model.rotation.x = this.model.rotation.x * 0.85 + (targetPitch + targetLeanTilt) * 0.15;
    }

    /**
     * Get the model
     * @returns {THREE.Group|null}
     */
    getModel() {
        return this.model;
    }
}
