import React from 'react';
import { Play, Star, Sparkles } from 'lucide-react';
import type { MediaItem } from '../../types';
import { isMovie } from '../../types';
import { ImageWithFallback } from './ImageWithFallback';
import { formatYear } from '../../utils/timeUtils';
import { extractMediaSpecs } from '../../utils/mediaBadgeUtils';

interface MoreLikeThisGridProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
}

export const MoreLikeThisGrid: React.FC<MoreLikeThisGridProps> = ({
  items,
  onSelect,
  onPlay,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-neutral-800">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-netflix" />
        <h3 className="text-xl font-bold text-white tracking-wide">More Like This</h3>
        <span className="text-xs text-neutral-400 font-medium ml-1">
          (From Your Local Library)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {items.map((item) => {
          const isCurrMovie = isMovie(item);
          const year = formatYear(
            isCurrMovie ? item.release_date || '' : (item as any).first_air_date || ''
          );
          const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
          const backdrop = item.backdrop_path || item.poster_path;
          const specs = extractMediaSpecs((item as any).file_path || '');

          return (
            <div
              key={`${item.id}-${isCurrMovie ? 'm' : 's'}`}
              onClick={() => onSelect(item)}
              className="group bg-[#222] rounded-lg overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-all cursor-pointer flex flex-col shadow-lg hover:shadow-2xl"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-neutral-900 overflow-hidden">
                <ImageWithFallback
                  src={backdrop}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Rating badge */}
                {rating && (
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px] font-bold text-green-400">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{rating}</span>
                  </div>
                )}

                {/* Play hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPlay) onPlay(item);
                      else onSelect(item);
                    }}
                    className="p-3 bg-white/90 hover:bg-white text-black rounded-full shadow-lg transform group-hover:scale-110 transition-transform"
                    title="Play"
                  >
                    <Play className="w-4 h-4 fill-black" />
                  </button>
                </div>
              </div>

              {/* Card Meta Body */}
              <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-netflix transition-colors line-clamp-1">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1">
                    {year && <span>{year}</span>}
                    <span className="border border-neutral-700 px-1 py-0.2 rounded text-[9px] font-mono">
                      {specs.resolution.includes('4K') ? '4K' : 'HD'}
                    </span>
                    <span className="uppercase text-[10px] text-neutral-500 font-semibold">
                      {isCurrMovie ? 'Movie' : 'Series'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                  {item.overview || 'Available in your CineTrack library.'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
