// BaseTool - Base class for editor tools

export class BaseTool {
    constructor(name) {
        this.name = name;
        this.editorManager = null;
        this.isActive = false;
    }

    /**
     * Set the editor manager reference
     */
    setEditorManager(editorManager) {
        this.editorManager = editorManager;
    }

    /**
     * Activate this tool
     */
    activate() {
        this.isActive = true;
        this.onActivate();
    }

    /**
     * Deactivate this tool
     */
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
    }

    /**
     * Called when tool is activated - override in subclass
     */
    onActivate() {}

    /**
     * Called when tool is deactivated - override in subclass
     */
    onDeactivate() {}

    /**
     * Update - called each frame when active
     */
    update(deltaTime) {}

    /**
     * Handle mouse down
     */
    onMouseDown(e) {}

    /**
     * Handle mouse move
     */
    onMouseMove(e) {}

    /**
     * Handle mouse up
     */
    onMouseUp(e) {}

    /**
     * Handle key down
     */
    onKeyDown(e) {}

    /**
     * Clean up
     */
    destroy() {}
}
