import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Play, Plus, ThumbsUp, ThumbsDown, ChevronDown, Star } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ProgressBar } from './ProgressBar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { watchlistApi } from '../../api/watchlist';
import type { Movie, TVSeries } from '../../types';
import { isMovie } from '../../types';
import { formatYear } from '../../utils/timeUtils';

const HOVER_WIDTH = 320;

interface HoverCardProps {
  item: Movie | TVSeries;
  anchorRect: DOMRect;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPlay?: () => void;
}

function computePosition(rect: DOMRect): { left: number; top: number; above: boolean } {
  const previewHeight = 380;
  const margin = 8;

  // Horizontal: center on card, clamp to viewport
  let left = rect.left + rect.width / 2 - HOVER_WIDTH / 2 + window.scrollX;
  if (left < 8) left = rect.left + window.scrollX;
  if (left + HOVER_WIDTH > window.innerWidth - 8) {
    left = rect.right - HOVER_WIDTH + window.scrollX;
  }
  left = Math.max(8, left);

  // Vertical
  const spaceAbove = rect.top;
  const above = spaceAbove >= previewHeight + margin;
  const top = above
    ? rect.top - previewHeight - margin + window.scrollY
    : rect.bottom + margin + window.scrollY;

  return { left, top, above };
}

export function HoverCard({
  item,
  anchorRect,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onPlay,
}: HoverCardProps) {
  const queryClient = useQueryClient();
  const { left, top } = computePosition(anchorRect);

  const backdrop = 'backdrop_path' in item ? item.backdrop_path : undefined;
  const poster = 'poster_path' in item ? item.poster_path : undefined;
  const imageSrc = backdrop || poster;

  const movieItem = isMovie(item) ? item : null;
  const seriesItem = !isMovie(item) ? (item as TVSeries) : null;

  const year = formatYear(movieItem?.release_date ?? seriesItem?.first_air_date ?? '');
  const rating = item.vote_average?.toFixed(1);
  const genres = item.genres?.slice(0, 3).join(' · ');
  const hasProgress = item.progress && item.progress.position > 0 && !item.progress.completed;

  const addToWatchlist = useMutation({
    mutationFn: () =>
      watchlistApi.addToWatchlist(isMovie(item) ? 'movie' : 'series', item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const content = (
    <motion.div
      className="fixed z-[9999] rounded-md overflow-hidden shadow-2xl bg-surface"
      style={{ left, top, width: HOVER_WIDTH }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Backdrop image 16:9 */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        <ImageWithFallback
          src={imageSrc}
          alt={item.title}
          fallbackTitle={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        {/* Title overlay */}
        <div className="absolute bottom-2 left-3 right-3">
          <p className="text-white font-bold text-sm line-clamp-2">{item.title}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-3 pt-3 pb-2">
        {/* Button row */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.();
              onClose();
            }}
            className="flex items-center gap-1.5 bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-white/90 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            {hasProgress ? 'Resume' : 'Play'}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              addToWatchlist.mutate();
            }}
            className="p-1.5 rounded-full border border-white/40 hover:border-white text-white transition-colors"
            title="Add to Watchlist"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button className="p-1.5 rounded-full border border-white/40 hover:border-white text-white transition-colors">
            <ThumbsUp className="w-4 h-4" />
          </button>

          <button className="p-1.5 rounded-full border border-white/40 hover:border-white text-white transition-colors">
            <ThumbsDown className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ml-auto p-1.5 rounded-full border border-white/40 hover:border-white text-white transition-colors"
            title="More info"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-[#e5e5e5] mb-1.5">
          {rating && (
            <span className="flex items-center gap-0.5 text-green-400 font-semibold">
              <Star className="w-3 h-3 fill-current" />
              {rating}
            </span>
          )}
          {year && <span>{year}</span>}
          {seriesItem?.number_of_seasons && (
            <span>{seriesItem.number_of_seasons} Season{seriesItem.number_of_seasons > 1 ? 's' : ''}</span>
          )}
          {movieItem?.runtime && <span>{Math.round(movieItem.runtime / 60)}h {movieItem.runtime % 60}m</span>}
        </div>

        {genres && <p className="text-xs text-[#808080] mb-2">{genres}</p>}

        {/* Episode label for series */}
        {seriesItem?.next_episode && (
          <p className="text-xs text-[#e5e5e5] mb-1 font-medium">
            S{seriesItem.next_episode.season_number} E{seriesItem.next_episode.episode_number}:{' '}
            {seriesItem.next_episode.title}
          </p>
        )}

        {/* Overview */}
        {item.overview && (
          <p className="text-xs text-[#e5e5e5] line-clamp-3 leading-relaxed">{item.overview}</p>
        )}

        {/* Progress bar */}
        {hasProgress && item.progress && (
          <div className="mt-2">
            <ProgressBar position={item.progress.position} duration={item.progress.duration} height={2} />
          </div>
        )}
      </div>
    </motion.div>
  );

  return createPortal(content, document.body);
}
