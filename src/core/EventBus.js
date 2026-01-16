// EventBus - Pub/sub system for decoupled communication between game systems

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to handlers
     */
    emit(event, ...args) {
        if (!this.listeners.has(event)) return;
        
        for (const callback of this.listeners.get(event)) {
            callback(...args);
        }
    }

    /**
     * Remove all listeners for an event (or all events)
     * @param {string} [event] - Event name (optional)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Event names as constants to avoid typos
export const Events = {
    // Input events
    INPUT_JUMP: 'input:jump',
    INPUT_SHOP_TOGGLE: 'input:shop:toggle',
    INPUT_SUMMARY: 'input:summary',
    INPUT_MOVE: 'input:move',
    
    // Player events
    PLAYER_GROUNDED: 'player:grounded',
    PLAYER_AIRBORNE: 'player:airborne',
    PLAYER_FLIGHT_START: 'player:flight:start',
    PLAYER_FLIGHT_END: 'player:flight:end',
    PLAYER_POSE_CHANGE: 'player:pose:change',
    PLAYER_LAND_IMPACT: 'player:land:impact', // Heavy landing from fall
    
    // Charge/boost events
    CHARGE_FULL: 'charge:full',
    CHARGE_THRESHOLD: 'charge:threshold',
    CHARGE_BOOST_USED: 'charge:boost:used',
    NEAR_MISS: 'near:miss',
    
    // Game events
    GAME_READY: 'game:ready',
    GAME_UPDATE: 'game:update',
    
    // Delivery events
    DELIVERY_STARTED: 'delivery:started',
    DELIVERY_COMPLETED: 'delivery:completed',
    DELIVERY_FAILED: 'delivery:failed',
    DELIVERY_WARNING: 'delivery:warning',
    PIZZA_PICKUP: 'pizza:pickup',
    
    // Collision events
    PLAYER_COLLISION: 'player:collision',
    
    // Upgrade events
    UPGRADE_PURCHASED: 'upgrade:purchased'
};
