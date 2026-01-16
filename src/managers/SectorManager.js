// SectorManager - Defines distinct city sectors and landmark buildings

import * as THREE from 'three';
import { Building } from '../editor/objects/Building.js';

// Landmark definitions
const LANDMARKS = {
    NEON_FISH: {
        name: 'The Neon Fish',
        description: 'A giant neon fish sign - everyone knows it',
        position: { x: 80, z: -60 },
        type: 'sign',
        color: '#00ffff',
        scale: { x: 8, y: 12, z: 2 }
    },
    CLOCK_TOWER: {
        name: 'Broken Clock Tower',
        description: 'The old clock tower - stuck at 3:47 since the blackout',
        position: { x: -70, z: 80 },
        type: 'tower',
        color: '#8b4513',
        scale: { x: 6, y: 40, z: 6 }
    },
    TRANSIT_HUB: {
        name: 'Central Transit Hub',
        description: 'Busy transit station - watch for pedestrians',
        position: { x: 0, z: -80 },
        type: 'building',
        color: '#4a4a4a',
        scale: { x: 25, y: 15, z: 35 }
    },
    CORP_PLAZA: {
        name: 'Corp Plaza',
        description: 'Sleek corporate district - drones patrol here',
        position: { x: 100, z: 40 },
        type: 'building',
        color: '#1a1a2e',
        scale: { x: 20, y: 60, z: 20 }
    },
    MARKET_ARCH: {
        name: 'Market Arch',
        description: 'Gateway to the food market',
        position: { x: -50, z: -40 },
        type: 'arch',
        color: '#ff6b35',
        scale: { x: 15, y: 20, z: 3 }
    },
    WATER_TOWER: {
        name: 'Old Water Tower',
        description: 'Rusty water tower - good flight landmark',
        position: { x: -90, z: -90 },
        type: 'tower',
        color: '#8b0000',
        scale: { x: 8, y: 25, z: 8 }
    }
};

// Sector definitions
const SECTORS = {
    CENTRAL: {
        name: 'Central District',
        description: "Rico's neighborhood - home base",
        bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
        color: '#ff6b35',
        trafficDensity: 1.0,
        pedestrianDensity: 1.2
    },
    CORPORATE: {
        name: 'Corporate Plaza',
        description: 'Clean streets, heavy drone surveillance',
        bounds: { minX: 50, maxX: 150, minZ: -50, maxZ: 100 },
        color: '#00aaff',
        trafficDensity: 0.8,
        pedestrianDensity: 0.6,
        droneDensity: 2.0
    },
    MARKET: {
        name: 'Market District',
        description: 'Crowded streets, tight alleys',
        bounds: { minX: -150, maxX: -50, minZ: -100, maxZ: 50 },
        color: '#ffaa00',
        trafficDensity: 0.5,
        pedestrianDensity: 2.0
    },
    RESIDENTIAL: {
        name: 'Residential Towers',
        description: 'Tall apartment blocks',
        bounds: { minX: -100, maxX: 50, minZ: 50, maxZ: 150 },
        color: '#aa88ff',
        trafficDensity: 0.7,
        pedestrianDensity: 1.0
    }
};

export class SectorManager {
    constructor(scene) {
        this.scene = scene;
        this.landmarks = new Map();
        this.sectors = SECTORS;
        this.landmarkDefinitions = LANDMARKS;
        
        // Atmosphere manager reference (set by GameManager)
        this.atmosphereManager = null;
    }

    /**
     * Set atmosphere manager for neon effects
     */
    setAtmosphereManager(atmosphereManager) {
        this.atmosphereManager = atmosphereManager;
    }

    /**
     * Initialize sectors and landmarks
     */
    init() {
        this._createLandmarks();
        // Disable sector markers by default for performance
        // this._createSectorMarkers();
    }

    /**
     * Create landmark buildings
     */
    _createLandmarks() {
        for (const [key, landmark] of Object.entries(LANDMARKS)) {
            const mesh = this._createLandmarkMesh(key, landmark);
            if (mesh) {
                this.scene.add(mesh);
                this.landmarks.set(key, {
                    ...landmark,
                    mesh: mesh
                });
                
                // Add neon effects to landmarks
                if (this.atmosphereManager) {
                    this._addLandmarkEffects(key, landmark, mesh);
                }
            }
        }
    }

