// EconomyManager - Handles credits, progression, and end-of-run summary

import { Events } from '../core/EventBus.js';

export class EconomyManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // Credits
        this.totalCredits = 0;
        this.sessionCredits = 0;
        
        // Session stats
        this.sessionStats = {
            deliveriesCompleted: 0,
            deliveriesFailed: 0,
            totalTimePlayedMs: 0,
            fastestDelivery: null,
            longestCombo: 0,
            nearMisses: 0,
            distanceTraveled: 0,
            maxAltitude: 0,
            flightTimeTotal: 0,
            tricksCompleted: 0,
            tricksFailed: 0,
            trickScore: 0,
            bestCombo: 0,
            
            // Per delivery type
            byType: {
                STANDARD: { completed: 0, failed: 0, credits: 0 },
                RUSH: { completed: 0, failed: 0, credits: 0 },
                FRAGILE: { completed: 0, failed: 0, credits: 0 },
                HOT: { completed: 0, failed: 0, credits: 0 },
                VIP: { completed: 0, failed: 0, credits: 0 }
            }
        };
        
        // Summary UI
        this.summaryElement = null;
        
        // Setup event listeners
        this._setupEventListeners();
    }

    /**
     * Initialize the economy system
     */
    init() {
        this._createSummaryUI();
        this._loadSavedData();
    }

    /**
     * Load saved credits from localStorage
     */
    _loadSavedData() {
        try {
            const saved = localStorage.getItem('neonSlice_credits');
            if (saved) {
                this.totalCredits = parseInt(saved) || 0;
            }
        } catch (e) {
            console.warn('Could not load saved credits:', e);
        }
    }

    /**
     * Save credits to localStorage
     */
    _saveData() {
        try {
            localStorage.setItem('neonSlice_credits', this.totalCredits.toString());
        } catch (e) {
            console.warn('Could not save credits:', e);
        }
    }

    /**
     * Setup event listeners for tracking
     */
    _setupEventListeners() {
        // Delivery completed
        this.eventBus.on(Events.DELIVERY_COMPLETED, (data) => {
            const credits = data.creditsEarned || 0;
            this.totalCredits += credits;
            this.sessionCredits += credits;
            this.sessionStats.deliveriesCompleted++;
            
            // Track by type
            if (data.type && this.sessionStats.byType[data.type]) {
                this.sessionStats.byType[data.type].completed++;
                this.sessionStats.byType[data.type].credits += credits;
            }
            
            // Track fastest delivery
            const deliveryTime = data.timeRemaining ? (data.timeLimit - data.timeRemaining) : null;
            if (deliveryTime && (!this.sessionStats.fastestDelivery || deliveryTime < this.sessionStats.fastestDelivery)) {
                this.sessionStats.fastestDelivery = deliveryTime;
            }
            
            this._saveData();
        });
        
        // Delivery failed
        this.eventBus.on(Events.DELIVERY_FAILED, (data) => {
            this.sessionStats.deliveriesFailed++;
            
            if (data.type && this.sessionStats.byType[data.type]) {
                this.sessionStats.byType[data.type].failed++;
            }
        });
        
        // Near miss
        this.eventBus.on(Events.NEAR_MISS, () => {
            this.sessionStats.nearMisses++;
        });
        
        // Trick completed
        this.eventBus.on(Events.TRICK_COMPLETED, (data) => {
            this.sessionStats.tricksCompleted++;
            this.sessionStats.trickScore += data.score || 0;
            
            // Track best combo
            if (data.isCombo && data.tricks) {
                const comboCount = data.tricks.length;
                if (comboCount > this.sessionStats.bestCombo) {
                    this.sessionStats.bestCombo = comboCount;
                }
            }
            
            // Emit charge reward event (5% charge per trick)
            this.eventBus.emit(Events.TRICK_CHARGE_REWARD, { amount: 0.05 });
        });
        
        // Trick failed
        this.eventBus.on(Events.TRICK_FAILED, () => {
            this.sessionStats.tricksFailed++;
        });
        
        // Flight tracking
        this.eventBus.on(Events.PLAYER_FLIGHT_START, () => {
            this._flightStartTime = performance.now();
        });
        
        this.eventBus.on(Events.PLAYER_FLIGHT_END, () => {
            if (this._flightStartTime) {
                this.sessionStats.flightTimeTotal += (performance.now() - this._flightStartTime) / 1000;
                this._flightStartTime = null;
            }
        });
    }

    /**
     * Update session stats
     */
    update(deltaTime, playerData) {
        this.sessionStats.totalTimePlayedMs += deltaTime * 1000;
        
        if (playerData) {
            // Track max altitude
            if (playerData.altitude > this.sessionStats.maxAltitude) {
                this.sessionStats.maxAltitude = playerData.altitude;
            }
            
            // Track distance (approximation based on speed)
            this.sessionStats.distanceTraveled += playerData.speed * deltaTime;
        }
    }

    /**
     * Create the summary UI element
     */
    _createSummaryUI() {
        this.summaryElement = document.createElement('div');
        this.summaryElement.id = 'session-summary';
        this.summaryElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            max-height: 80vh;
            background: rgba(0, 0, 0, 0.95);
            border: 3px solid #ff6b35;
            border-radius: 15px;
            padding: 30px;
            display: none;
            z-index: 1000;
            font-family: 'Courier New', monospace;
            color: white;
            box-shadow: 0 0 50px rgba(255, 107, 53, 0.3);
            overflow-y: auto;
        `;
        
        document.body.appendChild(this.summaryElement);
    }

    /**
     * Show end-of-session summary
     */
    showSummary() {
        const stats = this.sessionStats;
        const timeMinutes = Math.floor(stats.totalTimePlayedMs / 60000);
        const timeSeconds = Math.floor((stats.totalTimePlayedMs % 60000) / 1000);
        
        // Calculate efficiency
        const totalDeliveries = stats.deliveriesCompleted + stats.deliveriesFailed;
        const efficiency = totalDeliveries > 0 
            ? Math.round((stats.deliveriesCompleted / totalDeliveries) * 100) 
            : 0;
        
        // Build summary HTML
        this.summaryElement.innerHTML = `
            <h2 style="
                text-align: center;
                color: #ff6b35;
                margin: 0 0 20px 0;
                font-size: 28px;
                text-transform: uppercase;
                letter-spacing: 3px;
                text-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
            ">Session Summary</h2>
            
            <div style="
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                padding: 15px;
                background: rgba(255, 107, 53, 0.1);
                border-radius: 10px;
            ">
                <div style="text-align: center;">
                    <div style="font-size: 36px; color: #ffdd00; font-weight: bold;">${this.sessionCredits}</div>
                    <div style="color: #888; font-size: 12px;">CREDITS EARNED</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 36px; color: #00ff00; font-weight: bold;">${stats.deliveriesCompleted}</div>
                    <div style="color: #888; font-size: 12px;">DELIVERIES</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 36px; color: #ff4444; font-weight: bold;">${stats.deliveriesFailed}</div>
                    <div style="color: #888; font-size: 12px;">FAILED</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="color: #ff6b35; font-weight: bold; margin-bottom: 10px;">DELIVERY BREAKDOWN</div>
                ${this._generateTypeBreakdown(stats.byType)}
            </div>
            
            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
            ">
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                    <span style="color: #888;">Time Played:</span>
                    <span style="float: right;">${timeMinutes}:${timeSeconds.toString().padStart(2, '0')}</span>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                    <span style="color: #888;">Efficiency:</span>
                    <span style="float: right; color: ${efficiency > 80 ? '#00ff00' : efficiency > 50 ? '#ffaa00' : '#ff4444'}">${efficiency}%</span>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                    <span style="color: #888;">Near Misses:</span>
                    <span style="float: right;">${stats.nearMisses}</span>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                    <span style="color: #888;">Max Altitude:</span>
                    <span style="float: right;">${stats.maxAltitude.toFixed(1)}m</span>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                    <span style="color: #888;">Flight Time:</span>
                    <span style="float: right;">${stats.flightTimeTotal.toFixed(1)}s</span>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px;">
                    <span style="color: #888;">Distance:</span>
                    <span style="float: right;">${(stats.distanceTraveled).toFixed(0)}m</span>
                </div>
            </div>
            
            <div style="
                text-align: center;
                padding: 15px;
                background: rgba(255, 221, 0, 0.1);
                border: 1px solid #ffdd00;
                border-radius: 10px;
                margin-bottom: 20px;
            ">
                <div style="color: #888; font-size: 12px;">TOTAL CREDITS</div>
                <div style="font-size: 32px; color: #ffdd00; font-weight: bold;">${this.totalCredits}</div>
            </div>
            
            <button id="summary-close" style="
                width: 100%;
                padding: 15px;
                font-size: 18px;
                font-family: 'Courier New', monospace;
                background: linear-gradient(135deg, #ff6b35, #ff4500);
                border: none;
                border-radius: 10px;
                color: white;
                cursor: pointer;
                text-transform: uppercase;
                letter-spacing: 2px;
                transition: transform 0.1s, box-shadow 0.1s;
            ">Continue</button>
        `;
        
        // Add close button handler
        const closeBtn = this.summaryElement.querySelector('#summary-close');
        closeBtn.addEventListener('click', () => this.hideSummary());
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.transform = 'scale(1.02)';
            closeBtn.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.5)';
        });
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.transform = 'scale(1)';
            closeBtn.style.boxShadow = 'none';
        });
        
        this.summaryElement.style.display = 'block';
        
        // Emit event
        this.eventBus.emit('summary:shown');
    }

    /**
     * Generate delivery type breakdown HTML
     */
    _generateTypeBreakdown(byType) {
        const typeColors = {
            STANDARD: '#00ff00',
            RUSH: '#ffaa00',
            FRAGILE: '#ff00ff',
            HOT: '#ff4444',
            VIP: '#ffdd00'
        };
        
        let html = '';
        for (const [type, data] of Object.entries(byType)) {
            if (data.completed > 0 || data.failed > 0) {
                html += `
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 5px 10px;
                        margin-bottom: 5px;
                        background: ${typeColors[type]}15;
                        border-left: 3px solid ${typeColors[type]};
                    ">
                        <span style="color: ${typeColors[type]}; font-weight: bold;">${type}</span>
                        <span>${data.completed}/${data.completed + data.failed} (+${data.credits})</span>
                    </div>
                `;
            }
        }
        
        return html || '<div style="color: #888; text-align: center;">No deliveries yet</div>';
    }

    /**
     * Hide summary
     */
    hideSummary() {
        this.summaryElement.style.display = 'none';
        this.eventBus.emit('summary:hidden');
    }

    /**
     * Check if summary is currently open
     */
    isSummaryOpen() {
        return this.summaryElement && this.summaryElement.style.display === 'block';
    }

    /**
     * Reset session stats (for new session)
     */
    resetSession() {
        this.sessionCredits = 0;
        this.sessionStats = {
            deliveriesCompleted: 0,
            deliveriesFailed: 0,
            totalTimePlayedMs: 0,
            fastestDelivery: null,
            longestCombo: 0,
            nearMisses: 0,
            distanceTraveled: 0,
            maxAltitude: 0,
            flightTimeTotal: 0,
            byType: {
                STANDARD: { completed: 0, failed: 0, credits: 0 },
                RUSH: { completed: 0, failed: 0, credits: 0 },
                FRAGILE: { completed: 0, failed: 0, credits: 0 },
                HOT: { completed: 0, failed: 0, credits: 0 },
                VIP: { completed: 0, failed: 0, credits: 0 }
            }
        };
    }

    /**
     * Get current credits
     */
    getCredits() {
        return this.totalCredits;
    }

    /**
     * Spend credits (for upgrades)
     * @returns {boolean} Whether purchase succeeded
     */
    spendCredits(amount) {
        if (this.totalCredits >= amount) {
            this.totalCredits -= amount;
            this._saveData();
            return true;
        }
        return false;
    }

    /**
     * Dispose
     */
    dispose() {
        if (this.summaryElement && this.summaryElement.parentNode) {
            this.summaryElement.parentNode.removeChild(this.summaryElement);
        }
    }
}
