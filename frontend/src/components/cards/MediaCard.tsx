import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Check, ThumbsUp, ChevronDown, Star, X } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProgressBar } from './ProgressBar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { watchlistApi } from '../../api/watchlist';
import { playbackApi } from '../../api/playback';
import type { Movie, TVSeries } from '../../types';
import { isMovie } from '../../types';
import { formatYear, formatRuntime } from '../../utils/timeUtils';

export interface MediaCardProps {
  item: Movie | TVSeries;
  variant?: 'poster' | 'backdrop';
  onClick?: () => void;
  onPlay?: () => void;
  // Row hover control from ContentRail
  isControlledHover?: boolean;
  isHovered?: boolean;
  translateX?: number;
  transformOrigin?: string;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  // Continue watching removal
  isContinueWatching?: boolean;
  onRemoveFromContinueWatching?: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  variant = 'poster',
  onClick,
  onPlay,
  isControlledHover = false,
  isHovered: controlledIsHovered,
  translateX = 0,
  transformOrigin = 'center center',
  onHoverStart,
  onHoverEnd,
  isContinueWatching = false,
  onRemoveFromContinueWatching,
}) => {
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);
  const localTimeoutRef = useRef<any>(null);

  const [localHovered, setLocalHovered] = useState(false);
  const [localOrigin, setLocalOrigin] = useState<'left' | 'center' | 'right'>('center');

  // Determine active hover state
  const isExpanded = isControlledHover ? !!controlledIsHovered : localHovered;

  const isEpisode = (item as any).media_type === 'episode' || !!(item as any).series_title;
  const isCurrentMovie = !isEpisode && isMovie(item);
  const isPoster = variant === 'poster';
  const poster = item.poster_path;
  const backdrop = item.backdrop_path || (item as any).still_path;
  const normalImg = isPoster ? (poster || backdrop) : (backdrop || poster);
  const expandedImg = backdrop || poster;
  const progress = item.progress;

  const seriesTitle = (item as any).series_title;
  const seasonNum = (item as any).season_number;
  const epNum = (item as any).episode_number;

  const displayTitle = isEpisode && seriesTitle ? seriesTitle : item.title;
  const displaySubtitle = isEpisode && seasonNum && epNum ? `S${seasonNum} E${epNum}: ${item.title}` : null;
  const isUpNext = !!(item as any).is_up_next;

  const movieItem = isCurrentMovie ? (item as Movie) : null;
  const seriesItem = !isCurrentMovie && !isEpisode ? (item as TVSeries) : null;
  const year = formatYear(movieItem?.release_date ?? seriesItem?.first_air_date ?? (item as any).air_date ?? '');
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const genres = item.genres?.slice(0, 3).join(' • ');

  // Watchlist status
  const mediaType = isCurrentMovie ? 'movie' : 'series';
  const { data: watchlistData } = useQuery({
    queryKey: ['watchlist-check', mediaType, item.id],
    queryFn: () => watchlistApi.checkWatchlist(mediaType, item.id),
    staleTime: 1000 * 60 * 5,
    enabled: !isEpisode,
  });
  const inWatchlist = !!watchlistData?.in_watchlist;

  const toggleWatchlistMutation = useMutation({
    mutationFn: async () => {
      if (inWatchlist) {
        await watchlistApi.removeFromWatchlist(mediaType, item.id);
      } else {
        await watchlistApi.addToWatchlist(mediaType, item.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['watchlist-check', mediaType, item.id] });
    },
  });

  const removeContinueMutation = useMutation({
    mutationFn: async () => {
      const mt = (item as any).media_type || (isCurrentMovie ? 'movie' : 'episode');
      await playbackApi.removeFromContinueWatching(mt, item.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
      onRemoveFromContinueWatching?.();
    },
  });

  const handleMouseEnter = () => {
    if (isControlledHover) {
      onHoverStart?.();
    } else {
      localTimeoutRef.current = setTimeout(() => {
        if (cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          if (rect.left < 140) setLocalOrigin('left');
          else if (window.innerWidth - rect.right < 140) setLocalOrigin('right');
          else setLocalOrigin('center');
        }
        setLocalHovered(true);
      }, 350);
    }
  };

  const handleMouseLeave = () => {
    if (isControlledHover) {
      onHoverEnd?.();
    } else {
      if (localTimeoutRef.current) clearTimeout(localTimeoutRef.current);
      setLocalHovered(false);
    }
  };

  useEffect(() => {
    return () => {
      if (localTimeoutRef.current) clearTimeout(localTimeoutRef.current);
    };
  }, []);

  const baseWidth = isPoster ? 200 : 295;
  const expandedWidth = isPoster ? 315 : 385;
  const centerOffset = Math.round((baseWidth - expandedWidth) / 2);

  // Resolve expansion position
  const activeOrigin = isControlledHover
    ? (transformOrigin.includes('left') ? 'left' : transformOrigin.includes('right') ? 'right' : 'center')
    : localOrigin;

  return (
    <motion.div
      ref={cardRef}
      animate={{ x: translateX }}
      transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative flex-shrink-0 select-none ${isExpanded ? 'z-50' : 'z-10'}`}
      style={{
        width: `${baseWidth}px`,
        aspectRatio: isPoster ? '2/3' : '16/9',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 1. Base Card Slot */}
      <div
        onClick={onClick}
        className={`w-full h-full rounded-md overflow-hidden bg-[#1f1f1f] cursor-pointer transition-all duration-200 relative group/card ${
          isExpanded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <ImageWithFallback
          src={normalImg}
          alt={displayTitle}
          className="w-full h-full object-cover"
        />

        {/* Up Next Badge for next episode in series */}
        {isUpNext && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-netflix text-white text-[10px] font-bold uppercase tracking-wider shadow-md z-20 pointer-events-none">
            Up Next
          </div>
        )}

        {/* Remove from Continue Watching quick button */}
        {(isContinueWatching || onRemoveFromContinueWatching) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeContinueMutation.mutate();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-red-600 text-white/90 hover:text-white transition-all shadow-md active:scale-90 z-20"
            title="Remove from Continue Watching"
            aria-label="Remove from Continue Watching"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Title overlay on the card */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none">
          <p className="text-white text-xs font-bold truncate drop-shadow">{displayTitle}</p>
          {displaySubtitle && (
            <p className="text-[10px] text-neutral-300 truncate font-medium">{displaySubtitle}</p>
          )}
        </div>

        {/* Progress bar overlay */}
        {progress && !progress.completed && progress.position > 0 && (
          <div className="absolute bottom-0 inset-x-0">
            <ProgressBar position={progress.position} duration={progress.duration} height={3} />
          </div>
        )}
      </div>

      {/* 2. Netflix Expanded Card Overlay (Unified Card Zoom) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute z-50 rounded-md overflow-hidden bg-[#181818] shadow-[0_16px_36px_rgba(0,0,0,0.98)] border border-neutral-700/60 cursor-pointer"
            style={{
              top: '-32px',
              width: `${expandedWidth}px`,
              ...(activeOrigin === 'left' && { left: '0px' }),
              ...(activeOrigin === 'right' && { right: '0px' }),
              ...(activeOrigin === 'center' && { left: `${centerOffset}px` }),
            }}
            onClick={onClick}
          >
            {/* Top Media Image (16:9 backdrop composition) */}
            <div className="relative w-full aspect-video bg-neutral-900 overflow-hidden">
              <ImageWithFallback
                src={expandedImg}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent opacity-80" />

              {/* Title overlay */}
              <div className="absolute bottom-2 left-3 right-3">
                <p className="text-white font-black text-sm drop-shadow line-clamp-1">{displayTitle}</p>
                {displaySubtitle && (
                  <p className="text-neutral-300 font-semibold text-xs drop-shadow line-clamp-1">{displaySubtitle}</p>
                )}
              </div>

              {/* Playback progress if active */}
              {progress && !progress.completed && progress.position > 0 && (
                <div className="absolute bottom-0 inset-x-0">
                  <ProgressBar position={progress.position} duration={progress.duration} height={3} />
                </div>
              )}
            </div>

            {/* Bottom Controls & Metadata Drawer */}
            <div className="p-3.5 space-y-2.5 bg-[#181818]">
              {/* Action Buttons Row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPlay) onPlay();
                    else if (onClick) onClick();
                  }}
                  className="flex items-center justify-center p-2 rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow-md active:scale-95"
                  title="Play"
                >
                  <Play className="w-4 h-4 fill-black" />
                </button>

                {!isEpisode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlistMutation.mutate();
                    }}
                    className="flex items-center justify-center p-2 rounded-full border border-neutral-500 hover:border-white text-white hover:bg-white/10 transition-colors active:scale-95"
                    title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    {inWatchlist ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
                  </button>
                )}

                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center p-2 rounded-full border border-neutral-500 hover:border-white text-white hover:bg-white/10 transition-colors active:scale-95"
                  title="I like this"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>

                {(isContinueWatching || onRemoveFromContinueWatching) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeContinueMutation.mutate();
                    }}
                    className="flex items-center justify-center p-2 rounded-full border border-neutral-500 hover:border-red-500 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors active:scale-95"
                    title="Remove from Continue Watching"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                  }}
                  className="ml-auto flex items-center justify-center p-2 rounded-full border border-neutral-500 hover:border-white text-white hover:bg-white/10 transition-colors active:scale-95"
                  title="More Info"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Meta row: Rating, Year, Duration/Seasons */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                {rating && (
                  <span className="flex items-center gap-1 text-green-400 font-bold">
                    <Star className="w-3 h-3 fill-current" />
                    {rating}
                  </span>
                )}
                {year && <span className="text-neutral-300">{year}</span>}
                {seriesItem?.number_of_seasons && (
                  <span className="text-neutral-300">
                    {seriesItem.number_of_seasons} Season{seriesItem.number_of_seasons > 1 ? 's' : ''}
                  </span>
                )}
                {movieItem?.runtime && (
                  <span className="text-neutral-300">{formatRuntime(movieItem.runtime)}</span>
                )}
                <span className="text-[10px] font-bold border border-neutral-600 px-1 rounded text-neutral-300">
                  HD
                </span>
              </div>

              {/* Genres */}
              {genres && (
                <p className="text-[11px] text-neutral-400 truncate">{genres}</p>
              )}

              {/* Next episode for TV series */}
              {seriesItem?.next_episode && (
                <p className="text-[11px] text-neutral-300 truncate font-medium">
                  S{seriesItem.next_episode.season_number} E{seriesItem.next_episode.episode_number}: {seriesItem.next_episode.title}
                </p>
              )}

              {/* Short synopsis */}
              {item.overview && (
                <p className="text-[11px] text-neutral-300 line-clamp-2 leading-relaxed">
                  {item.overview}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
