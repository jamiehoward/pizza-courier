// CameraController - Third-person camera that follows the player

import * as THREE from 'three';
import { CAMERA } from '../constants.js';

export class CameraController {
    constructor() {
        this.camera = null;
        
        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDecay = 0.92;
        this.shakeOffset = new THREE.Vector3();
        
        // Speed-based effects
        this.speedShakeIntensity = 0;
    }

    /**
     * Create and configure the camera
     * @param {number} aspectRatio - Window aspect ratio
     * @returns {THREE.PerspectiveCamera}
     */
    create(aspectRatio) {
        this.camera = new THREE.PerspectiveCamera(
            CAMERA.FOV,
            aspectRatio,
            CAMERA.NEAR,
            CAMERA.FAR
        );
        this.camera.position.set(0, 3, 6);
        return this.camera;
    }

    /**
     * Update camera position and look target
     * @param {THREE.Vector3} targetPosition - Player position
     * @param {number} aimYaw - Player's aim yaw angle
     * @param {number} aimPitch - Player's aim pitch angle
     * @param {number} speed - Current player speed (optional)
     * @param {number} maxSpeed - Max player speed (optional)
     */
    update(targetPosition, aimYaw, aimPitch, speed = 0, maxSpeed = 1) {
        if (!this.camera) return;

        // Calculate right direction for shoulder offset
        const rightDir = new THREE.Vector3(
            Math.cos(aimYaw),
            0,
            -Math.sin(aimYaw)
        );

        // Position camera behind and to the right of player
        const cameraBehind = new THREE.Vector3(
            -Math.sin(aimYaw) * CAMERA.DISTANCE + rightDir.x * CAMERA.OFFSET_X,
            CAMERA.HEIGHT,
            -Math.cos(aimYaw) * CAMERA.DISTANCE + rightDir.z * CAMERA.OFFSET_X
        );

        const targetCameraPosition = targetPosition.clone().add(cameraBehind);
        
        // Update camera shake
        this._updateShake(speed, maxSpeed);
        targetCameraPosition.add(this.shakeOffset);
        
        this.camera.position.lerp(targetCameraPosition, CAMERA.LERP_FACTOR);

        // Look ahead of player (where they're aiming)
        const lookAhead = new THREE.Vector3(
            Math.sin(aimYaw) * 5,
            1.5 - aimPitch * 3,
            Math.cos(aimYaw) * 5
        );
        const lookTarget = targetPosition.clone().add(lookAhead);
        this.camera.lookAt(lookTarget);
    }

    /**
     * Trigger a camera shake effect
     * @param {number} intensity - Shake intensity (0-1)
     */
    shake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    /**
     * Update camera shake offset
     * @param {number} speed - Current speed
     * @param {number} maxSpeed - Maximum speed
     */
    _updateShake(speed, maxSpeed) {
        // Speed-based micro-shake (subtle vibration at high speed)
        const speedRatio = Math.min(1, speed / maxSpeed);
        this.speedShakeIntensity = speedRatio * speedRatio * 0.03; // Subtle at high speed
        
        // Combine event shake + speed shake
        const totalIntensity = this.shakeIntensity + this.speedShakeIntensity;
        
        if (totalIntensity > 0.001) {
            // Random shake offset
            this.shakeOffset.set(
                (Math.random() - 0.5) * 2 * totalIntensity,
                (Math.random() - 0.5) * 2 * totalIntensity,
                (Math.random() - 0.5) * 2 * totalIntensity
            );
        } else {
            this.shakeOffset.set(0, 0, 0);
        }
        
        // Decay event shake
        this.shakeIntensity *= this.shakeDecay;
        if (this.shakeIntensity < 0.001) {
            this.shakeIntensity = 0;
        }
    }

    /**
     * Get current shake intensity for external effects (motion blur)
     * @returns {number} Current total shake intensity
     */
    getShakeIntensity() {
        return this.shakeIntensity + this.speedShakeIntensity;
    }

    /**
     * Handle window resize
     * @param {number} width - Window width
     * @param {number} height - Window height
     */
    onResize(width, height) {
        if (!this.camera) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Get the camera instance
     * @returns {THREE.PerspectiveCamera}
     */
    getCamera() {
        return this.camera;
    }
}
