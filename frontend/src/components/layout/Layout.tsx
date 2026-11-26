import { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, Tv, Film, Bookmark, FolderHeart } from 'lucide-react';
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
      <main className="pb-20 md:pb-0">
        <ErrorBoundary>
          <Outlet
            context={{
              onOpenPlaySomething: () => setIsPlaySomethingOpen(true),
              onOpenLanModal: () => setIsLanModalOpen(true),
            }}
          />
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation Bar (Phone & Tablet Friendly) */}
      {!isBrowserPlayerOpen && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#121212]/95 border-t border-neutral-800/80 backdrop-blur-md flex items-center justify-around py-2 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[10px] font-semibold text-neutral-400 select-none">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Home className={`w-5 h-5 ${isActive ? 'text-netflix' : ''}`} />
                <span>Home</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/tv"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Tv className={`w-5 h-5 ${isActive ? 'text-netflix' : ''}`} />
                <span>TV</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/movies"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Film className={`w-5 h-5 ${isActive ? 'text-netflix' : ''}`} />
                <span>Movies</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/library"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <FolderHeart className={`w-5 h-5 ${isActive ? 'text-netflix' : ''}`} />
                <span>Library</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/watchlist"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Bookmark className={`w-5 h-5 ${isActive ? 'text-netflix' : ''}`} />
                <span>Watchlist</span>
              </>
            )}
          </NavLink>
        </nav>
      )}

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
