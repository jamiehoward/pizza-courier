// EditorCamera - Free-fly camera for level editing

import * as THREE from 'three';

export class EditorCamera {
    constructor(editorManager) {
        this.editorManager = editorManager;
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 50, 100);
        this.camera.lookAt(0, 0, 0);
        
        // Movement settings
        this.moveSpeed = 50;
        this.fastMoveSpeed = 150;
        this.rotateSpeed = 0.003;
        
        // State
        this.enabled = false;
        this.keys = {};
        this.isRightMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Rotation (Euler angles)
        this.yaw = 0;
        this.pitch = -0.5; // Looking slightly down
        
        // Bind event handlers
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._onResize = this._onResize.bind(this);
    }

    /**
     * Enable the editor camera
     */
    enable() {
        this.enabled = true;
        
        // Store current game camera position to start from similar view
        const gameCamera = this.editorManager.gameManager?.cameraController?.getCamera();
        if (gameCamera) {
            this.camera.position.copy(gameCamera.position);
            this.camera.position.y = Math.max(20, this.camera.position.y + 30);
        }
        
        // Add event listeners
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('wheel', this._onWheel);
        window.addEventListener('contextmenu', this._onContextMenu);
        window.addEventListener('resize', this._onResize);
        
        // Calculate initial rotation from camera direction
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.yaw = Math.atan2(direction.x, direction.z);
        this.pitch = Math.asin(-direction.y);
    }

    /**
     * Disable the editor camera
     */
    disable() {
        this.enabled = false;
        this.keys = {};
        this.isRightMouseDown = false;
        
        // Remove event listeners
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('wheel', this._onWheel);
        window.removeEventListener('contextmenu', this._onContextMenu);
        window.removeEventListener('resize', this._onResize);
    }

    _onKeyDown(e) {
        // Don't capture if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        this.keys[e.key.toLowerCase()] = true;
    }

    _onKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }

    _onMouseDown(e) {
        if (e.button === 2) { // Right mouse button
            this.isRightMouseDown = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }
    }

    _onMouseUp(e) {
        if (e.button === 2) {
            this.isRightMouseDown = false;
        }
    }

    _onMouseMove(e) {
        if (!this.isRightMouseDown) return;
        
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        
        this.yaw -= deltaX * this.rotateSpeed;
        this.pitch -= deltaY * this.rotateSpeed;
        
        // Clamp pitch to prevent flipping
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        // Update camera rotation
        this._updateRotation();
    }

    _onWheel(e) {
        if (!this.enabled) return;
        
        // Zoom in/out by moving forward/back
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        const zoomSpeed = e.shiftKey ? 5 : 2;
        this.camera.position.addScaledVector(direction, -e.deltaY * zoomSpeed * 0.1);
    }

    _onContextMenu(e) {
        e.preventDefault(); // Prevent context menu when right-clicking
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    _updateRotation() {
        // Create rotation from yaw and pitch
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        quaternion.setFromEuler(euler);
        this.camera.quaternion.copy(quaternion);
    }

    /**
     * Update camera position based on input
     */
    update(deltaTime) {
        if (!this.enabled) return;
        
        // Calculate movement speed
        const speed = this.keys['shift'] ? this.fastMoveSpeed : this.moveSpeed;
        const moveAmount = speed * deltaTime;
        
        // Get camera direction vectors
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        // WASD movement
        if (this.keys['w']) {
            this.camera.position.addScaledVector(forward, moveAmount);
        }
        if (this.keys['s']) {
            this.camera.position.addScaledVector(forward, -moveAmount);
        }
        if (this.keys['a']) {
            this.camera.position.addScaledVector(right, -moveAmount);
        }
        if (this.keys['d']) {
            this.camera.position.addScaledVector(right, moveAmount);
        }
        
        // Q/E for up/down
        if (this.keys['e'] || this.keys[' ']) {
            this.camera.position.y += moveAmount;
        }
        if (this.keys['q']) {
            this.camera.position.y -= moveAmount;
        }
        
        // Keep camera above ground
        this.camera.position.y = Math.max(1, this.camera.position.y);
    }

    /**
     * Get the camera
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Set camera position
     */
    setPosition(x, y, z) {
        this.camera.position.set(x, y, z);
    }

    /**
     * Look at a point
     */
    lookAt(target) {
        this.camera.lookAt(target);
        
        // Update yaw/pitch from new direction
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.yaw = Math.atan2(direction.x, direction.z);
        this.pitch = Math.asin(-direction.y);
    }

    /**
     * Clean up
     */
    destroy() {
        this.disable();
    }
}
