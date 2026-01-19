// InputManager - Handles keyboard and gamepad input state and emits events

import { KEYS, CONTROLLER } from '../constants.js';
import { Events } from '../core/EventBus.js';

export class InputManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.keys = {};
        
        // Gamepad state
        this.gamepadIndex = null;
        this.useController = false;
        this.lastGamepadState = {
            buttons: [],
            axes: []
        };
        this.currentGamepadState = {
            buttons: [],
            axes: []
        };
        
        // Double-tap detection for A button
        this.lastATapTime = 0;
        this.doubleTapWindow = 300; // ms window for double-tap
        this.wasDoubleTap = false; // Flag to track if current press was a double-tap
        
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onGamepadConnected = this._onGamepadConnected.bind(this);
        this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
    }

    init() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        
        // Gamepad event listeners
        window.addEventListener('gamepadconnected', this._onGamepadConnected);
        window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
        
        // Initial gamepad detection
        this._detectGamepad();
    }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('gamepadconnected', this._onGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
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
        
        // Emit board reset on 'R' key
        if (key === 'r') {
            this.eventBus.emit(Events.INPUT_RESET_BOARD);
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
        // Check controller first
        if (this.useController) {
            const stick = this._getLeftStick();
            if (stick.x !== 0 || stick.z !== 0) {
                return stick;
            }
        }

        // Fallback to keyboard
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
        // Check controller first
        if (this.useController) {
            const stick = this._getRightStick();
            if (stick.yaw !== 0 || stick.pitch !== 0) {
                return stick;
            }
        }

        // Fallback to keyboard
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
        // Check controller first
        if (this.useController) {
            return this._isButtonPressed(0); // A button
        }
        // Fallback to keyboard
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
        // Check controller first
        if (this.useController) {
            const stick = this._getLeftStick();
            return stick.z > 0.1; // Forward on left stick
        }
        // Fallback to keyboard
        return this.isPressed(KEYS.FORWARD);
    }

    /**
     * Check if boost key (Shift) is held
     * Note: For controller, speed boost is now on B button release, not held
     * @returns {boolean}
     */
    isBoostHeld() {
        // Controller speed boost is now handled via INPUT_SPEED_BOOST event on B button release
        // Fallback to keyboard (Shift key)
        return this.isPressed('shift');
    }

    /**
     * Update gamepad state (called every frame)
     */
    update() {
        if (this.useController) {
            this._pollGamepad();
        }
    }

    /**
     * Detect and connect to a gamepad
     */
    _detectGamepad() {
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                // Check if it's an Xbox controller (by mapping string)
                const isXbox = gamepad.mapping === 'standard' || 
                              gamepad.id.toLowerCase().includes('xbox') ||
                              gamepad.id.toLowerCase().includes('microsoft');
                
                if (isXbox || gamepad.mapping === 'standard') {
                    this.gamepadIndex = i;
                    this.useController = true;
                    console.log('Xbox controller connected:', gamepad.id);
                    return;
                }
            }
        }
        
        // No controller found
        this.gamepadIndex = null;
        this.useController = false;
    }

    /**
     * Handle gamepad connection
     */
    _onGamepadConnected(e) {
        console.log('Gamepad connected:', e.gamepad.id);
        this._detectGamepad();
    }

    /**
     * Handle gamepad disconnection
     */
    _onGamepadDisconnected(e) {
        console.log('Gamepad disconnected:', e.gamepad.id);
        if (this.gamepadIndex === e.gamepad.index) {
            this.gamepadIndex = null;
            this.useController = false;
        }
    }

    /**
     * Get current gamepad object
     */
    _getGamepad() {
        if (this.gamepadIndex === null) return null;
        const gamepads = navigator.getGamepads();
        return gamepads[this.gamepadIndex] || null;
    }

    /**
     * Poll gamepad state and store previous state for button release detection
     */
    _pollGamepad() {
        const gamepad = this._getGamepad();
        if (!gamepad) {
            this.useController = false;
            this.gamepadIndex = null;
            return;
        }

        // Store previous state
        this.lastGamepadState = {
            buttons: this.currentGamepadState.buttons.map(b => b),
            axes: this.currentGamepadState.axes.map(a => a)
        };

        // Update current state
        this.currentGamepadState = {
            buttons: Array.from(gamepad.buttons).map(b => ({
                pressed: b.pressed,
                value: b.value
            })),
            axes: Array.from(gamepad.axes)
        };

        // Check for A button press (for dialogue, jump/flight) and release (for jump)
        if (!this.lastGamepadState.buttons[0]?.pressed && 
            this.currentGamepadState.buttons[0]?.pressed) {
            // A button just pressed
            const currentTime = Date.now();
            const timeSinceLastTap = currentTime - this.lastATapTime;
            
            // Reset double-tap flag
            this.wasDoubleTap = false;
            
            // Check for double-tap on press
            if (timeSinceLastTap < this.doubleTapWindow && this.lastATapTime > 0) {
                // Double-tap detected - emit flight
                this.eventBus.emit(Events.INPUT_FLIGHT);
                this.wasDoubleTap = true; // Mark as double-tap so we don't emit jump on release
                this.lastATapTime = 0; // Reset to prevent triple-tap
            } else {
                // Single tap - emit dialogue advance (will also emit jump on release)
                this.eventBus.emit(Events.INPUT_DIALOGUE_ADVANCE);
                this.lastATapTime = currentTime;
            }
        }
        
        if (this.lastGamepadState.buttons[0] && 
            this.lastGamepadState.buttons[0].pressed && 
            !this.currentGamepadState.buttons[0].pressed) {
            // A button was just released - emit jump (only if not a double-tap)
            if (!this.wasDoubleTap) {
                this.eventBus.emit(Events.INPUT_JUMP);
            }
            // Reset flag for next press
            this.wasDoubleTap = false;
        }

        // Check for B button release (for speed boost and menu exit)
        if (this.lastGamepadState.buttons[1] && 
            this.lastGamepadState.buttons[1].pressed && 
            !this.currentGamepadState.buttons[1]?.pressed) {
            // B button was just released - emit speed boost
            this.eventBus.emit(Events.INPUT_SPEED_BOOST);
            // Also emit menu exit (will be handled by GameManager if menu is open)
            this.eventBus.emit(Events.INPUT_MENU_EXIT);
        }

        // Check for Back button press (menu navigation)
        if (!this.lastGamepadState.buttons[8]?.pressed && 
            this.currentGamepadState.buttons[8]?.pressed) {
            // Back button just pressed - emit menu navigate
            this.eventBus.emit(Events.INPUT_MENU_NAVIGATE);
        }

        // Check for Right Stick click (button 9) for board reset
        if (!this.lastGamepadState.buttons[9]?.pressed && 
            this.currentGamepadState.buttons[9]?.pressed) {
            // Right Stick click just pressed - emit board reset
            this.eventBus.emit(Events.INPUT_RESET_BOARD);
        }
    }

    /**
     * Apply deadzone to analog input
     */
    _applyDeadzone(value, deadzone) {
        const absValue = Math.abs(value);
        if (absValue < deadzone) {
            return 0;
        }
        // Normalize remaining range (deadzone to 1.0 maps to 0.0 to 1.0)
        const sign = value >= 0 ? 1 : -1;
        const normalized = (absValue - deadzone) / (1 - deadzone);
        return sign * normalized;
    }

    /**
     * Get left stick input (movement)
     */
    _getLeftStick() {
        const gamepad = this._getGamepad();
        if (!gamepad || !gamepad.axes) return { x: 0, z: 0 };

        const stickX = this._applyDeadzone(-(gamepad.axes[0] || 0), CONTROLLER.DEADZONE_LEFT); // Invert X for correct left/right
        const stickY = this._applyDeadzone(-(gamepad.axes[1] || 0), CONTROLLER.DEADZONE_LEFT); // Invert Y

        return { x: stickX, z: stickY };
    }

    /**
     * Get right stick input (aim)
     */
    _getRightStick() {
        const gamepad = this._getGamepad();
        if (!gamepad || !gamepad.axes) return { yaw: 0, pitch: 0 };

        const stickX = this._applyDeadzone(-(gamepad.axes[2] || 0), CONTROLLER.DEADZONE_RIGHT); // Invert X for correct left/right
        const stickY = this._applyDeadzone(-(gamepad.axes[3] || 0), CONTROLLER.DEADZONE_RIGHT); // Invert Y

        return { yaw: stickX, pitch: stickY };
    }

    /**
     * Check if button is currently pressed
     */
    _isButtonPressed(buttonIndex) {
        const gamepad = this._getGamepad();
        if (!gamepad || !gamepad.buttons[buttonIndex]) return false;
        return gamepad.buttons[buttonIndex].pressed;
    }

    /**
     * Get trick input state
     * @returns {{ spinLeft: boolean, spinRight: boolean, flipForward: boolean, flipBack: boolean, stickDirection: {x: number, z: number} }}
     */
    getTrickInput() {
        const movementInput = this.getMovementInput();
        
        // Check controller first
        if (this.useController) {
            // X button (button 2) for spin, Y button (button 3) for flip
            const gamepad = this._getGamepad();
            const xPressed = gamepad && gamepad.buttons[2]?.pressed;
            const yPressed = gamepad && gamepad.buttons[3]?.pressed;
            
            if (!xPressed && !yPressed) {
                // No trick buttons pressed
                return {
                    spinLeft: false,
                    spinRight: false,
                    flipForward: false,
                    flipBack: false,
                    stickDirection: movementInput
                };
            }
            
            // Determine direction from left stick
            // Left stick X: negative = left, positive = right (after our inversion)
            // Left stick Z: negative = forward, positive = back (after our inversion)
            let spinLeft = false;
            let spinRight = false;
            let flipForward = false;
            let flipBack = false;
            
            if (xPressed) {
                // Spin direction based on stick X
                if (movementInput.x < -0.1) {
                    spinLeft = true;
                } else if (movementInput.x > 0.1) {
                    spinRight = true;
                } else {
                    // Default to right if stick is neutral
                    spinRight = true;
                }
            }
            
            if (yPressed) {
                // Flip direction based on stick Z
                if (movementInput.z < -0.1) {
                    flipForward = true;
                } else if (movementInput.z > 0.1) {
                    flipBack = true;
                } else {
                    // Default to forward if stick is neutral
                    flipForward = true;
                }
            }
            
            return {
                spinLeft,
                spinRight,
                flipForward,
                flipBack,
                stickDirection: movementInput
            };
        }
        
        // Fallback to keyboard
        return {
            spinLeft: this.isPressed('q'),
            spinRight: this.isPressed('e'),
            flipForward: this.isPressed('r'),
            flipBack: this.isPressed('f'),
            stickDirection: movementInput
        };
    }
}
