// LevelSerializer - Save and load level data

import { Building } from './objects/Building.js';
import { Road } from './objects/Road.js';
import { EditorEvents } from './EditorManager.js';

const STORAGE_KEY = 'pizza_courier_level';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export class LevelSerializer {
    constructor(editorManager) {
        this.editorManager = editorManager;
        
        // Auto-save timer
        this.autoSaveTimer = null;
    }

    /**
     * Start auto-save
     */
    startAutoSave() {
        this.stopAutoSave();
        this.autoSaveTimer = setInterval(() => {
            this.saveToLocalStorage();
        }, AUTO_SAVE_INTERVAL);
    }

    /**
     * Stop auto-save
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Serialize current level to JSON
     */
    serialize() {
        const buildings = [];
        const roads = [];
        
        for (const obj of this.editorManager.objects) {
            const data = obj.serialize();
            
            if (obj instanceof Building || 
                ['box', 'cylinder', 'cone', 'wedge'].includes(obj.type)) {
                buildings.push(data);
            } else if (obj.type === 'road') {
                roads.push(data);
            }
        }
        
        return {
            version: 1,
            name: this.editorManager.levelData.name || 'Untitled',
            spawnPoint: this.editorManager.levelData.spawnPoint || { x: 0, y: 2, z: 0 },
            buildings,
            roads
        };
    }

    /**
     * Save to localStorage and download as file
     */
    save() {
        const data = this.serialize();
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Download as file
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.name.replace(/\s+/g, '_')}_level.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show confirmation
        if (this.editorManager.editorUI) {
            this.editorManager.editorUI.showHint(`Level saved: ${data.name}`, 2000);
        }
        
        this.editorManager.eventBus.emit(EditorEvents.LEVEL_SAVED, data);
        
        console.log('Level saved:', data);
    }

    /**
     * Save to localStorage only
     */
    saveToLocalStorage() {
        try {
            const data = this.serialize();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            console.log('Auto-saved to localStorage');
        } catch (e) {
            console.error('Failed to auto-save:', e);
        }
    }

    /**
     * Load from localStorage
     */
    loadFromLocalStorage() {
        try {
            const json = localStorage.getItem(STORAGE_KEY);
            if (json) {
                const data = JSON.parse(json);
                this.loadFromData(data);
                return true;
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
        return false;
    }

    /**
     * Load level from JSON data
     */
    loadFromData(data) {
        // Clear existing objects
        this._clearLevel();
        
        // Validate data
        if (!data || data.version !== 1) {
            console.error('Invalid level data');
            return false;
        }
        
        // Store level metadata
        this.editorManager.levelData = {
            version: data.version,
            name: data.name || 'Untitled',
            spawnPoint: data.spawnPoint || { x: 0, y: 2, z: 0 }
        };
        
        const scene = this.editorManager.getScene();
        
        // Load buildings
        if (data.buildings && Array.isArray(data.buildings)) {
            for (const buildingData of data.buildings) {
                const building = Building.deserialize(buildingData);
                building.addToScene(scene);
                this.editorManager.objects.push(building);
            }
        }
        
        // Load roads
        if (data.roads && Array.isArray(data.roads)) {
            for (const roadData of data.roads) {
                try {
                    const road = Road.deserialize(roadData);
                    road.addToScene(scene);
                    this.editorManager.objects.push(road);
                } catch (e) {
                    console.warn('Failed to load road:', e);
                }
            }
        }
        
        // Update UI
        if (this.editorManager.editorUI) {
            this.editorManager.editorUI.updateCounts(
                this.editorManager.objects.length,
                0
            );
            this.editorManager.editorUI.showHint(`Loaded: ${data.name}`, 2000);
        }
        
        // Clear history
        if (this.editorManager.historyManager) {
            this.editorManager.historyManager.clear();
        }
        
        this.editorManager.eventBus.emit(EditorEvents.LEVEL_LOADED, data);
        
        console.log(`Level loaded: ${data.name} (${this.editorManager.objects.length} objects)`);
        return true;
    }

    /**
     * Clear all objects from the level
     */
    _clearLevel() {
        const scene = this.editorManager.getScene();
        
        // Clear selection first
        this.editorManager.clearSelection();
        
        // Remove all objects from scene
        for (const obj of this.editorManager.objects) {
            if (obj.mesh && scene) {
                scene.remove(obj.mesh);
            }
            if (obj.dispose) {
                obj.dispose();
            }
        }
        
        // Clear objects array
        this.editorManager.objects = [];
    }

    /**
     * Create a new empty level
     */
    newLevel(name = 'Untitled') {
        this._clearLevel();
        
        this.editorManager.levelData = {
            version: 1,
            name: name,
            spawnPoint: { x: 0, y: 2, z: 0 }
        };
        
        // Clear history
        if (this.editorManager.historyManager) {
            this.editorManager.historyManager.clear();
        }
        
        // Update UI
        if (this.editorManager.editorUI) {
            this.editorManager.editorUI.updateCounts(0, 0);
            this.editorManager.editorUI.showHint(`New level: ${name}`, 2000);
        }
        
        console.log(`New level created: ${name}`);
    }

    /**
     * Check if there's saved data in localStorage
     */
    hasSavedData() {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    /**
     * Clear saved data from localStorage
     */
    clearSavedData() {
        localStorage.removeItem(STORAGE_KEY);
    }
}
