import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Plus, Check, Star, Clock, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { watchlistApi } from '../../api/watchlist';
import type { Movie } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatYear, formatRuntime } from '../../utils/timeUtils';
import { ProgressBar } from '../cards/ProgressBar';
import { TMDBMatchModal } from './TMDBMatchModal';

interface MovieDetailModalProps {
  movie: Movie | null;
  onClose: () => void;
  onPlay: (movie: Movie) => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  movie,
  onClose,
  onPlay,
}) => {
  const queryClient = useQueryClient();
  const [showMatchModal, setShowMatchModal] = useState(false);

  const { data: watchlistStatus } = useQuery({
    queryKey: ['watchlist-check', 'movie', movie?.id],
    queryFn: () => (movie ? watchlistApi.checkWatchlist('movie', movie.id) : { in_watchlist: false }),
    enabled: !!movie,
  });

  const toggleWatchlist = useMutation({
    mutationFn: async () => {
      if (!movie) return;
      if (watchlistStatus?.in_watchlist) {
        await watchlistApi.removeFromWatchlist('movie', movie.id);
      } else {
        await watchlistApi.addToWatchlist('movie', movie.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist-check', 'movie', movie?.id] });
    },
  });

  if (!movie) return null;

  const backdrop = movie.backdrop_path || movie.poster_path;
  const year = formatYear(movie.release_date || '');
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
  const genres = movie.genres?.join(' • ');
  const hasProgress = movie.progress && movie.progress.position > 0 && !movie.progress.completed;

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
          className="relative w-full max-w-3xl bg-[#181818] text-white rounded-t-xl md:rounded-xl overflow-hidden shadow-2xl z-10 my-auto flex flex-col"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/20"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Banner */}
          <div className="relative w-full h-[320px] md:h-[400px] shrink-0 bg-neutral-900">
            <ImageWithFallback
              src={backdrop}
              alt={movie.title}
              className="w-full h-full object-cover object-top"
            />
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent w-2/3" />

            {/* Banner Content */}
            <div className="absolute bottom-6 left-6 md:left-10 right-6 z-20 space-y-3">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-lg">
                {movie.title}
              </h1>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => onPlay(movie)}
                  className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded hover:bg-neutral-200 transition-colors shadow-lg active:scale-95 text-sm"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>{hasProgress ? 'Resume Movie' : 'Play Movie'}</span>
                </button>

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
                  <span>{movie.tmdb_id ? 'Fix Match' : 'Match TMDB'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 md:p-10 space-y-6">
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
              {rating && (
                <span className="flex items-center gap-1 text-green-400 font-bold">
                  <Star className="w-4 h-4 fill-current" />
                  {rating}
                </span>
              )}
              {year && <span>{year}</span>}
              {movie.runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatRuntime(movie.runtime)}
                </span>
              )}
              {genres && <span className="text-neutral-400">{genres}</span>}
            </div>

            {hasProgress && movie.progress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Playback Progress</span>
                  <span>{Math.round(movie.progress.position / 60)} min / {Math.round(movie.progress.duration / 60)} min</span>
                </div>
                <ProgressBar position={movie.progress.position} duration={movie.progress.duration} height={4} />
              </div>
            )}

            <p className="text-neutral-200 text-sm md:text-base leading-relaxed">
              {movie.overview || 'No synopsis available for this movie.'}
            </p>

            <div className="text-xs text-neutral-500 pt-4 border-t border-neutral-800 space-y-1">
              <div><span className="font-semibold text-neutral-400">File: </span>{movie.file_path}</div>
              {movie.tmdb_id && <div><span className="font-semibold text-neutral-400">TMDB ID: </span>{movie.tmdb_id}</div>}
            </div>
          </div>
        </motion.div>
      </div>

      {showMatchModal && (
        <TMDBMatchModal
          mediaType="movie"
          mediaId={movie.id}
          currentTitle={movie.title}
          onClose={() => setShowMatchModal(false)}
          onMatched={() => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
            queryClient.invalidateQueries({ queryKey: ['home'] });
            onClose();
          }}
        />
      )}
    </AnimatePresence>
  );
};
