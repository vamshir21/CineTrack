import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../api/search';
import { playbackApi } from '../api/playback';
import { MediaCard } from '../components/cards/MediaCard';
import { MovieDetailModal } from '../components/modals/MovieDetailModal';
import { SeriesDetailModal } from '../components/modals/SeriesDetailModal';
import { usePlaybackStore } from '../store/playbackStore';
import type { MediaItem, Movie, TVSeries, Episode } from '../types';
import { isMovie } from '../types';
import { Search as SearchIcon } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<TVSeries | null>(null);
  const { setPlayerOpen } = usePlaybackStore();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim()) {
        setSearchParams({ q: query.trim() });
      } else {
        setSearchParams({});
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, setSearchParams]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });

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

  const movies = searchResults?.movies || [];
  const series = searchResults?.series || [];
  const episodes = searchResults?.episodes || [];
  const totalCount = movies.length + series.length + episodes.length;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 px-8 md:px-12 pb-24">
      {/* Search Bar */}
      <div className="max-w-2xl mb-10">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-4 text-neutral-400 w-5 h-5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, series, episode name..."
            autoFocus
            className="w-full bg-[#202020] border border-neutral-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-netflix transition-colors text-base"
          />
        </div>
      </div>

      {/* Results Header */}
      {debouncedQuery.trim() && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">
            {isLoading ? 'Searching...' : `Results for "${debouncedQuery}" (${totalCount})`}
          </h2>
        </div>
      )}

      {/* Movies Section */}
      {movies.length > 0 && (
        <div className="mb-10">
          <h3 className="text-base font-semibold text-neutral-400 mb-3">Movies ({movies.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {movies.map((movie) => (
              <MediaCard
                key={movie.id}
                item={movie}
                variant="poster"
                onClick={() => handleItemClick(movie)}
                onPlay={() => handlePlayMedia(movie)}
              />
            ))}
          </div>
        </div>
      )}

      {/* TV Series Section */}
      {series.length > 0 && (
        <div className="mb-10">
          <h3 className="text-base font-semibold text-neutral-400 mb-3">TV Shows ({series.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {series.map((show) => (
              <MediaCard
                key={show.id}
                item={show}
                variant="poster"
                onClick={() => handleItemClick(show)}
                onPlay={() => handlePlayMedia(show)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Episodes Section */}
      {episodes.length > 0 && (
        <div className="mb-10">
          <h3 className="text-base font-semibold text-neutral-400 mb-3">Episodes ({episodes.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => handlePlayEpisode(ep)}
                className="bg-[#1e1e1e] hover:bg-[#282828] p-3 rounded-lg cursor-pointer transition-colors border border-neutral-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                    <span>S{ep.season_number} E{ep.episode_number}</span>
                    {ep.runtime && <span>{ep.runtime} min</span>}
                  </div>
                  <h4 className="font-bold text-white text-sm line-clamp-1">{ep.title}</h4>
                  <p className="text-xs text-neutral-400 line-clamp-2 mt-1">{ep.overview}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-neutral-800 text-[11px] text-neutral-500 truncate">
                  {ep.file_path}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {debouncedQuery.trim() && !isLoading && totalCount === 0 && (
        <div className="text-center py-20 text-neutral-500">
          <p className="text-lg font-semibold">No matches found</p>
          <p className="text-xs mt-1">Try a different title or keyword.</p>
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
