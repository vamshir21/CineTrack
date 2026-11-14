import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    <div className="min-h-screen bg-[#141414] pt-24 px-8 md:px-12 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-wide">My Library</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Consolidated local media collection ({items.length} titles)
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-[#222] p-1 rounded-lg border border-neutral-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-netflix text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Titles
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
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
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
        <div className="text-center py-24 text-neutral-500">
          <p className="text-lg font-semibold">Your library is currently empty</p>
          <p className="text-xs mt-1">Add local media folders and run a scan in Settings.</p>
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
