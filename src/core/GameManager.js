// GameManager - Main orchestrator for the game

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { EventBus, Events } from './EventBus.js';
import { InputManager } from '../managers/InputManager.js';
import { PhysicsManager } from '../managers/PhysicsManager.js';
import { CameraController } from '../managers/CameraController.js';
import { CityManager } from '../managers/CityManager.js';
import { UIManager } from '../managers/UIManager.js';
import { EffectsManager } from '../managers/EffectsManager.js';
import { DeliveryManager } from '../managers/DeliveryManager.js';
import { MinimapManager } from '../managers/MinimapManager.js';
import { TrafficManager } from '../managers/TrafficManager.js';
import { DroneManager } from '../managers/DroneManager.js';
import { PedestrianManager } from '../managers/PedestrianManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { AtmosphereManager } from '../managers/AtmosphereManager.js';
import { DialogueManager } from '../managers/DialogueManager.js';
import { EconomyManager } from '../managers/EconomyManager.js';
import { SectorManager } from '../managers/SectorManager.js';
import { UpgradeManager } from '../managers/UpgradeManager.js';
import { TrickManager } from '../managers/TrickManager.js';
import { Player } from '../entities/Player.js';
import { WORLD, LIGHTING, PLAYER, SKY } from '../constants.js';

// Editor imports
import { EditorManager, EditorMode, EditorTool } from '../editor/EditorManager.js';
import { EditorCamera } from '../editor/EditorCamera.js';
import { EditorUI } from '../editor/EditorUI.js';
import { SelectionManager } from '../editor/SelectionManager.js';
import { HistoryManager } from '../editor/HistoryManager.js';
import { GizmoManager } from '../editor/GizmoManager.js';
import { LevelSerializer } from '../editor/LevelSerializer.js';
import { GridHelper } from '../editor/GridHelper.js';
import { SelectTool } from '../editor/tools/SelectTool.js';
import { BuildingTool } from '../editor/tools/BuildingTool.js';
import { RoadTool } from '../editor/tools/RoadTool.js';

export class GameManager {
    constructor() {
        // Core Three.js objects
        this.scene = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Post-processing
        this.composer = null;
        this.afterimagePass = null;
        this.targetDamping = 0; // 0 = no blur, higher = more trail
        
        // Event system
        this.eventBus = new EventBus();
        
        // Managers
        this.inputManager = null;
        this.physicsManager = null;
        this.cameraController = null;
        this.cityManager = null;
        this.uiManager = null;
        this.effectsManager = null;
        this.deliveryManager = null;
        this.minimapManager = null;
        this.trafficManager = null;
        this.droneManager = null;
        this.pedestrianManager = null;
        this.audioManager = null;
        this.atmosphereManager = null;
        this.dialogueManager = null;
        this.economyManager = null;
        this.sectorManager = null;
        this.upgradeManager = null;
        this.trickManager = null;
        
        // Editor
        this.editorManager = null;
        this.editorGrid = null;
        
        // Entities
        this.player = null;
        
        // Momentum tracking
        this.momentumTimer = 0;
        
        // Game state
        this.isPaused = false;
        
        // Update throttling (frame counters)
        this.updateFrameCount = 0;
    }

    /**
     * Initialize the game
     * @param {HTMLElement} container - Optional container element for the renderer
     */
    async init(container = null) {
        // Store container reference
        this.container = container;
        
        // Create scene
        this._setupScene();
        
        // Create renderer
        this._setupRenderer();
        
        // Setup post-processing (disabled by default for performance)
        // this._setupPostProcessing();
        
        // Setup lighting
        this._setupLighting();
        
        // Create ground
        this._setupGround();
        
        // Initialize managers
        await this._initManagers();
        
        // Initialize editor (async since it initializes delivery system)
        await this._initEditor();
        
        // Create player
        await this._createPlayer();
        
        // Setup event listeners
        this._setupEventListeners();
        
        // Try to load saved level
        if (this.editorManager.levelSerializer.hasSavedData()) {
            console.log('Found saved level data, will load on next edit mode entry');
        }
        
        // Emit ready event
        this.eventBus.emit(Events.GAME_READY);
        
        console.log('Game initialized! Press F1 to enter level editor.');
    }

