import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from './Navbar';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { PlayerOverlay } from '../player/PlayerOverlay';
import { PlaySomethingModal } from '../modals/PlaySomethingModal';
import { KeyboardShortcutsModal } from '../modals/KeyboardShortcutsModal';
import { playbackApi } from '../../api/playback';
import { settingsApi } from '../../api/settings';
import { applyTheme, getInitialTheme } from '../../utils/themeUtils';

export function Layout() {
  const [isPlaySomethingOpen, setIsPlaySomethingOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const navigate = useNavigate();

  // Settings query for theme sync
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
    staleTime: 1000 * 60 * 10,
  });

  // Apply theme
  useEffect(() => {
    const local = getInitialTheme();
    applyTheme(settings?.theme ? (settings.theme === 'light' ? 'light' : 'dark') : local);
  }, [settings?.theme]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // Space: Toggle playback play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        playbackApi.toggle().catch(() => {});
      }
      // F: Toggle fullscreen
      else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
      // S: Surprise Me / Play Something
      else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setIsPlaySomethingOpen((prev) => !prev);
      }
      // ?: Keyboard Shortcuts Modal
      else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
      // /: Quick search
      else if (e.key === '/') {
        e.preventDefault();
        navigate('/search');
      }
      // Escape: Close any open modal
      else if (e.key === 'Escape') {
        setIsPlaySomethingOpen(false);
        setIsShortcutsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar
        onOpenPlaySomething={() => setIsPlaySomethingOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />
      <main>
        <ErrorBoundary>
          <Outlet context={{ onOpenPlaySomething: () => setIsPlaySomethingOpen(true) }} />
        </ErrorBoundary>
      </main>

      {/* Global VLC Player Controller & Next Episode Timer Overlay */}
      <PlayerOverlay />

      {/* Play Something (Shuffle) Modal */}
      <PlaySomethingModal
        isOpen={isPlaySomethingOpen}
        onClose={() => setIsPlaySomethingOpen(false)}
      />

      {/* Desktop Keyboard Shortcuts Cheat Sheet */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
