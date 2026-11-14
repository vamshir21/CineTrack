import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../api/library';
import { playbackApi } from '../api/playback';
import { HeroSection } from '../components/hero/HeroSection';
import { ContentRail } from '../components/rails/ContentRail';
import { SeriesDetailModal } from '../components/modals/SeriesDetailModal';
import { MovieDetailModal } from '../components/modals/MovieDetailModal';
import { usePlaybackStore } from '../store/playbackStore';
import type { MediaItem, Movie, TVSeries, Episode } from '../types';
import { isMovie } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const HomePage: React.FC = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<TVSeries | null>(null);
  const { setPlayerOpen } = usePlaybackStore();

  const { data: homeData, isLoading, error } = useQuery({
    queryKey: ['home'],
    queryFn: libraryApi.getHome,
    refetchInterval: 3000,
  });

  const handlePlayMedia = async (item: MediaItem) => {
    const rawItem = item as any;
    const isEp = rawItem.media_type === 'episode' || 'season_number' in rawItem || 'series_id' in rawItem;
    if (isEp) {
      if (!rawItem.file_path) return;
      await playbackApi.play({
        file_path: rawItem.file_path,
        position: rawItem.progress?.position || 0,
        media_type: 'episode',
        media_id: rawItem.id,
      });
      return;
    }

    if (isMovie(item)) {
      if (!item.file_path) return;
      await playbackApi.play({
        file_path: item.file_path,
        position: item.progress?.position || 0,
        media_type: 'movie',
        media_id: item.id,
      });
    } else {
      // For series, open detail modal so user can pick episode or resume
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
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !homeData) {
    return (
      <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center text-white px-4">
        <p className="text-xl font-bold text-neutral-300 mb-2">Unable to load media library</p>
        <p className="text-sm text-neutral-500 mb-6">Make sure the CineTrack backend service is running.</p>
      </div>
    );
  }

  const { featured, rails } = homeData;

  return (
    <div className="min-h-screen bg-[#141414] pb-24">
      {/* Featured Hero Banner */}
      <HeroSection
        items={featured || []}
        onPlay={handlePlayMedia}
        onMoreInfo={handleItemClick}
      />

      {/* Content Rails */}
      <div className="relative -mt-8 sm:-mt-12 md:-mt-16 z-20 space-y-6">
        {/* Continue Watching (Backdrop 16:9 ratio) */}
        {rails.continue_watching && rails.continue_watching.length > 0 && (
          <ContentRail
            title="Continue Watching"
            items={rails.continue_watching}
            variant="backdrop"
            onItemClick={handleItemClick}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Recently Added (Posters 2:3 ratio) */}
        {rails.recently_added && rails.recently_added.length > 0 && (
          <ContentRail
            title="Recently Added"
            items={rails.recently_added}
            variant="poster"
            onItemClick={handleItemClick}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Popular Movies */}
        {rails.popular_movies && rails.popular_movies.length > 0 && (
          <ContentRail
            title="Movies"
            items={rails.popular_movies}
            variant="poster"
            onItemClick={handleItemClick}
            onPlay={handlePlayMedia}
          />
        )}

        {/* TV Series (Consolidated - one card per show) */}
        {rails.all_series && rails.all_series.length > 0 && (
          <ContentRail
            title="TV Shows"
            items={rails.all_series}
            variant="poster"
            onItemClick={handleItemClick}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Watchlist */}
        {rails.watchlist && rails.watchlist.length > 0 && (
          <ContentRail
            title="My Watchlist"
            items={rails.watchlist}
            variant="poster"
            onItemClick={handleItemClick}
            onPlay={handlePlayMedia}
          />
        )}
      </div>

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
