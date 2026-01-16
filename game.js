// Pizza Courier - Entry Point
// This file bootstraps the game using the modular architecture in src/

import { GameManager } from './src/core/GameManager.js';

// Create and start the game
const game = new GameManager();

game.init()
    .then(() => {
        console.log('Pizza Courier started!');
    })
    .catch((error) => {
        console.error('Failed to start game:', error);
    });
