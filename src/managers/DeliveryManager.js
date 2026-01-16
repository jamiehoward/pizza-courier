import * as THREE from 'three';
import { Pizza } from '../entities/Pizza.js';
import { CITY, WORLD } from '../constants.js';
import { Events } from '../core/EventBus.js';

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
        
        // Destination marker
        this.destinationMarker = null;
        this.destinationBeam = null;
        
        // Stats
        this.deliveriesCompleted = 0;
        this.deliveriesFailed = 0;
        
        // Delivery range
        this.deliveryRange = 5;
        
        // Respawn delay
        this.respawnDelay = 3;
        this.respawnTimer = 0;
        this.waitingForRespawn = false;
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
     * Start a delivery
     */
    startDelivery() {
        this.hasActivePizza = true;
        this.deliveryDestination = this._generateDestination();
        this.deliveryTimer = this.deliveryTimeLimit;
        
        // Show destination marker
        this.destinationMarker.position.copy(this.deliveryDestination);
        this.destinationMarker.visible = true;
        
        // Emit event
        this.eventBus.emit(Events.DELIVERY_STARTED, {
            destination: this.deliveryDestination,
            timeLimit: this.deliveryTimeLimit
        });
        
        console.log('Delivery started! Destination:', this.deliveryDestination);
    }

    /**
     * Complete a delivery successfully
     */
    completeDelivery() {
        this.deliveriesCompleted++;
        this.hasActivePizza = false;
        this.destinationMarker.visible = false;
        
        // Emit event
        this.eventBus.emit(Events.DELIVERY_COMPLETED, {
            total: this.deliveriesCompleted,
            timeRemaining: this.deliveryTimer
        });
        
        console.log('Delivery complete! Total:', this.deliveriesCompleted);
        
        // Schedule respawn
        this.waitingForRespawn = true;
        this.respawnTimer = this.respawnDelay;
    }

    /**
     * Fail a delivery (time ran out)
     */
    failDelivery() {
        this.deliveriesFailed++;
        this.hasActivePizza = false;
        this.destinationMarker.visible = false;
        
        // Emit event
        this.eventBus.emit(Events.DELIVERY_FAILED, {
            failed: this.deliveriesFailed
        });
        
        console.log('Delivery failed! Total failed:', this.deliveriesFailed);
        
        // Schedule respawn
        this.waitingForRespawn = true;
        this.respawnTimer = this.respawnDelay;
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
    update(deltaTime, playerPosition) {
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
            this.deliveryTimer -= deltaTime;
            
            // Check for delivery completion
            if (this.canDeliver(playerPosition)) {
                this.completeDelivery();
            }
            // Check for time out
            else if (this.deliveryTimer <= 0) {
                this.failDelivery();
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
            
            // Pulse the ring
            const ring = this.destinationMarker.children[0];
            if (ring) {
                ring.material.opacity = 0.4 + Math.sin(Date.now() * 0.005) * 0.2;
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
            pizzaPosition: this.pizza?.isActive ? this.pizza.getPosition() : null
        };
    }
}
