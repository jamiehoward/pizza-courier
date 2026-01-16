'use client';

import { useEffect, useRef, useState } from 'react';

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    let mounted = true;

    const initGame = async () => {
      try {
        // Dynamically import the GameManager to avoid SSR issues
        const { GameManager } = await import('@/game/core/GameManager');
        
        if (!mounted || !containerRef.current) return;

        // Create and initialize the game
        const game = new GameManager();
        gameRef.current = game;

        await game.init(containerRef.current);
        
        if (!mounted) {
          game.dispose?.();
          return;
        }

        game.start();
        setIsLoading(false);
        console.log('Pizza Courier started!');
      } catch (error) {
        console.error('Failed to start game:', error);
        setLoadError(error instanceof Error ? error.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    initGame();

    // Cleanup
    return () => {
      mounted = false;
      if (gameRef.current?.dispose) {
        gameRef.current.dispose();
      }
    };
  }, []);

  return (
    <>
      {isLoading && (
        <div id="loading-screen">
          <h1>🍕 PIZZA COURIER</h1>
          <div className="spinner" />
          <p style={{ marginTop: '20px' }}>Loading...</p>
        </div>
      )}
      
      {loadError && (
        <div id="loading-screen" style={{ color: '#f00' }}>
          <h1>Error</h1>
          <p>{loadError}</p>
        </div>
      )}

      <div id="game-container" ref={containerRef}>
        {/* HUD */}
        <div id="hud">
          <div id="speed">SPEED: 0</div>
          <div id="altitude">ALT: 0</div>
          <div id="fly-energy">CHARGE: ░░░░░░░░░░ | FLIGHT: ░░░░░░░░░░</div>
        </div>

        {/* Controls Info */}
        <div id="controls-info">
          WASD: Move | Arrows: Aim | Space: Jump | Shift: Boost/Fly | U: Upgrades | Tab: Stats | F1: Editor
        </div>

        {/* Minimap */}
        <canvas id="minimap-canvas" width="180" height="180" />

        {/* Delivery UI */}
        <div id="delivery-ui">
          <div id="delivery-status">AWAITING PICKUP</div>
          <div id="delivery-timer" />
          <div id="delivery-stats">DELIVERIES: 0 | FAILED: 0</div>
        </div>

        {/* Delivery Result Popup */}
        <div id="delivery-result-popup" style={{ display: 'none' }} />

        {/* Editor Container */}
        <div id="editor-container" />
      </div>
    </>
  );
}
