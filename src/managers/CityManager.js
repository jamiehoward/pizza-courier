// CityManager - Handles city generation with editable building objects

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CITY, BUILDING_COLORS, ASSETS } from '../constants.js';
import { Building } from '../editor/objects/Building.js';

export class CityManager {
    constructor(scene) {
        this.scene = scene;
        this.buildings = [];
        this.roads = [];
        this.sidewalks = [];
        this.bushes = [];
        this.gltfLoader = new GLTFLoader();
        this.editorManager = null; // Set by GameManager
        this.pizzaShopPosition = new THREE.Vector3(0, 0, 0);
        
        // Materials (reused for performance)
        this.roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.1
        });
        this.sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.8,
            metalness: 0.0
        });
        this.bushMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d5a27,
            roughness: 0.9,
            metalness: 0.0
        });
        this.bushDarkMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e3d1a,
            roughness: 0.9,
            metalness: 0.0
        });
    }

    /**
     * Set the editor manager reference
     */
    setEditorManager(editorManager) {
        this.editorManager = editorManager;
    }

    /**
     * Set the atmosphere manager reference for neon/window effects
     */
    setAtmosphereManager(atmosphereManager) {
        this.atmosphereManager = atmosphereManager;
    }

    /**
     * Initialize the city
     */
    init() {
        this.createRoads();
        this.createSidewalks();
        this.createCity();
        this.createBushes();
        this.loadPizzaShop();
    }

    /**
     * Create the city grid with editable building objects
     */
    createCity() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        const shapes = ['box', 'box', 'box', 'cylinder']; // Mostly boxes, some cylinders

        for (let gridX = -CITY.GRID_EXTENT; gridX <= CITY.GRID_EXTENT; gridX++) {
            for (let gridZ = -CITY.GRID_EXTENT; gridZ <= CITY.GRID_EXTENT; gridZ++) {
                // Skip center block (spawn area)
                if (gridX === 0 && gridZ === 0) continue;

                const blockCenterX = gridX * cellSize;
                const blockCenterZ = gridZ * cellSize;

                // Random buildings per block
                const buildingCount = CITY.BUILDINGS_PER_BLOCK_MIN + 
                    Math.floor(Math.random() * (CITY.BUILDINGS_PER_BLOCK_MAX - CITY.BUILDINGS_PER_BLOCK_MIN + 1));
                
                for (let b = 0; b < buildingCount; b++) {
                    const offsetX = (Math.random() - 0.5) * (CITY.BLOCK_SIZE * 0.6);
                    const offsetZ = (Math.random() - 0.5) * (CITY.BLOCK_SIZE * 0.6);
                    const x = blockCenterX + offsetX;
                    const z = blockCenterZ + offsetZ;

                    const scale = CITY.BUILDING_SCALE_MIN + 
                        Math.random() * (CITY.BUILDING_SCALE_MAX - CITY.BUILDING_SCALE_MIN);
                    const width = (3 + Math.random() * 4) * scale * 0.1;
                    const height = (8 + Math.random() * 12) * scale * 0.1;
                    const depth = (3 + Math.random() * 4) * scale * 0.1;
                    const rotation = Math.floor(Math.random() * 4) * (Math.PI / 2);
                    
                    // Random shape
                    const shape = shapes[Math.floor(Math.random() * shapes.length)];
                    
                    // Random color from palette
                    const colorIndex = Math.floor(Math.random() * BUILDING_COLORS.length);
                    const color = '#' + BUILDING_COLORS[colorIndex].toString(16).padStart(6, '0');

                    // Create Building editor object
                    const building = new Building(shape, {
                        position: { x, y: 0, z },
                        scale: { x: width, y: height, z: depth },
                        rotation: rotation,
                        color: color,
                        collision: true
                    });

                    // Add to scene
                    building.addToScene(this.scene);

                    // Store locally
                    this.buildings.push(building);

                    // Add to editor if available
                    if (this.editorManager) {
                        this.editorManager.objects.push(building);
                    }
                    
                    // Add atmosphere effects (windows and neon)
                    if (this.atmosphereManager && building.mesh) {
                        // Add emissive windows to tall buildings
                        if (height > 10) {
                            this.atmosphereManager.addBuildingWindows(building.mesh, height);
                        }
                        // Add neon signs/strips
                        if (height > 15) {
                            this.atmosphereManager.addBuildingNeon(building.mesh, height);
                        }
                    }
                }
            }
        }

        console.log(`City created with ${this.buildings.length} buildings`);
    }

    /**
     * Create the road network
     */
    createRoads() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        const roadWidth = CITY.STREET_WIDTH;
        const extent = CITY.GRID_EXTENT + 1;
        const totalLength = cellSize * (extent * 2);
        
        // Create road geometry (reused)
        const horizontalRoadGeo = new THREE.PlaneGeometry(totalLength, roadWidth);
        const verticalRoadGeo = new THREE.PlaneGeometry(roadWidth, totalLength);
        
        // Horizontal roads
        for (let z = -extent; z <= extent; z++) {
            const roadZ = z * cellSize - CITY.BLOCK_SIZE / 2 - roadWidth / 2;
            const road = new THREE.Mesh(horizontalRoadGeo, this.roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.02, roadZ);
            road.receiveShadow = true;
            this.scene.add(road);
            this.roads.push(road);
        }
        
        // Vertical roads
        for (let x = -extent; x <= extent; x++) {
            const roadX = x * cellSize - CITY.BLOCK_SIZE / 2 - roadWidth / 2;
            const road = new THREE.Mesh(verticalRoadGeo, this.roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(roadX, 0.02, 0);
            road.receiveShadow = true;
            this.scene.add(road);
            this.roads.push(road);
        }
        
        // Add road markings (center lines)
        this._createRoadMarkings(cellSize, extent);
        
        console.log(`Created ${this.roads.length} road segments`);
    }

    /**
     * Create road center line markings
     */
    _createRoadMarkings(cellSize, extent) {
        const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const dashLength = 3;
        const dashGap = 4;
        const dashWidth = 0.3;
        const dashGeo = new THREE.PlaneGeometry(dashLength, dashWidth);
        
        const totalLength = cellSize * (extent * 2);
        
        // Horizontal road markings
        for (let z = -extent; z <= extent; z++) {
            const roadZ = z * cellSize - CITY.BLOCK_SIZE / 2 - CITY.STREET_WIDTH / 2;
            
            for (let x = -totalLength / 2; x < totalLength / 2; x += dashLength + dashGap) {
                const dash = new THREE.Mesh(dashGeo, markingMaterial);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(x + dashLength / 2, 0.03, roadZ);
                this.scene.add(dash);
            }
        }
        
        // Vertical road markings
        const vertDashGeo = new THREE.PlaneGeometry(dashWidth, dashLength);
        for (let x = -extent; x <= extent; x++) {
            const roadX = x * cellSize - CITY.BLOCK_SIZE / 2 - CITY.STREET_WIDTH / 2;
            
            for (let z = -totalLength / 2; z < totalLength / 2; z += dashLength + dashGap) {
                const dash = new THREE.Mesh(vertDashGeo, markingMaterial);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(roadX, 0.03, z + dashLength / 2);
                this.scene.add(dash);
            }
        }
    }

    /**
     * Create sidewalks around blocks
     */
    createSidewalks() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        const sidewalkWidth = 2;
        const sidewalkHeight = 0.15;
        
        for (let gridX = -CITY.GRID_EXTENT; gridX <= CITY.GRID_EXTENT; gridX++) {
            for (let gridZ = -CITY.GRID_EXTENT; gridZ <= CITY.GRID_EXTENT; gridZ++) {
                const blockCenterX = gridX * cellSize;
                const blockCenterZ = gridZ * cellSize;
                const halfBlock = CITY.BLOCK_SIZE / 2;
                
                // Create sidewalks on all four sides of the block
                // North sidewalk
                this._createSidewalkSegment(
                    blockCenterX, blockCenterZ - halfBlock - sidewalkWidth / 2,
                    CITY.BLOCK_SIZE + sidewalkWidth * 2, sidewalkWidth, sidewalkHeight
                );
                // South sidewalk
                this._createSidewalkSegment(
                    blockCenterX, blockCenterZ + halfBlock + sidewalkWidth / 2,
                    CITY.BLOCK_SIZE + sidewalkWidth * 2, sidewalkWidth, sidewalkHeight
                );
                // East sidewalk
                this._createSidewalkSegment(
                    blockCenterX + halfBlock + sidewalkWidth / 2, blockCenterZ,
                    sidewalkWidth, CITY.BLOCK_SIZE, sidewalkHeight
                );
                // West sidewalk
                this._createSidewalkSegment(
                    blockCenterX - halfBlock - sidewalkWidth / 2, blockCenterZ,
                    sidewalkWidth, CITY.BLOCK_SIZE, sidewalkHeight
                );
            }
        }
        
        console.log(`Created ${this.sidewalks.length} sidewalk segments`);
    }

    /**
     * Create a single sidewalk segment
     */
    _createSidewalkSegment(x, z, width, depth, height) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const sidewalk = new THREE.Mesh(geometry, this.sidewalkMaterial);
        sidewalk.position.set(x, height / 2, z);
        sidewalk.receiveShadow = true;
        sidewalk.castShadow = true;
        this.scene.add(sidewalk);
        this.sidewalks.push(sidewalk);
    }

    /**
     * Create bushes and vegetation around buildings
     */
    createBushes() {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        
        for (let gridX = -CITY.GRID_EXTENT; gridX <= CITY.GRID_EXTENT; gridX++) {
            for (let gridZ = -CITY.GRID_EXTENT; gridZ <= CITY.GRID_EXTENT; gridZ++) {
                // Skip center block
                if (gridX === 0 && gridZ === 0) continue;
                
                const blockCenterX = gridX * cellSize;
                const blockCenterZ = gridZ * cellSize;
                
                // Random number of bushes per block
                const bushCount = 3 + Math.floor(Math.random() * 5);
                
                for (let i = 0; i < bushCount; i++) {
                    // Position bushes near edges of blocks (near sidewalks)
                    const edge = Math.floor(Math.random() * 4);
                    let x, z;
                    const offset = CITY.BLOCK_SIZE / 2 - 3 - Math.random() * 5;
                    const along = (Math.random() - 0.5) * (CITY.BLOCK_SIZE - 6);
                    
                    switch (edge) {
                        case 0: x = blockCenterX + along; z = blockCenterZ - offset; break;
                        case 1: x = blockCenterX + along; z = blockCenterZ + offset; break;
                        case 2: x = blockCenterX - offset; z = blockCenterZ + along; break;
                        case 3: x = blockCenterX + offset; z = blockCenterZ + along; break;
                    }
                    
                    this._createBush(x, z);
                }
            }
        }
        
        console.log(`Created ${this.bushes.length} bushes`);
    }

    /**
     * Create a single bush (cluster of spheres)
     */
    _createBush(x, z) {
        const bushGroup = new THREE.Group();
        
        // Random bush size
        const baseSize = 0.4 + Math.random() * 0.4;
        
        // Create 2-4 overlapping spheres for organic look
        const sphereCount = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < sphereCount; i++) {
            const size = baseSize * (0.7 + Math.random() * 0.6);
            const geometry = new THREE.SphereGeometry(size, 8, 6);
            const material = Math.random() > 0.5 ? this.bushMaterial : this.bushDarkMaterial;
            const sphere = new THREE.Mesh(geometry, material);
            
            // Offset each sphere slightly
            sphere.position.set(
                (Math.random() - 0.5) * baseSize,
                size * 0.7 + Math.random() * 0.2,
                (Math.random() - 0.5) * baseSize
            );
            
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            bushGroup.add(sphere);
        }
        
        bushGroup.position.set(x, 0, z);
        this.scene.add(bushGroup);
        this.bushes.push(bushGroup);
    }

    /**
     * Load the pizza shop at spawn point
     */
    loadPizzaShop() {
        this.gltfLoader.load(
            ASSETS.PIZZA_SHOP,
            (gltf) => {
                const pizzaShop = gltf.scene;
                const scale = 25;
                pizzaShop.scale.set(scale, scale, scale);
                
                const box = new THREE.Box3().setFromObject(pizzaShop);
                const yOffset = -box.min.y;
                pizzaShop.position.set(0, yOffset, 0);

                pizzaShop.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.scene.add(pizzaShop);
                console.log('Pizza shop loaded!');
            },
            undefined,
            (error) => console.error('Error loading pizza shop:', error)
        );
    }

    /**
     * Update LOD - no longer needed since we use simple geometry
     */
    updateLOD(playerPosition) {
        // No-op - all buildings are simple geometry now
    }

    /**
     * Get all buildings
     */
    getBuildings() {
        return this.buildings;
    }

    /**
     * Clear all buildings
     */
    clearBuildings() {
        for (const building of this.buildings) {
            building.removeFromScene(this.scene);
            if (building.dispose) building.dispose();
        }
        this.buildings = [];
    }

    /**
     * Clear all environmental elements (roads, sidewalks, bushes)
     */
    clearEnvironment() {
        // Clear roads
        for (const road of this.roads) {
            this.scene.remove(road);
            road.geometry.dispose();
        }
        this.roads = [];
        
        // Clear sidewalks
        for (const sidewalk of this.sidewalks) {
            this.scene.remove(sidewalk);
            sidewalk.geometry.dispose();
        }
        this.sidewalks = [];
        
        // Clear bushes
        for (const bush of this.bushes) {
            bush.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                }
            });
            this.scene.remove(bush);
        }
        this.bushes = [];
    }

    /**
     * Get pizza shop position
     */
    getPizzaShopPosition() {
        return this.pizzaShopPosition.clone();
    }
}
