// PedestrianManager - Handles spawning and movement of pedestrians on sidewalks

import * as THREE from 'three';
import { CITY } from '../constants.js';

// Pedestrian appearance variations
const PEDESTRIAN_COLORS = {
    skin: [0xf5d0c5, 0xd4a574, 0x8d5524, 0xc68642, 0xffdbac],
    shirt: [0x3366cc, 0xcc3333, 0x33cc33, 0xffcc00, 0xff6699, 0x9933ff, 0x333333, 0xffffff, 0xff6600, 0x006666],
    pants: [0x222222, 0x333366, 0x444444, 0x1a1a2e, 0x4a3728, 0x2d4a3e],
};

const PEDESTRIAN_CONFIG = {
    MAX_PEDESTRIANS: 10,
    SPAWN_RADIUS: 50,
    DESPAWN_RADIUS: 70,
    MIN_SPAWN_DISTANCE: 15,
    WALK_SPEED_MIN: 1.5,
    WALK_SPEED_MAX: 3.0,
    SPAWN_INTERVAL: 0.15,
    DIRECTION_CHANGE_CHANCE: 0.01,
    STOP_CHANCE: 0.003,
    STOP_DURATION_MIN: 1,
    STOP_DURATION_MAX: 4,
};

class Pedestrian {
    constructor(position, direction, speed) {
        this.speed = speed;
        this.direction = direction; // angle in radians
        this.isStopped = false;
        this.stopTimer = 0;
        this.walkCycle = Math.random() * Math.PI * 2;
        
        this.mesh = this._createMesh();
        this.mesh.position.copy(position);
        this.mesh.rotation.y = direction;
        
        // Store body parts for animation
        this.leftLeg = null;
        this.rightLeg = null;
        this.leftArm = null;
        this.rightArm = null;
        
        // Collision
        this.collisionRadius = 0.5;
    }

