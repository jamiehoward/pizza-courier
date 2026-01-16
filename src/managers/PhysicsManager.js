// PhysicsManager - Handles velocity, gravity, collision, and ground detection

import * as THREE from 'three';
import { PLAYER, WORLD } from '../constants.js';
import { Events } from '../core/EventBus.js';

export class PhysicsManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // Velocity
        this.velocity = new THREE.Vector3();
        
        // State
        this.isGrounded = true;
        this.isFlying = false;
        this.wasFlying = false;
        this.isBoosting = false;
        
        // Charge system (replaces old flight system)
        this.charge = 0;                    // 0 to 1
        this.chargeRate = 0.15;             // Charge per second while moving
        this.isFullyCharged = false;
        this.chargeUsed = false;            // Prevent re-triggering
        
        // Near-miss system
        this.nearMissCooldown = 0;          // Cooldown timer
        this.nearMissDistance = 3.0;        // Distance threshold for near miss
        this.nearMissChargeBonus = 0.20;    // 20% charge per near miss
        this.nearMissCooldownTime = 1.0;    // 1 second cooldown
        
        // Time dilation for juice
        this.timeScale = 1.0;               // Current time scale (1.0 = normal)
        this.targetTimeScale = 1.0;         // Target time scale for smooth transitions
        this.timeDilationDuration = 0;      // How long to hold current dilation
        
        // Charge threshold tracking for particle bursts
        this.lastChargeThreshold = 0;       // Track which threshold we last crossed
        
        // Flight energy (consumed while flying)
        this.flyEnergy = 3.0;               // Seconds of flight
        this.flyEnergyMax = 3.0;
        
        // Momentum
        this.momentumTimer = 0;
        
        // Buildings for collision
        this.buildings = [];
        
        // Cars for collision (updated each frame)
        this.carCollisions = [];
        
        // Drones for collision (updated each frame)
        this.droneCollisions = [];
        
        // Pedestrians for collision (updated each frame)
        this.pedestrianCollisions = [];
        
        // Player collision radius
        this.playerRadius = 1.0;
        
        // Collision optimization - use spatial grid
        this.gridCellSize = 30;
        this.spatialGrid = new Map(); // Map of "x,z" -> array of building indices
        this.buildingCache = [];
        this.cacheBuilt = false;
    }

    /**
     * Set buildings for collision detection
     */
    setBuildings(buildings) {
        this.buildings = buildings;
        this._buildCollisionCache();
    }

    /**
     * Set car collision bounds (updated each frame)
     */
    setCarCollisions(carCollisions) {
        this.carCollisions = carCollisions;
    }

    /**
     * Set drone collision bounds (updated each frame)
     */
    setDroneCollisions(droneCollisions) {
        this.droneCollisions = droneCollisions;
    }

    /**
     * Set pedestrian collision bounds (updated each frame)
     */
    setPedestrianCollisions(pedestrianCollisions) {
        this.pedestrianCollisions = pedestrianCollisions;
    }

    /**
     * Build a cache and spatial grid for fast collision lookups
     */
    _buildCollisionCache() {
        this.buildingCache = [];
        this.spatialGrid.clear();
        
        for (let i = 0; i < this.buildings.length; i++) {
            const building = this.buildings[i];
            const pos = building.getPosition ? building.getPosition() : 
                       (building.position || { x: 0, y: 0, z: 0 });
            const scale = building.scale || { x: 10, y: 20, z: 10 };
            
            const halfW = scale.x / 2;
            const halfD = scale.z / 2;
            
            const bData = {
                x: pos.x,
                z: pos.z,
                halfW: halfW,
                halfD: halfD,
                height: scale.y,
                minX: pos.x - halfW,
                maxX: pos.x + halfW,
                minZ: pos.z - halfD,
                maxZ: pos.z + halfD
            };
            
            this.buildingCache.push(bData);
            
            // Add to spatial grid (building may span multiple cells)
            const minCellX = Math.floor(bData.minX / this.gridCellSize);
            const maxCellX = Math.floor(bData.maxX / this.gridCellSize);
            const minCellZ = Math.floor(bData.minZ / this.gridCellSize);
            const maxCellZ = Math.floor(bData.maxZ / this.gridCellSize);
            
            for (let cx = minCellX; cx <= maxCellX; cx++) {
                for (let cz = minCellZ; cz <= maxCellZ; cz++) {
                    const key = `${cx},${cz}`;
                    if (!this.spatialGrid.has(key)) {
                        this.spatialGrid.set(key, []);
                    }
                    this.spatialGrid.get(key).push(i);
                }
            }
        }
        
        this.cacheBuilt = true;
    }

    /**
     * Apply acceleration in a direction
     * @param {THREE.Vector3} direction - Normalized direction
     * @param {number} multiplier - Speed multiplier
     */
    applyAcceleration(direction, multiplier = 1) {
        const accel = PLAYER.ACCELERATION * multiplier;
        this.velocity.addScaledVector(direction, accel);
    }

    /**
     * Apply vertical force (for jump/flight)
     * @param {number} force - Vertical force
     */
    applyVerticalForce(force) {
        this.velocity.y += force;
    }

    /**
     * Trigger a jump
     */
    jump() {
        if (this.isGrounded) {
            this.velocity.y = PLAYER.JUMP_VELOCITY;
            this.isGrounded = false;
            this.eventBus.emit(Events.PLAYER_AIRBORNE);
        }
    }

    /**
     * Use charge boost - called when Shift is pressed with full charge
     * @param {boolean} isJumping - Whether player is also pressing jump
     * @param {number} aimYaw - Player's facing direction
     */
    useChargeBoost(isJumping, aimYaw) {
        if (!this.isFullyCharged || this.chargeUsed) return false;
        
        this.chargeUsed = true;
        this.isFullyCharged = false;
        this.charge = 0;
        
        if (isJumping && this.flyEnergy > 0) {
            // FLIGHT MODE - Jump + Shift with charge
            this.isFlying = true;
            this.velocity.y = PLAYER.JUMP_VELOCITY * 1.5; // Strong upward boost
            this.eventBus.emit(Events.PLAYER_FLIGHT_START);
        } else {
            // BOOST MODE - Just Shift with charge
            this.isBoosting = true;
            const boostSpeed = PLAYER.MAX_SPEED * 3;
            this.velocity.x = Math.sin(aimYaw) * boostSpeed;
            this.velocity.z = Math.cos(aimYaw) * boostSpeed;
            this.eventBus.emit(Events.CHARGE_BOOST_USED);
            
            // Boost ends quickly
            setTimeout(() => {
                this.isBoosting = false;
            }, 300);
        }
        
        return true;
    }

    /**
     * Update physics each frame
     * @param {number} deltaTime - Frame time in seconds
     * @param {THREE.Vector3} position - Current position (will be modified)
     * @param {number} speed - Current movement speed (for charge calculation)
     */
    update(deltaTime, position, speed = 0) {
        // ===== NEAR-MISS COOLDOWN =====
        if (this.nearMissCooldown > 0) {
            this.nearMissCooldown -= deltaTime;
        }
        
        // ===== CHARGE SYSTEM =====
        // Charge builds while moving
        if (speed > PLAYER.MOVE_THRESHOLD && !this.isFullyCharged) {
            // Charge faster when moving faster
            const speedRatio = Math.min(1, speed / PLAYER.MAX_SPEED);
            const previousCharge = this.charge;
            this.charge += this.chargeRate * speedRatio * deltaTime;
            
            // Check for charge threshold crossings (25%, 50%, 75%)
            const thresholds = [0.25, 0.50, 0.75];
            for (const threshold of thresholds) {
                if (previousCharge < threshold && this.charge >= threshold && this.lastChargeThreshold < threshold) {
                    this.lastChargeThreshold = threshold;
                    this.eventBus.emit(Events.CHARGE_THRESHOLD, { threshold });
                }
            }
            
            // Check for full charge
            if (this.charge >= 1) {
                this.charge = 1;
                if (!this.isFullyCharged) {
                    this.isFullyCharged = true;
                    this.chargeUsed = false;
                    this.lastChargeThreshold = 1;
                    this.eventBus.emit(Events.CHARGE_FULL);
                }
            }
        }
        
        // Slowly lose charge when still (but not when fully charged)
        if (speed < PLAYER.MOVE_THRESHOLD && !this.isFullyCharged && this.charge > 0) {
            this.charge = Math.max(0, this.charge - 0.05 * deltaTime);
            // Reset threshold tracking when charge drops
            if (this.charge < 0.25) this.lastChargeThreshold = 0;
            else if (this.charge < 0.50) this.lastChargeThreshold = 0.25;
            else if (this.charge < 0.75) this.lastChargeThreshold = 0.50;
        }

        // ===== FLIGHT MECHANICS =====
        if (this.isFlying) {
            this.flyEnergy -= deltaTime;
            this.wasFlying = true;
            
            if (this.flyEnergy <= 0) {
                this.flyEnergy = 0;
                this.isFlying = false;
                this.eventBus.emit(Events.PLAYER_FLIGHT_END);
            } else {
                // Hover effect while flying - reduced gravity
                this.velocity.y -= PLAYER.GRAVITY * 0.15;
                
                // Gradually slow vertical movement
                this.velocity.y *= 0.98;
            }
        } else if (!this.isGrounded) {
            // Not flying and not grounded - apply gravity
            if (this.wasFlying) {
                // Just stopped flying - fall like a rock
                this.velocity.y -= PLAYER.POST_FLIGHT_GRAVITY;
            } else {
                // Normal jump - regular gravity
                this.velocity.y -= PLAYER.GRAVITY;
            }
        }

        // Reset wasFlying when grounded
        if (this.isGrounded) {
            this.wasFlying = false;
            
            // Recharge fly energy when grounded
            if (this.flyEnergy < this.flyEnergyMax) {
                this.flyEnergy = Math.min(
                    this.flyEnergyMax,
                    this.flyEnergy + 0.5 * deltaTime
                );
            }
        }

        // Apply friction (less when boosting)
        const frictionMultiplier = this.isBoosting ? 0.995 : PLAYER.FRICTION;
        this.velocity.multiplyScalar(frictionMultiplier);

        // Clamp to max speed
        const effectiveMaxSpeed = PLAYER.MAX_SPEED * (this.isFlying ? 2.5 : (this.isBoosting ? 4 : 1.0));
        const currentSpeed = this.velocity.length();
        if (currentSpeed > effectiveMaxSpeed) {
            this.velocity.normalize().multiplyScalar(effectiveMaxSpeed);
        }

        // Update position
        position.add(this.velocity);

        // Keep in bounds
        position.x = Math.max(-WORLD.BOUNDARY, Math.min(WORLD.BOUNDARY, position.x));
        position.z = Math.max(-WORLD.BOUNDARY, Math.min(WORLD.BOUNDARY, position.z));
        position.y = Math.min(WORLD.MAX_HEIGHT, position.y);

        // Building collision
        this._handleBuildingCollision(position);

        // Car collision
        this._handleCarCollision(position);

        // Drone collision
        this._handleDroneCollision(position);

        // Pedestrian collision
        this._handlePedestrianCollision(position);

        // Ground collision with hysteresis
        this._handleGroundCollision(position);
    }

    _handleBuildingCollision(position) {
        if (!this.cacheBuilt) return;
        
        const px = position.x;
        const pz = position.z;
        const py = position.y;
        
        // Get buildings in current and adjacent grid cells
        const cellX = Math.floor(px / this.gridCellSize);
        const cellZ = Math.floor(pz / this.gridCellSize);
        
        // Check 3x3 grid of cells around player
        const checked = new Set();
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = `${cellX + dx},${cellZ + dz}`;
                const indices = this.spatialGrid.get(key);
                if (!indices) continue;
                
                for (const i of indices) {
                    if (checked.has(i)) continue;
                    checked.add(i);
                    
                    const b = this.buildingCache[i];
                    
                    // Check if player is inside building's XZ bounds
                    const insideX = px > b.minX && px < b.maxX;
                    const insideZ = pz > b.minZ && pz < b.maxZ;
                    
                    if (insideX && insideZ) {
                        // Player is directly above/inside building column
                        if (py <= b.height + 1 && py > 0) {
                            // Push up onto roof (ceiling collision)
                            if (this.velocity.y < 0) {
                                const fallVelocity = -this.velocity.y;
                                position.y = b.height + 1;
                                this.velocity.y = 0;
                                
                                // Emit landing impact for roof collision
                                if (fallVelocity > 0.3) {
                                    const impactStrength = Math.min(1, (fallVelocity - 0.3) / 0.7);
                                    this.eventBus.emit(Events.PLAYER_LAND_IMPACT, impactStrength);
                                }
                            }
                        }
                        continue;
                    }
                    
                    // Side collision (only if at building height)
                    if (py > b.height + 2) continue;
                    
                    // Find closest point on building to player
                    const closestX = Math.max(b.minX, Math.min(px, b.maxX));
                    const closestZ = Math.max(b.minZ, Math.min(pz, b.maxZ));
                    
                    const collDistX = px - closestX;
                    const collDistZ = pz - closestZ;
                    const collDistSq = collDistX * collDistX + collDistZ * collDistZ;
                    const radiusSq = this.playerRadius * this.playerRadius;
                    
                    if (collDistSq < radiusSq && collDistSq > 0.001) {
                        const collDist = Math.sqrt(collDistSq);
                        const pushFactor = (this.playerRadius - collDist) / collDist;
                        position.x += collDistX * pushFactor;
                        position.z += collDistZ * pushFactor;
                        
                        // Dampen velocity
                        const velDot = this.velocity.x * collDistX + this.velocity.z * collDistZ;
                        if (velDot < 0) {
                            this.velocity.x *= 0.5;
                            this.velocity.z *= 0.5;
                        }
                    }
                }
            }
        }
    }

    _handleCarCollision(position) {
        if (this.carCollisions.length === 0) return;
        
        const px = position.x;
        const pz = position.z;
        const py = position.y;
        const pr = this.playerRadius;
        
        for (const car of this.carCollisions) {
            // Skip if player is above the car
            if (py > car.height + 1) continue;
            
            // Check AABB collision with player sphere
            const closestX = Math.max(car.minX, Math.min(px, car.maxX));
            const closestZ = Math.max(car.minZ, Math.min(pz, car.maxZ));
            
            const dx = px - closestX;
            const dz = pz - closestZ;
            const distSq = dx * dx + dz * dz;
            const radiusSq = pr * pr;
            const dist = Math.sqrt(distSq);
            
            // ===== NEAR MISS CHECK =====
            // Check if close but not colliding
            const nearMissRadiusSq = this.nearMissDistance * this.nearMissDistance;
            if (distSq < nearMissRadiusSq && distSq >= radiusSq && this.nearMissCooldown <= 0) {
                // Near miss! Award charge bonus
                this._triggerNearMiss(position, car);
            }
            
            if (distSq < radiusSq && distSq > 0.001) {
                // Collision detected - push player out
                const pushFactor = (pr - dist) / dist;
                
                position.x += dx * pushFactor * 1.2;
                position.z += dz * pushFactor * 1.2;
                
                // Bounce velocity away from car
                const velDot = this.velocity.x * dx + this.velocity.z * dz;
                if (velDot < 0) {
                    // Hitting the car - bounce back
                    this.velocity.x *= -0.3;
                    this.velocity.z *= -0.3;
                }
            }
            
            // Check if player is directly on top of car (can stand on cars)
            const insideX = px > car.minX && px < car.maxX;
            const insideZ = pz > car.minZ && pz < car.maxZ;
            
            if (insideX && insideZ && py <= car.height + 1 && py > car.height - 0.5) {
                if (this.velocity.y < 0) {
                    position.y = car.height + 1;
                    this.velocity.y = 0;
                }
            }
        }
    }

    /**
     * Trigger near-miss bonus
     */
    _triggerNearMiss(position, car) {
        // Set cooldown
        this.nearMissCooldown = this.nearMissCooldownTime;
        
        // Add charge (20%)
        if (!this.isFullyCharged) {
            this.charge = Math.min(1, this.charge + this.nearMissChargeBonus);
            
            // Check if now fully charged
            if (this.charge >= 1) {
                this.charge = 1;
                this.isFullyCharged = true;
                this.chargeUsed = false;
                this.eventBus.emit(Events.CHARGE_FULL);
            }
        }
        
        // Calculate spark position (between player and car)
        const carCenterX = (car.minX + car.maxX) / 2;
        const carCenterZ = (car.minZ + car.maxZ) / 2;
        const sparkPos = {
            x: (position.x + carCenterX) / 2,
            y: position.y,
            z: (position.z + carCenterZ) / 2
        };
        
        // Trigger time dilation for juice (brief slowmo)
        this.triggerTimeDilation(0.7, 0.15);
        
        // Emit near miss event with position for spark effects
        this.eventBus.emit(Events.NEAR_MISS, { 
            position: sparkPos,
            chargeGained: this.nearMissChargeBonus
        });
    }

    _handleDroneCollision(position) {
        if (this.droneCollisions.length === 0) return;
        
        const px = position.x;
        const pz = position.z;
        const py = position.y;
        const pr = this.playerRadius;
        
        for (const drone of this.droneCollisions) {
            // Skip if player is not at drone altitude
            if (py < drone.minY - pr || py > drone.maxY + pr) continue;
            
            // Check AABB collision with player sphere (in XZ plane)
            const closestX = Math.max(drone.minX, Math.min(px, drone.maxX));
            const closestZ = Math.max(drone.minZ, Math.min(pz, drone.maxZ));
            
            const dx = px - closestX;
            const dz = pz - closestZ;
            const dy = py - drone.centerY;
            const distSq = dx * dx + dz * dz + dy * dy * 0.5; // Less weight on Y
            const radiusSq = pr * pr;
            
            if (distSq < radiusSq && distSq > 0.001) {
                // Collision detected - push player away
                const dist = Math.sqrt(distSq);
                const pushFactor = (pr - dist) / dist;
                
                // Push in all directions (drones are in air)
                position.x += dx * pushFactor * 1.5;
                position.z += dz * pushFactor * 1.5;
                position.y += dy * pushFactor * 0.8;
                
                // Bounce velocity - drones cause more chaotic bounces
                this.velocity.x += dx * 0.5;
                this.velocity.z += dz * 0.5;
                this.velocity.y += 0.2; // Pop up a little
            }
        }
    }

    _handlePedestrianCollision(position) {
        if (this.pedestrianCollisions.length === 0) return;
        
        const px = position.x;
        const pz = position.z;
        const py = position.y;
        const pr = this.playerRadius;
        
        for (const ped of this.pedestrianCollisions) {
            // Skip if player is above pedestrian
            if (py > ped.height + 0.5) continue;
            
            // Check AABB collision
            const closestX = Math.max(ped.minX, Math.min(px, ped.maxX));
            const closestZ = Math.max(ped.minZ, Math.min(pz, ped.maxZ));
            
            const dx = px - closestX;
            const dz = pz - closestZ;
            const distSq = dx * dx + dz * dz;
            const radiusSq = pr * pr;
            
            if (distSq < radiusSq && distSq > 0.001) {
                // Collision - push player away (softer than cars)
                const dist = Math.sqrt(distSq);
                const pushFactor = (pr - dist) / dist;
                
                position.x += dx * pushFactor * 0.8;
                position.z += dz * pushFactor * 0.8;
                
                // Slight velocity reduction
                this.velocity.x *= 0.9;
                this.velocity.z *= 0.9;
            }
        }
    }

    _handleGroundCollision(position) {
        const wasGrounded = this.isGrounded;
        const fallVelocity = this.velocity.y; // Store before zeroing
        
        // If we have upward velocity, we're definitely airborne
        if (this.velocity.y > 0.05) {
            this.isGrounded = false;
        }
        // Landing: near ground AND moving downward or stopped
        else if (position.y <= PLAYER.GROUND_LEVEL + 0.1 && this.velocity.y <= 0) {
            this.velocity.y = 0;
            this.isGrounded = true;
            this.isFlying = false;
        }
        // Clearly airborne: well above ground
        else if (position.y > PLAYER.GROUND_LEVEL + 0.5) {
            this.isGrounded = false;
        }
        // Between thresholds: maintain current state (hysteresis)

        // Emit events on state change
        if (!wasGrounded && this.isGrounded) {
            this.eventBus.emit(Events.PLAYER_GROUNDED);
            
            // Check for heavy landing impact (falling fast)
            // fallVelocity is negative when falling, so we negate it
            const impactSpeed = -fallVelocity;
            if (impactSpeed > 0.3) {
                // Scale impact: 0.3 = soft, 1.0+ = hard
                const impactStrength = Math.min(1, (impactSpeed - 0.3) / 0.7);
                this.eventBus.emit(Events.PLAYER_LAND_IMPACT, impactStrength);
            }
        } else if (wasGrounded && !this.isGrounded) {
            this.eventBus.emit(Events.PLAYER_AIRBORNE);
        }
    }

    /**
     * Get current speed
     * @returns {number}
     */
    getSpeed() {
        return this.velocity.length();
    }

    /**
     * Get boost charge level (0-1)
     * @returns {number}
     */
    getChargeLevel() {
        return this.charge;
    }

    /**
     * Check if fully charged
     * @returns {boolean}
     */
    isCharged() {
        return this.isFullyCharged;
    }

    /**
     * Get flight energy ratio (0-1)
     * @returns {number}
     */
    getFlightEnergyRatio() {
        return this.flyEnergy / this.flyEnergyMax;
    }

    /**
     * Trigger time dilation effect
     * @param {number} scale - Time scale (0.5 = half speed)
     * @param {number} duration - How long to hold before returning to normal
     */
    triggerTimeDilation(scale, duration) {
        this.targetTimeScale = scale;
        this.timeDilationDuration = duration;
    }

    /**
     * Update time dilation (call at start of update)
     * @param {number} deltaTime - Raw delta time
     * @returns {number} - Adjusted delta time
     */
    updateTimeDilation(deltaTime) {
        // Smoothly interpolate time scale
        this.timeScale = this.timeScale + (this.targetTimeScale - this.timeScale) * 0.2;
        
        // Count down duration
        if (this.timeDilationDuration > 0) {
            this.timeDilationDuration -= deltaTime;
            if (this.timeDilationDuration <= 0) {
                this.targetTimeScale = 1.0;
            }
        }
        
        return deltaTime * this.timeScale;
    }

    /**
     * Get current time scale
     */
    getTimeScale() {
        return this.timeScale;
    }
}
