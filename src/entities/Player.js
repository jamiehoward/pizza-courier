// Player - Jen character with animations and state machine

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PLAYER, ANIMATION_FILES } from '../constants.js';
import { Events } from '../core/EventBus.js';
import { Hoverboard } from './Hoverboard.js';

// Player states
export const PlayerState = {
    IDLE: 'idle',
    MOVING: 'moving',
    JUMPING: 'jumping',
    FLYING: 'flying',
    FALLING: 'falling'
};

export class Player {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        
        // Container group for all player objects
        this.group = new THREE.Group();
        this.group.position.set(0, 2, 15); // Start hovering, outside the pizza shop
        
        // Character model
        this.model = null;
        this.modelBaseY = 0;
        this.modelBaseRotationY = Math.PI / 2;
        
        // Pose-specific adjustments (some animations have different orientations)
        this.poseOffsets = {
            rest: { y: 0, rotationY: -2 },
            crouch: { y: 0, rotationY: -1.8 }  // Crouch needs slight rotation adjustment
        };
        
        // Animation
        this.mixer = null;
        this.animations = {};
        this.currentAnimation = null;
        
        // State
        this.state = PlayerState.IDLE;
        this.currentPose = 'rest'; // 'rest' or 'crouch'
        this.isLoaded = false;
        
        // Aim
        this.aimYaw = 0;
        this.aimPitch = 0;
        
        // Turning/lean dynamics
        this.leanAngle = 0;           // Current lean angle (for smooth interpolation)
        this.turnRotation = 0;        // Current turn rotation
        this.strafeInput = 0;         // Current strafe input (-1 to 1)
        
        // Animation blending
        this.idleAction = null;
        this.crouchAction = null;
        this.fallingAction = null;
        this.landingAction = null;
        this.jumpingAction = null;
        this.crouchWeight = 0;        // 0 = full idle, 1 = full crouch
        
        // Falling state
        this.isFalling = false;
        this.wasInAir = false;
        this.landingTimer = 0;
        
        // Jumping state
        this.isJumping = false;
        this.jumpTimer = 0;
        
        // Hoverboard
        this.hoverboard = new Hoverboard();
        
