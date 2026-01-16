import * as THREE from 'three';
import { Pizza } from '../entities/Pizza.js';
import { CITY, WORLD } from '../constants.js';
import { Events } from '../core/EventBus.js';

// Delivery type configurations
const DELIVERY_TYPES = {
    STANDARD: {
        name: 'Standard',
        description: 'Regular delivery',
        timeLimit: 120,
        rewardMultiplier: 1.0,
        color: 0x00ff00, // Green
        requirements: null
    },
    RUSH: {
        name: 'Rush',
        description: 'Tight deadline!',
        timeLimit: 45,
        rewardMultiplier: 1.5,
        color: 0xffaa00, // Orange
        requirements: null
    },
    FRAGILE: {
        name: 'Fragile',
        description: 'No collisions allowed!',
        timeLimit: 90,
        rewardMultiplier: 2.0,
        color: 0xff00ff, // Magenta
        requirements: {
            noCollisions: true
        }
    },
    HOT: {
        name: 'Hot',
        description: 'Keep moving or it cools!',
        timeLimit: 90,
        rewardMultiplier: 1.5,
        color: 0xff4444, // Red
        requirements: {
            minSpeed: 0.1,    // Must maintain this speed ratio
            coolingRate: 5,   // Seconds lost per second when too slow
        }
    },
    VIP: {
        name: 'VIP',
        description: 'High-profile customer',
        timeLimit: 60,
        rewardMultiplier: 2.5,
        color: 0xffdd00, // Gold
        requirements: null
    }
};

/**
 * Manages pizza pickup and delivery gameplay
 */
export class DeliveryManager {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        
        this.pizza = null;
        this.pizzaShopPosition = new THREE.Vector3(0, 0, 0);
        
        // Delivery state
        this.hasActivePizza = false;
        this.deliveryDestination = null;
        this.deliveryTimer = 0;
        this.deliveryTimeLimit = 120; // seconds
        
        // Delivery type system
        this.currentDeliveryType = null;
        this.deliveryTypes = DELIVERY_TYPES;
        this.collisionCount = 0;  // Track for FRAGILE type
        this.currentSpeed = 0;    // Track for HOT type
        this.pizzaTemperature = 100; // 0-100, for HOT type display
        
        // Destination marker
        this.destinationMarker = null;
        this.destinationBeam = null;
        
        // Stats
        this.deliveriesCompleted = 0;
        this.deliveriesFailed = 0;
        this.totalCreditsEarned = 0;
        
        // Per-type stats
        this.deliveryStats = {
            STANDARD: { completed: 0, failed: 0 },
            RUSH: { completed: 0, failed: 0 },
            FRAGILE: { completed: 0, failed: 0 },
            HOT: { completed: 0, failed: 0 },
            VIP: { completed: 0, failed: 0 }
        };
        
        // Delivery range
        this.deliveryRange = 5;
        
        // Respawn delay
        this.respawnDelay = 3;
        this.respawnTimer = 0;
        this.waitingForRespawn = false;
        
