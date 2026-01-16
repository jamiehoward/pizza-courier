// AudioManager - Handles all game audio: board sounds, ambiance, music, and UI

import { Events } from '../core/EventBus.js';

// Audio configuration
const AUDIO_CONFIG = {
    MASTER_VOLUME: 0.7,
    SFX_VOLUME: 0.8,
    MUSIC_VOLUME: 0.5,
    AMBIANCE_VOLUME: 0.4,
    
    // Engine sound
    ENGINE_MIN_PITCH: 0.8,
    ENGINE_MAX_PITCH: 1.5,
    ENGINE_MIN_VOLUME: 0.1,
    ENGINE_MAX_VOLUME: 0.4,
    
    // Wind sound
    WIND_MIN_VOLUME: 0,
    WIND_MAX_VOLUME: 0.5,
    WIND_SPEED_THRESHOLD: 0.1,
};

export class AudioManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.audioContext = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.ambianceGain = null;
        
        // Continuous sounds
        this.engineOscillator = null;
        this.engineGain = null;
        this.windNoise = null;
        this.windGain = null;
        this.ambianceSource = null;
        
        // Music
        this.currentMusic = null;
        this.musicIntensity = 0; // 0-1, affects music layering
        
        // Sound pools for frequently played sounds
        this.soundBuffers = new Map();
        this.activeSounds = [];
        
        // State
        this.isInitialized = false;
        this.isMuted = false;
        this.currentSpeed = 0;
        this.isFlying = false;
    }

    /**
     * Initialize the audio system (must be called after user interaction)
     */
    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes for mixing
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = AUDIO_CONFIG.MASTER_VOLUME;
            this.masterGain.connect(this.audioContext.destination);
            
            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.gain.value = AUDIO_CONFIG.SFX_VOLUME;
            this.sfxGain.connect(this.masterGain);
            
            this.musicGain = this.audioContext.createGain();
            this.musicGain.gain.value = AUDIO_CONFIG.MUSIC_VOLUME;
            this.musicGain.connect(this.masterGain);
            
            this.ambianceGain = this.audioContext.createGain();
            this.ambianceGain.gain.value = AUDIO_CONFIG.AMBIANCE_VOLUME;
            this.ambianceGain.connect(this.masterGain);
            
            // Create continuous sounds
            this._createEngineSound();
            this._createWindSound();
            this._createCityAmbiance();
            
            // Setup event listeners
            this._setupEventListeners();
            
            this.isInitialized = true;
            console.log('AudioManager initialized');
            
        } catch (error) {
            console.warn('AudioManager failed to initialize:', error);
        }
    }

    /**
     * Create the hoverboard engine hum
     */
    _createEngineSound() {
        // Main oscillator for engine tone
        this.engineOscillator = this.audioContext.createOscillator();
        this.engineOscillator.type = 'sawtooth';
        this.engineOscillator.frequency.value = 80;
        
        // Secondary oscillator for richness
        const engineOsc2 = this.audioContext.createOscillator();
        engineOsc2.type = 'sine';
        engineOsc2.frequency.value = 120;
        
        // Gain control
        this.engineGain = this.audioContext.createGain();
        this.engineGain.gain.value = AUDIO_CONFIG.ENGINE_MIN_VOLUME;
        
        // Low-pass filter for smoother sound
        const engineFilter = this.audioContext.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 400;
        engineFilter.Q.value = 1;
        
        // Connect
        this.engineOscillator.connect(engineFilter);
        engineOsc2.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);
        
        // Start
        this.engineOscillator.start();
        engineOsc2.start();
    }

    /**
     * Create wind rush sound using filtered noise
     */
    _createWindSound() {
        // Create noise buffer
        const bufferSize = this.audioContext.sampleRate * 2;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        // Create noise source
        this.windNoise = this.audioContext.createBufferSource();
        this.windNoise.buffer = noiseBuffer;
        this.windNoise.loop = true;
        
        // Bandpass filter for wind character
        const windFilter = this.audioContext.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 800;
        windFilter.Q.value = 0.5;
        
        // Gain control
        this.windGain = this.audioContext.createGain();
        this.windGain.gain.value = 0;
        
        // Connect
        this.windNoise.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.sfxGain);
        
        // Start
        this.windNoise.start();
    }

    /**
     * Create city ambiance layers
     */
    _createCityAmbiance() {
        // Low rumble (traffic)
        const trafficOsc = this.audioContext.createOscillator();
        trafficOsc.type = 'sine';
        trafficOsc.frequency.value = 40;
        
        const trafficGain = this.audioContext.createGain();
        trafficGain.gain.value = 0.1;
        
        // Modulate for variation
        const trafficLfo = this.audioContext.createOscillator();
        trafficLfo.frequency.value = 0.1;
        const trafficLfoGain = this.audioContext.createGain();
        trafficLfoGain.gain.value = 0.05;
        
        trafficLfo.connect(trafficLfoGain);
        trafficLfoGain.connect(trafficGain.gain);
        
        trafficOsc.connect(trafficGain);
        trafficGain.connect(this.ambianceGain);
        
        trafficOsc.start();
        trafficLfo.start();
    }

    /**
     * Setup event listeners for game events
     */
    _setupEventListeners() {
        // Boost used
        this.eventBus.on(Events.CHARGE_BOOST_USED, () => {
            this.playBoostSound();
        });
        
        // Flight start
        this.eventBus.on(Events.PLAYER_FLIGHT_START, () => {
            this.isFlying = true;
            this.playFlightActivation();
        });
        
        // Flight end
        this.eventBus.on(Events.PLAYER_FLIGHT_END, () => {
            this.isFlying = false;
        });
        
        // Landing
        this.eventBus.on(Events.PLAYER_GROUNDED, () => {
            this.playLandingSound(0.3);
        });
        
        // Heavy landing
        this.eventBus.on(Events.PLAYER_LAND_IMPACT, (data) => {
            this.playLandingSound(data?.impactStrength || 0.5);
        });
        
        // Near miss
        this.eventBus.on(Events.NEAR_MISS, () => {
            this.playNearMissSound();
        });
        
        // Charge full
        this.eventBus.on(Events.CHARGE_FULL, () => {
            this.playChargeFullSound();
        });
        
        // Delivery events
        this.eventBus.on(Events.PIZZA_PICKUP, () => {
            this.playPickupSound();
        });
        
        this.eventBus.on(Events.DELIVERY_COMPLETED, () => {
            this.playDeliverySuccessSound();
        });
        
        this.eventBus.on(Events.DELIVERY_FAILED, () => {
            this.playDeliveryFailSound();
        });
    }

    /**
     * Play boost whoosh sound
     */
    playBoostSound() {
        if (!this.isInitialized) return;
        
        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.5);
    }

    /**
     * Play flight activation burst
     */
    playFlightActivation() {
        if (!this.isInitialized) return;
        
        // Rising tone
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.3);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.4);
        
        // Burst noise
        this._playNoiseHit(0.2, 0.15, 2000);
    }

    /**
     * Play landing impact sound
     */
    playLandingSound(intensity = 0.5) {
        if (!this.isInitialized) return;
        
        // Thud
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80 * intensity + 40, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + 0.2);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3 * intensity, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
    }

    /**
     * Play near-miss electric crackle
     */
    playNearMissSound() {
        if (!this.isInitialized) return;
        
        // Electric zap
        const osc = this.audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        const distortion = this.audioContext.createWaveShaper();
        distortion.curve = this._makeDistortionCurve(50);
        
        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);
        
        // Add some noise crackle
        this._playNoiseHit(0.1, 0.1, 4000);
    }

    /**
     * Play charge full notification
     */
    playChargeFullSound() {
        if (!this.isInitialized) return;
        
        // Ascending arpeggio
        const notes = [400, 500, 600, 800];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const gain = this.audioContext.createGain();
            const startTime = this.audioContext.currentTime + i * 0.05;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.2);
        });
    }

    /**
     * Play pickup chime
     */
    playPickupSound() {
        if (!this.isInitialized) return;
        
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
        osc.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.1); // E5
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    }

    /**
     * Play delivery success fanfare
     */
    playDeliverySuccessSound() {
        if (!this.isInitialized) return;
        
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const gain = this.audioContext.createGain();
            const startTime = this.audioContext.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    /**
     * Play delivery fail sound
     */
    playDeliveryFailSound() {
        if (!this.isInitialized) return;
        
        // Descending sad tones
        const notes = [400, 350, 300];
        notes.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const gain = this.audioContext.createGain();
            const startTime = this.audioContext.currentTime + i * 0.15;
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            
            osc.connect(gain);
            gain.connect(this.sfxGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    /**
     * Play timer warning beep
     */
    playTimerWarning() {
        if (!this.isInitialized) return;
        
        const osc = this.audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 880;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gain.gain.setValueAtTime(0, this.audioContext.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(this.sfxGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);
    }

    /**
     * Helper: Play a noise hit
     */
    _playNoiseHit(volume, duration, filterFreq) {
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = filterFreq;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        
        source.start();
    }

    /**
     * Helper: Create distortion curve
     */
    _makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        
        return curve;
    }

    /**
     * Update continuous sounds based on game state
     */
    update(speed, maxSpeed, isGrounded, altitude) {
        if (!this.isInitialized) return;
        
        this.currentSpeed = speed;
        const speedRatio = Math.min(1, speed / maxSpeed);
        
        // Update engine pitch and volume
        if (this.engineOscillator && this.engineGain) {
            const targetPitch = AUDIO_CONFIG.ENGINE_MIN_PITCH + 
                speedRatio * (AUDIO_CONFIG.ENGINE_MAX_PITCH - AUDIO_CONFIG.ENGINE_MIN_PITCH);
            const targetVolume = AUDIO_CONFIG.ENGINE_MIN_VOLUME + 
                speedRatio * (AUDIO_CONFIG.ENGINE_MAX_VOLUME - AUDIO_CONFIG.ENGINE_MIN_VOLUME);
            
            // Flight increases pitch
            const flightMod = this.isFlying ? 1.3 : 1;
            
            this.engineOscillator.frequency.setTargetAtTime(
                80 * targetPitch * flightMod, 
                this.audioContext.currentTime, 
                0.1
            );
            this.engineGain.gain.setTargetAtTime(
                targetVolume, 
                this.audioContext.currentTime, 
                0.1
            );
        }
        
        // Update wind volume based on speed
        if (this.windGain) {
            const windVolume = speedRatio > AUDIO_CONFIG.WIND_SPEED_THRESHOLD
                ? AUDIO_CONFIG.WIND_MIN_VOLUME + speedRatio * (AUDIO_CONFIG.WIND_MAX_VOLUME - AUDIO_CONFIG.WIND_MIN_VOLUME)
                : 0;
            
            // Altitude increases wind
            const altitudeMod = Math.min(1.5, 1 + altitude / 50);
            
            this.windGain.gain.setTargetAtTime(
                windVolume * altitudeMod, 
                this.audioContext.currentTime, 
                0.2
            );
        }
    }

    /**
     * Set master volume
     */
    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.1);
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.setMasterVolume(this.isMuted ? 0 : AUDIO_CONFIG.MASTER_VOLUME);
    }

    /**
     * Resume audio context (required after user interaction)
     */
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Dispose of audio resources
     */
    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
