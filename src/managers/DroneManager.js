// DroneManager - Handles spawning and movement of flying drones

import * as THREE from 'three';
import { CITY } from '../constants.js';

// Drone configurations
const DRONE_TYPES = [
    { name: 'delivery', size: 0.8, color: 0x44aaff, propellers: 4 },
    { name: 'delivery', size: 0.8, color: 0xff8844, propellers: 4 },
    { name: 'camera', size: 0.5, color: 0x222222, propellers: 4 },
    { name: 'cargo', size: 1.2, color: 0xffcc00, propellers: 6 },
    { name: 'cargo', size: 1.2, color: 0x33cc33, propellers: 6 },
    { name: 'small', size: 0.4, color: 0xff44ff, propellers: 4 },
    { name: 'small', size: 0.4, color: 0x44ffff, propellers: 4 },
];

const DRONE_CONFIG = {
    MAX_DRONES: 50,
    SPAWN_RADIUS: 80,
    DESPAWN_RADIUS: 100,
    MIN_SPAWN_DISTANCE: 15,
    SPEED_MIN: 10,
    SPEED_MAX: 20,
    MIN_ALTITUDE: 8,
    MAX_ALTITUDE: 80,
    SPAWN_INTERVAL: 0.2,
    // Erratic behavior settings
    WOBBLE_INTENSITY: 0.3,
    WOBBLE_SPEED: 3,
    DIRECTION_CHANGE_CHANCE: 0.02,  // Chance per frame to change direction
    ALTITUDE_DRIFT_SPEED: 2,
    SUDDEN_STOP_CHANCE: 0.005,      // Chance to briefly hover
    SUDDEN_BOOST_CHANCE: 0.01,      // Chance to speed up suddenly
};

class Drone {
    constructor(type, position, velocity, targetAltitude) {
        this.type = type;
        this.velocity = velocity.clone();
        this.baseSpeed = velocity.length();
        this.targetAltitude = targetAltitude;
        
        // Store propeller references for animation (must be before _createMesh)
        this.propellers = [];
        
        this.mesh = this._createMesh(type);
        this.mesh.position.copy(position);
        
        // Erratic behavior state
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobblePhaseY = Math.random() * Math.PI * 2;
        this.isHovering = false;
        this.hoverTimer = 0;
        this.propellerAngle = 0;
        this.tiltAngle = new THREE.Vector2(0, 0);
        
        // Collision bounds
        this.collisionRadius = type.size * 1.5;
    }

    _createMesh(type) {
        const group = new THREE.Group();
        
        // Main body
        const bodyGeometry = new THREE.SphereGeometry(type.size * 0.5, 8, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: type.color,
            roughness: 0.3,
            metalness: 0.7
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.scale.set(1, 0.5, 1);
        body.castShadow = true;
        group.add(body);
        
        // Camera/sensor underneath
        const sensorGeometry = new THREE.CylinderGeometry(type.size * 0.15, type.size * 0.2, type.size * 0.3, 6);
        const sensorMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.1,
            metalness: 0.9
        });
        const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
        sensor.position.y = -type.size * 0.3;
        group.add(sensor);
        