    _createMesh() {
        const group = new THREE.Group();
        
        // Random colors
        const skinColor = PEDESTRIAN_COLORS.skin[Math.floor(Math.random() * PEDESTRIAN_COLORS.skin.length)];
        const shirtColor = PEDESTRIAN_COLORS.shirt[Math.floor(Math.random() * PEDESTRIAN_COLORS.shirt.length)];
        const pantsColor = PEDESTRIAN_COLORS.pants[Math.floor(Math.random() * PEDESTRIAN_COLORS.pants.length)];
        
        // Random height variation
        const heightScale = 0.85 + Math.random() * 0.3;
        
        // Materials
        const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
        const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
        const pantsMaterial = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
        const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.position.y = 1.6 * heightScale;
        head.castShadow = true;
        group.add(head);
        
        // Body/torso
        const torsoGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8);
        const torso = new THREE.Mesh(torsoGeometry, shirtMaterial);
        torso.position.y = 1.15 * heightScale;
        torso.castShadow = true;
        group.add(torso);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6);
        
        this.leftLeg = new THREE.Group();
        const leftLegMesh = new THREE.Mesh(legGeometry, pantsMaterial);
        leftLegMesh.position.y = -0.25;
        this.leftLeg.add(leftLegMesh);
        this.leftLeg.position.set(-0.1, 0.6 * heightScale, 0);
        this.leftLeg.castShadow = true;
        group.add(this.leftLeg);
        
        this.rightLeg = new THREE.Group();
        const rightLegMesh = new THREE.Mesh(legGeometry, pantsMaterial);
        rightLegMesh.position.y = -0.25;
        this.rightLeg.add(rightLegMesh);
        this.rightLeg.position.set(0.1, 0.6 * heightScale, 0);
        this.rightLeg.castShadow = true;
        group.add(this.rightLeg);
        
        // Feet/shoes
        const footGeometry = new THREE.BoxGeometry(0.1, 0.08, 0.2);
        
        const leftFoot = new THREE.Mesh(footGeometry, shoeMaterial);
        leftFoot.position.set(0, -0.5, 0.05);
        this.leftLeg.add(leftFoot);
        
        const rightFoot = new THREE.Mesh(footGeometry, shoeMaterial);
        rightFoot.position.set(0, -0.5, 0.05);
        this.rightLeg.add(rightFoot);
        
        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6);
        
        this.leftArm = new THREE.Group();
        const leftArmMesh = new THREE.Mesh(armGeometry, shirtMaterial);
        leftArmMesh.position.y = -0.2;
        this.leftArm.add(leftArmMesh);
        this.leftArm.position.set(-0.28, 1.25 * heightScale, 0);
        group.add(this.leftArm);
        
        this.rightArm = new THREE.Group();
        const rightArmMesh = new THREE.Mesh(armGeometry, shirtMaterial);
        rightArmMesh.position.y = -0.2;
        this.rightArm.add(rightArmMesh);
        this.rightArm.position.set(0.28, 1.25 * heightScale, 0);
        group.add(this.rightArm);
        
        // Hands
        const handGeometry = new THREE.SphereGeometry(0.05, 4, 4);
        
        const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
        leftHand.position.y = -0.4;
        this.leftArm.add(leftHand);
        
        const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
        rightHand.position.y = -0.4;
        this.rightArm.add(rightHand);
        
        return group;
    }

    update(deltaTime) {
        // Handle stopped state
        if (this.isStopped) {
            this.stopTimer -= deltaTime;
            if (this.stopTimer <= 0) {
                this.isStopped = false;
                // Maybe change direction when starting to walk again
                if (Math.random() < 0.3) {
                    this.direction += (Math.random() - 0.5) * Math.PI;
                    this.mesh.rotation.y = this.direction;
                }
            }
            return;
        }
        
        // Random behavior
        if (Math.random() < PEDESTRIAN_CONFIG.DIRECTION_CHANGE_CHANCE) {
            // Slight direction change
            this.direction += (Math.random() - 0.5) * 0.5;
            this.mesh.rotation.y = this.direction;
        }
        
        if (Math.random() < PEDESTRIAN_CONFIG.STOP_CHANCE) {
            // Stop walking briefly
            this.isStopped = true;
            this.stopTimer = PEDESTRIAN_CONFIG.STOP_DURATION_MIN + 
                Math.random() * (PEDESTRIAN_CONFIG.STOP_DURATION_MAX - PEDESTRIAN_CONFIG.STOP_DURATION_MIN);
            return;
        }
        
        // Move forward
        this.mesh.position.x += Math.sin(this.direction) * this.speed * deltaTime;
        this.mesh.position.z += Math.cos(this.direction) * this.speed * deltaTime;
        
        // Walking animation
        this.walkCycle += deltaTime * this.speed * 3;
        const legSwing = Math.sin(this.walkCycle) * 0.4;
        const armSwing = Math.sin(this.walkCycle) * 0.3;
        
        if (this.leftLeg) this.leftLeg.rotation.x = legSwing;
        if (this.rightLeg) this.rightLeg.rotation.x = -legSwing;
        if (this.leftArm) this.leftArm.rotation.x = -armSwing;
        if (this.rightArm) this.rightArm.rotation.x = armSwing;
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
            height: 1.8
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

export class PedestrianManager {
    constructor(scene) {
        this.scene = scene;
        this.pedestrians = [];
        this.spawnTimer = 0;
        this.sidewalkPositions = [];
        
        this._buildSidewalkNetwork();
        console.log('PedestrianManager initialized with', this.sidewalkPositions.length, 'sidewalk segments');
    }

    _buildSidewalkNetwork() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        const sidewalkWidth = 2;
        const halfBlock = CITY.BLOCK_SIZE / 2;
        
        for (let gridX = -CITY.GRID_EXTENT; gridX <= CITY.GRID_EXTENT; gridX++) {
            for (let gridZ = -CITY.GRID_EXTENT; gridZ <= CITY.GRID_EXTENT; gridZ++) {
                const blockCenterX = gridX * cellSize;
                const blockCenterZ = gridZ * cellSize;
                
                // North sidewalk (walks along X)
                this.sidewalkPositions.push({
                    axis: 'x',
                    fixedZ: blockCenterZ - halfBlock - sidewalkWidth / 2,
                    minX: blockCenterX - halfBlock - sidewalkWidth,
                    maxX: blockCenterX + halfBlock + sidewalkWidth
                });
                
                // South sidewalk (walks along X)
                this.sidewalkPositions.push({
                    axis: 'x',
                    fixedZ: blockCenterZ + halfBlock + sidewalkWidth / 2,
                    minX: blockCenterX - halfBlock - sidewalkWidth,
                    maxX: blockCenterX + halfBlock + sidewalkWidth
                });
                
                // East sidewalk (walks along Z)
                this.sidewalkPositions.push({
                    axis: 'z',
                    fixedX: blockCenterX + halfBlock + sidewalkWidth / 2,
                    minZ: blockCenterZ - halfBlock,
                    maxZ: blockCenterZ + halfBlock
                });
                
                // West sidewalk (walks along Z)
                this.sidewalkPositions.push({
                    axis: 'z',
                    fixedX: blockCenterX - halfBlock - sidewalkWidth / 2,
                    minZ: blockCenterZ - halfBlock,
                    maxZ: blockCenterZ + halfBlock
                });
            }
        }
    }

    _trySpawnPedestrian(playerPosition) {
        if (this.pedestrians.length >= PEDESTRIAN_CONFIG.MAX_PEDESTRIANS) return;
        
        // Find nearby sidewalks
        const nearbySidewalks = this.sidewalkPositions.filter(sw => {
            let dist;
            if (sw.axis === 'x') {
                const midX = (sw.minX + sw.maxX) / 2;
                dist = Math.sqrt(
                    Math.pow(midX - playerPosition.x, 2) + 
                    Math.pow(sw.fixedZ - playerPosition.z, 2)
                );
            } else {
                const midZ = (sw.minZ + sw.maxZ) / 2;
                dist = Math.sqrt(
                    Math.pow(sw.fixedX - playerPosition.x, 2) + 
                    Math.pow(midZ - playerPosition.z, 2)
                );
            }
            return dist > PEDESTRIAN_CONFIG.MIN_SPAWN_DISTANCE && 
                   dist < PEDESTRIAN_CONFIG.SPAWN_RADIUS;
        });
        
        if (nearbySidewalks.length === 0) return;
        
        // Pick a random sidewalk
        const sidewalk = nearbySidewalks[Math.floor(Math.random() * nearbySidewalks.length)];
        
        // Calculate spawn position on sidewalk
        let spawnPos = new THREE.Vector3();
        let direction;
        
        if (sidewalk.axis === 'x') {
            const x = sidewalk.minX + Math.random() * (sidewalk.maxX - sidewalk.minX);
            spawnPos.set(x, 0.15, sidewalk.fixedZ);
            // Walk along X axis (east or west)
            direction = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
        } else {
            const z = sidewalk.minZ + Math.random() * (sidewalk.maxZ - sidewalk.minZ);
            spawnPos.set(sidewalk.fixedX, 0.15, z);
            // Walk along Z axis (north or south)
            direction = Math.random() > 0.5 ? 0 : Math.PI;
        }
        
        // Check distance from player (XZ only)
        const distToPlayer = Math.sqrt(
            Math.pow(spawnPos.x - playerPosition.x, 2) + 
            Math.pow(spawnPos.z - playerPosition.z, 2)
        );
        
        if (distToPlayer < PEDESTRIAN_CONFIG.MIN_SPAWN_DISTANCE) return;
        
        // Check not too close to other pedestrians
        for (const ped of this.pedestrians) {
            if (ped.getPosition().distanceTo(spawnPos) < 2) {
                return;
            }
        }
        
        // Create the pedestrian
        const speed = PEDESTRIAN_CONFIG.WALK_SPEED_MIN + 
            Math.random() * (PEDESTRIAN_CONFIG.WALK_SPEED_MAX - PEDESTRIAN_CONFIG.WALK_SPEED_MIN);
        
        const pedestrian = new Pedestrian(spawnPos, direction, speed);
        this.scene.add(pedestrian.mesh);
        this.pedestrians.push(pedestrian);
    }

    _despawnDistantPedestrians(playerPosition) {
        for (let i = this.pedestrians.length - 1; i >= 0; i--) {
            const ped = this.pedestrians[i];
            const pos = ped.getPosition();
            const distance = Math.sqrt(
                Math.pow(pos.x - playerPosition.x, 2) + 
                Math.pow(pos.z - playerPosition.z, 2)
            );
            
            if (distance > PEDESTRIAN_CONFIG.DESPAWN_RADIUS) {
                this.scene.remove(ped.mesh);
                ped.dispose();
                this.pedestrians.splice(i, 1);
            }
        }
    }

    update(deltaTime, playerPosition) {
        // Spawn timer
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= PEDESTRIAN_CONFIG.SPAWN_INTERVAL) {
            this.spawnTimer = 0;
            this._trySpawnPedestrian(playerPosition);
        }
        
        // Update all pedestrians
        for (const ped of this.pedestrians) {
            ped.update(deltaTime);
        }
        
        // Despawn distant pedestrians
        this._despawnDistantPedestrians(playerPosition);
    }

    /**
     * Get pedestrian collisions for physics
     */
    getPedestrianCollisions(playerPosition, radius = 20) {
        const radiusSq = radius * radius;
        const collisions = [];
        
        for (const ped of this.pedestrians) {
            const pos = ped.getPosition();
            const dx = pos.x - playerPosition.x;
            const dz = pos.z - playerPosition.z;
            const distSq = dx * dx + dz * dz;
            
            if (distSq < radiusSq) {
                collisions.push(ped.getCollisionBounds());
            }
        }
        
        return collisions;
    }

    getPedestrianCount() {
        return this.pedestrians.length;
    }

    dispose() {
        for (const ped of this.pedestrians) {
            this.scene.remove(ped.mesh);
            ped.dispose();
        }
        this.pedestrians = [];
    }
}
