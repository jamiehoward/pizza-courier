import * as THREE from 'three';
import { CITY, WORLD } from '../constants.js';

/**
 * Manages the minimap display
 */
export class MinimapManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.size = 200;
        this.scale = this.size / WORLD.GROUND_SIZE;
        
        // Colors
        this.colors = {
            background: '#111122',
            grid: '#223344',
            building: '#445566',
            player: '#00ffff',
            playerDirection: '#00ffff',
            pizzaShop: '#ff4444',
            destination: '#00ff00',
            pizza: '#ffaa00',
            street: '#222233'
        };
        
        // Buildings cache
        this.buildings = [];
        
        // State
        this.playerPosition = new THREE.Vector3();
        this.playerRotation = 0;
        this.pizzaShopPosition = new THREE.Vector3();
        this.destinationPosition = null;
        this.pizzaPosition = null;
    }

    init() {
        // Get or create canvas
        this.canvas = document.getElementById('minimap-canvas');
        if (!this.canvas) {
            console.error('Minimap canvas not found!');
            return;
        }
        
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Set buildings data from city manager
     */
    setBuildings(buildings) {
        this.buildings = buildings.map(b => ({
            x: b.getPosition ? b.getPosition().x : b.position.x,
            z: b.getPosition ? b.getPosition().z : b.position.z,
            width: b.scale?.x || 10,
            depth: b.scale?.z || 10
        }));
    }

    /**
     * Set pizza shop position
     */
    setPizzaShopPosition(position) {
        this.pizzaShopPosition.copy(position);
    }

    /**
     * Update player position and rotation
     */
    updatePlayer(position, rotation) {
        this.playerPosition.copy(position);
        this.playerRotation = rotation;
    }

    /**
     * Set delivery destination
     */
    setDestination(position) {
        this.destinationPosition = position ? position.clone() : null;
    }

    /**
     * Set pizza position
     */
    setPizzaPosition(position) {
        this.pizzaPosition = position ? position.clone() : null;
    }

    /**
     * Convert world coordinates to minimap coordinates
     */
    worldToMinimap(x, z) {
        // Center the map on the world center, not player
        const mapX = (x * this.scale) + this.size / 2;
        const mapZ = (z * this.scale) + this.size / 2;
        return { x: mapX, y: mapZ };
    }

    /**
     * Draw the minimap
     */
    render() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const size = this.size;
        
        // Clear with background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, size, size);
        
        // Draw grid lines (streets)
        this._drawGrid(ctx);
        
        // Draw buildings
        this._drawBuildings(ctx);
        
        // Draw pizza shop
        this._drawPizzaShop(ctx);
        
        // Draw pizza if spawned
        if (this.pizzaPosition) {
            this._drawPizza(ctx);
        }
        
        // Draw destination if active
        if (this.destinationPosition) {
            this._drawDestination(ctx);
        }
        
        // Draw player (always on top)
        this._drawPlayer(ctx);
        
        // Draw border
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
    }

    _drawGrid(ctx) {
        const cellSize = CITY.BLOCK_SIZE + CITY.STREET_WIDTH;
        
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;
        
        // Draw street grid
        for (let i = -CITY.GRID_EXTENT; i <= CITY.GRID_EXTENT + 1; i++) {
            const worldPos = i * cellSize - CITY.STREET_WIDTH / 2;
            const mapPos = this.worldToMinimap(worldPos, 0);
            
            // Vertical line
            ctx.beginPath();
            ctx.moveTo(mapPos.x, 0);
            ctx.lineTo(mapPos.x, this.size);
            ctx.stroke();
            
            // Horizontal line
            const mapPosH = this.worldToMinimap(0, worldPos);
            ctx.beginPath();
            ctx.moveTo(0, mapPosH.y);
            ctx.lineTo(this.size, mapPosH.y);
            ctx.stroke();
        }
    }

    _drawBuildings(ctx) {
        ctx.fillStyle = this.colors.building;
        
        for (const building of this.buildings) {
            const pos = this.worldToMinimap(building.x, building.z);
            const w = building.width * this.scale;
            const h = building.depth * this.scale;
            
            ctx.fillRect(pos.x - w / 2, pos.y - h / 2, w, h);
        }
    }

    _drawPizzaShop(ctx) {
        const pos = this.worldToMinimap(this.pizzaShopPosition.x, this.pizzaShopPosition.z);
        
        // Draw as red square
        ctx.fillStyle = this.colors.pizzaShop;
        ctx.fillRect(pos.x - 6, pos.y - 6, 12, 12);
        
        // Add glow effect
        ctx.shadowColor = this.colors.pizzaShop;
        ctx.shadowBlur = 10;
        ctx.fillRect(pos.x - 4, pos.y - 4, 8, 8);
        ctx.shadowBlur = 0;
    }

    _drawPizza(ctx) {
        const pos = this.worldToMinimap(this.pizzaPosition.x, this.pizzaPosition.z);
        
        // Pulsing circle
        const pulse = Math.sin(Date.now() * 0.005) * 2 + 6;
        
        ctx.fillStyle = this.colors.pizza;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawDestination(ctx) {
        const pos = this.worldToMinimap(this.destinationPosition.x, this.destinationPosition.z);
        
        // Pulsing ring
        const pulse = Math.sin(Date.now() * 0.004) * 3 + 8;
        
        ctx.strokeStyle = this.colors.destination;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center dot
        ctx.fillStyle = this.colors.destination;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawPlayer(ctx) {
        const pos = this.worldToMinimap(this.playerPosition.x, this.playerPosition.z);
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        
        // Convert Three.js Y rotation to canvas rotation
        // In Three.js: 0 = facing +Z, positive = counterclockwise from above
        // In Canvas: 0 = pointing right, positive = clockwise
        // When aimYaw = 0 (facing +Z), arrow should point down on minimap (+Y canvas)
        // Triangle points up (-Y canvas), so we need to add π to flip it
        ctx.rotate(this.playerRotation + Math.PI);
        
        // Player triangle (pointing in direction of movement)
        ctx.fillStyle = this.colors.player;
        ctx.beginPath();
        ctx.moveTo(0, -8);  // Front point
        ctx.lineTo(-5, 6);  // Back left
        ctx.lineTo(5, 6);   // Back right
        ctx.closePath();
        ctx.fill();
        
        // Glow effect
        ctx.shadowColor = this.colors.player;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.restore();
    }

    /**
     * Cleanup
     */
    dispose() {
        this.ctx = null;
        this.canvas = null;
    }
}
