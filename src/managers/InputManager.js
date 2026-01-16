// InputManager - Handles keyboard input state and emits events

import { KEYS } from '../constants.js';
import { Events } from '../core/EventBus.js';

export class InputManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.keys = {};
        
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
    }

    init() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    _onKeyDown(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = true;
        this.keys[e.key] = true; // For arrow keys (keep original case)
    }

    _onKeyUp(e) {
        const key = e.key.toLowerCase();
        
        // Emit jump event on space RELEASE (not press)
        if (e.key === ' ') {
            this.eventBus.emit(Events.INPUT_JUMP);
        }
        
        // Emit shop toggle on 'U' key
        if (key === 'u') {
            this.eventBus.emit(Events.INPUT_SHOP_TOGGLE);
        }
        
        // Emit summary on 'Tab' key
        if (e.key === 'Tab') {
            e.preventDefault();
            this.eventBus.emit(Events.INPUT_SUMMARY);
        }
        
        this.keys[key] = false;
        this.keys[e.key] = false;
    }

    /**
     * Check if a key is currently pressed
     * @param {string} key - Key to check
     * @returns {boolean}
     */
    isPressed(key) {
        return this.keys[key] === true;
    }

    /**
     * Get movement input as a normalized vector
     * @returns {{ x: number, z: number }}
     */
    getMovementInput() {
        let x = 0;
        let z = 0;

        if (this.isPressed(KEYS.FORWARD)) z = 1;
        if (this.isPressed(KEYS.BACKWARD)) z = -1;
        if (this.isPressed(KEYS.STRAFE_LEFT)) x = 1;
        if (this.isPressed(KEYS.STRAFE_RIGHT)) x = -1;

        // Normalize diagonal movement
        const length = Math.sqrt(x * x + z * z);
        if (length > 0) {
            x /= length;
            z /= length;
        }

        return { x, z };
    }

    /**
     * Get aim input
     * @returns {{ yaw: number, pitch: number }}
     */
    getAimInput() {
        let yaw = 0;
        let pitch = 0;

        if (this.isPressed(KEYS.AIM_LEFT)) yaw = 1;
        if (this.isPressed(KEYS.AIM_RIGHT)) yaw = -1;
        if (this.isPressed(KEYS.AIM_UP)) pitch = 1;
        if (this.isPressed(KEYS.AIM_DOWN)) pitch = -1;

        return { yaw, pitch };
    }

    /**
     * Check if spacebar is held
     * @returns {boolean}
     */
    isJumpHeld() {
        return this.isPressed(KEYS.JUMP_FLY);
    }

    /**
     * Check if descend key is held
     * @returns {boolean}
     */
    isDescendHeld() {
        return this.isPressed(KEYS.DESCEND);
    }

    /**
     * Check if forward is held (for momentum boost)
     * @returns {boolean}
     */
    isForwardHeld() {
        return this.isPressed(KEYS.FORWARD);
    }

    /**
     * Check if boost key (Shift) is held
     * @returns {boolean}
     */
    isBoostHeld() {
        return this.isPressed('shift');
    }
}
