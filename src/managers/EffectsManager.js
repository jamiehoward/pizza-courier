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
        this.glowTexture = null;
        
        // Listen for events
        this.eventBus.on(Events.PLAYER_FLIGHT_START, () => this.createFlightBurst());
        this.eventBus.on(Events.CHARGE_FULL, () => this.createChargeBurst());
        this.eventBus.on(Events.CHARGE_BOOST_USED, () => this.createBoostBurst());
        this.eventBus.on(Events.NEAR_MISS, (data) => this.createNearMissSparks(data.position));
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
        
        // Create many small, fast-moving sparks
        for (let i = 0; i < 20; i++) {
            const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            const material = new THREE.SpriteMaterial({
                map: glowTexture,
                color: color,
                transparent: true,
                opacity: 1.0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const spark = new THREE.Sprite(material);
            
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
            spark.userData.gravity = 0.02; // Sparks fall with gravity
            
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
        
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const material = new THREE.SpriteMaterial({
                map: glowTexture,
                color: color,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const particle = new THREE.Sprite(material);
            
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
            const material = new THREE.SpriteMaterial({
                map: glowTexture,
                color: color,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const particle = new THREE.Sprite(material);
            
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
     * Create a trail particle
     * @param {THREE.Vector3} position - World position
     * @param {THREE.Color} color - Particle color
     */
    createTrailParticle(position, color) {
        const glowTexture = this.createGlowTexture();
        
        const material = new THREE.SpriteMaterial({
            map: glowTexture,
            color: color,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particle = new THREE.Sprite(material);
        particle.position.copy(position);
        const size = 0.8 + Math.random() * 0.4;
        particle.scale.set(size, size * 0.6, 1);
        particle.userData.life = 1.0;
        particle.userData.decay = 0.02 + Math.random() * 0.015;
        particle.userData.baseOpacity = 0.4;
        particle.userData.baseSize = size;
        
        this.scene.add(particle);
        this.trailParticles.push(particle);
        
        // Remove old particles
        while (this.trailParticles.length > EFFECTS.MAX_TRAIL_PARTICLES) {
            const old = this.trailParticles.shift();
            this.scene.remove(old);
            old.material.dispose();
        }
    }

    /**
     * Update all effects
     * @param {Object} data - Update data
     */
    update({ playerPosition, aimYaw, speed, maxSpeed, isGrounded, chargeLevel, isCharged }) {
        // Update charge state
        this.chargeLevel = chargeLevel || 0;
        this.isFullyCharged = isCharged || false;
        
        // Pulse effect when fully charged
        if (this.isFullyCharged) {
            this.chargeGlowPulse += 0.15;
        }
        
        this.updateBoardGlow(playerPosition, speed, maxSpeed);
        this.updateTrailParticles(playerPosition, aimYaw, speed, maxSpeed);
        
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
            
            // Remove dead particles
            if (particle.userData.life <= 0) {
                this.scene.remove(particle);
                particle.material.dispose();
                this.trailParticles.splice(i, 1);
            }
        }
    }
}
