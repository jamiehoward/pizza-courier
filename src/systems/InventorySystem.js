// InventorySystem - Manages pizza pickups and deliveries (placeholder for future)

import { Events } from '../core/EventBus.js';

export class InventorySystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.pizzas = [];
        this.deliveries = [];
        this.completedDeliveries = 0;
        
        // Listen for events
        this.eventBus.on(Events.PICKUP_PIZZA, (pizza) => this.addPizza(pizza));
        this.eventBus.on(Events.DELIVERY_COMPLETE, (order) => this.completeDelivery(order));
    }

    /**
     * Add a pizza to inventory
     * @param {Object} pizza - Pizza object
     */
    addPizza(pizza) {
        this.pizzas.push(pizza);
        console.log(`Pizza picked up! Total: ${this.pizzas.length}`);
    }

    /**
     * Get current pizza count
     * @returns {number}
     */
    getPizzaCount() {
        return this.pizzas.length;
    }

    /**
     * Add a delivery order
     * @param {Object} order - Delivery order
     */
    addDelivery(order) {
        this.deliveries.push(order);
    }

    /**
     * Complete a delivery
     * @param {Object} order - Completed order
     */
    completeDelivery(order) {
        const index = this.deliveries.indexOf(order);
        if (index > -1) {
            this.deliveries.splice(index, 1);
            this.completedDeliveries++;
            console.log(`Delivery complete! Total completed: ${this.completedDeliveries}`);
        }
        
        // Remove a pizza from inventory
        if (this.pizzas.length > 0) {
            this.pizzas.pop();
        }
    }

    /**
     * Get pending deliveries
     * @returns {Array}
     */
    getPendingDeliveries() {
        return this.deliveries;
    }

    /**
     * Get completed delivery count
     * @returns {number}
     */
    getCompletedCount() {
        return this.completedDeliveries;
    }
}
