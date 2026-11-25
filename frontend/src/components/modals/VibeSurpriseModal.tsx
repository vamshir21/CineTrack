import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Dices,
  Sparkles,
  Info,
  RotateCw,
  Film,
  Tv,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../../api/library';
import { tmdbApi } from '../../api/tmdb';
import type { Movie, TVSeries, VibeSurpriseResponse } from '../../types';
import { isMovie } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { RatingBadges } from '../common/RatingBadges';
import { formatYear } from '../../utils/timeUtils';
import { extractMediaSpecs } from '../../utils/mediaBadgeUtils';
import { getLanguageBadgeStyle } from '../../utils/languageUtils';

interface VibeSurpriseModalProps {
  isOpen: boolean;
  initialVibeKey?: string | null;
  onClose: () => void;
  onPlay: (item: Movie | TVSeries) => void;
  onSelectMedia?: (item: Movie | TVSeries) => void;
}

export const VibeSurpriseModal: React.FC<VibeSurpriseModalProps> = ({
  isOpen,
  initialVibeKey,
  onClose,
  onPlay,
  onSelectMedia,
}) => {
  const [selectedVibeKey, setSelectedVibeKey] = useState<string>(initialVibeKey || 'all');
  const [isSpinning, setIsSpinning] = useState(false);
  const [surpriseData, setSurpriseData] = useState<VibeSurpriseResponse | null>(null);

  // Available vibes for tabs
  const { data: vibesList } = useQuery({
    queryKey: ['vibes-list'],
    queryFn: libraryApi.getVibes,
    staleTime: 1000 * 60 * 10,
  });

  const fetchSurprise = async (vibeKey?: string) => {
    setIsSpinning(true);
    try {
      const keyToUse = vibeKey !== undefined ? vibeKey : selectedVibeKey;
      const apiParam = keyToUse === 'all' ? undefined : keyToUse;
      const data = await libraryApi.getVibeSurprise(apiParam);
      // Brief delay for dramatic slot-machine / roulette spin feel
      setTimeout(() => {
        setSurpriseData(data);
        setIsSpinning(false);
      }, 450);
    } catch (err) {
      console.error('Failed to get vibe surprise:', err);
      setIsSpinning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initialKey = initialVibeKey || 'all';
      setSelectedVibeKey(initialKey);
      fetchSurprise(initialKey);
    } else {
      setSurpriseData(null);
    }
  }, [isOpen, initialVibeKey]);

  // Fetch ratings for current surprise result
  const currentItem = surpriseData?.item;
  const isCurrentMovie = currentItem ? isMovie(currentItem) : true;
  const { data: ratingsData } = useQuery({
    queryKey: ['ratings', isCurrentMovie ? 'movie' : 'tv', currentItem?.tmdb_id],
    queryFn: () =>
      currentItem?.tmdb_id
        ? tmdbApi.getRatings(isCurrentMovie ? 'movie' : 'tv', currentItem.tmdb_id)
        : null,
    enabled: !!currentItem?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  });

  if (!isOpen) return null;

  const currentVibe = surpriseData?.vibe;
  const backdrop = currentItem?.backdrop_path || currentItem?.poster_path;
  const year = currentItem
    ? formatYear(
        (currentItem as Movie).release_date ||
          (currentItem as TVSeries).first_air_date ||
          ''
      )
    : '';
  const specs = currentItem && 'file_path' in currentItem
    ? extractMediaSpecs(currentItem.file_path)
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-3xl bg-[#181818] rounded-2xl overflow-hidden shadow-2xl z-10 border border-neutral-700/80 my-auto flex flex-col"
        >
          {/* Header Bar */}
          <div className="relative px-6 py-4 bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-900 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-netflix/20 text-netflix border border-netflix/30">
                <Dices className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>Surprise Me by Vibe</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-netflix text-white uppercase tracking-wider font-extrabold">
                    Shuffle
                  </span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Mood-matched instant selector powered by your library
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Vibe Selector Filter Bar inside Modal */}
          <div className="px-6 py-3 bg-neutral-900/80 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto scrollbar-thin">
            <button
              onClick={() => {
                setSelectedVibeKey('all');
                fetchSurprise('all');
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedVibeKey === 'all'
                  ? 'bg-netflix text-white shadow-md shadow-red-900/40'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Any Vibe</span>
            </button>

            {vibesList?.map((vibe) => (
              <button
                key={vibe.key}
                onClick={() => {
                  setSelectedVibeKey(vibe.key);
                  fetchSurprise(vibe.key);
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedVibeKey === vibe.key
                    ? 'bg-white text-black shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                }`}
              >
                <span>{vibe.emoji}</span>
                <span>{vibe.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({vibe.count})</span>
              </button>
            ))}
          </div>

          {/* Body Content */}
          <div className="relative min-h-[380px] sm:min-h-[440px] flex flex-col justify-end">
            {isSpinning ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#181818] z-20 space-y-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                  className="p-4 rounded-full bg-neutral-800 border-2 border-netflix text-netflix shadow-xl"
                >
                  <Dices className="w-10 h-10" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-base font-bold text-white tracking-wide">
                    Shuffling by Vibe...
                  </p>
                  <p className="text-xs text-neutral-400">
                    Finding the perfect mood match from your titles
                  </p>
                </div>
              </div>
            ) : currentItem && currentVibe ? (
              <>
                {/* Backdrop Image */}
                <div className="absolute inset-0 z-0 overflow-hidden bg-neutral-900">
                  {backdrop && (
                    <ImageWithFallback
                      src={backdrop}
                      alt={currentItem.title}
                      className="w-full h-full object-cover object-top opacity-60 scale-105"
                    />
                  )}
                  {/* Gradients */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/90 via-[#181818]/40 to-transparent" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 p-6 sm:p-8 space-y-4">
                  {/* Vibe Match Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-netflix text-white font-black text-xs shadow-lg uppercase tracking-wider">
                      <span>{currentVibe.emoji}</span>
                      <span>Matched: {currentVibe.name}</span>
                    </div>

                    <span className="text-xs text-neutral-300 font-medium italic hidden sm:inline">
                      "{currentVibe.tagline}"
                    </span>
                  </div>

                  {/* Title & Type */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-black/60 border border-white/20 text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1">
                        {isCurrentMovie ? (
                          <>
                            <Film className="w-3 h-3 text-netflix" /> Movie
                          </>
                        ) : (
                          <>
                            <Tv className="w-3 h-3 text-blue-400" /> TV Show
                          </>
                        )}
                      </span>
                      {year && <span className="text-sm font-semibold text-neutral-300">{year}</span>}
                    </div>

                    <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                      {currentItem.title}
                    </h2>
                  </div>

                  {/* Rotten Tomatoes & IMDb Ratings Badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    <RatingBadges ratings={ratingsData} tmdbFallback={currentItem.vote_average} size="md" />

                    {specs && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="border border-neutral-600 text-neutral-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                          {specs.resolution}
                        </span>
                        {specs.hdr && (
                          <span className="border border-amber-500/80 text-amber-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                            {specs.hdr}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Audio Languages */}
                    {currentItem.languages && currentItem.languages.length > 0 && (
                      <div className="flex items-center gap-1">
                        {currentItem.languages.map((lang) => {
                          const style = getLanguageBadgeStyle(lang);
                          return (
                            <span
                              key={lang}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}
                            >
                              {lang}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Overview */}
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed line-clamp-3 max-w-2xl drop-shadow">
                    {currentItem.overview || 'No synopsis available for this selection.'}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        onClose();
                        onPlay(currentItem);
                      }}
                      className="flex items-center gap-2 bg-white text-black font-extrabold px-6 py-2.5 rounded-lg hover:bg-neutral-200 transition-all shadow-lg active:scale-95 text-sm"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>Play Now</span>
                    </button>

                    <button
                      onClick={() => fetchSurprise()}
                      className="flex items-center gap-2 bg-neutral-800/90 hover:bg-neutral-700 text-white font-bold px-4 py-2.5 rounded-lg border border-neutral-600 transition-all shadow-md active:scale-95 text-sm"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>Spin Again</span>
                    </button>

                    {onSelectMedia && (
                      <button
                        onClick={() => {
                          onClose();
                          onSelectMedia(currentItem);
                        }}
                        className="flex items-center gap-2 bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-white font-semibold px-4 py-2.5 rounded-lg border border-neutral-700 transition-all text-sm ml-auto"
                      >
                        <Info className="w-4 h-4" />
                        <span>Details</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-400 space-y-3">
                <Dices className="w-12 h-12 text-neutral-600" />
                <p className="text-base font-bold text-neutral-200">
                  No matching titles found for this vibe
                </p>
                <p className="text-xs text-neutral-500">
                  Try selecting "Any Vibe" or a different mood category above.
                </p>
                <button
                  onClick={() => {
                    setSelectedVibeKey('all');
                    fetchSurprise('all');
                  }}
                  className="px-4 py-2 bg-netflix text-white font-bold rounded-lg text-xs hover:bg-red-700 transition-colors"
                >
                  Roll Across All Titles
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
