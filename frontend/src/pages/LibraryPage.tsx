import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, Tv, HardDrive, Clock, CheckCircle2, Search, ArrowUpDown } from 'lucide-react';
import { libraryApi } from '../api/library';
import { playbackApi } from '../api/playback';
import { MediaCard } from '../components/cards/MediaCard';
import { MovieDetailModal } from '../components/modals/MovieDetailModal';
import { SeriesDetailModal } from '../components/modals/SeriesDetailModal';
import { usePlaybackStore } from '../store/playbackStore';
import type { MediaItem, Movie, TVSeries, Episode } from '../types';
import { isMovie } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const LibraryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'title'>('recent');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<TVSeries | null>(null);
  const { setPlayerOpen } = usePlaybackStore();

  const { data: movies, isLoading: isMoviesLoading } = useQuery({
    queryKey: ['movies'],
    queryFn: libraryApi.getMovies,
  });

  const { data: seriesList, isLoading: isSeriesLoading } = useQuery({
    queryKey: ['series'],
    queryFn: libraryApi.getSeries,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: libraryApi.getStats,
  });

  const items = useMemo(() => {
    const m = movies || [];
    const s = seriesList || [];

    if (activeTab === 'movies') return m;
    if (activeTab === 'series') return s;

    // Combine and sort by added_at desc
    const combined: MediaItem[] = [...m, ...s];
    combined.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    return combined;
  }, [movies, seriesList, activeTab]);

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }
    if (sortBy === 'rating') {
      result.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    }
    return result;
  }, [items, searchQuery, sortBy]);

  const handlePlayMedia = async (item: MediaItem) => {
    if (isMovie(item)) {
      if (!item.file_path) return;
      await playbackApi.play({
        file_path: item.file_path,
        position: item.progress?.position || 0,
        media_type: 'movie',
        media_id: item.id,
      });
      setPlayerOpen(true);
    } else {
      setSelectedSeries(item);
    }
  };

  const handlePlayEpisode = async (ep: Episode) => {
    if (!ep.file_path) return;
    await playbackApi.play({
      file_path: ep.file_path,
      position: ep.progress?.position || 0,
      media_type: 'episode',
      media_id: ep.id,
    });
    setPlayerOpen(true);
  };

  const handleItemClick = (item: MediaItem) => {
    if (isMovie(item)) {
      setSelectedMovie(item);
    } else {
      setSelectedSeries(item);
    }
  };

  const isLoading = isMoviesLoading || isSeriesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] pt-24 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 px-8 md:px-12 pb-24 space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-wide">My Library</h1>
        <p className="text-xs text-neutral-400 mt-1">
          High-performance local media storage & streaming center
        </p>
      </div>

      {/* Pro Stats Dashboard Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 flex items-center space-x-3 shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-netflix/15 border border-netflix/30 flex items-center justify-center text-netflix">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Movies</p>
              <p className="text-xl font-black text-white">{stats.total_movies}</p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 flex items-center space-x-3 shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Shows / Eps</p>
              <p className="text-xl font-black text-white">
                {stats.total_series} <span className="text-xs font-normal text-zinc-400">({stats.total_episodes} eps)</span>
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 flex items-center space-x-3 shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Storage Used</p>
              <p className="text-xl font-black text-white">{stats.total_size_formatted}</p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 flex items-center space-x-3 shadow-lg">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Watch Time</p>
              <p className="text-xl font-black text-white">{stats.total_watch_formatted}</p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3.5 flex items-center space-x-3 shadow-lg col-span-2 sm:col-span-1">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">Finished</p>
              <p className="text-xl font-black text-white">
                {stats.completed_titles} <span className="text-xs font-normal text-zinc-400">titles</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-[#222] p-1 rounded-lg border border-neutral-800 w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-netflix text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Titles ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('movies')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === 'movies'
                ? 'bg-netflix text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Movies ({movies?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === 'series'
                ? 'bg-netflix text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            TV Series ({seriesList?.length || 0})
          </button>
        </div>

        {/* Search & Sort controls */}
        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in library..."
              className="bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 w-48 sm:w-60"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-neutral-900">Recently Added</option>
              <option value="rating" className="bg-neutral-900">Highest Rated</option>
              <option value="title" className="bg-neutral-900">Title (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredAndSortedItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filteredAndSortedItems.map((item) => (
            <MediaCard
              key={`${item.id}-${isMovie(item) ? 'movie' : 'series'}`}
              item={item}
              variant="poster"
              onClick={() => handleItemClick(item)}
              onPlay={() => handlePlayMedia(item)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 text-neutral-500">
          <p className="text-lg font-semibold">
            {searchQuery ? `No results matching "${searchQuery}"` : 'Your library is currently empty'}
          </p>
          <p className="text-xs mt-1">
            {searchQuery ? 'Try clearing your search term' : 'Add local media folders and run a scan in Settings.'}
          </p>
        </div>
      )}

      {/* Series Detail Modal */}
      {selectedSeries && (
        <SeriesDetailModal
          series={selectedSeries}
          onClose={() => setSelectedSeries(null)}
          onPlayEpisode={handlePlayEpisode}
        />
      )}

      {/* Movie Detail Modal */}
      {selectedMovie && (
        <MovieDetailModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={(m) => {
            setSelectedMovie(null);
            handlePlayMedia(m);
          }}
        />
      )}
    </div>
  );
};
