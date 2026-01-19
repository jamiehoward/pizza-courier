// DialogueManager - Handles character dialogue and tutorial messages

import { Events } from '../core/EventBus.js';

// Dialogue data
const CHARACTERS = {
    RICO: {
        name: 'Rico',
        color: '#ff6b35',
        portrait: 'R', // Placeholder - would be image URL in production
    }
};

// Tutorial dialogue sequences
const TUTORIAL_DIALOGUE = {
    intro: [
        { character: 'RICO', text: "Hey kid! Welcome to Rico's Real Slice. You ready to make some deliveries?" },
        { character: 'RICO', text: "Use WASD to move around. Your hoverboard charges up as you ride - keep moving!" },
    ],
    firstDelivery: [
        { character: 'RICO', text: "Your first order's up! Grab that pizza and get it to the customer before it gets cold." },
        { character: 'RICO', text: "The minimap shows you where to go. Don't keep 'em waiting!" },
    ],
    chargeExplain: [
        { character: 'RICO', text: "See that charge bar? It fills up while you move. Get close to cars without hitting them for bonus charge!" },
        { character: 'RICO', text: "When it's full, press SHIFT to boost. If you jump at the same time, you'll FLY! But watch your flight meter." },
    ],
    deliveryComplete: [
        { character: 'RICO', text: "Nice work! Keep it up and you'll be the best courier in Neo Angeles." },
    ],
    deliveryFailed: [
        { character: 'RICO', text: "Customer's not happy... but hey, there's always the next order. Get back here!" },
    ]
};

// Random flavor dialogue
const FLAVOR_DIALOGUE = {
    pickup: [
        "Hot one coming through!",
        "Fresh out the oven. Don't drop it!",
        "This one's going across town. Good luck!",
        "VIP order here. Make it snappy!",
        "Another satisfied customer waiting. Go get 'em!",
    ],
    return: [
        "Back for more? I like your style.",
        "Rest up, next order's almost ready.",
        "You're getting faster. Keep it up!",
        "The streets are busy tonight. Stay sharp.",
        "Another successful run. Nice work, kid.",
    ]
};

