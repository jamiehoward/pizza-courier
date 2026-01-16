import dynamic from 'next/dynamic';

// Dynamically import Game component with SSR disabled
// Three.js requires the window object which doesn't exist during SSR
const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => (
    <div id="loading-screen">
      <h1>🍕 PIZZA COURIER</h1>
      <div className="spinner" />
      <p style={{ marginTop: '20px' }}>Initializing...</p>
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
