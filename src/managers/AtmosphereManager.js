// AtmosphereManager - Handles cyberpunk atmosphere: neon signs, fog, and visual effects

import * as THREE from 'three';

// Neon sign colors
const NEON_COLORS = [
    0xff0066, // Hot pink
    0x00ffff, // Cyan
    0xff6600, // Orange
    0x00ff66, // Green
    0xff00ff, // Magenta
    0xffff00, // Yellow
    0x6666ff, // Blue
    0xff3333, // Red
];

// Sign text options
const SIGN_TEXTS = [
    'PIZZA', 'NEON', 'OPEN', 'LIVE', 'CAFE', 
    '24HR', 'FOOD', 'TAXI', 'BAR', 'CLUB',
    'SHOP', 'TECH', 'DATA', 'NET', 'HACK'
];

// Culling distances
const CULL_DISTANCES = {
    NEON_SIGNS: 100,      // Only update/visible within 100m
    WINDOW_LIGHTS: 60,    // Only update/visible within 60m
    HAZE: 200             // Haze always follows player
};

export class AtmosphereManager {
    constructor(scene) {
        this.scene = scene;
        this.neonSigns = [];
        this.windowLights = [];
        this.fogEnabled = true;
        this.playerPosition = new THREE.Vector3();
        
        // Neon glow materials (reusable)
        this.neonMaterials = new Map();
        
        // Create shared glow texture
        this.glowTexture = this._createGlowTexture();
    }

    /**
     * Set player position for distance culling
     */
    setPlayerPosition(position) {
        this.playerPosition.copy(position);
    }

    /**
     * Initialize atmosphere effects
     */
    init() {
        this._setupFog();
        this._createAmbientHaze();
    }

    /**
     * Create glow texture for signs
     */
    _createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    /**
     * Setup volumetric fog
     */
    _setupFog() {
        if (this.fogEnabled) {
            // Dense fog for cyberpunk atmosphere
            this.scene.fog = new THREE.FogExp2(0x0a0a15, 0.008);
        }
    }

    /**
     * Create ambient haze particles
     */
    _createAmbientHaze() {
        // Dust/haze particles floating in the air
        const particleCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 30 + 2;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
            sizes[i] = Math.random() * 0.5 + 0.2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            color: 0x8888aa,
            size: 0.3,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.hazeParticles = new THREE.Points(geometry, material);
        this.scene.add(this.hazeParticles);
    }

    /**
     * Add emissive windows to a building (optimized - only for tall buildings, fewer windows)
     * @param {THREE.Mesh} buildingMesh - The building mesh
     * @param {number} buildingHeight - Height of the building
     */
    addBuildingWindows(buildingMesh, buildingHeight) {
        // Only add windows to very tall buildings (reduces count significantly)
        if (buildingHeight < 20) return;
        
        // Only 20% of eligible buildings get windows
        if (Math.random() > 0.2) return;
        
        const buildingPos = buildingMesh.position;
        const buildingScale = buildingMesh.scale;
        
        // Calculate window grid (reduced density)
        const floorsCount = Math.floor(buildingHeight / 6); // Larger floor spacing
        const windowsPerFloor = Math.floor(Math.max(buildingScale.x, buildingScale.z) / 6); // Larger window spacing
        
        if (floorsCount < 2 || windowsPerFloor < 1) return;
        
        // Create window light group
        const windowGroup = new THREE.Group();
        
        // Window material with random lit/unlit states
        const windowGeometry = new THREE.PlaneGeometry(2, 3); // Slightly larger windows
        
        // Only add windows to 2 sides (front and one side) instead of all 4
        const sides = [
            { dir: new THREE.Vector3(0, 0, 1), rot: 0 },
            { dir: new THREE.Vector3(1, 0, 0), rot: Math.PI / 2 }
        ];
        
        for (const side of sides) {
            const sideWidth = side.dir.x !== 0 ? buildingScale.z : buildingScale.x;
            const actualWindowsPerFloor = Math.floor(sideWidth / 6);
            
            for (let floor = 1; floor < floorsCount; floor++) {
                for (let w = 0; w < actualWindowsPerFloor; w++) {
                    // Random chance for window to be lit (increased threshold)
                    if (Math.random() > 0.5) continue;
                    
                    // Window color - warm interior lights
                    const warmColors = [0xffdd99, 0xffffcc, 0xffeeaa];
                    const color = warmColors[Math.floor(Math.random() * warmColors.length)];
                    const intensity = 0.4 + Math.random() * 0.3;
                    
                    const material = new THREE.MeshBasicMaterial({
                        color: color,
                        transparent: true,
                        opacity: intensity,
                        side: THREE.DoubleSide
                    });
                    
                    const window = new THREE.Mesh(windowGeometry, material);
                    
                    // Position window
                    const offset = (w - actualWindowsPerFloor / 2 + 0.5) * 6;
                    const y = floor * 6 + 3;
                    const distance = (side.dir.x !== 0 ? buildingScale.x : buildingScale.z) / 2 + 0.1;
                    
                    window.position.set(
                        side.dir.x * distance + (side.dir.z !== 0 ? offset : 0),
                        y,
                        side.dir.z * distance + (side.dir.x !== 0 ? offset : 0)
                    );
                    window.rotation.y = side.rot;
                    
                    // Store for animation
                    window.userData.flickerSpeed = Math.random() * 0.01; // Slower flicker
                    window.userData.flickerOffset = Math.random() * Math.PI * 2;
                    window.userData.baseOpacity = intensity;
                    
                    windowGroup.add(window);
                }
            }
        }
        
        windowGroup.position.copy(buildingPos);
        this.scene.add(windowGroup);
        this.windowLights.push(windowGroup);
    }

