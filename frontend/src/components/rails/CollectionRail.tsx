import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Layers, Film } from 'lucide-react';
import type { MovieCollection } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface CollectionRailProps {
  title?: string;
  subtitle?: string;
  collections: MovieCollection[];
  onSelectCollection: (collectionId: number) => void;
}

export const CollectionRail: React.FC<CollectionRailProps> = ({
  title = "Franchises & Collections",
  subtitle = "Binge your favorite movie sagas in chronological order",
  collections,
  onSelectCollection,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [collections]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  if (!collections || collections.length === 0) return null;

  return (
    <div className="relative group px-4 sm:px-8 md:px-12 my-6">
      {/* Title & Subtitle */}
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-wide">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-neutral-400 hidden sm:inline">
            {subtitle}
          </span>
        )}
      </div>

      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-28 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center rounded-r-md opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-28 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center rounded-l-md opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}

      {/* Rail Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth py-3"
      >
        {collections.map((c) => (
          <div
            key={c.collection_id}
            onClick={() => onSelectCollection(c.collection_id)}
            className="flex-shrink-0 w-60 sm:w-80 cursor-pointer group/card rounded-xl overflow-hidden bg-[#1c1c1c] border border-neutral-800 hover:border-neutral-600 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/60 relative"
          >
            {/* Backdrop / Poster Container */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
              {c.backdrop_url || c.poster_url ? (
                <ImageWithFallback
                  src={c.backdrop_url || c.poster_url || ''}
                  alt={c.collection_name}
                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-500">
                  <Film className="w-10 h-10" />
                </div>
              )}

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1c] via-[#1c1c1c]/40 to-transparent" />

              {/* Top Badge: Franchise */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-neutral-700/60 text-[10px] font-black uppercase tracking-wider text-neutral-200">
                <Layers className="w-3 h-3 text-netflix" />
                <span>FRANCHISE</span>
              </div>

              {/* Bottom Badge: Count */}
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-netflix text-white text-[10px] font-bold shadow-md">
                {c.local_movies_count} in Library
              </div>
            </div>

            {/* Meta */}
            <div className="p-3.5">
              <h3 className="text-sm font-bold text-white group-hover/card:text-red-400 transition-colors line-clamp-1">
                {c.collection_name}
              </h3>
              {c.overview && (
                <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                  {c.overview}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
