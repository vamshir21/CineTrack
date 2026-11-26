import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../api/library';
import { MediaCard } from '../components/cards/MediaCard';
import { SeriesDetailModal } from '../components/modals/SeriesDetailModal';
import { usePlaybackStore } from '../store/playbackStore';
import { usePlayMedia } from '../hooks/usePlayMedia';
import type { TVSeries, Episode } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const TVShowsPage: React.FC = () => {
  const [selectedSeries, setSelectedSeries] = useState<TVSeries | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const { setPlayerOpen } = usePlaybackStore();
  const { playEpisode } = usePlayMedia();

  const { data: seriesList, isLoading } = useQuery({
    queryKey: ['series'],
    queryFn: libraryApi.getSeries,
  });

  const allGenres = useMemo(() => {
    if (!seriesList) return [];
    const set = new Set<string>();
    seriesList.forEach((s) => s.genres?.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [seriesList]);

  const allLanguages = useMemo(() => {
    if (!seriesList) return [];
    const set = new Set<string>();
    seriesList.forEach((s) => s.languages?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [seriesList]);

  const filteredSeries = useMemo(() => {
    if (!seriesList) return [];
    let list = [...seriesList];

    if (selectedGenre !== 'all') {
      list = list.filter((s) => s.genres?.includes(selectedGenre));
    }

    if (selectedLanguage !== 'all') {
      list = list.filter((s) => s.languages?.includes(selectedLanguage));
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    } else if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [seriesList, selectedGenre, selectedLanguage, sortBy]);

  const handlePlayEpisode = async (ep: Episode) => {
    playEpisode(ep, selectedSeries || undefined);
    setPlayerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] pt-24 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-20 sm:pt-24 px-4 sm:px-8 md:px-12 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">TV Shows</h1>
          <p className="text-xs text-neutral-400 mt-1">
            {filteredSeries.length} consolidated series in local library
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-2.5 sm:px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-netflix cursor-pointer"
          >
            <option value="all">All Genres</option>
            {allGenres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Language select */}
          {allLanguages.length > 0 && (
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-2.5 sm:px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-netflix cursor-pointer"
            >
              <option value="all">All Languages</option>
              {allLanguages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-2.5 sm:px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-netflix cursor-pointer"
          >
            <option value="recent">Recently Added</option>
            <option value="rating">Top Rated</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Grid of TV Series Cards - Exactly 1 card per series */}
      {filteredSeries.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
          {filteredSeries.map((series) => (
            <MediaCard
              key={series.id}
              item={series}
              variant="poster"
              onClick={() => setSelectedSeries(series)}
              onPlay={() => setSelectedSeries(series)}
              fluidWidth={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-neutral-500">
          <p className="text-lg font-semibold">No TV shows found</p>
          <p className="text-xs mt-1">Add folders and scan media in Settings to import TV series.</p>
        </div>
      )}

      {/* Series Detail Modal with Seasons and Episodes */}
      {selectedSeries && (
        <SeriesDetailModal
          series={selectedSeries}
          onClose={() => setSelectedSeries(null)}
          onPlayEpisode={handlePlayEpisode}
        />
      )}

    </div>
  );
};
