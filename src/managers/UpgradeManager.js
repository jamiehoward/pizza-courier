// UpgradeManager - Handles board upgrades and Rico's shop

import { Events } from '../core/EventBus.js';

// Upgrade definitions
const UPGRADES = {
    // Capacitor - affects flight duration
    CAPACITOR: {
        name: 'Capacitor',
        description: 'Increases maximum flight time',
        icon: '⚡',
        maxTier: 5,
        effects: [
            { tier: 1, value: 3.5, cost: 200, description: '+0.5s flight time' },
            { tier: 2, value: 4.0, cost: 400, description: '+1s flight time' },
            { tier: 3, value: 5.0, cost: 800, description: '+2s flight time' },
            { tier: 4, value: 6.5, cost: 1500, description: '+3.5s flight time' },
            { tier: 5, value: 8.0, cost: 3000, description: '+5s flight time' }
        ],
        applyEffect: (tier, gameManager) => {
            const effect = UPGRADES.CAPACITOR.effects[tier - 1];
            if (gameManager.physicsManager) {
                gameManager.physicsManager.flyEnergyMax = effect.value;
            }
        }
    },
    
    // Harvester - affects charge rate
    HARVESTER: {
        name: 'Harvester',
        description: 'Increases charge collection rate',
        icon: '🔋',
        maxTier: 5,
        effects: [
            { tier: 1, value: 0.12, cost: 150, description: '+20% charge rate' },
            { tier: 2, value: 0.15, cost: 300, description: '+50% charge rate' },
            { tier: 3, value: 0.18, cost: 600, description: '+80% charge rate' },
            { tier: 4, value: 0.22, cost: 1200, description: '+120% charge rate' },
            { tier: 5, value: 0.30, cost: 2500, description: '+200% charge rate' }
        ],
        applyEffect: (tier, gameManager) => {
            const effect = UPGRADES.HARVESTER.effects[tier - 1];
            if (gameManager.physicsManager) {
                gameManager.physicsManager.chargeRate = effect.value;
            }
        }
    },
    
    // Repulsors - affects max speed
    REPULSORS: {
        name: 'Repulsors',
        description: 'Increases maximum speed',
        icon: '🚀',
        maxTier: 5,
        effects: [
            { tier: 1, value: 0.60, cost: 250, description: '+10% max speed' },
            { tier: 2, value: 0.70, cost: 500, description: '+27% max speed' },
            { tier: 3, value: 0.85, cost: 1000, description: '+54% max speed' },
            { tier: 4, value: 1.00, cost: 2000, description: '+82% max speed' },
            { tier: 5, value: 1.20, cost: 4000, description: '+118% max speed' }
        ],
        applyEffect: (tier, gameManager) => {
            // Note: This would need to modify constants or physics
            // For now, we'll store it for future use
            gameManager.upgradeMultipliers = gameManager.upgradeMultipliers || {};
            gameManager.upgradeMultipliers.maxSpeed = UPGRADES.REPULSORS.effects[tier - 1].value / 0.55;
        }
    }
};

// Rico's shop dialogue
const SHOP_DIALOGUE = {
    welcome: [
        "Back room's open, kid. What can I do for ya?",
        "Need some upgrades? I've got the best parts in Neo Angeles.",
        "Your board's looking worn. Time for some improvements?"
    ],
    cantAfford: [
        "You're short on credits, kid. Make some more deliveries.",
        "Not enough cash there. Keep hustling!",
        "Come back when you've got the credits."
    ],
    purchased: [
        "Nice choice! That'll make you faster out there.",
        "Good upgrade. You're gonna love this.",
        "Installed and ready to go. Try it out!"
    ],
    maxed: [
        "That's maxed out already. Can't improve perfection!",
        "You've got the best there is. Nothing more I can do."
    ]
};

export class UpgradeManager {
    constructor(eventBus, economyManager) {
        this.eventBus = eventBus;
        this.economyManager = economyManager;
        this.gameManager = null; // Set by GameManager
        
        // Current upgrade levels
        this.upgradeLevels = {
            CAPACITOR: 0,
            HARVESTER: 0,
            REPULSORS: 0
        };
        
        // Shop UI
        this.shopElement = null;
        this.isShopOpen = false;
        
        // Load saved upgrades
        this._loadUpgrades();
    }

    /**
     * Set game manager reference
     */
    setGameManager(gameManager) {
        this.gameManager = gameManager;
        // Apply current upgrades
        this._applyAllUpgrades();
    }

    /**
     * Initialize upgrade system
     */
    init() {
        this._createShopUI();
        this._setupEventListeners();
    }