export class DialogueManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // DOM elements
        this.container = null;
        this.portraitElement = null;
        this.nameElement = null;
        this.textElement = null;
        this.continueIndicator = null;
        
        // State
        this.isActive = false;
        this.currentQueue = [];
        this.currentIndex = 0;
        this.isTyping = false;
        this.typingSpeed = 30; // ms per character
        this.currentText = '';
        this.displayedText = '';
        this.typingTimeout = null;
        
        // Tutorial progress
        this.tutorialState = {
            introShown: false,
            chargeExplained: false,
            firstDeliveryStarted: false,
        };
        
        // Controller input tracking
        this.lastAButtonState = false;
        
        // Bind methods
        this._handleClick = this._handleClick.bind(this);
        this._handleKeyPress = this._handleKeyPress.bind(this);
        this._checkControllerInput = this._checkControllerInput.bind(this);
    }

    /**
     * Initialize the dialogue UI
     */
    init() {
        this._createUI();
        this._setupEventListeners();
    }

    /**
     * Create dialogue UI elements
     */
    _createUI() {
        // Main container
        this.container = document.createElement('div');
        this.container.id = 'dialogue-container';
        this.container.style.cssText = `
            position: absolute;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 800px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #ff6b35;
            border-radius: 10px;
            padding: 20px;
            display: none;
            z-index: 300;
            font-family: 'Courier New', monospace;
            box-shadow: 0 0 20px rgba(255, 107, 53, 0.3);
        `;
        
        // Portrait area
        this.portraitElement = document.createElement('div');
        this.portraitElement.style.cssText = `
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #ff6b35, #ff4500);
            border-radius: 50%;
            float: left;
            margin-right: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: bold;
            color: white;
            text-shadow: 0 0 10px rgba(0,0,0,0.5);
        `;
        
        // Text container
        const textContainer = document.createElement('div');
        textContainer.style.cssText = `
            overflow: hidden;
        `;
        
        // Name
        this.nameElement = document.createElement('div');
        this.nameElement.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #ff6b35;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 2px;
        `;
        
        // Text
        this.textElement = document.createElement('div');
        this.textElement.style.cssText = `
            font-size: 16px;
            color: #fff;
            line-height: 1.5;
            min-height: 48px;
        `;
        
        // Continue indicator
        this.continueIndicator = document.createElement('div');
        this.continueIndicator.style.cssText = `
            text-align: right;
            color: #888;
            font-size: 12px;
            margin-top: 10px;
            animation: blink 1s infinite;
        `;
        this.continueIndicator.textContent = 'Click or press SPACE to continue...';
        
        // Add blink animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.3; }
            }
        `;
        document.head.appendChild(style);
        
        // Assemble
        textContainer.appendChild(this.nameElement);
        textContainer.appendChild(this.textElement);
        this.container.appendChild(this.portraitElement);
        this.container.appendChild(textContainer);
        this.container.appendChild(this.continueIndicator);
        
        document.body.appendChild(this.container);
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        document.addEventListener('click', this._handleClick);
        document.addEventListener('keydown', this._handleKeyPress);
        
        // Listen for controller input to advance dialogue
        this.eventBus.on(Events.INPUT_DIALOGUE_ADVANCE, () => {
            if (this.isActive) {
                this._advanceDialogue();
            }
        });
        
        // Also check for A button held state during dialogue (in case we missed the press event)
        this.controllerCheckInterval = setInterval(this._checkControllerInput, 50); // Check every 50ms
        
        // Game events for tutorial triggers
        this.eventBus.on(Events.PIZZA_PICKUP, () => {
            if (!this.tutorialState.firstDeliveryStarted) {
                this.tutorialState.firstDeliveryStarted = true;
                // Small delay before showing dialogue
                setTimeout(() => this.showFlavor('pickup'), 500);
            } else {
                // Random pickup flavor text (quick)
                this.showQuickMessage(this._getRandomFlavor('pickup'));
            }
        });
        
        this.eventBus.on(Events.DELIVERY_COMPLETED, () => {
            if (!this.tutorialState.chargeExplained) {
                this.tutorialState.chargeExplained = true;
                setTimeout(() => this.showDialogue('chargeExplain'), 1500);
            } else {
                this.showQuickMessage(this._getRandomFlavor('return'));
            }
        });
        
        this.eventBus.on(Events.DELIVERY_FAILED, () => {
            this.showDialogue('deliveryFailed');
        });
    }

    /**
     * Handle click to advance dialogue
     */
    _handleClick(e) {
        if (!this.isActive) return;
        
        // Don't advance if clicking UI buttons
        if (e.target.closest('.editor-btn, #hud, #delivery-ui')) return;
        
        this._advanceDialogue();
    }

    /**
     * Handle key press to advance dialogue
     */
    _handleKeyPress(e) {
        if (!this.isActive) return;
        
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            this._advanceDialogue();
        }
    }

    /**
     * Advance to next dialogue or close
     */
    _advanceDialogue() {
        // If still typing, show all text immediately
        if (this.isTyping) {
            this._finishTyping();
            return;
        }
        
        // Move to next dialogue
        this.currentIndex++;
        if (this.currentIndex < this.currentQueue.length) {
            this._showCurrentDialogue();
        } else {
            this.hide();
        }
    }

    /**
     * Show a dialogue sequence
     */
    showDialogue(sequenceKey) {
        const sequence = TUTORIAL_DIALOGUE[sequenceKey];
        if (!sequence) {
            console.warn('Unknown dialogue sequence:', sequenceKey);
            return;
        }
        
        this.currentQueue = sequence;
        this.currentIndex = 0;
        this.isActive = true;
        this.container.style.display = 'block';
        
        // Pause game
        this.eventBus.emit('dialogue:start');
        
        this._showCurrentDialogue();
    }

    /**
     * Show flavor text (single message, quick)
     */
    showFlavor(type) {
        const text = this._getRandomFlavor(type);
        this.showDialogue('firstDelivery');
    }

    /**
     * Show quick message (no pause, auto-dismiss)
     */
    showQuickMessage(text, duration = 3000) {
        // Create temporary message
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: absolute;
            top: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #ff6b35;
            border-radius: 5px;
            padding: 10px 20px;
            color: #ff6b35;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 250;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        msg.textContent = `Rico: "${text}"`;
        document.body.appendChild(msg);
        
        // Fade in
        requestAnimationFrame(() => {
            msg.style.opacity = '1';
        });
        
        // Auto dismiss
        setTimeout(() => {
            msg.style.opacity = '0';
            setTimeout(() => msg.remove(), 300);
        }, duration);
    }

    /**
     * Get random flavor text
     */
    _getRandomFlavor(type) {
        const options = FLAVOR_DIALOGUE[type] || FLAVOR_DIALOGUE.pickup;
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Show the current dialogue in queue
     */
    _showCurrentDialogue() {
        const dialogue = this.currentQueue[this.currentIndex];
        const character = CHARACTERS[dialogue.character];
        
        // Update portrait
        this.portraitElement.textContent = character.portrait;
        this.portraitElement.style.background = `linear-gradient(135deg, ${character.color}, #ff4500)`;
        
        // Update name
        this.nameElement.textContent = character.name;
        this.nameElement.style.color = character.color;
        
        // Start typing effect
        this.currentText = dialogue.text;
        this.displayedText = '';
        this.isTyping = true;
        this.continueIndicator.style.opacity = '0';
        
        this._typeNextCharacter();
    }

    /**
     * Type next character
     */
    _typeNextCharacter() {
        if (this.displayedText.length < this.currentText.length) {
            this.displayedText = this.currentText.substring(0, this.displayedText.length + 1);
            this.textElement.textContent = this.displayedText;
            
            this.typingTimeout = setTimeout(() => this._typeNextCharacter(), this.typingSpeed);
        } else {
            this._finishTyping();
        }
    }

    /**
     * Finish typing immediately
     */
    _finishTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.displayedText = this.currentText;
        this.textElement.textContent = this.displayedText;
        this.isTyping = false;
        this.continueIndicator.style.opacity = '1';
    }

    /**
     * Show intro dialogue
     */
    showIntro() {
        if (!this.tutorialState.introShown) {
            this.tutorialState.introShown = true;
            this.showDialogue('intro');
        }
    }

    /**
     * Hide dialogue
     */
    hide() {
        this.container.style.display = 'none';
        this.isActive = false;
        this.currentQueue = [];
        this.currentIndex = 0;
        
        // Resume game
        this.eventBus.emit('dialogue:end');
    }

    /**
     * Check if dialogue is active
     */
    isDialogueActive() {
        return this.isActive;
    }

    /**
     * Check controller input for dialogue advancement
     */
    _checkControllerInput() {
        if (!this.isActive) {
            this.lastAButtonState = false;
            return;
        }

        // Check if A button is pressed on any connected gamepad
        const gamepads = navigator.getGamepads();
        let aButtonPressed = false;
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && gamepad.buttons && gamepad.buttons[0]) {
                if (gamepad.buttons[0].pressed) {
                    aButtonPressed = true;
                    break;
                }
            }
        }

        // If A button was just pressed (transition from not pressed to pressed)
        if (aButtonPressed && !this.lastAButtonState) {
            this._advanceDialogue();
        }
        
        this.lastAButtonState = aButtonPressed;
    }

    /**
     * Dispose
     */
    dispose() {
        document.removeEventListener('click', this._handleClick);
        document.removeEventListener('keydown', this._handleKeyPress);
        
        if (this.controllerCheckInterval) {
            clearInterval(this.controllerCheckInterval);
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