    /**
     * Create a neon sign
     * @param {THREE.Vector3} position - Position for the sign
     * @param {string} text - Text to display (optional)
     * @param {number} color - Hex color (optional, random if not provided)
     * @param {number} scale - Scale multiplier
     */
    createNeonSign(position, text = null, color = null, scale = 1) {
        const signText = text || SIGN_TEXTS[Math.floor(Math.random() * SIGN_TEXTS.length)];
        const signColor = color || NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
        
        const group = new THREE.Group();
        
        // Create text using simple box-based letters
        const letterWidth = 0.8 * scale;
        const letterHeight = 1.2 * scale;
        const letterDepth = 0.1 * scale;
        const spacing = 0.2 * scale;
        
        const totalWidth = signText.length * (letterWidth + spacing) - spacing;
        
        // Backing panel (dark)
        const backingGeometry = new THREE.BoxGeometry(totalWidth + 1, letterHeight + 0.6, 0.2);
        const backingMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9
        });
        const backing = new THREE.Mesh(backingGeometry, backingMaterial);
        backing.position.z = -0.15;
        group.add(backing);
        
        // Neon tubes (simplified as boxes)
        const neonMaterial = new THREE.MeshBasicMaterial({
            color: signColor,
            transparent: true,
            opacity: 1
        });
        
        for (let i = 0; i < signText.length; i++) {
            const letterGeometry = new THREE.BoxGeometry(letterWidth, letterHeight, letterDepth);
            const letter = new THREE.Mesh(letterGeometry, neonMaterial.clone());
            letter.position.x = i * (letterWidth + spacing) - totalWidth / 2 + letterWidth / 2;
            group.add(letter);
        }
        
        // Glow sprite behind the sign
        const glowMaterial = new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: signColor,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(totalWidth * 2, letterHeight * 3, 1);
        glow.position.z = -0.3;
        group.add(glow);
        
        // Point light for actual illumination
        const light = new THREE.PointLight(signColor, 2, 15);
        light.position.z = 1;
        group.add(light);
        
        // Position and add to scene
        group.position.copy(position);
        
        // Store animation data
        group.userData = {
            baseColor: signColor,
            flickerSpeed: 0.1 + Math.random() * 0.2,
            flickerIntensity: 0.1 + Math.random() * 0.1,
            time: Math.random() * Math.PI * 2
        };
        
        this.scene.add(group);
        this.neonSigns.push(group);
        
        return group;
    }

    /**
     * Create a vertical neon bar/strip
     */
    createNeonStrip(position, height, color, rotation = 0) {
        const geometry = new THREE.BoxGeometry(0.1, height, 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const strip = new THREE.Mesh(geometry, material);
        strip.position.copy(position);
        strip.rotation.y = rotation;
        
        // Glow
        const glowMaterial = new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: color,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(2, height * 1.5, 1);
        strip.add(glow);
        
        this.scene.add(strip);
        this.neonSigns.push(strip);
        
        return strip;
    }

    /**
     * Add neon elements to building
     */
    addBuildingNeon(buildingMesh, buildingHeight) {
        const pos = buildingMesh.position;
        const scale = buildingMesh.scale;
        
                    // Random chance to add neon sign (reduced from 30% to 10%)
                    if (Math.random() < 0.1 && buildingHeight > 15) {
            const signHeight = 10 + Math.random() * (buildingHeight - 15);
            const side = Math.floor(Math.random() * 4);
            const offsets = [
                { x: scale.x / 2 + 0.5, z: 0 },
                { x: -scale.x / 2 - 0.5, z: 0 },
                { x: 0, z: scale.z / 2 + 0.5 },
                { x: 0, z: -scale.z / 2 - 0.5 }
            ];
            const rotations = [Math.PI / 2, -Math.PI / 2, 0, Math.PI];
            
            const signPos = new THREE.Vector3(
                pos.x + offsets[side].x,
                signHeight,
                pos.z + offsets[side].z
            );
            
            const sign = this.createNeonSign(signPos);
            sign.rotation.y = rotations[side];
        }
        
        // Random chance to add neon strips on edges (reduced from 20% to 5%)
        if (Math.random() < 0.05) {
            const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
            const corners = [
                { x: scale.x / 2, z: scale.z / 2 },
                { x: -scale.x / 2, z: scale.z / 2 },
                { x: scale.x / 2, z: -scale.z / 2 },
                { x: -scale.x / 2, z: -scale.z / 2 }
            ];
            
            // Add strip to random corner
            const corner = corners[Math.floor(Math.random() * corners.length)];
            this.createNeonStrip(
                new THREE.Vector3(pos.x + corner.x, buildingHeight / 2, pos.z + corner.z),
                buildingHeight,
                color
            );
        }
    }

    /**
     * Update atmosphere effects
     */
    update(deltaTime, playerPosition) {
        // Update player position
        this.setPlayerPosition(playerPosition);
        
        // Update haze particles to follow player
        if (this.hazeParticles) {
            this.hazeParticles.position.x = playerPosition.x;
            this.hazeParticles.position.z = playerPosition.z;
        }
        
        // Animate neon signs (only within cull distance)
        const time = performance.now() * 0.001;
        const neonCullDistSq = CULL_DISTANCES.NEON_SIGNS * CULL_DISTANCES.NEON_SIGNS;
        
        for (const sign of this.neonSigns) {
            // Calculate distance to player
            const signPos = sign.position;
            const dx = signPos.x - playerPosition.x;
            const dz = signPos.z - playerPosition.z;
            const distSq = dx * dx + dz * dz;
            
            // Only update and show if within range
            const inRange = distSq < neonCullDistSq;
            sign.visible = inRange;
            
            if (inRange && sign.userData.flickerSpeed) {
                sign.userData.time += deltaTime * sign.userData.flickerSpeed * 10;
                
                // Subtle flicker effect
                const flicker = 1 - Math.abs(Math.sin(sign.userData.time * 20)) * sign.userData.flickerIntensity;
                
                // Apply to children
                sign.traverse((child) => {
                    if (child.material && child.material.opacity !== undefined) {
                        if (child.isSprite) {
                            child.material.opacity = 0.4 * flicker;
                        } else if (child.material.emissive === undefined) {
                            child.material.opacity = flicker;
                        }
                    }
                    if (child.isLight) {
                        child.intensity = 2 * flicker;
                    }
                });
            }
        }
        
        // Animate window lights (only within cull distance)
        const windowCullDistSq = CULL_DISTANCES.WINDOW_LIGHTS * CULL_DISTANCES.WINDOW_LIGHTS;
        
        for (const windowGroup of this.windowLights) {
            // Calculate distance to player
            const groupPos = windowGroup.position;
            const dx = groupPos.x - playerPosition.x;
            const dz = groupPos.z - playerPosition.z;
            const distSq = dx * dx + dz * dz;
            
            // Only update and show if within range
            const inRange = distSq < windowCullDistSq;
            windowGroup.visible = inRange;
            
            if (inRange) {
                windowGroup.traverse((child) => {
                    if (child.userData.flickerSpeed) {
                        const flicker = 1 - Math.abs(Math.sin(time * child.userData.flickerSpeed * 100 + child.userData.flickerOffset)) * 0.1;
                        child.material.opacity = child.userData.baseOpacity * flicker;
                    }
                });
            }
        }
    }

    /**
     * Dispose of atmosphere resources
     */
    dispose() {
        for (const sign of this.neonSigns) {
            this.scene.remove(sign);
            sign.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        
        for (const windowGroup of this.windowLights) {
            this.scene.remove(windowGroup);
            windowGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        
        if (this.hazeParticles) {
            this.scene.remove(this.hazeParticles);
            this.hazeParticles.geometry.dispose();
            this.hazeParticles.material.dispose();
        }
        
        this.neonSigns = [];
        this.windowLights = [];
    }
}
