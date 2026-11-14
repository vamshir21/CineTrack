import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Settings, Film } from 'lucide-react';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-[68px] flex items-center px-12 transition-all duration-500 ${
        scrolled
          ? 'bg-[#141414]'
          : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      {/* Logo */}
      <NavLink to="/" className="mr-8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Film className="text-netflix w-6 h-6" />
          <span className="text-netflix font-black text-xl tracking-widest">CINETRACK</span>
        </div>
      </NavLink>

      {/* Nav links */}
      <div className="flex items-center gap-6 flex-1">
        <NavLink to="/" end className={navLinkClass}>
          Home
        </NavLink>
        <NavLink to="/tv" className={navLinkClass}>
          TV Shows
        </NavLink>
        <NavLink to="/movies" className={navLinkClass}>
          Movies
        </NavLink>
        <NavLink to="/library" className={navLinkClass}>
          My Library
        </NavLink>
        <NavLink to="/watchlist" className={navLinkClass}>
          Watchlist
        </NavLink>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
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
                className="bg-transparent text-white placeholder-white/50 text-sm px-3 py-1.5 outline-none w-56"
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false);
                }}
              />
            </div>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="text-white hover:text-white/80 transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        <NavLink
          to="/settings"
          className="text-white hover:text-white/80 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </NavLink>
      </div>
    </nav>
  );
}
