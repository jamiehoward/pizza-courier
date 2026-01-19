// EffectsManager - Handles glow effects, particles, and trails

import * as THREE from 'three';
import { EFFECTS, PLAYER } from '../constants.js';
import { Events } from '../core/EventBus.js';

export class EffectsManager {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        
        // Glow elements
        this.boardGlow = null;
        this.boardGlowSprite = null;
        this.boardAmbientGlow = null;
        this.groundReflection = null;
        
        // Charge state
        this.chargeLevel = 0;
        this.isFullyCharged = false;
        this.chargeGlowPulse = 0;
        
        // Particles
        this.trailParticles = [];
        this.particlePool = []; // Pool of reusable particles
        this.glowTexture = null;
        
        // Initialize particle pool
        this._initParticlePool();
        
        // Speed lines
        this.speedLines = [];
        this.speedLineGroup = new THREE.Group();
        this.scene.add(this.speedLineGroup);
        this._createSpeedLines();
        
        // Player reference for speed lines
        this.playerPosition = new THREE.Vector3();
        this.playerAimYaw = 0;
        this.currentSpeed = 0;
        
        // Listen for events
        this.eventBus.on(Events.PLAYER_FLIGHT_START, () => this.createFlightBurst());
        this.eventBus.on(Events.CHARGE_FULL, () => this.createChargeBurst());
        this.eventBus.on(Events.CHARGE_BOOST_USED, () => this.createBoostBurst());
        this.eventBus.on(Events.NEAR_MISS, (data) => this.createNearMissSparks(data.position));
        this.eventBus.on(Events.CHARGE_THRESHOLD, (data) => this.createChargeThresholdBurst(data.threshold));
        
