import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  Settings,
  Film,
  Shuffle,
  Keyboard,
  Sun,
  Moon,
  Smartphone,
  ChevronDown,
  Shield,
  Users,
  Eye,
} from 'lucide-react';
import { applyTheme, getInitialTheme } from '../../utils/themeUtils';
import { useProfileStore, getAvatarPreset } from '../../store/profileStore';

interface NavbarProps {
  onOpenPlaySomething?: () => void;
  onOpenShortcuts?: () => void;
  onOpenLanModal?: () => void;
}

export function Navbar({ onOpenPlaySomething, onOpenShortcuts, onOpenLanModal }: NavbarProps = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTheme, setCurrentTheme] = useState(getInitialTheme());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { activeProfile, setProfileSelectorOpen } = useProfileStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.theme) setCurrentTheme(e.detail.theme);
    };
    window.addEventListener('cinetrack_theme_changed', handler);
    return () => window.removeEventListener('cinetrack_theme_changed', handler);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const next = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(next);
    applyTheme(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors duration-200 hover:text-white ${
      isActive ? 'text-white font-bold' : 'text-[#e5e5e5]'
    }`;

  const avatarPreset = activeProfile ? getAvatarPreset(activeProfile.avatar) : null;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-[68px] flex items-center px-6 md:px-12 transition-all duration-500 ${
        scrolled ? 'bg-[#141414]' : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      {/* Logo */}
      <NavLink to="/" className="mr-6 md:mr-8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Film className="text-netflix w-6 h-6" />
          <span className="text-netflix font-black text-xl tracking-widest">CINETRACK</span>
        </div>
      </NavLink>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-6 flex-1">
        <NavLink to="/" end className={navLinkClass}>
          Home
        </NavLink>
        <NavLink to="/tv" className={navLinkClass}>
          TV Shows
        </NavLink>
        <NavLink to="/movies" className={navLinkClass}>
          Movies
        </NavLink>
        <NavLink to="/upcoming" className={navLinkClass}>
          Upcoming
        </NavLink>
        <NavLink to="/library" className={navLinkClass}>
          My Library
        </NavLink>
        <NavLink to="/watchlist" className={navLinkClass}>
          Watchlist
        </NavLink>
      </div>

      <div className="flex-1 md:flex-initial" />

      {/* Right side actions */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        {/* Stream on Phone & TV LAN Button */}
        {onOpenLanModal && (
          <button
            onClick={onOpenLanModal}
            className="flex items-center gap-1.5 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Stream on Phone & TV over LAN"
          >
            <Smartphone className="w-3.5 h-3.5 text-netflix" />
            <span className="hidden sm:inline">Phone & TV</span>
          </button>
        )}

        {/* Play Something button */}
        {onOpenPlaySomething && (
          <button
            onClick={onOpenPlaySomething}
            className="hidden sm:flex items-center gap-1.5 bg-[#222]/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Play Something (S)"
          >
            <Shuffle className="w-3.5 h-3.5 text-netflix" />
            <span>Play Something</span>
          </button>
        )}

        {/* Search */}
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="flex items-center bg-black/80 border border-white/50 rounded">
              <Search className="ml-2 text-white w-4 h-4" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Titles, people, genres"
                className="bg-transparent text-white placeholder-white/50 text-sm px-3 py-1.5 outline-none w-44 sm:w-56"
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false);
                }}
              />
            </div>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="text-white hover:text-white/80 transition-colors p-1"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="text-neutral-300 hover:text-white transition-colors p-1"
          title={currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle theme"
        >
          {currentTheme === 'light' ? (
            <Moon className="w-5 h-5 text-neutral-700 hover:text-black" />
          ) : (
            <Sun className="w-5 h-5 text-amber-400 hover:text-amber-300" />
          )}
        </button>

        {/* Settings */}
        <NavLink
          to="/settings"
          className="text-white hover:text-white/80 transition-colors p-1"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </NavLink>

        {/* Shortcuts */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="hidden sm:inline-block text-neutral-400 hover:text-white transition-colors p-1"
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard className="w-5 h-5" />
          </button>
        )}

        {/* Profile Avatar & Dropdown */}
        {activeProfile && avatarPreset && (
          <div className="relative ml-1 sm:ml-2" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/10 transition-colors focus:outline-none"
              title={`Active Profile: ${activeProfile.name}`}
            >
              <div
                className={`w-8 h-8 rounded-md ${avatarPreset.bg} flex items-center justify-center text-base shadow border border-white/20`}
              >
                <span>{avatarPreset.icon}</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-300 transition-transform ${
                  profileMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#181818] border border-neutral-700/80 shadow-2xl p-3 z-50 text-white animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Active Profile Info */}
                <div className="flex items-center gap-3 p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 mb-2">
                  <div
                    className={`w-10 h-10 rounded-lg ${avatarPreset.bg} flex items-center justify-center text-xl shadow flex-shrink-0`}
                  >
                    <span>{avatarPreset.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm truncate">{activeProfile.name}</span>
                      {activeProfile.is_admin ? (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5 fill-amber-400" />
                          Admin
                        </span>
                      ) : (
                        <span className="bg-neutral-800 text-neutral-300 border border-neutral-700 text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Eye className="w-2.5 h-2.5" />
                          Viewer
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {activeProfile.is_admin
                        ? 'Full admin library control'
                        : 'Read-only watch access'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setProfileSelectorOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors text-left"
                  >
                    <Users className="w-4 h-4 text-netflix" />
                    <span>Switch Profile</span>
                  </button>

                  {onOpenLanModal && (
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onOpenLanModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors text-left"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span>Stream on Phone & TV</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
