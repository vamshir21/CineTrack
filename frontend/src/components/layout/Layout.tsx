import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from './Navbar';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { PlayerOverlay } from '../player/PlayerOverlay';
import { BrowserPlayerModal } from '../player/BrowserPlayerModal';
import { ProfileSelectorModal } from '../profiles/ProfileSelectorModal';
import { LanConnectModal } from '../modals/LanConnectModal';
import { PlaySomethingModal } from '../modals/PlaySomethingModal';
import { KeyboardShortcutsModal } from '../modals/KeyboardShortcutsModal';
import { playbackApi } from '../../api/playback';
import { settingsApi } from '../../api/settings';
import { useProfileStore } from '../../store/profileStore';
import { useBrowserPlayerStore } from '../../store/browserPlayerStore';
import { applyTheme, getInitialTheme } from '../../utils/themeUtils';

export function Layout() {
  const [isPlaySomethingOpen, setIsPlaySomethingOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const navigate = useNavigate();

  const { fetchProfiles } = useProfileStore();
  const { isOpen: isBrowserPlayerOpen } = useBrowserPlayerStore();

  // Initialize profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

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
      // Don't intercept shortcuts when browser player is open
      if (isBrowserPlayerOpen) return;

      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      // Space: Toggle playback play/pause (host VLC)
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
        setIsLanModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, isBrowserPlayerOpen]);

  return (
    <div className="min-h-screen bg-background text-white">
      <Navbar
        onOpenPlaySomething={() => setIsPlaySomethingOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenLanModal={() => setIsLanModalOpen(true)}
      />
      <main>
        <ErrorBoundary>
          <Outlet
            context={{
              onOpenPlaySomething: () => setIsPlaySomethingOpen(true),
              onOpenLanModal: () => setIsLanModalOpen(true),
            }}
          />
        </ErrorBoundary>
      </main>

      {/* Fullscreen HTML5 In-Browser Video Player for LAN & Direct Play */}
      <BrowserPlayerModal />

      {/* Global Netflix-style Profile Selector Modal */}
      <ProfileSelectorModal />

      {/* Stream on Phone & TV Modal */}
      <LanConnectModal
        isOpen={isLanModalOpen}
        onClose={() => setIsLanModalOpen(false)}
      />

      {/* Host VLC Player Controller & Next Episode Timer Overlay (only when VLC active) */}
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
