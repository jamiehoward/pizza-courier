// TrafficManager - Handles spawning and movement of cars on roads

import * as THREE from 'three';
import { CITY } from '../constants.js';

// Car configurations
const CAR_TYPES = [
    { name: 'sedan', length: 4, width: 1.8, height: 1.4, color: 0x3366cc },
    { name: 'sedan', length: 4, width: 1.8, height: 1.4, color: 0xcc3333 },
    { name: 'sedan', length: 4, width: 1.8, height: 1.4, color: 0x33cc33 },
    { name: 'sedan', length: 4, width: 1.8, height: 1.4, color: 0xffcc00 },
    { name: 'sedan', length: 4, width: 1.8, height: 1.4, color: 0xffffff },
    { name: 'sedan', length: 4, width: 1.8, height: 1.4, color: 0x222222 },
    { name: 'suv', length: 4.5, width: 2, height: 1.8, color: 0x444444 },
    { name: 'suv', length: 4.5, width: 2, height: 1.8, color: 0x666688 },
    { name: 'truck', length: 6, width: 2.2, height: 2.5, color: 0x884422 },
    { name: 'van', length: 5, width: 2, height: 2.2, color: 0xeeeeee },
];

const TRAFFIC_CONFIG = {
    MAX_CARS: 120,
    SPAWN_RADIUS: 100,      // Distance from player to spawn cars
    DESPAWN_RADIUS: 130,    // Distance to despawn cars
    MIN_SPAWN_DISTANCE: 20, // Minimum distance from player to spawn
    SPEED_MIN: 8,
    SPEED_MAX: 18,
    LANE_OFFSET: 2.5,       // Offset from road center for lanes
    SPAWN_INTERVAL: 0.1,    // Seconds between spawn attempts
};

class Car {
    constructor(type, position, direction, speed, roadAxis) {
        this.type = type;
        this.speed = speed;
        this.direction = direction; // 1 or -1
        this.roadAxis = roadAxis;   // 'x' or 'z'
        this.mesh = this._createMesh(type);
        this.mesh.position.copy(position);
        
        // Set rotation based on direction and road axis
        if (roadAxis === 'x') {
            this.mesh.rotation.y = direction > 0 ? 0 : Math.PI;
        } else {
            this.mesh.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        
        // Collision bounds (half-extents)
        this.collisionHalfLength = type.length / 2 + 0.5;
        this.collisionHalfWidth = type.width / 2 + 0.3;
        this.collisionHeight = type.height;
    }

    _createMesh(type) {
        const group = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(type.length, type.height * 0.6, type.width);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: type.color,
            roughness: 0.3,
            metalness: 0.6
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = type.height * 0.3;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        // Cabin/roof (smaller box on top)
        if (type.name !== 'truck') {
            const cabinWidth = type.width * 0.9;
            const cabinLength = type.length * 0.5;
            const cabinHeight = type.height * 0.4;
            const cabinGeometry = new THREE.BoxGeometry(cabinLength, cabinHeight, cabinWidth);
            const cabinMaterial = new THREE.MeshStandardMaterial({
                color: 0x222233,
                roughness: 0.1,
                metalness: 0.8
            });
            const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
            cabin.position.set(-type.length * 0.1, type.height * 0.5, 0);
            cabin.castShadow = true;
            group.add(cabin);
        }
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            roughness: 0.9
        });
        
