import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { watchlistApi } from '../api/watchlist';
import { playbackApi } from '../api/playback';
import { MediaCard } from '../components/cards/MediaCard';
import { MovieDetailModal } from '../components/modals/MovieDetailModal';
import { SeriesDetailModal } from '../components/modals/SeriesDetailModal';
import { usePlaybackStore } from '../store/playbackStore';
import type { MediaItem, Movie, TVSeries, Episode } from '../types';
import { isMovie } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ArrowLeft, Film, PlusCircle } from 'lucide-react';

export const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<TVSeries | null>(null);
  const { setPlayerOpen } = usePlaybackStore();

  const { data: watchlistData, isLoading, isError, refetch } = useQuery({
    queryKey: ['watchlist'],
    queryFn: watchlistApi.getWatchlist,
  });

  // Extract valid items safely
  const items: MediaItem[] = React.useMemo(() => {
    if (!watchlistData || !Array.isArray(watchlistData)) return [];
    return watchlistData
      .map((entry: any) => {
        // Handle both entry.item and direct entry
        const item = entry.item || entry.details || (entry.title ? entry : null);
        return item;
      })
      .filter((item): item is MediaItem => Boolean(item && typeof item === 'object' && item.id && item.title));
  }, [watchlistData]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] pt-24 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[#141414] pt-28 px-8 md:px-16 text-white flex flex-col items-center justify-center text-center">
        <p className="text-xl font-bold mb-2">Unable to load watchlist</p>
        <p className="text-sm text-neutral-400 mb-6">Could not fetch your saved titles from the library.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 rounded text-xs font-semibold"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2 bg-netflix hover:bg-netflix-hover rounded text-xs font-bold"
          >
            Back to Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#141414] pt-24 px-8 md:px-16 pb-24 text-white">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 p-2 hover:bg-neutral-800/80 rounded-full transition-colors text-neutral-300 hover:text-white"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-wide">My Watchlist</h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                {items.length} {items.length === 1 ? 'title' : 'titles'} saved for later
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <span>Explore All Titles</span>
          </button>
        </div>

        {/* Content Grid or Rich Empty State */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-8">
            {items.map((item) => (
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
          <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-full text-neutral-500 mb-2">
              <PlusCircle className="w-12 h-12 text-netflix" />
            </div>
            <h2 className="text-xl font-bold text-white">Your Watchlist is empty</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Never lose track of what you want to stream. Click the <span className="inline-block px-1.5 py-0.5 bg-neutral-800 rounded text-white text-xs font-mono">+</span> button on any movie or TV series to add it to this list.
            </p>
            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={() => navigate('/movies')}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-neutral-200 rounded text-xs font-bold transition-colors shadow"
              >
                <Film className="w-4 h-4 fill-black" />
                <span>Browse Movies</span>
              </button>
              <button
                onClick={() => navigate('/tv')}
                className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold transition-colors border border-neutral-700"
              >
                <span>Browse TV Shows</span>
              </button>
            </div>
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
    </ErrorBoundary>
  );
};
