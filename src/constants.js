// Constants and tuning values for the game
// Centralized configuration for easy tweaking

export const PLAYER = {
    // Movement
    MAX_SPEED: 0.4,
    ACCELERATION: 0.01,
    FRICTION: 0.95,
    MOVE_THRESHOLD: 0.08,
    
    // Momentum boost
    MOMENTUM_BOOST_DELAY: 0.5,
    MOMENTUM_BOOST_MAX: 4,
    
    // Jump and flight
    JUMP_VELOCITY: 0.3,
    GRAVITY: 0.03,
    POST_FLIGHT_GRAVITY: 0.03,
    GROUND_LEVEL: -0.5,
    FLY_ENERGY_MAX: 3.0,
    FLY_RECHARGE_RATE: 1.0,
    FLIGHT_ACTIVATION_TIME: 1.0,
    
    // Aim control
    AIM_YAW_SPEED: 0.04,
    AIM_PITCH_SPEED: 0.03,
    AIM_LEVEL_SPEED: 0.03,
    MIN_AIM_PITCH: -0.6,
    MAX_AIM_PITCH: 0.6,
    
    // Size
    TARGET_HEIGHT: 1.8
};

export const CAMERA = {
    DISTANCE: 3,
    HEIGHT: 1.8,
    OFFSET_X: 0.8,  // Over-shoulder offset
    FOV: 60,
    NEAR: 0.1,
    FAR: 1000,
    LERP_FACTOR: 0.15
};

export const CITY = {
    BLOCK_SIZE: 50,
    STREET_WIDTH: 14,
    GRID_EXTENT: 5,
    BUILDINGS_PER_BLOCK_MIN: 1,
    BUILDINGS_PER_BLOCK_MAX: 3,
    BUILDING_SCALE_MIN: 30,
    BUILDING_SCALE_MAX: 70,
    LOD_DISTANCE: 100,
    LOD_UPDATE_INTERVAL: 500  // ms
};

export const WORLD = {
    GROUND_SIZE: 800,
    GRID_DIVISIONS: 200,
    BOUNDARY: 380,
    MAX_HEIGHT: 200,
    FOG_DENSITY: 0.002,
    BACKGROUND_COLOR: 0x87ceeb  // Sky blue
};

export const SKY = {
    TOP_COLOR: 0x0077ff,      // Deep blue at zenith
    HORIZON_COLOR: 0x87ceeb,  // Light blue at horizon
    GROUND_COLOR: 0x444444,   // Dark for ground reflection
    SUN_COLOR: 0xffffee,
    SUN_INTENSITY: 2.0,
    SUN_POSITION: { x: 100, y: 150, z: 50 }
};

export const EFFECTS = {
    MAX_TRAIL_PARTICLES: 40,
    GLOW_COLORS: {
        PRIMARY: 0x00ffff,
        SECONDARY: 0x00ffaa
    },
    BURST_PARTICLE_COUNT: 20
};

export const LIGHTING = {
    AMBIENT: {
        COLOR: 0xffffff,
        INTENSITY: 0.5
    },
    KEY: {
        COLOR: 0xffeedd,
        INTENSITY: 1.5,
        POSITION: { x: 30, y: 50, z: 20 }
    },
    FILL: {
        COLOR: 0xaabbcc,
        INTENSITY: 0.6,
        POSITION: { x: -20, y: 30, z: -20 }
    },
    RIM: {
        COLOR: 0xffffff,
        INTENSITY: 0.4,
        POSITION: { x: 0, y: 20, z: -30 }
    },
    HEMISPHERE: {
        SKY_COLOR: 0x87ceeb,
        GROUND_COLOR: 0x444444,
        INTENSITY: 0.6
    }
};

export const BUILDING_COLORS = [
    0x3a3a3a, 0x4a4a4a, 0x555555, 0x404040,
    0x484848, 0x505050, 0x454545, 0x3d3d3d
];

export const SKYSCRAPER_MODELS = [
    'assets/buildings/skyscrapers/skyscraper_1.glb',
    'assets/buildings/skyscrapers/skyscraper_2.glb',
    'assets/buildings/skyscrapers/skyscraper_3.glb',
    'assets/buildings/skyscrapers/skyscraper_4.glb'
];

export const ANIMATION_FILES = {
    idle: 'assets/characters/jen/Standing Idle.fbx',
    crouch: 'assets/characters/jen/Crouch Idle.fbx',
    skateboard: 'assets/characters/jen/Skateboarding.fbx',
    crouchToStand: 'assets/characters/jen/Crouch To Standing.fbx',
    standUp: 'assets/characters/jen/Standing Up.fbx',
    falling: 'assets/characters/jen/Falling Idle.fbx',
    fallingToLand: 'assets/characters/jen/Falling To Landing.fbx',
    jumping: 'assets/characters/jen/Jumping.fbx'
};

export const ASSETS = {
    HOVERBOARD: 'assets/objects/hoverboard.glb',
    PIZZA_SHOP: 'assets/buildings/pizza-shop.glb'
};

// Key bindings
export const KEYS = {
    FORWARD: 'w',
    BACKWARD: 's',
    STRAFE_LEFT: 'a',
    STRAFE_RIGHT: 'd',
    JUMP_FLY: ' ',
    DESCEND: 'shift',
    AIM_LEFT: 'ArrowLeft',
    AIM_RIGHT: 'ArrowRight',
    AIM_UP: 'ArrowUp',
    AIM_DOWN: 'ArrowDown'
};