        const wheelPositions = [
            { x: type.length * 0.3, z: type.width * 0.5 },
            { x: type.length * 0.3, z: -type.width * 0.5 },
            { x: -type.length * 0.3, z: type.width * 0.5 },
            { x: -type.length * 0.3, z: -type.width * 0.5 },
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(pos.x, 0.35, pos.z);
            wheel.castShadow = true;
            group.add(wheel);
        });
        
        // Headlights
        const lightGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.3);
        const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        
        const headlightL = new THREE.Mesh(lightGeometry, lightMaterial);
        headlightL.position.set(type.length / 2, type.height * 0.25, type.width * 0.3);
        group.add(headlightL);
        
        const headlightR = new THREE.Mesh(lightGeometry, lightMaterial);
        headlightR.position.set(type.length / 2, type.height * 0.25, -type.width * 0.3);
        group.add(headlightR);
        
        // Taillights
        const tailMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        
        const taillightL = new THREE.Mesh(lightGeometry, tailMaterial);
        taillightL.position.set(-type.length / 2, type.height * 0.25, type.width * 0.3);
        group.add(taillightL);
        
        const taillightR = new THREE.Mesh(lightGeometry, tailMaterial);
        taillightR.position.set(-type.length / 2, type.height * 0.25, -type.width * 0.3);
        group.add(taillightR);
        
        return group;
    }

    update(deltaTime) {
        // Move car along its road axis
        if (this.roadAxis === 'x') {
            this.mesh.position.x += this.speed * this.direction * deltaTime;
        } else {
            this.mesh.position.z += this.speed * this.direction * deltaTime;
        }
    }

    getPosition() {
        return this.mesh.position;
    }

    /**
     * Get axis-aligned bounding box for collision
     */
    getCollisionBounds() {
        const pos = this.mesh.position;
        
        // Swap length/width based on orientation
        let halfX, halfZ;
        if (this.roadAxis === 'x') {
            halfX = this.collisionHalfLength;
            halfZ = this.collisionHalfWidth;
        } else {
            halfX = this.collisionHalfWidth;
            halfZ = this.collisionHalfLength;
        }
        
        return {
            minX: pos.x - halfX,
            maxX: pos.x + halfX,
            minZ: pos.z - halfZ,
            maxZ: pos.z + halfZ,
            height: this.collisionHeight
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

export class TrafficManager {
    constructor(scene) {
        this.scene = scene;
        this.cars = [];
        this.spawnTimer = 0;
        this.roadPositions = [];
        
        // Build road positions for spawning
        this._buildRoadNetwork();
    }

    _buildRoadNetwork() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        const extent = CITY.GRID_EXTENT + 1;
        
        // Horizontal roads (cars travel along X axis)
        for (let z = -extent; z <= extent; z++) {
            const roadZ = z * cellSize - CITY.BLOCK_SIZE / 2 - CITY.STREET_WIDTH / 2;
            this.roadPositions.push({
                axis: 'x',
                fixedCoord: roadZ,
                laneOffset: TRAFFIC_CONFIG.LANE_OFFSET,
                minCoord: -cellSize * extent,
                maxCoord: cellSize * extent
            });
        }
        
        // Vertical roads (cars travel along Z axis)
        for (let x = -extent; x <= extent; x++) {
            const roadX = x * cellSize - CITY.BLOCK_SIZE / 2 - CITY.STREET_WIDTH / 2;
            this.roadPositions.push({
                axis: 'z',
                fixedCoord: roadX,
                laneOffset: TRAFFIC_CONFIG.LANE_OFFSET,
                minCoord: -cellSize * extent,
                maxCoord: cellSize * extent
            });
        }
    }

    _getRandomCarType() {
        return CAR_TYPES[Math.floor(Math.random() * CAR_TYPES.length)];
    }

    _trySpawnCar(playerPosition) {
        if (this.cars.length >= TRAFFIC_CONFIG.MAX_CARS) return;
        
        // Pick a random road
        const road = this.roadPositions[Math.floor(Math.random() * this.roadPositions.length)];
        
        // Pick a random direction (1 or -1)
        const direction = Math.random() > 0.5 ? 1 : -1;
        
        // Pick lane based on direction (right-hand traffic)
        // For X-axis roads: +X direction stays on -Z side, -X direction stays on +Z side
        // For Z-axis roads: +Z direction stays on +X side, -Z direction stays on -X side
        let laneOffset;
        if (road.axis === 'x') {
            laneOffset = -direction * road.laneOffset; // Right-hand traffic for X roads
        } else {
            laneOffset = direction * road.laneOffset;  // Right-hand traffic for Z roads
        }
        
        // Calculate spawn position
        let spawnPos = new THREE.Vector3();
        let validSpawn = false;
        
        // Try to find a valid spawn point
        for (let attempt = 0; attempt < 5; attempt++) {
            if (road.axis === 'x') {
                // Spawn at edge of view range along X
                const spawnX = playerPosition.x + (Math.random() > 0.5 ? 1 : -1) * 
                    (TRAFFIC_CONFIG.MIN_SPAWN_DISTANCE + Math.random() * 
                    (TRAFFIC_CONFIG.SPAWN_RADIUS - TRAFFIC_CONFIG.MIN_SPAWN_DISTANCE));
                spawnPos.set(spawnX, 0.1, road.fixedCoord + laneOffset);
            } else {
                // Spawn at edge of view range along Z
                const spawnZ = playerPosition.z + (Math.random() > 0.5 ? 1 : -1) * 
                    (TRAFFIC_CONFIG.MIN_SPAWN_DISTANCE + Math.random() * 
                    (TRAFFIC_CONFIG.SPAWN_RADIUS - TRAFFIC_CONFIG.MIN_SPAWN_DISTANCE));
                spawnPos.set(road.fixedCoord + laneOffset, 0.1, spawnZ);
            }
            
            // Check distance from player
            const distToPlayer = spawnPos.distanceTo(playerPosition);
            if (distToPlayer >= TRAFFIC_CONFIG.MIN_SPAWN_DISTANCE && 
                distToPlayer <= TRAFFIC_CONFIG.SPAWN_RADIUS) {
                
                // Check if not too close to other cars
                let tooClose = false;
                for (const car of this.cars) {
                    if (car.getPosition().distanceTo(spawnPos) < 10) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    validSpawn = true;
                    break;
                }
            }
        }
        
        if (!validSpawn) return;
        
        // Create the car
        const carType = this._getRandomCarType();
        const speed = TRAFFIC_CONFIG.SPEED_MIN + 
            Math.random() * (TRAFFIC_CONFIG.SPEED_MAX - TRAFFIC_CONFIG.SPEED_MIN);
        
        const car = new Car(carType, spawnPos, direction, speed, road.axis);
        this.scene.add(car.mesh);
        this.cars.push(car);
    }

    _despawnDistantCars(playerPosition) {
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            const distance = car.getPosition().distanceTo(playerPosition);
            
            if (distance > TRAFFIC_CONFIG.DESPAWN_RADIUS) {
                this.scene.remove(car.mesh);
                car.dispose();
                this.cars.splice(i, 1);
            }
        }
    }

    update(deltaTime, playerPosition) {
        // Update spawn timer
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= TRAFFIC_CONFIG.SPAWN_INTERVAL) {
            this.spawnTimer = 0;
            this._trySpawnCar(playerPosition);
        }
        
        // Update all cars
        for (const car of this.cars) {
            car.update(deltaTime);
        }
        
        // Despawn distant cars
        this._despawnDistantCars(playerPosition);
    }

    /**
     * Get all car meshes for collision detection
     */
    getCarMeshes() {
        return this.cars.map(car => car.mesh);
    }

    /**
     * Get all car collision bounds for physics
     * @param {THREE.Vector3} playerPosition - Player position for proximity filtering
     * @param {number} radius - Only return cars within this radius
     */
    getCarCollisions(playerPosition, radius = 30) {
        const radiusSq = radius * radius;
        const collisions = [];
        
        for (const car of this.cars) {
            const pos = car.getPosition();
            const dx = pos.x - playerPosition.x;
            const dz = pos.z - playerPosition.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < radiusSq) {
                collisions.push(car.getCollisionBounds());
            }
        }
        
        return collisions;
    }

    /**
     * Get car count for debugging
     */
    getCarCount() {
        return this.cars.length;
    }

    dispose() {
        for (const car of this.cars) {
            this.scene.remove(car.mesh);
            car.dispose();
        }
        this.cars = [];
    }
}
