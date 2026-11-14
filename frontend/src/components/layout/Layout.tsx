import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { PlayerOverlay } from '../player/PlayerOverlay';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <PlayerOverlay />
    </div>
  );
}
