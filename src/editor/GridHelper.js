// GridHelper - Visual grid for the editor

import * as THREE from 'three';

export class GridHelper {
    constructor(editorManager, size = 500, divisions = 100) {
        this.editorManager = editorManager;
        this.size = size;
        this.divisions = divisions;
        
        // Create grid
        this.grid = new THREE.GridHelper(size, divisions, 0x444444, 0x222222);
        this.grid.position.y = 0.01; // Slightly above ground
        this.grid.visible = true;
        
        // Add axis indicator
        this.axisHelper = new THREE.AxesHelper(10);
        this.axisHelper.position.set(0, 0.1, 0);
        
        // Group
        this.group = new THREE.Group();
        this.group.add(this.grid);
        this.group.add(this.axisHelper);
    }

    /**
     * Add to scene
     */
    addToScene(scene) {
        scene.add(this.group);
    }

    /**
     * Remove from scene
     */
    removeFromScene(scene) {
        scene.remove(this.group);
    }

    /**
     * Show grid
     */
    show() {
        this.group.visible = true;
    }

    /**
     * Hide grid
     */
    hide() {
        this.group.visible = false;
    }

    /**
     * Set visibility
     */
    setVisible(visible) {
        this.group.visible = visible;
    }

    /**
     * Update grid size
     */
    setSize(size, divisions) {
        this.size = size;
        this.divisions = divisions || this.divisions;
        
        // Recreate grid
        this.group.remove(this.grid);
        this.grid.geometry.dispose();
        
        this.grid = new THREE.GridHelper(size, this.divisions, 0x444444, 0x222222);
        this.grid.position.y = 0.01;
        this.group.add(this.grid);
    }

    /**
     * Clean up
     */
    destroy() {
        this.grid.geometry.dispose();
        this.axisHelper.geometry.dispose();
    }
}
