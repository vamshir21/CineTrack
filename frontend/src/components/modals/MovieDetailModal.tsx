import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Plus, Check, Clock, Sparkles, Trash2, CheckCircle2, Film } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { watchlistApi } from '../../api/watchlist';
import { libraryApi } from '../../api/library';
import { tmdbApi } from '../../api/tmdb';
import type { Movie } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatYear, formatRuntime } from '../../utils/timeUtils';
import { extractMediaSpecs } from '../../utils/mediaBadgeUtils';
import { getLanguageBadgeStyle } from '../../utils/languageUtils';
import { ProgressBar } from '../cards/ProgressBar';
import { TMDBMatchModal } from './TMDBMatchModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { CastRail } from '../common/CastRail';
import { MoreLikeThisGrid } from '../common/MoreLikeThisGrid';
import { TrailerPlayer } from '../common/TrailerPlayer';
import { RatingBadges } from '../common/RatingBadges';
import { PersonDetailModal } from './PersonDetailModal';

interface MovieDetailModalProps {
  movie: Movie | null;
  onClose: () => void;
  onPlay: (movie: Movie) => void;
  onSelectMovie?: (movie: Movie) => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  movie,
  onClose,
  onPlay,
  onSelectMovie,
}) => {
  const queryClient = useQueryClient();
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string } | null>(null);

  // Rotten Tomatoes & IMDb Ratings
  const { data: ratingsData } = useQuery({
    queryKey: ['ratings', 'movie', movie?.tmdb_id],
    queryFn: () => (movie?.tmdb_id ? tmdbApi.getRatings('movie', movie.tmdb_id) : null),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  });

  // Watchlist status
  const { data: watchlistStatus } = useQuery({
    queryKey: ['watchlist-check', 'movie', movie?.id],
    queryFn: () => (movie ? watchlistApi.checkWatchlist('movie', movie.id) : { in_watchlist: false }),
    enabled: !!movie,
  });

  // Cast & Crew from TMDB
  const { data: creditsData } = useQuery({
    queryKey: ['credits', 'movie', movie?.tmdb_id],
    queryFn: () => (movie?.tmdb_id ? tmdbApi.getCredits('movie', movie.tmdb_id) : null),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  });

  // Official Trailer from TMDB
  const { data: trailerData } = useQuery({
    queryKey: ['trailer', 'movie', movie?.tmdb_id],
    queryFn: () => (movie?.tmdb_id ? tmdbApi.getTrailer('movie', movie.tmdb_id) : null),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  });

  // More Like This from Local Library
  const { data: moreLikeThisData } = useQuery({
    queryKey: ['more-like-this', 'movie', movie?.id],
    queryFn: () => (movie?.id ? libraryApi.getMoreLikeThis('movie', movie.id, 6) : []),
    enabled: !!movie?.id,
  });

  const isWatched = !!movie?.progress?.completed;
  const trailerKey = trailerData?.trailer?.key;

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

  const toggleWatched = useMutation({
    mutationFn: async () => {
      if (!movie) return;
      if (isWatched) {
        await libraryApi.markUnwatched('movie', movie.id);
      } else {
        await libraryApi.markWatched('movie', movie.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
  });

  const handleDeleteMovie = async (deleteFile: boolean) => {
    if (!movie) return;
    await libraryApi.deleteMovie(movie.id, deleteFile);
    queryClient.invalidateQueries({ queryKey: ['movies'] });
    queryClient.invalidateQueries({ queryKey: ['home'] });
    queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    onClose();
  };

  if (!movie) return null;

  const backdrop = movie.backdrop_path || movie.poster_path;
  const year = formatYear(movie.release_date || '');
  const genres = movie.genres?.join(' • ');
  const hasProgress = movie.progress && movie.progress.position > 0 && !movie.progress.completed;
  const specs = extractMediaSpecs(movie.file_path, movie.runtime || undefined);

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
          className="relative w-full max-w-4xl bg-[#181818] text-white rounded-t-xl md:rounded-xl overflow-hidden shadow-2xl z-10 my-auto flex flex-col min-h-[85vh] max-h-[92vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-40 p-2 bg-[#181818]/70 hover:bg-[#181818] text-white rounded-full transition-colors border border-white/20"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Banner Container */}
          <div className="relative w-full h-[340px] md:h-[420px] shrink-0 bg-neutral-900 overflow-hidden">
            {showTrailer && trailerKey ? (
              <div className="relative w-full h-full">
                <TrailerPlayer
                  videoKey={trailerKey}
                  autoPlay={true}
                  muted={false}
                  controls={true}
                  className="w-full h-full"
                />
                <button
                  onClick={() => setShowTrailer(false)}
                  className="absolute top-4 left-4 z-40 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white text-xs font-semibold border border-white/20 flex items-center gap-1.5 backdrop-blur-sm transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Exit Trailer</span>
                </button>
              </div>
            ) : (
              <>
                <ImageWithFallback
                  src={backdrop}
                  alt={movie.title}
                  className="w-full h-full object-cover object-top"
                />
                {/* Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-transparent to-transparent w-2/3" />
              </>
            )}

            {/* Banner Content & Actions */}
            <div className="absolute bottom-6 left-6 md:left-10 right-6 z-30 space-y-3 pointer-events-auto">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-lg">
                {movie.title}
              </h1>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onPlay(movie)}
                  className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded hover:bg-neutral-200 transition-colors shadow-lg active:scale-95 text-sm"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>{hasProgress ? 'Resume Movie' : 'Play Movie'}</span>
                </button>

                {trailerKey && (
                  <button
                    onClick={() => setShowTrailer(!showTrailer)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded border transition-colors text-sm font-semibold shadow-md active:scale-95 ${
                      showTrailer
                        ? 'bg-netflix text-white border-netflix'
                        : 'bg-neutral-800/80 hover:bg-neutral-700 text-white border-white/20'
                    }`}
                    title={showTrailer ? 'Close Trailer' : 'Watch Official Trailer'}
                  >
                    <Film className="w-4 h-4 text-netflix" />
                    <span>{showTrailer ? 'Hide Trailer' : 'Trailer'}</span>
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
                  onClick={() => toggleWatched.mutate()}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded border transition-colors text-sm font-medium ${
                    isWatched
                      ? 'bg-green-600/30 border-green-500/50 text-green-400 hover:bg-green-600/40'
                      : 'bg-neutral-800/80 border-white/20 text-neutral-300 hover:text-white hover:bg-neutral-700'
                  }`}
                  title={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isWatched ? 'Watched' : 'Mark Watched'}</span>
                </button>

                <button
                  onClick={() => setShowMatchModal(true)}
                  className="flex items-center gap-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium px-3.5 py-2.5 rounded border border-white/20 transition-colors text-sm"
                  title="Search & match on TMDB"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>{movie.tmdb_id ? 'Fix Match' : 'Match TMDB'}</span>
                </button>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 font-medium px-3.5 py-2.5 rounded border border-red-800/50 transition-colors text-sm ml-auto"
                  title="Delete movie from library"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          {/* Body / Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
            {/* Meta badges & synopsis */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
                <RatingBadges ratings={ratingsData} tmdbFallback={movie.vote_average} />
                {year && <span>{year}</span>}
                {movie.runtime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatRuntime(movie.runtime)}
                  </span>
                )}
                {genres && <span className="text-neutral-400">{genres}</span>}
              </div>

              {/* Media Quality & Specs Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="border border-neutral-600 text-neutral-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                  {specs.resolution}
                </span>
                {specs.hdr && (
                  <span className="border border-amber-500/80 text-amber-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                    {specs.hdr}
                  </span>
                )}
                <span className="border border-neutral-600 text-neutral-300 text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                  {specs.audio}
                </span>
                <span className="bg-neutral-800 border border-neutral-700 text-neutral-400 text-[10px] px-2 py-0.5 rounded font-mono">
                  {specs.container}
                </span>

                {/* Audio Languages */}
                {movie.languages && movie.languages.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-1">
                    {movie.languages.map((lang) => {
                      const style = getLanguageBadgeStyle(lang);
                      return (
                        <span
                          key={lang}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {lang}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {hasProgress && movie.progress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Playback Progress</span>
                    <span>
                      {Math.round(movie.progress.position / 60)} min / {Math.round(movie.progress.duration / 60)} min
                    </span>
                  </div>
                  <ProgressBar position={movie.progress.position} duration={movie.progress.duration} height={4} />
                </div>
              )}

              <p className="text-neutral-200 text-sm md:text-base leading-relaxed">
                {movie.overview || 'No synopsis available for this movie.'}
              </p>
            </div>

            {/* Cast & Crew Rail */}
            {creditsData && (
              <CastRail
                cast={creditsData.cast}
                crew={creditsData.crew}
                onSelectPerson={(id, name) => setSelectedPerson({ id, name })}
              />
            )}

            {/* More Like This (Local Library Recommendations) */}
            {moreLikeThisData && moreLikeThisData.length > 0 && (
              <MoreLikeThisGrid
                items={moreLikeThisData}
                onSelect={(item) => {
                  if (onSelectMovie) onSelectMovie(item as Movie);
                  else onPlay(item as Movie);
                }}
                onPlay={(item) => onPlay(item as Movie)}
              />
            )}

            {/* File & Technical Details */}
            <div className="text-xs text-neutral-500 pt-4 border-t border-neutral-800 space-y-1">
              <div>
                <span className="font-semibold text-neutral-400">File: </span>
                {movie.file_path}
              </div>
              {movie.tmdb_id && (
                <div>
                  <span className="font-semibold text-neutral-400">TMDB ID: </span>
                  {movie.tmdb_id}
                </div>
              )}
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

      {showDeleteModal && (
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteMovie}
          title={movie.title}
          mediaType="movie"
          filePath={movie.file_path}
          fileSize={movie.file_size}
        />
      )}

      {selectedPerson && (
        <PersonDetailModal
          personId={selectedPerson.id}
          personName={selectedPerson.name}
          onClose={() => setSelectedPerson(null)}
          onPlayMovie={(m) => {
            setSelectedPerson(null);
            onPlay(m);
          }}
          onSelectMovie={(m) => {
            setSelectedPerson(null);
            if (onSelectMovie) onSelectMovie(m);
            else onPlay(m);
          }}
        />
      )}
    </AnimatePresence>
  );
};
