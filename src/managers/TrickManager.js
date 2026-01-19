// TrickManager - Handles skateboard-style tricks with independent board rotation

import * as THREE from 'three';
import { Events } from '../core/EventBus.js';

// Trick types
const TRICK_TYPES = {
    SPIN: 'spin',
    FLIP: 'flip',
    COMBO: 'combo'
};

// Trick rotation speeds (degrees per second)
const TRICK_SPEEDS = {
    SPIN: 1080,     // 3 full rotations per second (fast enough for quick 360s)
    FLIP: 720       // 2 full rotations per second (fast enough for quick 180s)
};

// Minimum rotations to complete
const MIN_ROTATIONS = {
    SPIN: 360,      // Spins must complete at least 360 degrees
    FLIP: 180       // Flips must complete at least 180 degrees
};

export class TrickManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // Active tricks
        this.activeTricks = [];
        
        // Board rotation (quaternion)
        this.boardRotation = new THREE.Quaternion();
        this.targetRotation = new THREE.Quaternion();
        
        // State
        this.isAirborne = false;
        this.wasGrounded = true;
        this.trickHistory = [];
        this.currentJumpTricks = [];
        
        // Rotation smoothing
        this.rotationLerpSpeed = 0.2;
    }

    /**
     * Initialize the trick system
     */
    init() {
        // Listen for landing events to complete tricks
        this.eventBus.on(Events.PLAYER_GROUNDED, () => {
            this._onLanding();
        });
        
        this.eventBus.on(Events.PLAYER_AIRBORNE, () => {
            this.isAirborne = true;
            this.wasGrounded = false;
            this.currentJumpTricks = []; // Reset tricks for new jump
        });
    }

    /**
     * Update trick system
     * @param {number} deltaTime - Frame time in seconds
     * @param {boolean} isAirborne - Whether player is airborne
     * @param {Object} inputState - Trick input state from InputManager
     */
    update(deltaTime, isAirborne, inputState) {
        this.isAirborne = isAirborne;
        
        // Track ground state changes
        if (!this.wasGrounded && isAirborne) {
            // Just became airborne - reset tricks for new jump
            // Normal ollies (A button only) won't have tricks, so this stays empty
            this.currentJumpTricks = [];
        }
        this.wasGrounded = !isAirborne;
        
        // Only process tricks while airborne
        if (!isAirborne) {
            // Smoothly reset rotation when grounded
            this._resetRotation(deltaTime);
            // Clear jump tricks when grounded (normal ollies don't count)
            this.currentJumpTricks = [];
            return;
        }
        
        // Process trick input (only X/Y buttons trigger tricks, not normal jumps)
        this._processTrickInput(deltaTime, inputState);
        
        // Update active tricks
        this._updateActiveTricks(deltaTime);
        
        // Update board rotation
        this._updateBoardRotation(deltaTime);
    }

    /**
     * Process trick input and start new tricks
     */
    _processTrickInput(deltaTime, inputState) {
        if (!inputState) return;
        
        // Check for spin input (X button or Q/E keys)
        const spinInput = inputState.spinLeft || inputState.spinRight;
        const spinDirection = inputState.spinLeft ? -1 : (inputState.spinRight ? 1 : 0);
        
        // Check for flip input (Y button or R/F keys)
        const flipInput = inputState.flipForward || inputState.flipBack;
        const flipDirection = inputState.flipForward ? 1 : (inputState.flipBack ? -1 : 0);
        
        // Start spin trick
        if (spinInput && spinDirection !== 0) {
            const existingSpin = this.activeTricks.find(t => t.type === TRICK_TYPES.SPIN);
            if (!existingSpin) {
                this._startTrick(TRICK_TYPES.SPIN, spinDirection);
            } else if (existingSpin && !existingSpin.active) {
                // Restart if it was stopped
                existingSpin.active = true;
                existingSpin.direction = spinDirection;
            }
        } else {
            // Stop spin trick if input released
            this._stopTrick(TRICK_TYPES.SPIN);
        }
        
        // Start flip trick
        if (flipInput && flipDirection !== 0) {
            const existingFlip = this.activeTricks.find(t => t.type === TRICK_TYPES.FLIP);
            if (!existingFlip) {
                this._startTrick(TRICK_TYPES.FLIP, flipDirection);
            } else if (existingFlip && !existingFlip.active) {
                // Restart if it was stopped
                existingFlip.active = true;
                existingFlip.direction = flipDirection;
            }
        } else {
            // Stop flip trick if input released
            this._stopTrick(TRICK_TYPES.FLIP);
        }
    }

    /**
     * Start a new trick
     */
    _startTrick(type, direction) {
        const trick = {
            type: type,
            direction: direction,
            rotation: 0, // Total rotation in degrees
            startTime: performance.now(),
            active: true,
            committed: false, // Whether trick has committed to minimum rotation
            minRotation: MIN_ROTATIONS[type] // Minimum rotation to complete
        };
        
        this.activeTricks.push(trick);
        this.currentJumpTricks.push(trick);
        
        this.eventBus.emit(Events.TRICK_STARTED, { type, direction });
    }

    /**
     * Stop a trick (but allow it to complete minimum rotation)
     */
    _stopTrick(type) {
        const trick = this.activeTricks.find(t => t.type === type);
        if (trick) {
            // Mark as committed - must complete minimum rotation
            trick.committed = true;
            // Only deactivate if we've reached the minimum rotation
            if (Math.abs(trick.rotation) >= trick.minRotation) {
                trick.active = false;
            }
        }
    }

    /**
     * Update active tricks
     */
    _updateActiveTricks(deltaTime) {
        for (const trick of this.activeTricks) {
            // Calculate rotation speed based on trick type
            const speed = trick.type === TRICK_TYPES.SPIN 
                ? TRICK_SPEEDS.SPIN 
                : TRICK_SPEEDS.FLIP;
            
            // Continue rotating if active, or if committed but haven't reached minimum
            if (trick.active || (trick.committed && Math.abs(trick.rotation) < trick.minRotation)) {
                // Add rotation
                trick.rotation += speed * deltaTime * trick.direction;
                
                // If committed and we've reached minimum, deactivate
                if (trick.committed && Math.abs(trick.rotation) >= trick.minRotation) {
                    trick.active = false;
                }
            }
        }
        
        // Remove inactive tricks after rotation has decayed
        this.activeTricks = this.activeTricks.filter(t => {
            if (!t.active && !t.committed && Math.abs(t.rotation) < 0.5) {
                return false; // Remove if rotation has reset
            }
            return true;
        });
    }

    /**
     * Update board rotation quaternion
     */
    _updateBoardRotation(deltaTime) {
        // Start with identity quaternion
        let combinedRotation = new THREE.Quaternion();
        
        // Apply all active trick rotations
        for (const trick of this.activeTricks) {
            // Handle stopping tricks (only decay if not committed or past minimum)
            if (!trick.active && !trick.committed) {
                // Smoothly reduce rotation when stopping (only if not committed)
                trick.rotation *= 0.95;
                if (Math.abs(trick.rotation) < 0.5) {
                    trick.rotation = 0;
                }
            } else if (!trick.active && trick.committed && Math.abs(trick.rotation) >= trick.minRotation) {
                // After completing minimum rotation, smoothly decay
                trick.rotation *= 0.98; // Slower decay after completion
                if (Math.abs(trick.rotation) < 1) {
                    trick.rotation = 0;
                    trick.committed = false; // Reset committed flag
                }
            }
            
            // Apply rotation if significant
            if (Math.abs(trick.rotation) > 0.01) {
                // Convert rotation to quaternion
                const axis = trick.type === TRICK_TYPES.SPIN
                    ? new THREE.Vector3(0, 1, 0) // Y-axis for spins
                    : new THREE.Vector3(1, 0, 0); // X-axis for flips
                
                const angle = THREE.MathUtils.degToRad(trick.rotation);
                const trickQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
                
                // Combine rotations: multiply current combined with new trick
                // Order matters: combinedRotation * trickQuat applies trick on top
                combinedRotation = combinedRotation.multiply(trickQuat);
            }
        }
        
        // Smoothly interpolate to target rotation
        this.targetRotation.copy(combinedRotation);
        this.boardRotation.slerp(this.targetRotation, this.rotationLerpSpeed);
    }

    /**
     * Reset rotation smoothly when landing
     */
    _resetRotation(deltaTime) {
        // Smoothly return to identity
        this.targetRotation.identity();
        this.boardRotation.slerp(this.targetRotation, this.rotationLerpSpeed * 2);
        
        // Clear active tricks
        this.activeTricks = [];
    }

    /**
     * Public method to reset board orientation immediately
     * Can be called anytime to reset the board to its original orientation
     */
    resetBoardOrientation() {
        // Immediately reset to identity
        this.targetRotation.identity();
        this.boardRotation.identity();
        
        // Clear all active tricks
        this.activeTricks = [];
        this.currentJumpTricks = [];
    }

    /**
     * Handle landing event
     */
    _onLanding() {
        // If no tricks were performed, reset immediately
        if (this.currentJumpTricks.length === 0) {
            this.resetBoardOrientation();
            return;
        }
        
        // Calculate total rotation for scoring
        let totalSpin = 0;
        let totalFlip = 0;
        
        for (const trick of this.currentJumpTricks) {
            if (trick.type === TRICK_TYPES.SPIN) {
                totalSpin += Math.abs(trick.rotation);
            } else if (trick.type === TRICK_TYPES.FLIP) {
                totalFlip += Math.abs(trick.rotation);
            }
        }
        
        // Check for clean landing (board rotation close to normal)
        const rotationAngle = 2 * Math.acos(Math.abs(this.boardRotation.w));
        const isCleanLanding = rotationAngle < THREE.MathUtils.degToRad(45); // Within 45 degrees
        
        if (isCleanLanding && this.currentJumpTricks.length > 0) {
            // Successful trick completion
            const score = this._calculateScore(totalSpin, totalFlip, this.currentJumpTricks.length);
            this.eventBus.emit(Events.TRICK_COMPLETED, {
                tricks: this.currentJumpTricks,
                totalSpin,
                totalFlip,
                score,
                isCombo: this.currentJumpTricks.length > 1
            });
            
            if (this.currentJumpTricks.length > 1) {
                this.eventBus.emit(Events.TRICK_COMBO, {
                    count: this.currentJumpTricks.length,
                    score
                });
            }
        } else if (this.currentJumpTricks.length > 0) {
            // Failed landing (bail)
            this.eventBus.emit(Events.TRICK_FAILED, {
                tricks: this.currentJumpTricks
            });
        }
        
        // Reset for next jump
        this.currentJumpTricks = [];
    }

    /**
     * Calculate trick score
     */
    _calculateScore(totalSpin, totalFlip, trickCount) {
        let score = 0;
        
        // Base score per trick
        score += trickCount * 100;
        
        // Rotation bonuses (each 360° = +50 points)
        const spinRotations = Math.floor(totalSpin / 360);
        const flipRotations = Math.floor(totalFlip / 360);
        score += (spinRotations + flipRotations) * 50;
        
        // Combo multiplier
        if (trickCount >= 3) {
            score *= 2.0;
        } else if (trickCount === 2) {
            score *= 1.5;
        }
        
        // Clean landing bonus
        score += 25;
        
        return Math.floor(score);
    }

    /**
     * Get current board rotation quaternion
     * @returns {THREE.Quaternion}
     */
    getBoardRotation() {
        return this.boardRotation.clone();
    }

    /**
     * Check if any trick is active
     * @returns {boolean}
     */
    isTrickActive() {
        return this.activeTricks.some(t => t.active);
    }

    /**
     * Get current trick count for this jump
     * @returns {number}
     */
    getTrickCount() {
        return this.currentJumpTricks.length;
    }
}
