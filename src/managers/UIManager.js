// UIManager - Handles HUD updates (speed, altitude, flight energy, delivery)

export class UIManager {
    constructor() {
        this.speedElement = null;
        this.altitudeElement = null;
        this.flyEnergyElement = null;
        
        // Delivery UI
        this.deliveryStatusElement = null;
        this.deliveryTimerElement = null;
        this.deliveryStatsElement = null;
        this.pickupPromptElement = null;
    }

    init() {
        this.speedElement = document.getElementById('speed');
        this.altitudeElement = document.getElementById('altitude');
        this.flyEnergyElement = document.getElementById('fly-energy');
        
        // Delivery UI
        this.deliveryStatusElement = document.getElementById('delivery-status');
        this.deliveryTimerElement = document.getElementById('delivery-timer');
        this.deliveryStatsElement = document.getElementById('delivery-stats');
        this.pickupPromptElement = document.getElementById('pickup-prompt');
    }

    /**
     * Update the HUD display
     * @param {Object} data - HUD data
     * @param {number} data.speed - Current speed
     * @param {number} data.altitude - Current altitude
     * @param {number} data.flyEnergyRatio - Flight energy (0-1)
     * @param {boolean} data.isFlying - Whether currently flying
     * @param {boolean} data.isGrounded - Whether on ground
     * @param {number} data.chargeLevel - Boost charge level (0-1)
     * @param {boolean} data.isCharged - Whether fully charged
     */
    update({ speed, altitude, flyEnergyRatio, isFlying, isGrounded, chargeLevel, isCharged }) {
        // Speed
        if (this.speedElement) {
            this.speedElement.textContent = `SPEED: ${(speed * 100).toFixed(1)}`;
        }

        // Altitude
        if (this.altitudeElement) {
            this.altitudeElement.textContent = `ALT: ${altitude.toFixed(1)}`;
        }

        // Charge and flight energy display
        if (this.flyEnergyElement) {
            // Charge bar (shows boost charge)
            const chargeBarLength = 10;
            const chargeFilledBars = Math.round((chargeLevel || 0) * chargeBarLength);
            const chargeEmptyBars = chargeBarLength - chargeFilledBars;
            const chargeBar = '█'.repeat(chargeFilledBars) + '░'.repeat(chargeEmptyBars);
            
            // Flight energy bar
            const flightBarLength = 10;
            const flightFilledBars = Math.round(flyEnergyRatio * flightBarLength);
            const flightEmptyBars = flightBarLength - flightFilledBars;
            const flightBar = '█'.repeat(flightFilledBars) + '░'.repeat(flightEmptyBars);
            
            // Status indicator
            let status = '';
            if (isFlying) {
                status = ' [FLYING]';
            } else if (isCharged) {
                status = ' [READY! SHIFT to BOOST]';
            } else if (!isGrounded) {
                status = ' [AIR]';
            }
            
            this.flyEnergyElement.textContent = `CHARGE: ${chargeBar} | FLIGHT: ${flightBar}${status}`;
        }
    }

    /**
     * Update delivery UI
     * @param {Object} deliveryState - Delivery state from DeliveryManager
     */
    updateDelivery(deliveryState) {
        const { hasActivePizza, timeRemaining, deliveriesCompleted, deliveriesFailed } = deliveryState;
        
        // Update status
        if (this.deliveryStatusElement) {
            if (hasActivePizza) {
                this.deliveryStatusElement.textContent = 'DELIVERING...';
                this.deliveryStatusElement.style.color = '#0f0';
            } else {
                this.deliveryStatusElement.textContent = 'AWAITING PICKUP';
                this.deliveryStatusElement.style.color = '#0ff';
            }
        }
        
        // Update timer
        if (this.deliveryTimerElement) {
            if (hasActivePizza) {
                this.deliveryTimerElement.style.display = 'block';
                this.deliveryTimerElement.textContent = Math.ceil(timeRemaining);
                
                // Color based on time remaining
                this.deliveryTimerElement.classList.remove('warning', 'critical');
                if (timeRemaining <= 5) {
                    this.deliveryTimerElement.classList.add('critical');
                } else if (timeRemaining <= 10) {
                    this.deliveryTimerElement.classList.add('warning');
                }
            } else {
                this.deliveryTimerElement.style.display = 'none';
            }
        }
        
        // Update stats
        if (this.deliveryStatsElement) {
            this.deliveryStatsElement.textContent = `DELIVERIES: ${deliveriesCompleted} | FAILED: ${deliveriesFailed}`;
        }
    }

    /**
     * Show/hide pickup prompt
     */
    showPickupPrompt(show) {
        if (this.pickupPromptElement) {
            this.pickupPromptElement.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Show delivery result message
     */
    showDeliveryResult(success, message) {
        // Create temporary popup
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 36px;
            font-weight: bold;
            color: ${success ? '#0f0' : '#f00'};
            text-shadow: 0 0 20px ${success ? '#0f0' : '#f00'};
            z-index: 200;
            pointer-events: none;
            animation: fadeOut 2s forwards;
        `;
        popup.textContent = message;
        
        // Add animation style
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                100% { opacity: 0; transform: translate(-50%, -80%) scale(0.8); }
            }
        `;
        popup.appendChild(style);
        
        document.body.appendChild(popup);
        
        // Remove after animation
        setTimeout(() => popup.remove(), 2000);
    }
}
