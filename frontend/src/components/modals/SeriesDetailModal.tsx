import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Plus, Check, Star, Clock, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryApi } from '../../api/library';
import { watchlistApi } from '../../api/watchlist';
import type { TVSeries, Episode, Season } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProgressBar } from '../cards/ProgressBar';
import { formatYear, formatRuntime } from '../../utils/timeUtils';
import { TMDBMatchModal } from './TMDBMatchModal';

interface SeriesDetailModalProps {
  series: TVSeries | null;
  onClose: () => void;
  onPlayEpisode: (episode: Episode) => void;
}

export const SeriesDetailModal: React.FC<SeriesDetailModalProps> = ({
  series,
  onClose,
  onPlayEpisode,
}) => {
  const queryClient = useQueryClient();
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [showMatchModal, setShowMatchModal] = useState(false);

  // Fetch full series details with seasons
  const { data: fullSeries } = useQuery({
    queryKey: ['series', series?.id],
    queryFn: () => (series ? libraryApi.getSeriesById(series.id) : null),
    enabled: !!series,
  });

  // Watchlist status
  const { data: watchlistStatus } = useQuery({
    queryKey: ['watchlist-check', 'series', series?.id],
    queryFn: () => (series ? watchlistApi.checkWatchlist('series', series.id) : { in_watchlist: false }),
    enabled: !!series,
  });

  // Fetch episodes for selected season
  const { data: episodes, isLoading: isEpisodesLoading } = useQuery({
    queryKey: ['episodes', series?.id, selectedSeason],
    queryFn: () => (series ? libraryApi.getSeasonEpisodes(series.id, selectedSeason) : []),
    enabled: !!series,
  });

  // Watchlist mutation
  const toggleWatchlist = useMutation({
    mutationFn: async () => {
      if (!series) return;
      if (watchlistStatus?.in_watchlist) {
        await watchlistApi.removeFromWatchlist('series', series.id);
      } else {
        await watchlistApi.addToWatchlist('series', series.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist-check', 'series', series?.id] });
    },
  });

  // Set default season if available
  useEffect(() => {
    if (fullSeries && 'seasons' in fullSeries) {
      const seasons = (fullSeries as any).seasons as Season[];
      if (seasons && seasons.length > 0) {
        setSelectedSeason(seasons[0].season_number);
      }
    }
  }, [fullSeries]);

  if (!series) return null;

  const displayData = fullSeries || series;
  const seasons = ('seasons' in displayData ? (displayData as any).seasons : []) as Season[];
  const backdrop = displayData.backdrop_path || displayData.poster_path;
  const year = formatYear(displayData.first_air_date || '');
  const rating = displayData.vote_average ? displayData.vote_average.toFixed(1) : null;
  const genres = displayData.genres?.join(' • ');

  // Find first unwatched or in-progress episode
  const firstEpisodeToPlay = episodes && episodes.length > 0 ? episodes[0] : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex justify-center p-0 md:p-6 sm:p-4">
        {/* Backdrop dismiss */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-4xl bg-[#181818] text-white rounded-t-xl md:rounded-xl overflow-hidden shadow-2xl z-10 my-auto min-h-[85vh] max-h-[92vh] flex flex-col"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/20"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header Banner */}
          <div className="relative w-full h-[320px] md:h-[400px] shrink-0 bg-neutral-900">
            <ImageWithFallback
              src={backdrop}
              alt={displayData.title}
              className="w-full h-full object-cover object-top"
            />
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent w-2/3" />

            {/* Banner Content */}
            <div className="absolute bottom-6 left-6 md:left-10 right-6 z-20 space-y-3">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-lg">
                {displayData.title}
              </h1>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                {firstEpisodeToPlay && (
                  <button
                    onClick={() => onPlayEpisode(firstEpisodeToPlay)}
                    className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded hover:bg-neutral-200 transition-colors shadow-lg active:scale-95 text-sm"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Play S{selectedSeason} E1</span>
                  </button>
                )}

                <button
                  onClick={() => toggleWatchlist.mutate()}
                  className="flex items-center gap-2 bg-neutral-800/80 hover:bg-neutral-700 text-white font-medium px-4 py-2.5 rounded border border-white/20 transition-colors text-sm"
                >
                  {watchlistStatus?.in_watchlist ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span>In Watchlist</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Watchlist</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowMatchModal(true)}
                  className="flex items-center gap-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium px-3.5 py-2.5 rounded border border-white/20 transition-colors text-sm"
                  title="Search & match on TMDB"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>{displayData.tmdb_id ? 'Fix Match' : 'Match TMDB'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Body / Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-6">
            {/* Metadata & Synopsis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
                  {rating && (
                    <span className="flex items-center gap-1 text-green-400 font-bold">
                      <Star className="w-4 h-4 fill-current" />
                      {rating}
                    </span>
                  )}
                  {year && <span>{year}</span>}
                  {displayData.number_of_seasons && (
                    <span className="border border-neutral-600 px-1.5 py-0.5 rounded text-xs">
                      {displayData.number_of_seasons} Season{displayData.number_of_seasons > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <p className="text-neutral-200 text-sm md:text-base leading-relaxed">
                  {displayData.overview || 'No synopsis available for this TV series.'}
                </p>
              </div>

              {/* Right column details */}
              <div className="space-y-2 text-xs md:text-sm text-neutral-400">
                {genres && (
                  <div>
                    <span className="text-neutral-500 font-semibold">Genres: </span>
                    <span className="text-neutral-200">{genres}</span>
                  </div>
                )}
                {displayData.tmdb_id && (
                  <div>
                    <span className="text-neutral-500 font-semibold">TMDB ID: </span>
                    <span className="text-neutral-200">{displayData.tmdb_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <hr className="border-neutral-800" />

            {/* Seasons & Episodes Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white tracking-wide">Episodes</h3>

                {/* Season Dropdown */}
                {seasons.length > 0 ? (
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-netflix cursor-pointer"
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.season_number}>
                        {s.name || `Season ${s.season_number}`} ({s.episode_count} eps)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-neutral-400">Season {selectedSeason}</span>
                )}
              </div>

              {/* Episode List */}
              {isEpisodesLoading ? (
                <div className="py-12 text-center text-neutral-400 text-sm">
                  Loading episodes...
                </div>
              ) : episodes && episodes.length > 0 ? (
                <div className="space-y-3 divide-y divide-neutral-800/60">
                  {episodes.map((ep: Episode) => {
                    const hasProgress = ep.progress && ep.progress.position > 0 && !ep.progress.completed;
                    const isWatched = ep.progress?.completed;

                    return (
                      <div
                        key={ep.id}
                        className="pt-3 group flex items-start sm:items-center gap-4 p-3 rounded-lg hover:bg-neutral-800/60 transition-colors cursor-pointer"
                        onClick={() => onPlayEpisode(ep)}
                      >
                        {/* Episode Number */}
                        <span className="text-lg md:text-xl font-bold text-neutral-400 w-6 text-center shrink-0">
                          {ep.episode_number}
                        </span>

                        {/* Thumbnail */}
                        <div className="relative w-28 sm:w-36 aspect-video shrink-0 rounded overflow-hidden bg-neutral-900">
                          <ImageWithFallback
                            src={ep.still_path || backdrop}
                            alt={ep.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="p-2 rounded-full bg-black/60 text-white group-hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 fill-white" />
                            </div>
                          </div>
                          {/* Progress overlay */}
                          {hasProgress && ep.progress && (
                            <div className="absolute bottom-0 inset-x-0">
                              <ProgressBar position={ep.progress.position} duration={ep.progress.duration} height={3} />
                            </div>
                          )}
                          {isWatched && (
                            <div className="absolute top-1 right-1 bg-netflix text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              WATCHED
                            </div>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-netflix transition-colors truncate">
                              {ep.title || `Episode ${ep.episode_number}`}
                            </h4>
                            {ep.runtime && (
                              <span className="text-xs text-neutral-400 shrink-0 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatRuntime(ep.runtime)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                            {ep.overview || 'No episode description available.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500 text-sm">
                  No episodes found for this season.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {showMatchModal && (
        <TMDBMatchModal
          mediaType="tv"
          mediaId={displayData.id}
          currentTitle={displayData.title}
          onClose={() => setShowMatchModal(false)}
          onMatched={() => {
            queryClient.invalidateQueries({ queryKey: ['series'] });
            queryClient.invalidateQueries({ queryKey: ['home'] });
            onClose();
          }}
        />
      )}
    </AnimatePresence>
  );
};