    /**
     * Create mesh for a landmark
     */
    _createLandmarkMesh(key, landmark) {
        const { position, scale, color, type } = landmark;
        let geometry, mesh;
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.3
        });
        
        switch (type) {
            case 'tower':
                // Cylinder for towers
                geometry = new THREE.CylinderGeometry(
                    scale.x / 2, 
                    scale.x / 2 * 1.1, // Slightly wider base
                    scale.y, 
                    8
                );
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(position.x, scale.y / 2, position.z);
                
                // Add top detail for clock tower
                if (key === 'CLOCK_TOWER') {
                    const topGeo = new THREE.BoxGeometry(scale.x * 1.5, 4, scale.z * 1.5);
                    const topMesh = new THREE.Mesh(topGeo, material);
                    topMesh.position.y = scale.y / 2 + 2;
                    mesh.add(topMesh);
                    
                    // Clock face
                    const clockGeo = new THREE.CircleGeometry(2, 16);
                    const clockMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
                    const clockFace = new THREE.Mesh(clockGeo, clockMat);
                    clockFace.position.set(0, scale.y / 2 + 2, scale.z / 2 + 0.1);
                    mesh.add(clockFace);
                }
                break;
                
            case 'sign':
                // Flat sign mesh
                geometry = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(position.x, scale.y / 2 + 10, position.z);
                
                // Support pole
                const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, 15, 8);
                const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.y = -scale.y / 2 - 5;
                mesh.add(pole);
                break;
                
            case 'arch':
                // Create arch shape
                const archGroup = new THREE.Group();
                
                // Left pillar
                const pillarGeo = new THREE.BoxGeometry(3, scale.y, scale.z);
                const leftPillar = new THREE.Mesh(pillarGeo, material);
                leftPillar.position.set(-scale.x / 2 + 1.5, scale.y / 2, 0);
                archGroup.add(leftPillar);
                
                // Right pillar
                const rightPillar = new THREE.Mesh(pillarGeo, material);
                rightPillar.position.set(scale.x / 2 - 1.5, scale.y / 2, 0);
                archGroup.add(rightPillar);
                
                // Top arch
                const topGeo2 = new THREE.BoxGeometry(scale.x, 4, scale.z);
                const top = new THREE.Mesh(topGeo2, material);
                top.position.y = scale.y - 2;
                archGroup.add(top);
                
                archGroup.position.set(position.x, 0, position.z);
                mesh = archGroup;
                break;
                
            case 'building':
            default:
                // Standard building
                geometry = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(position.x, scale.y / 2, position.z);
                break;
        }
        
        // Enable shadows
        if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        } else {
            mesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
        
        // Store landmark data
        mesh.userData = {
            isLandmark: true,
            landmarkKey: key,
            landmarkName: landmark.name
        };
        
        return mesh;
    }

    /**
     * Add neon effects to landmarks
     */
    _addLandmarkEffects(key, landmark, mesh) {
        if (!this.atmosphereManager) return;
        
        const pos = new THREE.Vector3(
            landmark.position.x,
            landmark.scale.y + 5,
            landmark.position.z
        );
        
        switch (key) {
            case 'NEON_FISH':
                // Big neon sign
                this.atmosphereManager.createNeonSign(
                    new THREE.Vector3(landmark.position.x, 25, landmark.position.z),
                    'FISH',
                    0x00ffff,
                    2
                );
                break;
                
            case 'CORP_PLAZA':
                // Blue corporate glow strips on edges
                for (let i = 0; i < 4; i++) {
                    this.atmosphereManager.createNeonStrip(
                        new THREE.Vector3(
                            landmark.position.x + (i % 2 === 0 ? 10 : -10),
                            landmark.scale.y / 2,
                            landmark.position.z + (i < 2 ? 10 : -10)
                        ),
                        landmark.scale.y,
                        0x0088ff
                    );
                }
                break;
                
            case 'MARKET_ARCH':
                // Colorful market entrance
                this.atmosphereManager.createNeonSign(
                    new THREE.Vector3(landmark.position.x, 18, landmark.position.z),
                    'MARKET',
                    0xff6b35,
                    1.5
                );
                break;
                
            case 'CLOCK_TOWER':
                // Subtle glow around clock face
                const light = new THREE.PointLight(0xffffaa, 2, 20);
                light.position.set(0, landmark.scale.y / 2 + 2, landmark.scale.z / 2 + 2);
                mesh.add(light);
                break;
        }
    }

    /**
     * Create subtle sector boundary markers
     */
    _createSectorMarkers() {
        // Add subtle ground markings or lights at sector boundaries
        for (const [key, sector] of Object.entries(SECTORS)) {
            // Corner lights
            const corners = [
                { x: sector.bounds.minX, z: sector.bounds.minZ },
                { x: sector.bounds.maxX, z: sector.bounds.minZ },
                { x: sector.bounds.minX, z: sector.bounds.maxZ },
                { x: sector.bounds.maxX, z: sector.bounds.maxZ }
            ];
            
            for (const corner of corners) {
                const light = new THREE.PointLight(sector.color, 0.5, 15);
                light.position.set(corner.x, 2, corner.z);
                this.scene.add(light);
            }
        }
    }

    /**
     * Get the sector at a given position
     */
    getSectorAt(position) {
        for (const [key, sector] of Object.entries(SECTORS)) {
            const b = sector.bounds;
            if (position.x >= b.minX && position.x <= b.maxX &&
                position.z >= b.minZ && position.z <= b.maxZ) {
                return { key, ...sector };
            }
        }
        return null;
    }

    /**
     * Get nearby landmarks
     */
    getNearbyLandmarks(position, radius = 100) {
        const nearby = [];
        
        for (const [key, landmark] of this.landmarks) {
            const dist = Math.sqrt(
                Math.pow(position.x - landmark.position.x, 2) +
                Math.pow(position.z - landmark.position.z, 2)
            );
            
            if (dist < radius) {
                nearby.push({
                    key,
                    name: landmark.name,
                    description: landmark.description,
                    distance: dist
                });
            }
        }
        
        return nearby.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Get all landmark positions for minimap
     */
    getLandmarkPositions() {
        const positions = [];
        for (const [key, landmark] of this.landmarks) {
            positions.push({
                key,
                name: landmark.name,
                x: landmark.position.x,
                z: landmark.position.z
            });
        }
        return positions;
    }

    /**
     * Get traffic/pedestrian density multiplier for position
     */
    getDensityMultiplier(position, type = 'traffic') {
        const sector = this.getSectorAt(position);
        if (!sector) return 1.0;
        
        switch (type) {
            case 'traffic':
                return sector.trafficDensity || 1.0;
            case 'pedestrian':
                return sector.pedestrianDensity || 1.0;
            case 'drone':
                return sector.droneDensity || 1.0;
            default:
                return 1.0;
        }
    }

    /**
     * Dispose of sector resources
     */
    dispose() {
        for (const [key, landmark] of this.landmarks) {
            if (landmark.mesh) {
                this.scene.remove(landmark.mesh);
                landmark.mesh.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        }
        this.landmarks.clear();
    }
}