        // Add group to scene
        this.scene.add(this.group);
    }

    /**
     * Load the player character and animations
     * @returns {Promise<void>}
     */
    async load() {
        const fbxLoader = new FBXLoader();
        
        // Create placeholder while loading
        const placeholder = this._createPlaceholder();
        this.scene.add(placeholder);
        
        try {
            // Load base model (idle animation has full character)
            await this._loadBaseModel(fbxLoader);
            
            // Load other animations in parallel
            await Promise.all([
                this._loadAnimation(fbxLoader, 'crouch', ANIMATION_FILES.crouch),
                this._loadAnimation(fbxLoader, 'skateboard', ANIMATION_FILES.skateboard),
                this._loadAnimation(fbxLoader, 'crouchToStand', ANIMATION_FILES.crouchToStand),
                this._loadAnimation(fbxLoader, 'standUp', ANIMATION_FILES.standUp),
                this._loadAnimation(fbxLoader, 'falling', ANIMATION_FILES.falling),
                this._loadAnimation(fbxLoader, 'fallingToLand', ANIMATION_FILES.fallingToLand),
                this._loadAnimation(fbxLoader, 'jumping', ANIMATION_FILES.jumping)
            ]);
            
            // Load hoverboard
            await this.hoverboard.load(this.group);
            
            // Remove placeholder
            this.scene.remove(placeholder);
            placeholder.geometry.dispose();
            placeholder.material.dispose();
            
            // Setup animation blending (play both idle and crouch simultaneously)
            this._setupAnimationBlending();
            this.isLoaded = true;
            
            console.log('Player loaded successfully!');
        } catch (error) {
            console.error('Error loading player:', error);
            throw error;
        }
    }

    _createPlaceholder() {
        const geometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 1.5, 0);
        mesh.castShadow = true;
        return mesh;
    }

    _loadBaseModel(loader) {
        return new Promise((resolve, reject) => {
            loader.load(
                ANIMATION_FILES.idle,
                (fbx) => {
                    this.model = fbx;
                    
                    // Normalize size
                    const box = new THREE.Box3().setFromObject(fbx);
                    const size = box.getSize(new THREE.Vector3());
                    const scale = PLAYER.TARGET_HEIGHT / size.y;
                    fbx.scale.set(scale, scale, scale);
                    
                    // Center the model horizontally
                    const newBox = new THREE.Box3().setFromObject(fbx);
                    const center = newBox.getCenter(new THREE.Vector3());
                    fbx.position.x = -center.x;
                    fbx.position.z = -center.z;
                    
                    // Position Jen's feet directly on the hoverboard surface
                    // The hoverboard is at y=0.15 in local space, so we place feet there
                    fbx.position.y = -newBox.min.y + 0.15;
                    this.modelBaseY = fbx.position.y;
                    
                    // Rotate to face sideways (skateboard stance)
                    fbx.rotation.y = Math.PI / 2;
                    this.modelBaseRotationY = fbx.rotation.y;

                    // Enable shadows
                    fbx.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    // Create animation mixer
                    this.mixer = new THREE.AnimationMixer(fbx);
                    
                    // Store idle animation
                    if (fbx.animations.length > 0) {
                        this.animations['idle'] = fbx.animations[0];
                    }
                    
                    this.group.add(fbx);
                    resolve(fbx);
                },
                undefined,
                reject
            );
        });
    }

    _loadAnimation(loader, name, path) {
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (fbx) => {
                    if (fbx.animations.length > 0) {
                        this.animations[name] = fbx.animations[0];
                        console.log(`Animation '${name}' loaded`);
                    }
                    resolve();
                },
                undefined,
                (error) => {
                    console.error(`Error loading animation '${name}':`, error);
                    resolve(); // Don't fail the whole load for one animation
                }
            );
        });
    }

    /**
     * Setup animation blending between idle and crouch
     * Both animations play simultaneously with adjustable weights
     */
    _setupAnimationBlending() {
        if (!this.mixer) return;
        
        // Create actions for both animations
        if (this.animations['idle']) {
            this.idleAction = this.mixer.clipAction(this.animations['idle']);
            this.idleAction.play();
            this.idleAction.setEffectiveWeight(1);
        }
        
        if (this.animations['crouch']) {
            this.crouchAction = this.mixer.clipAction(this.animations['crouch']);
            this.crouchAction.play();
            this.crouchAction.setEffectiveWeight(0);
        }
        
        // Falling animation (loops while falling)
        if (this.animations['falling']) {
            this.fallingAction = this.mixer.clipAction(this.animations['falling']);
            this.fallingAction.setEffectiveWeight(0);
            this.fallingAction.play();
        }
        
        // Landing animation (plays once on landing)
        if (this.animations['fallingToLand']) {
            this.landingAction = this.mixer.clipAction(this.animations['fallingToLand']);
            this.landingAction.setLoop(THREE.LoopOnce);
            this.landingAction.clampWhenFinished = true;
            this.landingAction.setEffectiveWeight(0);
        }
        
        // Jumping animation (plays once on jump)
        if (this.animations['jumping']) {
            this.jumpingAction = this.mixer.clipAction(this.animations['jumping']);
            this.jumpingAction.setLoop(THREE.LoopOnce);
            this.jumpingAction.clampWhenFinished = true;
            this.jumpingAction.setEffectiveWeight(0);
        }
        
        this.crouchWeight = 0;
    }

    /**
     * Update animation blend weights based on speed
     * @param {number} speedRatio - 0 to 1 representing speed relative to max
     */
    _updateAnimationBlend(speedRatio) {
        if (!this.idleAction || !this.crouchAction) return;
        
        // Map speed ratio to crouch weight
        // At 0 speed: 0% crouch (full idle)
        // At threshold speed (25% of max): 25% crouch
        // At full speed: 100% crouch
        const targetWeight = Math.min(1, speedRatio * 1.2); // Slight multiplier so we reach full crouch before max speed
        
        // Smooth interpolation
        this.crouchWeight += (targetWeight - this.crouchWeight) * 0.1;
        
        // Apply weights
        this.idleAction.setEffectiveWeight(1 - this.crouchWeight);
        this.crouchAction.setEffectiveWeight(this.crouchWeight);
        
        // Update current pose for offset calculations
        this.currentPose = this.crouchWeight > 0.5 ? 'crouch' : 'rest';
    }

    /**
     * Update falling animation state
     * @param {number} deltaTime - Frame delta
     * @param {number} velocityY - Vertical velocity
     * @param {boolean} isGrounded - Whether on ground
     * @param {boolean} isFallingFromFlight - Whether this is post-flight falling
     */
    _updateFallingState(deltaTime, velocityY, isGrounded, isFallingFromFlight) {
        // Update landing timer
        if (this.landingTimer > 0) {
            this.landingTimer -= deltaTime;
            if (this.landingTimer <= 0) {
                // Landing animation finished, return to normal
                this._endLandingAnimation();
            }
            return;
        }
        
        // Detect falling state (falling fast from flight)
        const wasFalling = this.isFalling;
        this.isFalling = isFallingFromFlight && velocityY < -0.1 && !isGrounded;
        
        // Started falling
        if (this.isFalling && !wasFalling) {
            this._startFallingAnimation();
        }
        // Stopped falling (landed)
        else if (!this.isFalling && wasFalling && isGrounded) {
            this._startLandingAnimation();
        }
        // No longer falling but didn't land properly
        else if (!this.isFalling && wasFalling) {
            this._endFallingAnimation();
        }
        
        this.wasInAir = !isGrounded;
    }

    /**
     * Start the falling animation
     */
    _startFallingAnimation() {
        if (!this.fallingAction) return;
        
        // Fade out normal animations
        if (this.idleAction) this.idleAction.setEffectiveWeight(0);
        if (this.crouchAction) this.crouchAction.setEffectiveWeight(0);
        
        // Fade in falling
        this.fallingAction.reset();
        this.fallingAction.setEffectiveWeight(1);
        this.fallingAction.play();
    }

    /**
     * End falling animation without landing
     */
    _endFallingAnimation() {
        if (this.fallingAction) {
            this.fallingAction.setEffectiveWeight(0);
        }
        
        // Restore normal blend weights
        if (this.idleAction) this.idleAction.setEffectiveWeight(1 - this.crouchWeight);
        if (this.crouchAction) this.crouchAction.setEffectiveWeight(this.crouchWeight);
    }

    /**
     * Start the landing animation
     */
    _startLandingAnimation() {
        // Stop falling animation
        if (this.fallingAction) {
            this.fallingAction.setEffectiveWeight(0);
        }
        
        // Play landing animation
        if (this.landingAction) {
            this.landingAction.reset();
            this.landingAction.setEffectiveWeight(1);
            this.landingAction.play();
            this.landingTimer = 0.8; // Duration of landing animation
        } else {
            // No landing animation, just restore normal
            this._endFallingAnimation();
        }
    }

    /**
     * End landing animation and return to normal
     */
    _endLandingAnimation() {
        if (this.landingAction) {
            this.landingAction.setEffectiveWeight(0);
        }
        
        // Restore normal blend weights
        if (this.idleAction) this.idleAction.setEffectiveWeight(1 - this.crouchWeight);
        if (this.crouchAction) this.crouchAction.setEffectiveWeight(this.crouchWeight);
    }

    /**
     * Trigger jump animation
     */
    triggerJump() {
        if (!this.jumpingAction) return;
        
        this.isJumping = true;
        this.jumpTimer = 0.6; // Duration of jump animation
        
        // Fade out normal animations
        if (this.idleAction) this.idleAction.setEffectiveWeight(0);
        if (this.crouchAction) this.crouchAction.setEffectiveWeight(0);
        
        // Play jump animation
        this.jumpingAction.reset();
        this.jumpingAction.setEffectiveWeight(1);
        this.jumpingAction.play();
    }

    /**
     * Update jumping animation state
     * @param {number} deltaTime - Frame delta
     */
    _updateJumpingState(deltaTime) {
        if (!this.isJumping) return;
        
        this.jumpTimer -= deltaTime;
        if (this.jumpTimer <= 0) {
            this._endJumpingAnimation();
        }
    }

    /**
     * End jumping animation
     */
    _endJumpingAnimation() {
        this.isJumping = false;
        
        if (this.jumpingAction) {
            this.jumpingAction.setEffectiveWeight(0);
        }
        
        // Restore normal blend weights (if not falling)
        if (!this.isFalling) {
            if (this.idleAction) this.idleAction.setEffectiveWeight(1 - this.crouchWeight);
            if (this.crouchAction) this.crouchAction.setEffectiveWeight(this.crouchWeight);
        }
    }

    /**
     * Play an animation by name (for non-blended animations)
     * @param {string} name - Animation name
     * @param {number} crossFadeDuration - Crossfade duration in seconds
     */
    playAnimation(name, crossFadeDuration = 0.3) {
        if (!this.mixer || !this.animations[name]) return;
        
        const clip = this.animations[name];
        const action = this.mixer.clipAction(clip);
        
        if (this.currentAnimation) {
            this.currentAnimation.fadeOut(crossFadeDuration);
        }
        
        action.reset();
        action.fadeIn(crossFadeDuration);
        action.play();
        
        this.currentAnimation = action;
    }

    /**
     * Update aim angles from arrow key input
     * @param {{ yaw: number, pitch: number }} aimInput - Aim input from arrow keys
     */
    updateAim(aimInput) {
        // Arrow keys control camera aim direction
        if (aimInput.yaw !== 0) {
            this.aimYaw += aimInput.yaw * PLAYER.AIM_YAW_SPEED;
        }
        if (aimInput.pitch !== 0) {
            this.aimPitch += aimInput.pitch * PLAYER.AIM_PITCH_SPEED;
            this.aimPitch = Math.max(PLAYER.MIN_AIM_PITCH, Math.min(PLAYER.MAX_AIM_PITCH, this.aimPitch));
        }
        
        // Level out pitch when no input
        if (aimInput.pitch === 0) {
            this.aimPitch *= (1 - PLAYER.AIM_LEVEL_SPEED);
        }
        
        // Note: Group rotation is now handled in _updateGroupRotation() 
        // which combines yaw, pitch, AND lean
    }

    /**
     * Set strafe input for lean and turning calculations
     * @param {number} strafe - Strafe input (-1 to 1)
     */
    setStrafeInput(strafe) {
        this.strafeInput = strafe;
    }

    /**
     * Update the player each frame
     * @param {number} deltaTime - Frame time in seconds
     * @param {THREE.Vector3} velocity - Current velocity
     * @param {boolean} isGrounded - Whether on ground
     * @param {boolean} isFallingFromFlight - Whether falling after flight ended
     */
    update(deltaTime, velocity, isGrounded, isFallingFromFlight = false) {
        const speed = velocity.length();
        const speedRatio = Math.min(1, speed / PLAYER.MAX_SPEED);
        
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Handle jumping animation state
        this._updateJumpingState(deltaTime);
        
        // Handle falling animation state
        this._updateFallingState(deltaTime, velocity.y, isGrounded, isFallingFromFlight);
        
        // Update animation blend based on speed (only if not in special animation state)
        if (!this.isFalling && !this.isJumping && this.landingTimer <= 0) {
            this._updateAnimationBlend(speedRatio);
        }
        
        // ===== TURNING SYSTEM =====
        // A/D actually rotates the player (like carving on a skateboard/hoverboard)
        // Turn rate scales with speed - slow when still, fast when moving
        const baseTurnRate = 0.015;  // Turn rate when nearly stopped
        const maxTurnRate = 0.06;    // Turn rate at full speed
        const turnRate = baseTurnRate + (maxTurnRate - baseTurnRate) * speedRatio;
        
        // Apply rotation when strafing (A/D causes actual turning)
        this.aimYaw += this.strafeInput * turnRate;
        
        // ===== LEAN SYSTEM =====
        // Lean into turns like a racecar on a banked track
        // Lean intensity scales with speed - gentle when slow, dramatic when fast
        const minLeanIntensity = 0.3;   // 30% lean at rest
        const maxLeanIntensity = 1.0;   // 100% lean at full speed
        const leanIntensity = minLeanIntensity + (maxLeanIntensity - minLeanIntensity) * speedRatio;
        
        // Maximum lean angle - up to 50 degrees at full speed!
        const maxLeanAngle = 0.87;  // ~50 degrees in radians
        const targetLean = this.strafeInput * maxLeanAngle * leanIntensity;
        
        // Smooth interpolation for lean - responsive but not jerky
        const leanLerpSpeed = 0.12 + speedRatio * 0.08;  // Faster response at speed
        this.leanAngle += (targetLean - this.leanAngle) * leanLerpSpeed;
        
        // Decay lean when not turning
        if (Math.abs(this.strafeInput) < 0.1) {
            this.leanAngle *= 0.92;  // Gradually return to upright
        }
        
        // Reset model position to prevent animation root motion
        if (this.model) {
            // Blend between rest and crouch offsets based on crouch weight
            const restOffset = this.poseOffsets.rest;
            const crouchOffset = this.poseOffsets.crouch;
            const blendedY = restOffset.y + (crouchOffset.y - restOffset.y) * this.crouchWeight;
            const blendedRotY = restOffset.rotationY + (crouchOffset.rotationY - restOffset.rotationY) * this.crouchWeight;
            
            this.model.position.x = 0;
            this.model.position.z = 0;
            this.model.position.y = this.modelBaseY + blendedY;
            this.model.rotation.y = this.modelBaseRotationY + blendedRotY;
            
            // Apply lean to the model (tilt forward/back in model's local space = sideways lean visually)
            // Since model is rotated 90 degrees, we lean on X axis for visual sideways tilt
            this.model.rotation.x = this.leanAngle;
        }
        
        // Update hoverboard with lean
        this.hoverboard.update(velocity, this.aimYaw, this.leanAngle);
        
        // Update group rotation (yaw + pitch for aiming, lean for banking)
        this._updateGroupRotation();
        
        // Hover wobble applied to whole group when grounded
        if (isGrounded) {
            this.group.position.y = PLAYER.GROUND_LEVEL + Math.sin(Date.now() * 0.003) * 0.05 + 0.05;
        }
    }
    
    /**
     * Update the group's rotation combining yaw, pitch, and lean
     */
    _updateGroupRotation() {
        // Build rotation: yaw (turn) -> pitch (aim up/down) -> roll (lean into turn)
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            this.aimYaw
        );
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            this.aimPitch
        );
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), 
            -this.leanAngle  // Lean into the turn
        );
        
        // Combine: yaw first, then pitch, then roll
        this.group.quaternion.copy(yawQuat).multiply(pitchQuat).multiply(rollQuat);
    }

    /**
     * Get the player's world position
     * @returns {THREE.Vector3}
     */
    getPosition() {
        return this.group.position;
    }

    /**
     * Get the player's group
     * @returns {THREE.Group}
     */
    getGroup() {
        return this.group;
    }

    /**
     * Calculate world movement direction from input
     * @param {{ x: number, z: number }} input - Movement input
     * @returns {THREE.Vector3}
     */
    getWorldMovementDirection(input) {
        if (input.x === 0 && input.z === 0) {
            return new THREE.Vector3();
        }

        // Forward direction (where player is pointing)
        const forward = new THREE.Vector3(
            Math.sin(this.aimYaw) * Math.cos(this.aimPitch),
            -Math.sin(this.aimPitch),
            Math.cos(this.aimYaw) * Math.cos(this.aimPitch)
        );
        
        // Right direction (always horizontal)
        const right = new THREE.Vector3(
            Math.cos(this.aimYaw),
            0,
            -Math.sin(this.aimYaw)
        );

        // Combine into world movement
        const direction = new THREE.Vector3();
        direction.addScaledVector(forward, input.z);
        direction.addScaledVector(right, input.x);
        
        return direction.normalize();
    }
}
