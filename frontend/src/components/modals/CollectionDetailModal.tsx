import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Film, CheckCircle2, AlertCircle, Star, Calendar, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../../api/library';
import { tmdbApi } from '../../api/tmdb';
import type { Movie, CollectionPart } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatYear } from '../../utils/timeUtils';
import { ProgressBar } from '../cards/ProgressBar';
import { TrailerPlayer } from '../common/TrailerPlayer';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface CollectionDetailModalProps {
  collectionId: number | null;
  onClose: () => void;
  onPlayMovie: (movie: Movie) => void;
  onSelectMovie?: (movie: Movie) => void;
}

export const CollectionDetailModal: React.FC<CollectionDetailModalProps> = ({
  collectionId,
  onClose,
  onPlayMovie,
  onSelectMovie,
}) => {
  const [selectedPartForTrailer, setSelectedPartForTrailer] = useState<CollectionPart | null>(null);

  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['collection-detail', collectionId],
    queryFn: () => (collectionId ? libraryApi.getCollectionDetail(collectionId) : null),
    enabled: !!collectionId,
  });

  const { data: trailerData } = useQuery({
    queryKey: ['trailer', 'movie', selectedPartForTrailer?.id],
    queryFn: () => (selectedPartForTrailer?.id ? tmdbApi.getTrailer('movie', selectedPartForTrailer.id) : null),
    enabled: !!selectedPartForTrailer?.id,
  });

  if (!collectionId) return null;

  // Find next movie to binge: first owned unwatched movie, or first owned movie
  const ownedMovies = collection?.parts.filter(p => p.in_library && p.local_movie) || [];
  const nextToBinge = ownedMovies.find(p => !p.local_movie?.progress?.completed) || ownedMovies[0];

  const handleBingeFranchise = () => {
    if (nextToBinge?.local_movie) {
      onPlayMovie(nextToBinge.local_movie);
    }
  };

  const ownedCount = collection?.owned_count || 0;
  const totalCount = collection?.total_count || 0;
  const completionPct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
        {/* Backdrop click dismiss */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-4xl bg-[#181818] rounded-xl overflow-hidden shadow-2xl z-10 border border-neutral-800 my-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-neutral-800 text-white/90 hover:text-white transition-all shadow-lg backdrop-blur-sm"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : error || !collection ? (
            <div className="h-96 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <p className="text-lg font-bold text-white mb-1">Could not load collection details</p>
              <p className="text-sm">Please check your connection to TMDB.</p>
            </div>
          ) : (
            <div>
              {/* Header Hero Banner */}
              <div className="relative h-72 sm:h-84 md:h-96 w-full overflow-hidden bg-neutral-900">
                {collection.backdrop_url ? (
                  <ImageWithFallback
                    src={collection.backdrop_url}
                    alt={collection.name}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-red-950/40 via-neutral-900 to-black" />
                )}

                {/* Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181818] via-transparent to-transparent opacity-80" />

                {/* Header Content */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-netflix text-white">
                      FRANCHISE
                    </span>
                    <span className="text-xs text-neutral-300 font-medium">
                      {totalCount} {totalCount === 1 ? 'Movie' : 'Movies'}
                    </span>
                    <span className="text-neutral-500">•</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {ownedCount} of {totalCount} In Library ({completionPct}%)
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md mb-3">
                    {collection.name}
                  </h1>

                  {/* Binge Button & Library Progress */}
                  <div className="flex flex-wrap items-center gap-4">
                    {nextToBinge?.local_movie && (
                      <button
                        onClick={handleBingeFranchise}
                        className="flex items-center gap-2.5 bg-netflix hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg hover:shadow-red-900/40 active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Binge Franchise</span>
                        <span className="text-xs font-normal text-white/80">
                          ({nextToBinge.title})
                        </span>
                      </button>
                    )}

                    {/* Progress Bar */}
                    <div className="bg-black/50 backdrop-blur-sm border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center gap-3">
                      <div className="w-24 sm:w-32 bg-neutral-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-neutral-300">
                        {ownedCount}/{totalCount} Owned
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body Details */}
              <div className="p-6 sm:p-8 space-y-8">
                {/* Overview */}
                {collection.overview && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                      About this Franchise
                    </h3>
                    <p className="text-sm text-neutral-300 leading-relaxed max-w-3xl">
                      {collection.overview}
                    </p>
                  </div>
                )}

                {/* Franchise Timeline / Watch Order */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-black text-white tracking-wide">
                        Chronological Watch Order
                      </h2>
                      <p className="text-xs text-neutral-400">
                        All parts in release order with your library status
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {collection.parts.map((part, index) => {
                      const isOwned = part.in_library && part.local_movie;
                      const isCompleted = isOwned && part.local_movie?.progress?.completed;

                      return (
                        <div
                          key={part.id}
                          className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-200 ${
                            isOwned
                              ? 'bg-[#222]/80 border-neutral-700/60 hover:border-neutral-500 hover:bg-[#282828]'
                              : 'bg-[#1b1b1b]/50 border-neutral-800/60 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {/* Left: Part index + Poster + Title info */}
                          <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                            {/* Sequence number */}
                            <span className="text-lg font-black text-neutral-500 w-6 text-center">
                              {index + 1}
                            </span>

                            {/* Thumbnail Poster */}
                            <div className="relative w-14 h-20 rounded-md overflow-hidden flex-shrink-0 bg-neutral-900 shadow">
                              {part.poster_url ? (
                                <ImageWithFallback
                                  src={part.poster_url}
                                  alt={part.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                  <Film className="w-6 h-6" />
                                </div>
                              )}
                              {isCompleted && (
                                <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5 shadow">
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>

                            {/* Meta */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="text-sm font-bold text-white truncate max-w-sm">
                                  {part.title}
                                </h4>
                                {isOwned ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    In Library
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                                    Not in Library
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-neutral-400">
                                {part.release_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatYear(part.release_date)}
                                  </span>
                                )}
                                {part.vote_average && part.vote_average > 0 && (
                                  <span className="flex items-center gap-1 text-amber-400">
                                    <Star className="w-3 h-3 fill-amber-400" />
                                    {part.vote_average.toFixed(1)}
                                  </span>
                                )}
                              </div>

                              {part.overview && (
                                <p className="text-xs text-neutral-400 line-clamp-1 mt-1">
                                  {part.overview}
                                </p>
                              )}

                              {/* Progress bar if movie started */}
                              {isOwned && part.local_movie?.progress && part.local_movie.progress.duration > 0 && (
                                <div className="mt-2 max-w-xs">
                                  <ProgressBar
                                    position={part.local_movie.progress.position}
                                    duration={part.local_movie.progress.duration}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 mt-3 sm:mt-0 self-end sm:self-center">
                            {isOwned ? (
                              <>
                                <button
                                  onClick={() => onPlayMovie(part.local_movie!)}
                                  className="flex items-center gap-1.5 bg-netflix hover:bg-red-700 text-white px-3.5 py-1.5 rounded-md font-bold text-xs transition-all shadow-sm active:scale-95"
                                >
                                  <Play className="w-3.5 h-3.5 fill-white" />
                                  <span>Play</span>
                                </button>
                                {onSelectMovie && (
                                  <button
                                    onClick={() => onSelectMovie(part.local_movie!)}
                                    className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-semibold text-xs border border-neutral-700 transition-colors"
                                  >
                                    Details
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => setSelectedPartForTrailer(part)}
                                className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white px-3 py-1.5 rounded-md font-semibold text-xs border border-neutral-700 transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-netflix" />
                                <span>Watch Trailer</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Trailer modal for missing part */}
                {selectedPartForTrailer && (
                  <div className="border-t border-neutral-800 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-white">
                        Trailer: {selectedPartForTrailer.title}
                      </h4>
                      <button
                        onClick={() => setSelectedPartForTrailer(null)}
                        className="text-xs text-neutral-400 hover:text-white"
                      >
                        Close Trailer
                      </button>
                    </div>
                    {trailerData?.trailer ? (
                      <div className="max-w-2xl mx-auto rounded-lg overflow-hidden shadow-lg border border-neutral-800">
                        <TrailerPlayer videoKey={trailerData.trailer.key} autoPlay={true} />
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500 italic">No trailer available for this title.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