        // Listen for collision events (for FRAGILE)
        this.eventBus.on(Events.PLAYER_COLLISION, () => {
            if (this.hasActivePizza && this.currentDeliveryType?.requirements?.noCollisions) {
                this.collisionCount++;
                this._onFragileCollision();
            }
        });
    }

    async init() {
        // Create pizza entity
        this.pizza = new Pizza(this.scene, this.eventBus);
        await this.pizza.load();
        
        // Create destination marker
        this._createDestinationMarker();
        
        // Spawn initial pizza at shop
        this.spawnPizzaAtShop();
    }

    /**
     * Set the pizza shop position
     */
    setPizzaShopPosition(position) {
        this.pizzaShopPosition.copy(position);
    }

    /**
     * Spawn a pizza at the shop
     */
    spawnPizzaAtShop() {
        if (this.pizza) {
            // Spawn outside the front of the shop
            const spawnPos = this.pizzaShopPosition.clone();
            spawnPos.z += 12; // Further out in front
            spawnPos.y = 0;
            this.pizza.spawn(spawnPos);
        }
        this.waitingForRespawn = false;
    }

    /**
     * Create the destination marker (pillar of light)
     */
    _createDestinationMarker() {
        // Create a group for the marker
        this.destinationMarker = new THREE.Group();
        
        // Ground ring
        const ringGeometry = new THREE.RingGeometry(2, 3, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        this.destinationMarker.add(ring);
        
        // Beam of light
        const beamGeometry = new THREE.CylinderGeometry(0.5, 2, 50, 16, 1, true);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.destinationBeam = new THREE.Mesh(beamGeometry, beamMaterial);
        this.destinationBeam.position.y = 25;
        this.destinationMarker.add(this.destinationBeam);
        
        // Arrow pointing down
        const arrowGeometry = new THREE.ConeGeometry(1, 2, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });
        this.destinationArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        this.destinationArrow.rotation.x = Math.PI;
        this.destinationArrow.position.y = 5;
        this.destinationMarker.add(this.destinationArrow);
        
        this.destinationMarker.visible = false;
        this.scene.add(this.destinationMarker);
    }

    /**
     * Generate a random delivery destination on building edge
     */
    _generateDestination() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        
        // Pick a random block (not center)
        let gridX, gridZ;
        do {
            gridX = Math.floor(Math.random() * (CITY.GRID_EXTENT * 2 + 1)) - CITY.GRID_EXTENT;
            gridZ = Math.floor(Math.random() * (CITY.GRID_EXTENT * 2 + 1)) - CITY.GRID_EXTENT;
        } while (gridX === 0 && gridZ === 0);
        
        // Position at block edge (on the street)
        const blockCenterX = gridX * cellSize;
        const blockCenterZ = gridZ * cellSize;
        
        // Random edge of block
        const edge = Math.floor(Math.random() * 4);
        let x, z;
        
        switch (edge) {
            case 0: // North
                x = blockCenterX + (Math.random() - 0.5) * CITY.BLOCK_SIZE * 0.5;
                z = blockCenterZ - CITY.BLOCK_SIZE / 2 - 2;
                break;
            case 1: // South
                x = blockCenterX + (Math.random() - 0.5) * CITY.BLOCK_SIZE * 0.5;
                z = blockCenterZ + CITY.BLOCK_SIZE / 2 + 2;
                break;
            case 2: // East
                x = blockCenterX + CITY.BLOCK_SIZE / 2 + 2;
                z = blockCenterZ + (Math.random() - 0.5) * CITY.BLOCK_SIZE * 0.5;
                break;
            case 3: // West
                x = blockCenterX - CITY.BLOCK_SIZE / 2 - 2;
                z = blockCenterZ + (Math.random() - 0.5) * CITY.BLOCK_SIZE * 0.5;
                break;
        }
        
        return new THREE.Vector3(x, 0, z);
    }

    /**
     * Select a random delivery type based on progression
     */
    _selectDeliveryType() {
        const completedTotal = this.deliveriesCompleted;
        
        // Early game: mostly standard
        if (completedTotal < 3) {
            return { ...DELIVERY_TYPES.STANDARD, key: 'STANDARD' };
        }
        
        // Build weighted pool based on progression
        const pool = [];
        
        // Standard always available
        pool.push({ type: 'STANDARD', weight: 30 });
        
        // Rush available after 2 deliveries
        if (completedTotal >= 2) {
            pool.push({ type: 'RUSH', weight: 25 });
        }
        
        // Fragile available after 5 deliveries
        if (completedTotal >= 5) {
            pool.push({ type: 'FRAGILE', weight: 15 });
        }
        
        // Hot available after 3 deliveries
        if (completedTotal >= 3) {
            pool.push({ type: 'HOT', weight: 20 });
        }
        
        // VIP rare, available after 8 deliveries
        if (completedTotal >= 8) {
            pool.push({ type: 'VIP', weight: 10 });
        }
        
        // Weighted random selection
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const item of pool) {
            random -= item.weight;
            if (random <= 0) {
                return { ...DELIVERY_TYPES[item.type], key: item.type };
            }
        }
        
        return { ...DELIVERY_TYPES.STANDARD, key: 'STANDARD' };
    }

    /**
     * Start a delivery
     */
    startDelivery() {
        // Select delivery type
        this.currentDeliveryType = this._selectDeliveryType();
        
        this.hasActivePizza = true;
        this.deliveryDestination = this._generateDestination();
        this.deliveryTimer = this.currentDeliveryType.timeLimit;
        this.deliveryTimeLimit = this.currentDeliveryType.timeLimit;
        this.collisionCount = 0;
        this.pizzaTemperature = 100;
        
        // Update marker color based on delivery type
        this._updateMarkerColor(this.currentDeliveryType.color);
        
        // Show destination marker
        this.destinationMarker.position.copy(this.deliveryDestination);
        this.destinationMarker.visible = true;
        
        // Emit event
        this.eventBus.emit(Events.DELIVERY_STARTED, {
            destination: this.deliveryDestination,
            timeLimit: this.deliveryTimeLimit,
            type: this.currentDeliveryType.key,
            typeName: this.currentDeliveryType.name,
            description: this.currentDeliveryType.description,
            rewardMultiplier: this.currentDeliveryType.rewardMultiplier
        });
        
        console.log(`${this.currentDeliveryType.name} delivery started! Destination:`, this.deliveryDestination);
    }

    /**
     * Update destination marker color
     */
    _updateMarkerColor(color) {
        if (this.destinationMarker) {
            this.destinationMarker.traverse((child) => {
                if (child.material) {
                    child.material.color.setHex(color);
                }
            });
        }
    }

    /**
     * Handle collision during FRAGILE delivery
     */
    _onFragileCollision() {
        // First collision gives a warning
        if (this.collisionCount === 1) {
            this.eventBus.emit(Events.DELIVERY_WARNING, {
                message: 'Careful! Package is fragile!'
            });
        }
        // Second collision fails the delivery
        else if (this.collisionCount >= 2) {
            this.eventBus.emit(Events.DELIVERY_WARNING, {
                message: 'Package damaged!'
            });
            this.failDelivery('damaged');
        }
    }

    /**
     * Calculate credits earned for a delivery
     */
    _calculateCredits(timeRemaining, timeLimit, rewardMultiplier) {
        const baseCredits = 100;
        const timeBonus = Math.floor((timeRemaining / timeLimit) * 50);
        return Math.floor((baseCredits + timeBonus) * rewardMultiplier);
    }

    /**
     * Complete a delivery successfully
     */
    completeDelivery() {
        this.deliveriesCompleted++;
        this.hasActivePizza = false;
        this.destinationMarker.visible = false;
        
        // Calculate credits
        const creditsEarned = this._calculateCredits(
            this.deliveryTimer,
            this.deliveryTimeLimit,
            this.currentDeliveryType.rewardMultiplier
        );
        this.totalCreditsEarned += creditsEarned;
        
        // Update per-type stats
        if (this.currentDeliveryType?.key) {
            this.deliveryStats[this.currentDeliveryType.key].completed++;
        }
        
        // Emit event
        this.eventBus.emit(Events.DELIVERY_COMPLETED, {
            total: this.deliveriesCompleted,
            timeRemaining: this.deliveryTimer,
            creditsEarned: creditsEarned,
            totalCredits: this.totalCreditsEarned,
            type: this.currentDeliveryType?.key,
            typeName: this.currentDeliveryType?.name
        });
        
        console.log(`${this.currentDeliveryType?.name} delivery complete! Credits: ${creditsEarned}`);
        
        // Schedule respawn
        this.waitingForRespawn = true;
        this.respawnTimer = this.respawnDelay;
        this.currentDeliveryType = null;
    }

    /**
     * Fail a delivery
     * @param {string} reason - 'timeout', 'damaged', 'cold'
     */
    failDelivery(reason = 'timeout') {
        this.deliveriesFailed++;
        this.hasActivePizza = false;
        this.destinationMarker.visible = false;
        
        // Update per-type stats
        if (this.currentDeliveryType?.key) {
            this.deliveryStats[this.currentDeliveryType.key].failed++;
        }
        
        // Emit event
        this.eventBus.emit(Events.DELIVERY_FAILED, {
            failed: this.deliveriesFailed,
            reason: reason,
            type: this.currentDeliveryType?.key,
            typeName: this.currentDeliveryType?.name
        });
        
        console.log(`${this.currentDeliveryType?.name} delivery failed! Reason: ${reason}`);
        
        // Schedule respawn
        this.waitingForRespawn = true;
        this.respawnTimer = this.respawnDelay;
        this.currentDeliveryType = null;
    }

    /**
     * Check if player can deliver
     */
    canDeliver(playerPosition) {
        if (!this.hasActivePizza || !this.deliveryDestination) return false;
        
        const distance = playerPosition.distanceTo(this.deliveryDestination);
        return distance < this.deliveryRange;
    }

    /**
     * Update delivery state
     */
    update(deltaTime, playerPosition, playerSpeed = 0, maxSpeed = 1) {
        // Store current speed for HOT delivery type
        this.currentSpeed = playerSpeed / maxSpeed;
        
        // Update pizza animation
        if (this.pizza) {
            this.pizza.update(deltaTime);
        }
        
        // Check for pizza pickup
        if (this.pizza && this.pizza.canPickup(playerPosition)) {
            this.pizza.pickup();
            this.startDelivery();
        }
        
        // Update delivery timer
        if (this.hasActivePizza) {
            let timeDeduction = deltaTime;
            
            // HOT delivery: extra time penalty when moving slowly
            if (this.currentDeliveryType?.requirements?.minSpeed) {
                const minSpeedRequired = this.currentDeliveryType.requirements.minSpeed;
                const coolingRate = this.currentDeliveryType.requirements.coolingRate;
                
                if (this.currentSpeed < minSpeedRequired) {
                    // Faster cooling when slower
                    const coolingMultiplier = 1 - (this.currentSpeed / minSpeedRequired);
                    timeDeduction += coolingRate * coolingMultiplier * deltaTime;
                    
                    // Update pizza temperature for UI
                    this.pizzaTemperature = Math.max(0, this.pizzaTemperature - coolingMultiplier * 20 * deltaTime);
                    
                    // Warning when getting cold
                    if (this.pizzaTemperature < 30 && this.pizzaTemperature > 0) {
                        // Emit warning periodically
                        if (Math.random() < deltaTime * 0.5) {
                            this.eventBus.emit(Events.DELIVERY_WARNING, {
                                message: 'Pizza is getting cold! Speed up!'
                            });
                        }
                    }
                } else {
                    // Reheat slightly when moving fast
                    this.pizzaTemperature = Math.min(100, this.pizzaTemperature + 10 * deltaTime);
                }
                
                // Fail if pizza gets too cold
                if (this.pizzaTemperature <= 0) {
                    this.failDelivery('cold');
                    return;
                }
            }
            
            this.deliveryTimer -= timeDeduction;
            
            // Check for delivery completion
            if (this.canDeliver(playerPosition)) {
                this.completeDelivery();
            }
            // Check for time out
            else if (this.deliveryTimer <= 0) {
                this.failDelivery('timeout');
            }
        }
        
        // Update respawn timer
        if (this.waitingForRespawn) {
            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.spawnPizzaAtShop();
            }
        }
        
        // Animate destination marker
        if (this.destinationMarker.visible) {
            this.destinationArrow.position.y = 5 + Math.sin(Date.now() * 0.003) * 1;
            this.destinationBeam.rotation.y += 0.01;
            
            // Pulse the ring - faster pulse for Rush delivery
            const pulseSpeed = this.currentDeliveryType?.key === 'RUSH' ? 0.01 : 0.005;
            const ring = this.destinationMarker.children[0];
            if (ring) {
                ring.material.opacity = 0.4 + Math.sin(Date.now() * pulseSpeed) * 0.2;
            }
        }
    }

    /**
     * Get delivery state for UI
     */
    getState() {
        return {
            hasActivePizza: this.hasActivePizza,
            timeRemaining: Math.max(0, this.deliveryTimer),
            destination: this.deliveryDestination,
            deliveriesCompleted: this.deliveriesCompleted,
            deliveriesFailed: this.deliveriesFailed,
            pizzaPosition: this.pizza?.isActive ? this.pizza.getPosition() : null,
            // Delivery type info
            deliveryType: this.currentDeliveryType?.key,
            deliveryTypeName: this.currentDeliveryType?.name,
            deliveryDescription: this.currentDeliveryType?.description,
            rewardMultiplier: this.currentDeliveryType?.rewardMultiplier,
            // HOT delivery specific
            pizzaTemperature: this.pizzaTemperature,
            isHotDelivery: this.currentDeliveryType?.requirements?.minSpeed !== undefined,
            // Stats
            totalCredits: this.totalCreditsEarned,
            deliveryStats: this.deliveryStats
        };
    }
}