    /**
     * Load saved upgrade levels
     */
    _loadUpgrades() {
        try {
            const saved = localStorage.getItem('neonSlice_upgrades');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.upgradeLevels = { ...this.upgradeLevels, ...parsed };
            }
        } catch (e) {
            console.warn('Could not load upgrades:', e);
        }
    }

    /**
     * Save upgrade levels
     */
    _saveUpgrades() {
        try {
            localStorage.setItem('neonSlice_upgrades', JSON.stringify(this.upgradeLevels));
        } catch (e) {
            console.warn('Could not save upgrades:', e);
        }
    }

    /**
     * Apply all current upgrades
     */
    _applyAllUpgrades() {
        if (!this.gameManager) return;
        
        for (const [key, level] of Object.entries(this.upgradeLevels)) {
            if (level > 0 && UPGRADES[key]) {
                UPGRADES[key].applyEffect(level, this.gameManager);
            }
        }
    }

    /**
     * Create shop UI
     */
    _createShopUI() {
        this.shopElement = document.createElement('div');
        this.shopElement.id = 'upgrade-shop';
        this.shopElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 85vh;
            background: linear-gradient(180deg, rgba(20,20,30,0.98) 0%, rgba(10,10,15,0.98) 100%);
            border: 3px solid #ff6b35;
            border-radius: 15px;
            padding: 0;
            display: none;
            z-index: 1000;
            font-family: 'Courier New', monospace;
            color: white;
            box-shadow: 0 0 50px rgba(255, 107, 53, 0.4);
            overflow: hidden;
        `;
        
        document.body.appendChild(this.shopElement);
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        // Close shop on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isShopOpen) {
                this.closeShop();
            }
        });
    }

    /**
     * Open the shop
     */
    openShop() {
        this.isShopOpen = true;
        this._renderShop();
        this.shopElement.style.display = 'block';
        this.eventBus.emit('shop:opened');
    }

    /**
     * Close the shop
     */
    closeShop() {
        this.isShopOpen = false;
        this.shopElement.style.display = 'none';
        this.eventBus.emit('shop:closed');
    }

    /**
     * Render the shop UI
     */
    _renderShop() {
        const credits = this.economyManager.getCredits();
        const welcomeMsg = this._getRandomDialogue('welcome');
        
        this.shopElement.innerHTML = `
            <div style="
                background: linear-gradient(90deg, #ff6b35, #ff4500);
                padding: 20px;
                text-align: center;
            ">
                <h2 style="
                    margin: 0;
                    font-size: 24px;
                    text-transform: uppercase;
                    letter-spacing: 4px;
                    text-shadow: 0 0 10px rgba(0,0,0,0.5);
                ">Rico's Back Room</h2>
            </div>
            
            <div style="padding: 20px;">
                <div style="
                    display: flex;
                    align-items: center;
                    margin-bottom: 20px;
                    background: rgba(255,107,53,0.1);
                    border-radius: 10px;
                    padding: 15px;
                ">
                    <div style="
                        width: 50px;
                        height: 50px;
                        background: linear-gradient(135deg, #ff6b35, #ff4500);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 28px;
                        margin-right: 15px;
                    ">R</div>
                    <div style="flex: 1;">
                        <div style="color: #ff6b35; font-weight: bold;">Rico</div>
                        <div style="color: #aaa; font-size: 14px;">"${welcomeMsg}"</div>
                    </div>
                </div>
                
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding: 10px 15px;
                    background: rgba(255, 221, 0, 0.1);
                    border: 1px solid #ffdd00;
                    border-radius: 8px;
                ">
                    <span style="color: #888;">Your Credits:</span>
                    <span style="color: #ffdd00; font-size: 24px; font-weight: bold;">${credits}</span>
                </div>
                
                <div style="
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                ">
                    ${this._renderUpgradeItems()}
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 1px solid #333;">
                <button id="shop-close" style="
                    width: 100%;
                    padding: 15px;
                    font-size: 16px;
                    font-family: 'Courier New', monospace;
                    background: rgba(255,255,255,0.1);
                    border: 2px solid #888;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    transition: all 0.2s;
                ">Back to Deliveries</button>
            </div>
        `;
        
        // Setup event handlers
        const closeBtn = this.shopElement.querySelector('#shop-close');
        closeBtn.addEventListener('click', () => this.closeShop());
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
            closeBtn.style.borderColor = '#fff';
        });
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.1)';
            closeBtn.style.borderColor = '#888';
        });
        
        // Setup purchase buttons
        this.shopElement.querySelectorAll('.upgrade-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.upgrade;
                this._purchaseUpgrade(key);
            });
        });
    }

    /**
     * Render upgrade items
     */
    _renderUpgradeItems() {
        let html = '';
        
        for (const [key, upgrade] of Object.entries(UPGRADES)) {
            const currentTier = this.upgradeLevels[key];
            const isMaxed = currentTier >= upgrade.maxTier;
            const nextEffect = !isMaxed ? upgrade.effects[currentTier] : null;
            const credits = this.economyManager.getCredits();
            const canAfford = nextEffect ? credits >= nextEffect.cost : false;
            
            // Tier indicators
            let tierIndicators = '';
            for (let i = 1; i <= upgrade.maxTier; i++) {
                const filled = i <= currentTier;
                tierIndicators += `<span style="
                    display: inline-block;
                    width: 20px;
                    height: 8px;
                    background: ${filled ? '#ff6b35' : 'rgba(255,255,255,0.1)'};
                    margin-right: 3px;
                    border-radius: 2px;
                "></span>`;
            }
            
            html += `
                <div style="
                    background: rgba(255,255,255,0.03);
                    border: 1px solid ${isMaxed ? '#00ff00' : '#333'};
                    border-radius: 10px;
                    padding: 15px;
                    ${isMaxed ? 'opacity: 0.7;' : ''}
                ">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                <span style="font-size: 24px;">${upgrade.icon}</span>
                                <span style="font-size: 18px; font-weight: bold; color: #ff6b35;">${upgrade.name}</span>
                                ${isMaxed ? '<span style="color: #00ff00; font-size: 12px; background: rgba(0,255,0,0.1); padding: 2px 8px; border-radius: 4px;">MAXED</span>' : ''}
                            </div>
                            <div style="color: #888; font-size: 12px; margin-bottom: 10px;">${upgrade.description}</div>
                            <div style="margin-bottom: 5px;">${tierIndicators}</div>
                            ${!isMaxed ? `<div style="color: #0f0; font-size: 12px;">Next: ${nextEffect.description}</div>` : ''}
                        </div>
                        
                        ${!isMaxed ? `
                            <button class="upgrade-buy-btn" data-upgrade="${key}" style="
                                padding: 12px 20px;
                                font-family: 'Courier New', monospace;
                                font-size: 14px;
                                background: ${canAfford ? 'linear-gradient(135deg, #ff6b35, #ff4500)' : 'rgba(255,255,255,0.05)'};
                                border: 2px solid ${canAfford ? '#ff6b35' : '#333'};
                                border-radius: 8px;
                                color: ${canAfford ? 'white' : '#666'};
                                cursor: ${canAfford ? 'pointer' : 'not-allowed'};
                                white-space: nowrap;
                                transition: all 0.2s;
                            ">${nextEffect.cost} credits</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Purchase an upgrade
     */
    _purchaseUpgrade(key) {
        const upgrade = UPGRADES[key];
        if (!upgrade) return;
        
        const currentTier = this.upgradeLevels[key];
        if (currentTier >= upgrade.maxTier) {
            this._showMessage(this._getRandomDialogue('maxed'));
            return;
        }
        
        const nextEffect = upgrade.effects[currentTier];
        const cost = nextEffect.cost;
        
        if (!this.economyManager.spendCredits(cost)) {
            this._showMessage(this._getRandomDialogue('cantAfford'));
            return;
        }
        
        // Apply upgrade
        this.upgradeLevels[key] = currentTier + 1;
        this._saveUpgrades();
        
        if (this.gameManager) {
            upgrade.applyEffect(this.upgradeLevels[key], this.gameManager);
        }
        
        // Show success message
        this._showMessage(this._getRandomDialogue('purchased'));
        
        // Emit event
        this.eventBus.emit(Events.UPGRADE_PURCHASED, {
            upgrade: key,
            tier: this.upgradeLevels[key],
            cost: cost
        });
        
        // Re-render shop
        this._renderShop();
    }

    /**
     * Show a message in the shop
     */
    _showMessage(message) {
        const msgElement = document.createElement('div');
        msgElement.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #ff6b35;
            border-radius: 10px;
            padding: 15px 30px;
            color: #ff6b35;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 1100;
            animation: fadeOut 2s forwards;
        `;
        msgElement.innerHTML = `Rico: "${message}"`;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        msgElement.appendChild(style);
        
        document.body.appendChild(msgElement);
        setTimeout(() => msgElement.remove(), 2000);
    }

    /**
     * Get random dialogue
     */
    _getRandomDialogue(type) {
        const options = SHOP_DIALOGUE[type];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Get current upgrade levels
     */
    getUpgradeLevels() {
        return { ...this.upgradeLevels };
    }

    /**
     * Check if shop is open
     */
    isOpen() {
        return this.isShopOpen;
    }

    /**
     * Dispose
     */
    dispose() {
        if (this.shopElement && this.shopElement.parentNode) {
            this.shopElement.parentNode.removeChild(this.shopElement);
        }
    }
}