        // Arms and propellers
        const armGeometry = new THREE.BoxGeometry(type.size * 1.5, type.size * 0.08, type.size * 0.12);
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.5,
            metalness: 0.5
        });
        
        const propGeometry = new THREE.BoxGeometry(type.size * 0.8, type.size * 0.02, type.size * 0.1);
        const propMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.3,
            metalness: 0.8
        });
        
        const numArms = type.propellers === 6 ? 3 : 2;
        
        for (let i = 0; i < numArms; i++) {
            const angle = (i / numArms) * Math.PI;
            const arm = new THREE.Mesh(armGeometry, armMaterial);
            arm.rotation.y = angle;
            arm.castShadow = true;
            group.add(arm);
            
            // Propellers at each end of arm
            const propDistance = type.size * 0.7;
            for (let side = -1; side <= 1; side += 2) {
                const propGroup = new THREE.Group();
                propGroup.position.set(
                    Math.cos(angle) * propDistance * side,
                    type.size * 0.1,
                    Math.sin(angle) * propDistance * side
                );
                
                const prop = new THREE.Mesh(propGeometry, propMaterial);
                propGroup.add(prop);
                
                // Second blade perpendicular
                const prop2 = new THREE.Mesh(propGeometry, propMaterial);
                prop2.rotation.y = Math.PI / 2;
                propGroup.add(prop2);
                
                group.add(propGroup);
                this.propellers.push(propGroup);
            }
        }
        
        // Lights
        const lightGeometry = new THREE.SphereGeometry(type.size * 0.08, 4, 4);
        const lightMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.9
        });
        
        const light1 = new THREE.Mesh(lightGeometry, lightMaterial);
        light1.position.set(type.size * 0.4, 0, 0);
        group.add(light1);
        
        const light2Material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.9
        });
        const light2 = new THREE.Mesh(lightGeometry, light2Material);
        light2.position.set(-type.size * 0.4, 0, 0);
        group.add(light2);
        
        return group;
    }

    update(deltaTime) {
        // Spin propellers
        this.propellerAngle += deltaTime * 30;
        for (const prop of this.propellers) {
            prop.rotation.y = this.propellerAngle;
        }
        
        // Handle hovering state
        if (this.isHovering) {
            this.hoverTimer -= deltaTime;
            if (this.hoverTimer <= 0) {
                this.isHovering = false;
            }
            // Just wobble in place
            this._applyWobble(deltaTime);
            return;
        }
        
        // Random behavior changes
        if (Math.random() < DRONE_CONFIG.DIRECTION_CHANGE_CHANCE) {
            // Sudden direction shift
            const turnAngle = (Math.random() - 0.5) * Math.PI * 0.5;
            const cos = Math.cos(turnAngle);
            const sin = Math.sin(turnAngle);
            const newVx = this.velocity.x * cos - this.velocity.z * sin;
            const newVz = this.velocity.x * sin + this.velocity.z * cos;
            this.velocity.x = newVx;
            this.velocity.z = newVz;
        }
        
        if (Math.random() < DRONE_CONFIG.SUDDEN_STOP_CHANCE) {
            // Brief hover
            this.isHovering = true;
            this.hoverTimer = 0.5 + Math.random() * 1.5;
        }
        
        if (Math.random() < DRONE_CONFIG.SUDDEN_BOOST_CHANCE) {
            // Speed boost
            const boostFactor = 1.5 + Math.random() * 0.5;
            this.velocity.multiplyScalar(boostFactor);
            // Clamp to reasonable speed
            const speed = this.velocity.length();
            if (speed > DRONE_CONFIG.SPEED_MAX * 2) {
                this.velocity.multiplyScalar(DRONE_CONFIG.SPEED_MAX * 2 / speed);
            }
        }
        
        // Gradually return to base speed
        const currentSpeed = this.velocity.length();
        if (currentSpeed > this.baseSpeed * 1.1) {
            this.velocity.multiplyScalar(0.98);
        } else if (currentSpeed < this.baseSpeed * 0.9) {
            this.velocity.multiplyScalar(1.02);
        }
        
        // Move
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;
        
        // Altitude drift toward target
        const altDiff = this.targetAltitude - this.mesh.position.y;
        this.mesh.position.y += altDiff * DRONE_CONFIG.ALTITUDE_DRIFT_SPEED * deltaTime;
        
        // Random altitude wandering
        this.targetAltitude += (Math.random() - 0.5) * 0.5;
        this.targetAltitude = Math.max(DRONE_CONFIG.MIN_ALTITUDE, 
            Math.min(DRONE_CONFIG.MAX_ALTITUDE, this.targetAltitude));
        
        // Apply wobble
        this._applyWobble(deltaTime);
        
        // Tilt based on movement direction
        const targetTiltX = -this.velocity.z * 0.02;
        const targetTiltZ = this.velocity.x * 0.02;
        this.tiltAngle.x += (targetTiltX - this.tiltAngle.x) * 5 * deltaTime;
        this.tiltAngle.y += (targetTiltZ - this.tiltAngle.y) * 5 * deltaTime;
        
        this.mesh.rotation.x = this.tiltAngle.x;
        this.mesh.rotation.z = this.tiltAngle.y;
        
        // Face movement direction (with wobble)
        const moveAngle = Math.atan2(this.velocity.x, this.velocity.z);
        this.mesh.rotation.y = moveAngle + Math.sin(this.wobblePhase) * 0.1;
    }

    _applyWobble(deltaTime) {
        this.wobblePhase += DRONE_CONFIG.WOBBLE_SPEED * deltaTime;
        this.wobblePhaseY += DRONE_CONFIG.WOBBLE_SPEED * 1.3 * deltaTime;
        
        // Position wobble
        const wobbleX = Math.sin(this.wobblePhase) * DRONE_CONFIG.WOBBLE_INTENSITY;
        const wobbleY = Math.sin(this.wobblePhaseY) * DRONE_CONFIG.WOBBLE_INTENSITY * 0.5;
        
        this.mesh.position.x += wobbleX * deltaTime;
        this.mesh.position.y += wobbleY * deltaTime;
    }

    getPosition() {
        return this.mesh.position;
    }

    getCollisionBounds() {
        const pos = this.mesh.position;
        const r = this.collisionRadius;
        
        return {
            minX: pos.x - r,
            maxX: pos.x + r,
            minZ: pos.z - r,
            maxZ: pos.z + r,
            minY: pos.y - r * 0.5,
            maxY: pos.y + r * 0.5,
            centerY: pos.y
        };
    }

    dispose() {
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
}