        // Trick events
        this.eventBus.on(Events.TRICK_STARTED, () => this.createTrickTrail());
        this.eventBus.on(Events.TRICK_COMPLETED, (data) => this.createTrickSuccessEffect(data));
        this.eventBus.on(Events.TRICK_COMBO, (data) => this.createComboEffect(data));
        this.eventBus.on(Events.TRICK_FAILED, () => this.createTrickFailEffect());
    }

    /**
     * Initialize particle pool
     */
    _initParticlePool() {
        const poolSize = EFFECTS.MAX_TRAIL_PARTICLES + 20; // Extra for bursts
        const glowTexture = this.createGlowTexture();
        
        for (let i = 0; i < poolSize; i++) {
            const material = new THREE.SpriteMaterial({
                map: glowTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const particle = new THREE.Sprite(material);
            particle.visible = false;
            particle.userData.isActive = false;
            
            this.particlePool.push(particle);
        }
    }

    /**
     * Get a particle from the pool
     */
    _getParticleFromPool() {
        for (const particle of this.particlePool) {
            if (!particle.userData.isActive) {
                particle.userData.isActive = true;
                particle.visible = true;
                return particle;
            }
        }
        // If pool exhausted, create a new one (shouldn't happen with proper sizing)
        const glowTexture = this.createGlowTexture();
        const material = new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const particle = new THREE.Sprite(material);
        particle.userData.isActive = true;
        this.particlePool.push(particle);
        return particle;
    }

    /**
     * Return a particle to the pool
     */
    _returnParticleToPool(particle) {
        particle.userData.isActive = false;
        particle.visible = false;
        particle.material.opacity = 0;
        if (particle.parent) {
            particle.parent.remove(particle);
        }
    }

    /**
     * Create speed line geometry
     */
    _createSpeedLines() {
        const lineCount = 10;
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        
        for (let i = 0; i < lineCount; i++) {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(6); // Two points
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const line = new THREE.Line(geometry, lineMaterial.clone());
            line.userData = {
                offset: new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 4 + 1,
                    (Math.random() - 0.5) * 8
                ),
                length: 2 + Math.random() * 4,
                speed: 0.8 + Math.random() * 0.4
            };
            
            this.speedLines.push(line);
            this.speedLineGroup.add(line);
        }
    }

    /**
     * Create particle burst when crossing charge thresholds
     */
    createChargeThresholdBurst(threshold) {
        // Colors get warmer as charge increases
        const colors = {
            0.25: [0x00ffff, 0x00aaff], // Cyan
            0.50: [0x00ff88, 0x88ff00], // Green-yellow
            0.75: [0xffaa00, 0xff6600]  // Orange
        };
        
        const burstColors = colors[threshold] || [0xffffff];
        const glowTexture = this.createGlowTexture();
        
        // Create burst particles around the board (limit to 8)
        for (let i = 0; i < 8; i++) {
            const color = burstColors[Math.floor(Math.random() * burstColors.length)];
            const particle = this._getParticleFromPool();
            
            // Configure particle
            particle.material.color.setHex(color);
            particle.material.opacity = 0.8;
            
            // Ring pattern around board
            const angle = (i / 12) * Math.PI * 2;
            particle.userData.offsetX = Math.cos(angle) * 0.8;
            particle.userData.offsetY = -0.2;
            particle.userData.offsetZ = Math.sin(angle) * 0.8;
            
            const size = 0.3 + Math.random() * 0.3;
            particle.scale.set(size, size, 1);
            
            // Burst outward
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * 0.15,
                0.1 + Math.random() * 0.1,
                Math.sin(angle) * 0.15
            );
            particle.userData.life = 1.0;
            particle.userData.decay = 0.05;
            particle.userData.baseOpacity = 0.8;
            particle.userData.baseSize = size;
            particle.userData.isBurst = true;
            particle.userData.isSpark = false;
            particle.userData.needsInitialPosition = true;
            
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }

    /**
     * Create the radial gradient texture for glow effects
     */
    createGlowTexture() {
        if (this.glowTexture) return this.glowTexture;
        
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        
        this.glowTexture = new THREE.CanvasTexture(canvas);
        this.glowTexture.needsUpdate = true;
        return this.glowTexture;
    }

    /**
     * Create board glow effects and attach to player group
     * @param {THREE.Group} playerGroup - The player's group to attach effects to
     */
    createBoardGlow(playerGroup) {
        const glowTexture = this.createGlowTexture();
        
        // Point light under the board
        this.boardGlow = new THREE.PointLight(EFFECTS.GLOW_COLORS.PRIMARY, 2, 12);
        this.boardGlow.position.set(0, -0.2, 0);
        playerGroup.add(this.boardGlow);
        
        // Main glow sprite
        const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: EFFECTS.GLOW_COLORS.PRIMARY,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.boardGlowSprite = new THREE.Sprite(glowMaterial);
        this.boardGlowSprite.position.set(0, -0.1, 0);
        this.boardGlowSprite.scale.set(4, 2, 1);
        playerGroup.add(this.boardGlowSprite);
        
        // Ambient glow sprite
        const ambientGlowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: EFFECTS.GLOW_COLORS.PRIMARY,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.boardAmbientGlow = new THREE.Sprite(ambientGlowMaterial);
        this.boardAmbientGlow.position.set(0, -0.05, 0);
        this.boardAmbientGlow.scale.set(8, 4, 1);
        playerGroup.add(this.boardAmbientGlow);
        
        // Ground reflection (on ground plane, not attached to player)
        const groundReflectionGeometry = new THREE.PlaneGeometry(1, 1);
        const groundReflectionMaterial = new THREE.MeshBasicMaterial({
            map: glowTexture,
            color: EFFECTS.GLOW_COLORS.PRIMARY,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.groundReflection = new THREE.Mesh(groundReflectionGeometry, groundReflectionMaterial);
        this.groundReflection.rotation.x = -Math.PI / 2;
        this.groundReflection.position.set(0, 0.05, 0);
        this.groundReflection.scale.set(5, 5, 1);
        this.scene.add(this.groundReflection);
    }

    /**
     * Create spark effect for near miss
     */
    createNearMissSparks(position) {
        const sparkColors = [0xffff00, 0xffaa00, 0xff6600, 0xffffff];
        const glowTexture = this.createGlowTexture();
        
        // Create many small, fast-moving sparks (limit to 8)
        for (let i = 0; i < 8; i++) {
            const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            const spark = this._getParticleFromPool();
            
            // Configure spark
            spark.material.color.setHex(color);
            spark.material.opacity = 1.0;
            
            // Start at the near-miss position
            spark.position.set(
                position.x + (Math.random() - 0.5) * 0.5,
                position.y + (Math.random() - 0.5) * 0.5,
                position.z + (Math.random() - 0.5) * 0.5
            );
            
            const size = 0.1 + Math.random() * 0.2;
            spark.scale.set(size, size, 1);
            
            // Sparks fly outward in all directions
            spark.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.3 + 0.1,
                (Math.random() - 0.5) * 0.5
            );
            spark.userData.life = 1.0;
            spark.userData.decay = 0.08 + Math.random() * 0.05; // Fast decay
            spark.userData.baseOpacity = 1.0;
            spark.userData.baseSize = size;
            spark.userData.isSpark = true;
            spark.userData.isBurst = false;
            spark.userData.gravity = 0.02; // Sparks fall with gravity
            spark.userData.needsInitialPosition = false;
            
            this.scene.add(spark);
            this.trailParticles.push(spark);
        }
    }

    /**
     * Create burst effect when charge reaches 100%
     */
    createChargeBurst() {
        this.isFullyCharged = true;
        const burstColors = [0xffff00, 0xffaa00, 0xffff44, 0xffffff];
        this._createBurstParticles(burstColors, 15, 1.2);
    }

    /**
     * Create burst effect when using boost
     */
    createBoostBurst() {
        this.isFullyCharged = false;
        this.chargeLevel = 0;
        const burstColors = [0xff6600, 0xff3300, 0xffaa00, 0xffff00];
        this._createBurstParticles(burstColors, 25, 1.5);
    }

    /**
     * Helper to create burst particles
     */
    _createBurstParticles(colors, count, scale) {
        const glowTexture = this.createGlowTexture();
        
        // Limit burst particles to 8
        const actualCount = Math.min(count, 8);
        for (let i = 0; i < actualCount; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const particle = this._getParticleFromPool();
            
            // Configure particle
            particle.material.color.setHex(color);
            particle.material.opacity = 0.9;
            
            particle.userData.offsetX = (Math.random() - 0.5) * 0.8;
            particle.userData.offsetY = -0.1 + (Math.random() - 0.5) * 0.4;
            particle.userData.offsetZ = (Math.random() - 0.5) * 0.8;
            
            const size = (0.6 + Math.random() * 0.6) * scale;
            particle.scale.set(size, size, 1);
            
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.3
            );
            particle.userData.life = 1.0;
            particle.userData.decay = 0.04 + Math.random() * 0.03;
            particle.userData.baseOpacity = 0.9;
            particle.userData.baseSize = size;
            particle.userData.isBurst = true;
            particle.userData.needsInitialPosition = true;
            
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }

    /**
     * Create burst particles when flight activates
     */
    createFlightBurst() {
        const burstColors = [0x00ffff, 0x00ffaa, 0x44ffff, 0xaaffff];
        const glowTexture = this.createGlowTexture();
        
        for (let i = 0; i < EFFECTS.BURST_PARTICLE_COUNT; i++) {
            const color = burstColors[Math.floor(Math.random() * burstColors.length)];
            const particle = this._getParticleFromPool();
            
            // Configure particle
            particle.material.color.setHex(color);
            particle.material.opacity = 0.8;
            
            // Will be positioned relative to player in update
            particle.userData.offsetX = (Math.random() - 0.5) * 0.5;
            particle.userData.offsetY = -0.2 + (Math.random() - 0.5) * 0.3;
            particle.userData.offsetZ = -0.8 + (Math.random() - 0.5) * 0.5;
            
            const size = 0.8 + Math.random() * 0.8;
            particle.scale.set(size, size, 1);
            
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.15,
                (Math.random() - 0.5) * 0.1,
                -0.2 + (Math.random() - 0.5) * 0.15
            );
            particle.userData.life = 1.0;
            particle.userData.decay = 0.03 + Math.random() * 0.02;
            particle.userData.baseOpacity = 0.8;
            particle.userData.baseSize = size;
            particle.userData.isBurst = true;
            particle.userData.needsInitialPosition = true;
            
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }

    /**
     * Create a trail particle (uses pool)
     * @param {THREE.Vector3} position - World position
     * @param {THREE.Color} color - Particle color
     */
    createTrailParticle(position, color) {
        // Remove old particles if at limit
        while (this.trailParticles.length >= EFFECTS.MAX_TRAIL_PARTICLES) {
            const old = this.trailParticles.shift();
            this._returnParticleToPool(old);
        }
        
        // Get particle from pool
        const particle = this._getParticleFromPool();
        
        // Configure particle
        particle.position.copy(position);
        const size = 0.8 + Math.random() * 0.4;
        particle.scale.set(size, size * 0.6, 1);
        particle.material.color.copy(color);
        particle.material.opacity = 0.4;
        
        particle.userData.life = 1.0;
        particle.userData.decay = 0.02 + Math.random() * 0.015;
        particle.userData.baseOpacity = 0.4;
        particle.userData.baseSize = size;
        particle.userData.isSpark = false;
        particle.userData.isBurst = false;
        particle.userData.velocity = null;
        
        this.scene.add(particle);
        this.trailParticles.push(particle);
    }

    /**
     * Update all effects
     * @param {Object} data - Update data
     */
    update({ playerPosition, aimYaw, speed, maxSpeed, isGrounded, chargeLevel, isCharged }) {
        // Store player state for other methods
        this.playerPosition.copy(playerPosition);
        this.playerAimYaw = aimYaw;
        this.currentSpeed = speed;
        
        // Update charge state
        this.chargeLevel = chargeLevel || 0;
        this.isFullyCharged = isCharged || false;
        
        // Pulse effect when fully charged
        if (this.isFullyCharged) {
            this.chargeGlowPulse += 0.15;
        }
        
        this.updateBoardGlow(playerPosition, speed, maxSpeed);
        this.updateTrailParticles(playerPosition, aimYaw, speed, maxSpeed);
        this.updateSpeedLines(playerPosition, aimYaw, speed, maxSpeed);
        
        // Spawn trail particles when moving
        if (speed > PLAYER.MOVE_THRESHOLD * 2) {
            const spawnChance = Math.min(0.8, speed * 2);
            if (Math.random() < spawnChance) {
                const trailPos = playerPosition.clone();
                trailPos.y -= 0.2;
                trailPos.x -= Math.sin(aimYaw) * 0.5;
                trailPos.z -= Math.cos(aimYaw) * 0.5;
                trailPos.x += (Math.random() - 0.5) * 0.3;
                trailPos.z += (Math.random() - 0.5) * 0.3;
                
                // Color based on charge (cyan -> yellow -> orange when charged)
                let color;
                if (this.isFullyCharged) {
                    color = new THREE.Color(0xffaa00);
                } else {
                    const chargeRatio = this.chargeLevel;
                    color = new THREE.Color().setRGB(
                        chargeRatio,
                        1 - chargeRatio * 0.3,
                        1 - chargeRatio
                    );
                }
                this.createTrailParticle(trailPos, color);
            }
        }
    }

    /**
     * Update speed lines based on velocity
     */
    updateSpeedLines(playerPosition, aimYaw, speed, maxSpeed) {
        const speedRatio = Math.min(1, speed / maxSpeed);
        const speedThreshold = 0.4; // Only show speed lines above this ratio
        
        // Calculate line visibility
        const lineOpacity = speedRatio > speedThreshold 
            ? (speedRatio - speedThreshold) / (1 - speedThreshold) * 0.6 
            : 0;
        
        for (const line of this.speedLines) {
            const material = line.material;
            material.opacity = lineOpacity;
            
            if (lineOpacity > 0) {
                const positions = line.geometry.attributes.position.array;
                const offset = line.userData.offset;
                const length = line.userData.length * (0.5 + speedRatio * 1.5);
                
                // Position relative to player, in front of camera
                const baseX = playerPosition.x + offset.x;
                const baseY = playerPosition.y + offset.y;
                const baseZ = playerPosition.z + offset.z;
                
                // Line extends backward from direction of travel
                const dirX = -Math.sin(aimYaw);
                const dirZ = -Math.cos(aimYaw);
                
                // Start point
                positions[0] = baseX;
                positions[1] = baseY;
                positions[2] = baseZ;
                
                // End point (extends backward)
                positions[3] = baseX + dirX * length;
                positions[4] = baseY;
                positions[5] = baseZ + dirZ * length;
                
                line.geometry.attributes.position.needsUpdate = true;
                
                // Color based on charge
                if (this.isFullyCharged) {
                    material.color.setHex(0xffaa00);
                } else if (this.chargeLevel > 0.5) {
                    material.color.setHex(0x88ffff);
                } else {
                    material.color.setHex(0xffffff);
                }
            }
        }
    }

    updateBoardGlow(playerPosition, speed, maxSpeed) {
        if (!this.boardGlow) return;
        
        const groundProximity = Math.max(0, 1 - (playerPosition.y / 15));
        const groundProximitySmooth = groundProximity * groundProximity;
        
        // Calculate color based on charge level
        // Low charge: soft cyan
        // Mid charge: warm yellow
        // Full charge: golden orange with subtle pulse
        let r, g, b;
        let chargeBoost = 1;
        
        if (this.isFullyCharged) {
            // Subtle pulsing gold/orange when fully charged
            const pulse = Math.sin(this.chargeGlowPulse) * 0.15 + 0.85;
            r = 1;
            g = 0.6 + pulse * 0.2;
            b = 0.1;
            chargeBoost = 1 + pulse * 0.15; // Much subtler boost
        } else if (this.chargeLevel > 0) {
            // Transition from cyan to yellow based on charge
            r = this.chargeLevel * 0.8;
            g = 0.8 + this.chargeLevel * 0.2;
            b = 1 - this.chargeLevel * 0.9;
            chargeBoost = 1 + this.chargeLevel * 0.15;
        } else {
            // Default soft cyan
            const boostRatio = Math.min(1, speed / maxSpeed);
            r = boostRatio * 0.3;
            g = 0.8;
            b = 1;
        }
        
        // Point light - subtle underglow
        this.boardGlow.color.setRGB(r, g, b);
        const baseIntensity = 0.8 + this.chargeLevel * 0.4;
        const speedBoost = speed * 2;
        this.boardGlow.intensity = (baseIntensity + speedBoost) * (0.3 + groundProximitySmooth * 0.7);
        this.boardGlow.distance = 3 + groundProximitySmooth * 3 + this.chargeLevel * 1;
        
        // Core glow sprite - tight to the board
        if (this.boardGlowSprite) {
            this.boardGlowSprite.material.color.setRGB(r, g, b);
            const coreOpacity = (0.15 + this.chargeLevel * 0.15) * (0.5 + groundProximitySmooth * 0.5);
            this.boardGlowSprite.material.opacity = Math.min(0.4, coreOpacity);
            const baseScale = 1.5 + this.chargeLevel * 0.5;
            this.boardGlowSprite.scale.set(baseScale, baseScale * 0.3, 1);
        }
        
        // Ambient glow - soft halo
        if (this.boardAmbientGlow) {
            this.boardAmbientGlow.material.color.setRGB(r, g, b);
            const ambientOpacity = (0.05 + this.chargeLevel * 0.08) * groundProximitySmooth;
            this.boardAmbientGlow.material.opacity = Math.min(0.2, ambientOpacity);
            const ambientScale = 2.5 + this.chargeLevel * 1;
            this.boardAmbientGlow.scale.set(ambientScale, ambientScale * 0.3, 1);
        }
        
        // Ground reflection - subtle
        if (this.groundReflection) {
            this.groundReflection.material.color.setRGB(r, g, b);
            this.groundReflection.material.opacity = (0.1 + this.chargeLevel * 0.1) * groundProximitySmooth;
            const reflectionScale = 2 + this.chargeLevel * 1;
            this.groundReflection.scale.set(reflectionScale, reflectionScale, 1);
            this.groundReflection.position.set(playerPosition.x, 0.05, playerPosition.z);
        }
    }

    updateTrailParticles(playerPosition, aimYaw, speed, maxSpeed) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const particle = this.trailParticles[i];
            
            // Initialize burst particle position
            if (particle.userData.needsInitialPosition) {
                const backOffset = new THREE.Vector3(
                    -Math.sin(aimYaw) * 0.8 + particle.userData.offsetX,
                    particle.userData.offsetY,
                    -Math.cos(aimYaw) * 0.8 + particle.userData.offsetZ
                );
                particle.position.copy(playerPosition).add(backOffset);
                
                // Set velocity relative to aim direction
                particle.userData.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15 - Math.sin(aimYaw) * 0.2,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.15 - Math.cos(aimYaw) * 0.2
                );
                particle.userData.needsInitialPosition = false;
            }
            
            particle.userData.life -= particle.userData.decay;
            
            // Move burst particles
            if (particle.userData.velocity) {
                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.multiplyScalar(0.95);
                
                // Apply gravity to sparks
                if (particle.userData.isSpark && particle.userData.gravity) {
                    particle.userData.velocity.y -= particle.userData.gravity;
                }
            }
            
            // Fade out
            const easedLife = particle.userData.life * particle.userData.life;
            particle.material.opacity = easedLife * particle.userData.baseOpacity;
            
            // Expand as it fades (sparks stay small)
            let expandFactor;
            if (particle.userData.isSpark) {
                expandFactor = 1 + (1 - particle.userData.life) * 0.5; // Minimal expansion for sparks
            } else if (particle.userData.isBurst) {
                expandFactor = 1 + (1 - particle.userData.life) * 3;
            } else {
                expandFactor = 1 + (1 - particle.userData.life) * 1.5;
            }
            const size = particle.userData.baseSize * expandFactor;
            particle.scale.set(size, size * (particle.userData.isSpark ? 1 : 0.6), 1);
            
            // Remove dead particles (return to pool)
            if (particle.userData.life <= 0) {
                this._returnParticleToPool(particle);
                this.trailParticles.splice(i, 1);
            }
        }
    }

    /**
     * Create trick trail effect (sparks during tricks)
     */
    createTrickTrail() {
        // Enhanced trail particles during tricks
        // This is handled by the existing trail particle system
        // Just ensure particles are more visible during tricks
    }

    /**
     * Create success effect when trick completes
     */
    createTrickSuccessEffect(data) {
        const successColors = [0x00ff00, 0x00ffff, 0x88ff00, 0xffffff];
        const glowTexture = this.createGlowTexture();
        
        // Create burst particles (limit to 6)
        for (let i = 0; i < 6; i++) {
            const color = successColors[Math.floor(Math.random() * successColors.length)];
            const particle = this._getParticleFromPool();
            
            // Configure particle
            particle.material.color.setHex(color);
            particle.material.opacity = 0.9;
            
            // Position around board
            const angle = (i / 6) * Math.PI * 2;
            particle.userData.offsetX = Math.cos(angle) * 0.6;
            particle.userData.offsetY = -0.1;
            particle.userData.offsetZ = Math.sin(angle) * 0.6;
            
            const size = 0.4 + Math.random() * 0.3;
            particle.scale.set(size, size, 1);
            
            // Burst outward
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * 0.1,
                0.05 + Math.random() * 0.05,
                Math.sin(angle) * 0.1
            );
            particle.userData.life = 1.0;
            particle.userData.decay = 0.03;
            particle.userData.baseOpacity = 0.9;
            particle.userData.baseSize = size;
            particle.userData.isBurst = true;
            particle.userData.isSpark = false;
            particle.userData.needsInitialPosition = true;
            
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }

    /**
     * Create combo effect for multiple tricks
     */
    createComboEffect(data) {
        const comboColors = [0xff00ff, 0x00ffff, 0xffff00, 0xff6600];
        const glowTexture = this.createGlowTexture();
        
        // Create larger burst for combos (limit to 8)
        for (let i = 0; i < 8; i++) {
            const color = comboColors[Math.floor(Math.random() * comboColors.length)];
            const particle = this._getParticleFromPool();
            
            // Configure particle
            particle.material.color.setHex(color);
            particle.material.opacity = 1.0;
            
            // Position around board
            const angle = (i / 8) * Math.PI * 2;
            particle.userData.offsetX = Math.cos(angle) * 0.8;
            particle.userData.offsetY = -0.1;
            particle.userData.offsetZ = Math.sin(angle) * 0.8;
            
            const size = 0.6 + Math.random() * 0.4;
            particle.scale.set(size, size, 1);
            
            // Stronger burst for combos
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * 0.15,
                0.1 + Math.random() * 0.1,
                Math.sin(angle) * 0.15
            );
            particle.userData.life = 1.0;
            particle.userData.decay = 0.025;
            particle.userData.baseOpacity = 1.0;
            particle.userData.baseSize = size;
            particle.userData.isBurst = true;
            particle.userData.isSpark = false;
            particle.userData.needsInitialPosition = true;
            
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }

    /**
     * Create fail effect when trick bails
     */
    createTrickFailEffect() {
        const failColors = [0xff0000, 0xff3300, 0xcc0000];
        const glowTexture = this.createGlowTexture();
        
        // Create small red sparks (limit to 4)
        for (let i = 0; i < 4; i++) {
            const color = failColors[Math.floor(Math.random() * failColors.length)];
            const particle = this._getParticleFromPool();
            
            // Configure particle
            particle.material.color.setHex(color);
            particle.material.opacity = 0.8;
            
            // Position around board
            const angle = (i / 4) * Math.PI * 2;
            particle.userData.offsetX = Math.cos(angle) * 0.4;
            particle.userData.offsetY = -0.1;
            particle.userData.offsetZ = Math.sin(angle) * 0.4;
            
            const size = 0.2 + Math.random() * 0.2;
            particle.scale.set(size, size, 1);
            
            // Small burst
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * 0.05,
                0.02,
                Math.sin(angle) * 0.05
            );
            particle.userData.life = 0.5; // Shorter life
            particle.userData.decay = 0.05;
            particle.userData.baseOpacity = 0.8;
            particle.userData.baseSize = size;
            particle.userData.isBurst = true;
            particle.userData.isSpark = false;
            particle.userData.needsInitialPosition = true;
            
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }
}