    _setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(SKY.HORIZON_COLOR, WORLD.FOG_DENSITY);
        
        // Create gradient sky
        this._createSky();
    }

    _createSky() {
        // Procedural gradient sky using a large sphere with custom shader
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(SKY.TOP_COLOR) },
                horizonColor: { value: new THREE.Color(SKY.HORIZON_COLOR) },
                bottomColor: { value: new THREE.Color(SKY.GROUND_COLOR) },
                offset: { value: 20 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 horizonColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    
                    // Above horizon: blend from horizon to top
                    if (h > 0.0) {
                        float t = pow(h, exponent);
                        gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
                    } 
                    // Below horizon: blend from horizon to bottom (ground reflection)
                    else {
                        float t = pow(-h, 0.5);
                        gl_FragColor = vec4(mix(horizonColor, bottomColor, t), 1.0);
                    }
                }
            `,
            side: THREE.BackSide,
            depthWrite: false
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        this.sky = sky;
    }

    _setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Shadow settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Tone mapping for more realistic lighting
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // Output encoding for correct colors
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Add to container
        const targetContainer = this.container || document.getElementById('game-container');
        if (targetContainer) {
            targetContainer.appendChild(this.renderer.domElement);
        }
    }

    _setupPostProcessing() {
        // Create effect composer
        this.composer = new EffectComposer(this.renderer);
        
        // Add render pass (renders the scene normally first)
        const renderPass = new RenderPass(this.scene, this.cameraController?.camera);
        this.composer.addPass(renderPass);
        
        // Create afterimage pass for motion blur effect
        // Uses frame accumulation technique - damp value controls trail length
        // 0 = no trail, 0.96 = long trail
        this.afterimagePass = new AfterimagePass(0);
        this.composer.addPass(this.afterimagePass);
    }

    /**
     * Update motion blur intensity based on speed and events
     * @param {number} speedRatio - Current speed ratio (0-1)
     * @param {number} shakeIntensity - Camera shake intensity
     */
    _updateMotionBlur(speedRatio, shakeIntensity) {
        // Calculate target damping based on speed and shake
        // Higher damping = more motion trail/blur
        // Keep values subtle: 0.15-0.3 range for a hint of motion blur
        const speedDamping = speedRatio * speedRatio * 0.2; // Max 0.2 at full speed
        const shakeDamping = shakeIntensity * 0.15; // Subtle additional blur from shake
        
        this.targetDamping = Math.min(0.35, speedDamping + shakeDamping);
        
        // Smooth interpolation (faster decay when slowing down)
        const currentDamp = this.afterimagePass?.uniforms['damp']?.value || 0;
        const lerpSpeed = this.targetDamping > currentDamp ? 0.1 : 0.2;
        const newDamp = currentDamp + (this.targetDamping - currentDamp) * lerpSpeed;
        
        if (this.afterimagePass) {
            this.afterimagePass.uniforms['damp'].value = newDamp;
        }
    }

    _setupLighting() {
        // Ambient light - provides base illumination for all objects
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main sun light with shadows
        this.sunLight = new THREE.DirectionalLight(SKY.SUN_COLOR, SKY.SUN_INTENSITY);
        this.sunLight.position.set(
            SKY.SUN_POSITION.x,
            SKY.SUN_POSITION.y,
            SKY.SUN_POSITION.z
        );
        
        // Shadow configuration for large city
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        
        // Large shadow camera to cover nearby buildings
        const shadowSize = 150;
        this.sunLight.shadow.camera.left = -shadowSize;
        this.sunLight.shadow.camera.right = shadowSize;
        this.sunLight.shadow.camera.top = shadowSize;
        this.sunLight.shadow.camera.bottom = -shadowSize;
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 400;
        
        // Softer shadows
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.normalBias = 0.02;
        
        this.scene.add(this.sunLight);
        
        // Sun target (follows player)
        this.sunTarget = new THREE.Object3D();
        this.scene.add(this.sunTarget);
        this.sunLight.target = this.sunTarget;

        // Character fill light - follows camera to illuminate player from front
        this.characterLight = new THREE.DirectionalLight(0xaabbff, 0.8);
        this.characterLight.position.set(0, 10, -20);
        this.scene.add(this.characterLight);
        
        // Target for character light
        this.characterLightTarget = new THREE.Object3D();
        this.scene.add(this.characterLightTarget);
        this.characterLight.target = this.characterLightTarget;
        
        // Hemisphere light for sky/ground ambient bounce
        const hemiLight = new THREE.HemisphereLight(
            SKY.HORIZON_COLOR,  // Sky color (from above)
            0x666666,           // Ground color (bounce from below)
            0.7
        );
        this.scene.add(hemiLight);
    }

    /**
     * Update sun position to follow player for consistent shadows
     */
    _updateSunPosition(playerPosition) {
        if (!this.sunLight || !this.sunTarget) return;
        
        // Move sun target to player position
        this.sunTarget.position.copy(playerPosition);
        
        // Move sun light relative to player
        this.sunLight.position.set(
            playerPosition.x + SKY.SUN_POSITION.x,
            SKY.SUN_POSITION.y,
            playerPosition.z + SKY.SUN_POSITION.z
        );
        
        // Update character fill light to follow camera (light player from front)
        if (this.characterLight && this.characterLightTarget && this.cameraController) {
            const camera = this.cameraController.getCamera();
            if (camera) {
                // Position light behind camera, pointing at player
                this.characterLight.position.copy(camera.position);
                this.characterLight.position.y += 5;
                this.characterLightTarget.position.copy(playerPosition);
            }
        }
    }

    _setupGround() {
        // Ground plane with road-like texture
        const groundGeometry = new THREE.PlaneGeometry(WORLD.GROUND_SIZE, WORLD.GROUND_SIZE);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.95,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.name = 'ground'; // For editor exclusion
        this.scene.add(ground);
        this.ground = ground;
    }

    async _initManagers() {
        // Input
        this.inputManager = new InputManager(this.eventBus);
        this.inputManager.init();
        
        // Physics
        this.physicsManager = new PhysicsManager(this.eventBus);
        
        // Camera
        this.cameraController = new CameraController();
        this.cameraController.create(window.innerWidth / window.innerHeight);
        
        // City (init called after editor is set up)
        this.cityManager = new CityManager(this.scene);
        
        // UI
        this.uiManager = new UIManager();
        this.uiManager.init();
        
        // Effects (created after player so we can attach glow)
        this.effectsManager = new EffectsManager(this.scene, this.eventBus);
        
        // Traffic system
        this.trafficManager = new TrafficManager(this.scene);
        
        // Drone system
        this.droneManager = new DroneManager(this.scene);
        
        // Pedestrian system
        this.pedestrianManager = new PedestrianManager(this.scene);
        
        // Audio system
        this.audioManager = new AudioManager(this.eventBus);
        await this.audioManager.init();
        
        // Atmosphere system (neon, fog, windows)
        this.atmosphereManager = new AtmosphereManager(this.scene);
        this.atmosphereManager.init();
        
        // Sector system (landmarks, districts)
        this.sectorManager = new SectorManager(this.scene);
        this.sectorManager.setAtmosphereManager(this.atmosphereManager);
        this.sectorManager.init();
        
        // Dialogue system
        this.dialogueManager = new DialogueManager(this.eventBus);
        this.dialogueManager.init();
        
        // Economy system
        this.economyManager = new EconomyManager(this.eventBus);
        this.economyManager.init();
        
        // Upgrade system
        this.upgradeManager = new UpgradeManager(this.eventBus, this.economyManager);
        this.upgradeManager.setGameManager(this);
        this.upgradeManager.init();
        
        // Trick system
        this.trickManager = new TrickManager(this.eventBus);
        this.trickManager.init();
        
        // Listen for dialogue events
        this.eventBus.on('dialogue:start', () => this.pause());
        this.eventBus.on('dialogue:end', () => this.resume());
        
        // Listen for summary events
        this.eventBus.on('summary:shown', () => this.pause());
        this.eventBus.on('summary:hidden', () => this.resume());
        
        // Listen for shop events
        this.eventBus.on('shop:opened', () => this.pause());
        this.eventBus.on('shop:closed', () => this.resume());
        
        // Shop toggle input (keyboard only - controller uses menu navigation)
        this.eventBus.on(Events.INPUT_SHOP_TOGGLE, () => {
            if (this.upgradeManager && !this.inputManager.useController) {
                if (this.upgradeManager.isOpen()) {
                    this.upgradeManager.closeShop();
                } else {
                    this.upgradeManager.openShop();
                }
            }
        });
        
        // Summary toggle input (keyboard only - controller uses menu navigation)
        this.eventBus.on(Events.INPUT_SUMMARY, () => {
            if (this.economyManager && !this.inputManager.useController) {
                this.economyManager.showSummary();
            }
        });
        
        // Menu navigation (Back button - swipe between shop and summary)
        this.eventBus.on(Events.INPUT_MENU_NAVIGATE, () => {
            const shopOpen = this.upgradeManager?.isOpen() || false;
            const summaryOpen = this.economyManager?.isSummaryOpen() || false;
            
            if (shopOpen) {
                // Switch from shop to summary
                this.upgradeManager.closeShop();
                if (this.economyManager) {
                    this.economyManager.showSummary();
                }
            } else if (summaryOpen) {
                // Switch from summary to shop
                this.economyManager.hideSummary();
                if (this.upgradeManager) {
                    this.upgradeManager.openShop();
                }
            } else {
                // No menu open - open shop first
                if (this.upgradeManager) {
                    this.upgradeManager.openShop();
                }
            }
        });
        
        // Menu exit (B button - close any open menu)
        this.eventBus.on(Events.INPUT_MENU_EXIT, () => {
            if (this.upgradeManager?.isOpen()) {
                this.upgradeManager.closeShop();
            }
            if (this.economyManager?.isSummaryOpen()) {
                this.economyManager.hideSummary();
            }
        });

        // Board reset input
        this.eventBus.on(Events.INPUT_RESET_BOARD, () => {
            if (!this.isPaused && this.trickManager) {
                this.trickManager.resetBoardOrientation();
            }
        });
        
        // Speed boost input (B button release on controller)
        this.eventBus.on(Events.INPUT_SPEED_BOOST, () => {
            // Only trigger boost if no menu is open
            const shopOpen = this.upgradeManager?.isOpen() || false;
            const summaryOpen = this.economyManager?.isSummaryOpen() || false;
            
            if (!shopOpen && !summaryOpen) {
                this.physicsManager.useSpeedBoost(this.player.aimYaw);
            }
        });
        
        // Flight input (double-tap A when charge is full)
        this.eventBus.on(Events.INPUT_FLIGHT, () => {
            // Only trigger flight if no menu is open and charge is full
            const shopOpen = this.upgradeManager?.isOpen() || false;
            const summaryOpen = this.economyManager?.isSummaryOpen() || false;
            
            if (!shopOpen && !summaryOpen) {
                this.physicsManager.startFlight();
            }
        });
        
        // Listen for jump events (fires on spacebar release or single A tap)
        this.eventBus.on(Events.INPUT_JUMP, () => {
            if (!this.isPaused && this.physicsManager.isGrounded) {
                this.physicsManager.jump();
                // Trigger jump animation
                if (this.player) {
                    this.player.triggerJump();
                }
            }
        });
        
        // Camera shake on flight start (takeoff)
        this.eventBus.on(Events.PLAYER_FLIGHT_START, () => {
            if (this.cameraController) {
                this.cameraController.shake(0.4); // Medium shake on takeoff
            }
        });
        
        // Camera shake on landing impact
        this.eventBus.on(Events.PLAYER_LAND_IMPACT, (impactStrength) => {
            if (this.cameraController) {
                // Impact strength 0-1, scale shake accordingly
                const shakeAmount = 0.2 + (impactStrength || 0.5) * 0.6;
                this.cameraController.shake(shakeAmount);
            }
        });
        
        // Camera shake on grounded (soft landing)
        this.eventBus.on(Events.PLAYER_GROUNDED, () => {
            if (this.cameraController) {
                this.cameraController.shake(0.1); // Subtle shake on any landing
            }
        });
        
        // Camera shake when charge is full
        this.eventBus.on(Events.CHARGE_FULL, () => {
            if (this.cameraController) {
                this.cameraController.shake(0.2); // Subtle shake to indicate ready
            }
        });
        
        // Camera shake when using boost
        this.eventBus.on(Events.CHARGE_BOOST_USED, () => {
            if (this.cameraController) {
                this.cameraController.shake(0.5); // Strong shake for boost
            }
        });
        
        // Trick event handlers
        this.eventBus.on(Events.TRICK_COMPLETED, (data) => {
            // Handle trick completion (scoring will be handled by EconomyManager)
            if (this.cameraController) {
                this.cameraController.shake(0.15); // Subtle shake on successful trick
            }
        });
        
        this.eventBus.on(Events.TRICK_COMBO, (data) => {
            // Handle combo tricks
            if (this.cameraController) {
                this.cameraController.shake(0.25); // Stronger shake for combos
            }
        });
        
        this.eventBus.on(Events.TRICK_FAILED, () => {
            // Handle failed tricks (bail)
            if (this.cameraController) {
                this.cameraController.shake(0.3); // Shake on bail
            }
        });
    }

    async _initEditor() {
        // Create editor manager
        this.editorManager = new EditorManager(this);
        
        // Create editor sub-managers
        const editorCamera = new EditorCamera(this.editorManager);
        const editorUI = new EditorUI(this.editorManager);
        const selectionManager = new SelectionManager(this.editorManager);
        const historyManager = new HistoryManager(this.editorManager);
        const gizmoManager = new GizmoManager(this.editorManager);
        const levelSerializer = new LevelSerializer(this.editorManager);
        
        // Set managers
        this.editorManager.setManagers({
            editorCamera,
            editorUI,
            selectionManager,
            historyManager,
            gizmoManager,
            levelSerializer
        });
        
        // Create and add editor grid
        this.editorGrid = new GridHelper(this.editorManager, 500, 100);
        this.editorGrid.addToScene(this.scene);
        this.editorGrid.hide(); // Hidden by default
        
        // Register tools
        this.editorManager.registerTool(EditorTool.SELECT, new SelectTool());
        this.editorManager.registerTool(EditorTool.BUILDING, new BuildingTool());
        this.editorManager.registerTool(EditorTool.ROAD, new RoadTool());
        
        // Initialize editor
        this.editorManager.init();
        
        // Now that editor is ready, set it on city manager and create city
        this.cityManager.setEditorManager(this.editorManager);
        this.cityManager.setAtmosphereManager(this.atmosphereManager);
        this.cityManager.init();
        
        // Initialize delivery system after city is created
        await this._initDeliverySystem();
        
        // Update UI counts after city is created
        if (this.editorManager.editorUI) {
            this.editorManager.editorUI.updateCounts(
                this.editorManager.objects.length,
                0
            );
        }
        
        // Listen for mode changes
        this.editorManager.eventBus.on('editor:mode:changed', (mode) => {
            if (mode === EditorMode.EDIT) {
                this.editorGrid.show();
                selectionManager.enable();
            } else {
                this.editorGrid.hide();
                selectionManager.disable();
            }
        });
    }

    async _initDeliverySystem() {
        // Initialize minimap
        this.minimapManager = new MinimapManager();
        this.minimapManager.init();
        
        // Set pizza shop position (from city manager)
        const pizzaShopPos = this.cityManager.getPizzaShopPosition();
        this.minimapManager.setPizzaShopPosition(pizzaShopPos);
        
        // Set buildings for minimap
        this.minimapManager.setBuildings(this.cityManager.buildings);
        
        // Set buildings for collision detection
        this.physicsManager.setBuildings(this.cityManager.buildings);
        
        // Initialize delivery manager
        this.deliveryManager = new DeliveryManager(this.scene, this.eventBus);
        this.deliveryManager.setPizzaShopPosition(pizzaShopPos);
        await this.deliveryManager.init();
        
        // Listen for delivery events
        this.eventBus.on(Events.DELIVERY_STARTED, (data) => {
            this.minimapManager.setDestination(data.destination);
            this.minimapManager.setPizzaPosition(null);
        });
        
        this.eventBus.on(Events.DELIVERY_COMPLETED, (data) => {
            this.minimapManager.setDestination(null);
            this.uiManager.showDeliveryResult(true, `DELIVERED! +${Math.ceil(data.timeRemaining)}s BONUS`);
        });
        
        this.eventBus.on(Events.DELIVERY_FAILED, () => {
            this.minimapManager.setDestination(null);
            this.uiManager.showDeliveryResult(false, 'DELIVERY FAILED!');
        });
    }

    async _createPlayer() {
        this.player = new Player(this.scene, this.eventBus);
        await this.player.load();
        
        // Set trick manager on player
        if (this.trickManager) {
            this.player.setTrickManager(this.trickManager);
        }
        
        // Create board glow effects attached to player
        this.effectsManager.createBoardGlow(this.player.getGroup());
    }

    _setupEventListeners() {
        window.addEventListener('resize', () => this._onResize());
    }

    _onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.cameraController.onResize(width, height);
        this.renderer.setSize(width, height);
        
        // Resize post-processing
        if (this.composer) {
            this.composer.setSize(width, height);
        }
        
        // Also resize editor camera
        if (this.editorManager?.editorCamera) {
            this.editorManager.editorCamera._onResize();
        }
    }

    /**
     * Pause the game (called when entering edit mode)
     */
    pause() {
        this.isPaused = true;
        
        // Hide game UI
        const gameUI = document.getElementById('ui-overlay');
        if (gameUI) gameUI.style.display = 'none';
        
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo) controlsInfo.style.display = 'none';
    }

    /**
     * Resume the game (called when exiting edit mode)
     */
    resume() {
        this.isPaused = false;
        
        // Show game UI
        const gameUI = document.getElementById('ui-overlay');
        if (gameUI) gameUI.style.display = 'block';
        
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo) controlsInfo.style.display = 'block';
    }

    /**
     * Main update loop
     */
    update() {
        const rawDeltaTime = this.clock.getDelta();
        
        // Update editor if in edit mode
        if (this.editorManager?.mode === EditorMode.EDIT) {
            this.editorManager.update(rawDeltaTime);
            return; // Skip game update in edit mode
        }
        
        if (!this.player || !this.player.isLoaded) return;
        if (this.isPaused) return;
        
        // Apply time dilation for juice effects
        const deltaTime = this.physicsManager.updateTimeDilation(rawDeltaTime);
        
        // Update input manager (polls gamepad state)
        this.inputManager.update();
        
        // Get input
        const movementInput = this.inputManager.getMovementInput();
        const aimInput = this.inputManager.getAimInput();
        const spaceHeld = this.inputManager.isJumpHeld();
        const boostHeld = this.inputManager.isBoostHeld();
        const forwardHeld = this.inputManager.isForwardHeld();
        
        // Update player aim
        this.player.updateAim(aimInput);
        
        // Pass strafe input to player for lean/turn calculations
        this.player.setStrafeInput(movementInput.x);
        
        // Calculate movement direction
        const moveDirection = this.player.getWorldMovementDirection(movementInput);
        
        // Apply movement with momentum boost
        if (moveDirection.length() > 0) {
            // Momentum boost when holding forward
            let boostMultiplier = 1;
            if (forwardHeld) {
                this.momentumTimer += deltaTime;
                if (this.momentumTimer > PLAYER.MOMENTUM_BOOST_DELAY) {
                    const boostProgress = Math.min(1, (this.momentumTimer - PLAYER.MOMENTUM_BOOST_DELAY) / 2);
                    boostMultiplier = 1 + (PLAYER.MOMENTUM_BOOST_MAX - 1) * boostProgress;
                }
            } else {
                this.momentumTimer = 0;
            }
            
            // Flight acceleration boost
            const flightBoost = this.physicsManager.isFlying ? 2.0 : 1.0;
            
            this.physicsManager.applyAcceleration(moveDirection, boostMultiplier * flightBoost);
        } else {
            this.momentumTimer = 0;
        }
        
        // Handle charge boost activation (Shift key for keyboard)
        // Controller speed boost is handled via INPUT_SPEED_BOOST event on B button release
        // Controller flight is handled via INPUT_FLIGHT event on double-tap A
        if (boostHeld && !this.inputManager.useController && this.physicsManager.isCharged()) {
            this.physicsManager.useChargeBoost(spaceHeld, this.player.aimYaw);
        }
        
        // Get current speed
        let currentSpeed = this.physicsManager.getSpeed();
        
        // Update physics
        this.physicsManager.update(
            deltaTime,
            this.player.getPosition(),
            currentSpeed
        );
        
        // Update speed after physics (may have changed)
        currentSpeed = this.physicsManager.getSpeed();
        
        // Update trick system (when airborne - including during flight)
        const isAirborne = !this.physicsManager.isGrounded;
        if (this.trickManager && isAirborne) {
            const trickInput = this.inputManager.getTrickInput();
            this.trickManager.update(
                deltaTime,
                isAirborne,
                trickInput
            );
        }
        
        // Update player
        const isFallingFromFlight = this.physicsManager.wasFlying && 
                                    !this.physicsManager.isFlying && 
                                    !this.physicsManager.isGrounded;
        this.player.update(
            deltaTime,
            this.physicsManager.velocity,
            this.physicsManager.isGrounded,
            isFallingFromFlight
        );
        
        // Update camera (with speed for shake effect)
        this.cameraController.update(
            this.player.getPosition(),
            this.player.aimYaw,
            this.player.aimPitch,
            currentSpeed,
            PLAYER.MAX_SPEED
        );
        
        // Update motion blur based on speed and camera shake
        const speedRatio = Math.min(1, currentSpeed / PLAYER.MAX_SPEED);
        this._updateMotionBlur(speedRatio, this.cameraController.getShakeIntensity());
        
        // Update sun position for dynamic shadows
        this._updateSunPosition(this.player.getPosition());
        
        // Update effects
        this.effectsManager.update({
            playerPosition: this.player.getPosition(),
            aimYaw: this.player.aimYaw,
            speed: this.physicsManager.getSpeed(),
            maxSpeed: PLAYER.MAX_SPEED,
            isGrounded: this.physicsManager.isGrounded,
            chargeLevel: this.physicsManager.getChargeLevel(),
            isCharged: this.physicsManager.isCharged()
        });
        
        // Update city LOD
        this.cityManager.updateLOD(this.player.getPosition());
        
        // Increment frame counter for throttling
        this.updateFrameCount++;
        
        // Update traffic (every frame - needed for collisions)
        if (this.trafficManager) {
            this.trafficManager.update(deltaTime, this.player.getPosition());
            
            // Pass car collisions to physics
            const carCollisions = this.trafficManager.getCarCollisions(this.player.getPosition());
            this.physicsManager.setCarCollisions(carCollisions);
        }
        
        // Update drones (every 2nd frame)
        if (this.droneManager && (this.updateFrameCount % 2 === 0)) {
            this.droneManager.update(deltaTime * 2, this.player.getPosition());
            
            // Pass drone collisions to physics (always check collisions)
            const droneCollisions = this.droneManager.getDroneCollisions(this.player.getPosition());
            this.physicsManager.setDroneCollisions(droneCollisions);
        }
        
        // Update pedestrians (every 2nd frame)
        if (this.pedestrianManager && (this.updateFrameCount % 2 === 0)) {
            this.pedestrianManager.update(deltaTime * 2, this.player.getPosition());
            
            // Pass pedestrian collisions to physics (always check collisions)
            const pedCollisions = this.pedestrianManager.getPedestrianCollisions(this.player.getPosition());
            this.physicsManager.setPedestrianCollisions(pedCollisions);
        }
        
        // Update UI
        this.uiManager.update({
            speed: this.physicsManager.getSpeed(),
            altitude: this.player.getPosition().y,
            flyEnergyRatio: this.physicsManager.getFlightEnergyRatio(),
            isFlying: this.physicsManager.isFlying,
            isGrounded: this.physicsManager.isGrounded,
            chargeLevel: this.physicsManager.getChargeLevel(),
            isCharged: this.physicsManager.isCharged()
        });
        
        // Update delivery system
        if (this.deliveryManager) {
            this.deliveryManager.update(deltaTime, this.player.getPosition(), currentSpeed, PLAYER.MAX_SPEED);
            
            // Update delivery UI
            const deliveryState = this.deliveryManager.getState();
            this.uiManager.updateDelivery(deliveryState);
            
            // Update minimap with pizza position
            this.minimapManager.setPizzaPosition(deliveryState.pizzaPosition);
        }
        
        // Update minimap
        if (this.minimapManager) {
            this.minimapManager.updatePlayer(this.player.getPosition(), this.player.aimYaw);
            this.minimapManager.render();
        }
        
        // Update audio
        if (this.audioManager) {
            this.audioManager.update(
                currentSpeed,
                PLAYER.MAX_SPEED,
                this.physicsManager.isGrounded,
                this.player.getPosition().y
            );
        }
        
        // Update atmosphere (every 3rd frame)
        if (this.atmosphereManager && (this.updateFrameCount % 3 === 0)) {
            this.atmosphereManager.update(deltaTime * 3, this.player.getPosition());
        }
        
        // Update economy tracking
        if (this.economyManager) {
            this.economyManager.update(deltaTime, {
                altitude: this.player.getPosition().y,
                speed: currentSpeed
            });
        }
    }

    /**
     * Animation loop
     */
    animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());
        
        this.update();
        
        // Render with appropriate camera and effects
        if (this.editorManager?.mode === EditorMode.EDIT) {
            // Editor mode: simple render without post-processing
            const camera = this.editorManager.editorCamera.camera;
            this.renderer.render(this.scene, camera);
        } else {
            // Game mode: use composer with motion blur
            const camera = this.cameraController.getCamera();
            
            // Update composer's render pass camera
            if (this.composer && this.composer.passes[0]) {
                this.composer.passes[0].camera = camera;
            }
            
            // Render with post-processing (motion blur)
            const currentDamp = this.afterimagePass?.uniforms['damp']?.value || 0;
            if (this.composer && currentDamp > 0.02) {
                this.composer.render();
            } else {
                // Skip post-processing if blur is minimal
                this.renderer.render(this.scene, camera);
            }
        }
    }

    /**
     * Start the game
     */
    start() {
        this.animate();
        
        // Show intro dialogue after a short delay
        setTimeout(() => {
            if (this.dialogueManager) {
                this.dialogueManager.showIntro();
            }
        }, 1500);
    }

    /**
     * Dispose of the game and clean up resources
     */
    dispose() {
        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Dispose managers
        if (this.inputManager) {
            this.inputManager.destroy();
        }

        // Dispose Three.js resources
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        console.log('Game disposed');
    }
}