export class DroneManager {
    constructor(scene) {
        this.scene = scene;
        this.drones = [];
        this.spawnTimer = 0;
        
        console.log('DroneManager initialized');
    }

    _buildFlightPaths() {
        // No longer needed - using simpler spawn logic
    }

    _getRandomDroneType() {
        return DRONE_TYPES[Math.floor(Math.random() * DRONE_TYPES.length)];
    }

    _trySpawnDrone(playerPosition) {
        if (this.drones.length >= DRONE_CONFIG.MAX_DRONES) return;
        
        // Random altitude
        const altitude = DRONE_CONFIG.MIN_ALTITUDE + 
            Math.random() * (DRONE_CONFIG.MAX_ALTITUDE - DRONE_CONFIG.MIN_ALTITUDE);
        
        // Random spawn angle around player
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnDist = DRONE_CONFIG.MIN_SPAWN_DISTANCE + 
            Math.random() * (DRONE_CONFIG.SPAWN_RADIUS - DRONE_CONFIG.MIN_SPAWN_DISTANCE);
        
        const spawnPos = new THREE.Vector3(
            playerPosition.x + Math.cos(spawnAngle) * spawnDist,
            altitude,
            playerPosition.z + Math.sin(spawnAngle) * spawnDist
        );
        
        // Random velocity direction (somewhat toward player area for visibility)
        const velAngle = spawnAngle + Math.PI + (Math.random() - 0.5) * Math.PI;
        const speed = DRONE_CONFIG.SPEED_MIN + 
            Math.random() * (DRONE_CONFIG.SPEED_MAX - DRONE_CONFIG.SPEED_MIN);
        
        const velocity = new THREE.Vector3(
            Math.cos(velAngle) * speed,
            0,
            Math.sin(velAngle) * speed
        );
        
        // Check not too close to other drones
        for (const drone of this.drones) {
            if (drone.getPosition().distanceTo(spawnPos) < 6) {
                return;
            }
        }
        
        // Create the drone
        const droneType = this._getRandomDroneType();
        const drone = new Drone(droneType, spawnPos, velocity, altitude);
        this.scene.add(drone.mesh);
        this.drones.push(drone);
        
        if (this.drones.length <= 5) {
            console.log(`Drone spawned at altitude ${altitude.toFixed(1)}, total: ${this.drones.length}`);
        }
    }

    _despawnDistantDrones(playerPosition) {
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const drone = this.drones[i];
            const pos = drone.getPosition();
            const dx = pos.x - playerPosition.x;
            const dz = pos.z - playerPosition.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > DRONE_CONFIG.DESPAWN_RADIUS) {
                this.scene.remove(drone.mesh);
                drone.dispose();
                this.drones.splice(i, 1);
            }
        }
    }

    update(deltaTime, playerPosition) {
        // Spawn timer
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= DRONE_CONFIG.SPAWN_INTERVAL) {
            this.spawnTimer = 0;
            this._trySpawnDrone(playerPosition);
        }
        
        // Update all drones
        for (const drone of this.drones) {
            drone.update(deltaTime);
        }
        
        // Despawn distant drones
        this._despawnDistantDrones(playerPosition);
    }

    /**
     * Get drone collisions for physics
     */
    getDroneCollisions(playerPosition, radius = 30) {
        const radiusSq = radius * radius;
        const collisions = [];
        
        for (const drone of this.drones) {
            const pos = drone.getPosition();
            const dx = pos.x - playerPosition.x;
            const dz = pos.z - playerPosition.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < radiusSq) {
                collisions.push(drone.getCollisionBounds());
            }
        }
        
        return collisions;
    }

    getDroneCount() {
        return this.drones.length;
    }

    dispose() {
        for (const drone of this.drones) {
            this.scene.remove(drone.mesh);
            drone.dispose();
        }
        this.drones = [];
    }
}
