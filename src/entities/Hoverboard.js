// Hoverboard - The player's vehicle

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSETS, PLAYER } from '../constants.js';

export class Hoverboard {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        
        // Base rotation (for movement tilt)
        this.baseRotation = new THREE.Euler();
        
        // Trick rotation (separate from movement)
        this.trickRotation = new THREE.Quaternion();
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
     * @param {THREE.Quaternion} trickRotation - Optional trick rotation quaternion
     */
    update(velocity, aimYaw, leanAngle = 0, trickRotation = null) {
        if (!this.model) return;

        // Tilt forward/back based on forward velocity (nose dips when accelerating)
        const forwardSpeed = velocity.z * Math.cos(aimYaw) + velocity.x * Math.sin(aimYaw);
        const targetPitch = -forwardSpeed * 0.4;
        
        // The board's roll follows the player's lean (banked turns)
        // Since the board is rotated 90 degrees, we apply lean to X axis
        const targetLeanTilt = leanAngle * 0.6;  // Board tilts with Jen but slightly less
        
        // Update base rotation (movement-based tilt)
        // Keep Y rotation at base orientation (board facing direction)
        this.baseRotation.x = this.baseRotation.x * 0.85 + (targetPitch + targetLeanTilt) * 0.15;
        this.baseRotation.y = Math.PI / 2; // Board orientation
        this.baseRotation.z = 0;
        
        // Store trick rotation if provided
        if (trickRotation) {
            this.trickRotation.copy(trickRotation);
        } else {
            // Smoothly reset trick rotation when not active
            this.trickRotation.slerp(new THREE.Quaternion(), 0.1);
        }
        
        // Apply base rotation first (Euler to Quaternion)
        const baseQuat = new THREE.Quaternion().setFromEuler(this.baseRotation);
        
        // Combine with trick rotation
        // Check if trick rotation is significant (not identity)
        const isTrickActive = Math.abs(this.trickRotation.w - 1.0) > 0.01 || 
                             Math.abs(this.trickRotation.x) > 0.01 || 
                             Math.abs(this.trickRotation.y) > 0.01 || 
                             Math.abs(this.trickRotation.z) > 0.01;
        
        if (isTrickActive) {
            // Apply trick rotation on top of base rotation
            // Order: baseQuat * trickRotation applies trick in local space
            this.model.quaternion.copy(baseQuat).multiply(this.trickRotation);
        } else {
            // No trick rotation, just use base rotation
            this.model.quaternion.copy(baseQuat);
        }
    }

    /**
     * Get the model
     * @returns {THREE.Group|null}
     */
    getModel() {
        return this.model;
    }
}
