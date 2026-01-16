// UIManager - Handles HUD updates (speed, altitude, flight energy, delivery)

// Delivery type colors
const DELIVERY_TYPE_COLORS = {
    STANDARD: '#00ff00',
    RUSH: '#ffaa00',
    FRAGILE: '#ff00ff',
    HOT: '#ff4444',
    VIP: '#ffdd00'
};

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
        this.deliveryTypeElement = null;
        this.deliveryCreditsElement = null;
        this.pizzaTempElement = null;
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
        
        // Create delivery type display
        this._createDeliveryTypeUI();
    }

    /**
     * Create additional delivery type UI elements
     */
    _createDeliveryTypeUI() {
        const deliveryUI = document.getElementById('delivery-ui');
        if (!deliveryUI) return;
        
        // Delivery type badge
        this.deliveryTypeElement = document.createElement('div');
        this.deliveryTypeElement.id = 'delivery-type';
        this.deliveryTypeElement.style.cssText = `
            display: none;
            font-size: 14px;
            font-weight: bold;
            padding: 4px 10px;
            border-radius: 4px;
            margin-bottom: 5px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 2px;
        `;
        deliveryUI.insertBefore(this.deliveryTypeElement, deliveryUI.firstChild);
        
        // Credits display
        this.deliveryCreditsElement = document.createElement('div');
        this.deliveryCreditsElement.id = 'delivery-credits';
        this.deliveryCreditsElement.style.cssText = `
            font-size: 12px;
            color: #ffdd00;
            margin-top: 5px;
        `;
        deliveryUI.appendChild(this.deliveryCreditsElement);
        
        // Pizza temperature bar (for HOT deliveries)
        this.pizzaTempElement = document.createElement('div');
        this.pizzaTempElement.id = 'pizza-temp';
        this.pizzaTempElement.style.cssText = `
            display: none;
            font-size: 12px;
            margin-top: 5px;
        `;
        deliveryUI.appendChild(this.pizzaTempElement);
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
        const { 
            hasActivePizza, 
            timeRemaining, 
            deliveriesCompleted, 
            deliveriesFailed,
            deliveryType,
            deliveryTypeName,
            deliveryDescription,
            rewardMultiplier,
            pizzaTemperature,
            isHotDelivery,
            totalCredits
        } = deliveryState;
        
        // Update delivery type badge
        if (this.deliveryTypeElement) {
            if (hasActivePizza && deliveryType) {
                const color = DELIVERY_TYPE_COLORS[deliveryType] || '#00ff00';
                this.deliveryTypeElement.style.display = 'block';
                this.deliveryTypeElement.style.backgroundColor = color + '33';
                this.deliveryTypeElement.style.border = `2px solid ${color}`;
                this.deliveryTypeElement.style.color = color;
                this.deliveryTypeElement.innerHTML = `${deliveryTypeName} <span style="font-size:10px">(${rewardMultiplier}x)</span>`;
            } else {
                this.deliveryTypeElement.style.display = 'none';
            }
        }
        
        // Update status
        if (this.deliveryStatusElement) {
            if (hasActivePizza) {
                const statusText = deliveryDescription || 'DELIVERING...';
                this.deliveryStatusElement.textContent = statusText;
                this.deliveryStatusElement.style.color = DELIVERY_TYPE_COLORS[deliveryType] || '#0f0';
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
        
        // Update pizza temperature for HOT deliveries
        if (this.pizzaTempElement) {
            if (hasActivePizza && isHotDelivery) {
                this.pizzaTempElement.style.display = 'block';
                const tempBarLength = 10;
                const filledBars = Math.round((pizzaTemperature / 100) * tempBarLength);
                const emptyBars = tempBarLength - filledBars;
                const tempBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
                
                // Color based on temperature
                let tempColor = '#ff4444';
                if (pizzaTemperature > 60) tempColor = '#ffaa00';
                if (pizzaTemperature > 80) tempColor = '#00ff00';
                
                this.pizzaTempElement.innerHTML = `TEMP: <span style="color:${tempColor}">${tempBar}</span> ${Math.round(pizzaTemperature)}°`;
            } else {
                this.pizzaTempElement.style.display = 'none';
            }
        }
        
        // Update stats and credits
        if (this.deliveryStatsElement) {
            this.deliveryStatsElement.textContent = `DELIVERIES: ${deliveriesCompleted} | FAILED: ${deliveriesFailed}`;
        }
        
        if (this.deliveryCreditsElement) {
            this.deliveryCreditsElement.textContent = `CREDITS: ${totalCredits || 0}`;
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
