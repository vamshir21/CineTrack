import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from '../cards/MediaCard';
import type { MediaItem } from '../../types';

interface ContentRailProps {
  title: string;
  items: MediaItem[];
  variant?: 'poster' | 'backdrop';
  onItemClick?: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
}

export const ContentRail: React.FC<ContentRailProps> = ({
  title,
  items,
  variant = 'poster',
  onItemClick,
  onPlay,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<any>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isRailHovered, setIsRailHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      checkScroll();
    }
  };

  // Row-level hover calculation: adjacent cards slide away to make room
  // Poster: base 200px, expanded 315px -> expansion 115px
  // Backdrop: base 295px, expanded 385px -> expansion 90px
  const isPoster = variant === 'poster';
  const expansionWidth = isPoster ? 115 : 90;
  const halfExpansion = Math.round(expansionWidth / 2);

  const handleCardMouseEnter = (index: number) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredIdx(index);
    }, 300); // 300ms Netflix deliberate hover delay
  };

  const handleCardMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredIdx(null);
  };

  const getCardTransform = (index: number) => {
    if (hoveredIdx === null) {
      return { translateX: 0, origin: 'center center', isHovered: false };
    }

    if (index === hoveredIdx) {
      if (hoveredIdx === 0) {
        return { translateX: 0, origin: 'left center', isHovered: true };
      }
      if (hoveredIdx === items.length - 1) {
        return { translateX: 0, origin: 'right center', isHovered: true };
      }
      return { translateX: 0, origin: 'center center', isHovered: true };
    }

    if (hoveredIdx === 0) {
      // First card hovered: every subsequent card shifts right
      return { translateX: index > hoveredIdx ? expansionWidth : 0, origin: 'center center', isHovered: false };
    }

    if (hoveredIdx === items.length - 1) {
      // Last card hovered: every previous card shifts left
      return { translateX: index < hoveredIdx ? -expansionWidth : 0, origin: 'center center', isHovered: false };
    }

    // Middle card: left cards slide left, right cards slide right
    if (index < hoveredIdx) {
      return { translateX: -halfExpansion, origin: 'center center', isHovered: false };
    } else {
      return { translateX: halfExpansion, origin: 'center center', isHovered: false };
    }
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div
      className="relative mb-8 group/rail"
      onMouseEnter={() => setIsRailHovered(true)}
      onMouseLeave={() => {
        setIsRailHovered(false);
        handleCardMouseLeave();
      }}
    >
      {/* Rail Title */}
      <h2 className="text-lg md:text-xl font-bold text-white px-8 md:px-12 mb-3 tracking-wide flex items-center gap-2">
        <span>{title}</span>
        <span className="text-xs text-neutral-400 font-normal">({items.length})</span>
      </h2>

      {/* Rail Container */}
      <div className="relative">
        {/* Scroll Left Button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className={`absolute left-0 top-8 bottom-16 z-40 w-12 bg-black/70 hover:bg-black/95 text-white flex items-center justify-center transition-all duration-300 rounded-r backdrop-blur-xs ${
              isRailHovered && hoveredIdx === null ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll Left"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}

        {/* Scrolling Items with Row Shift Accommodation */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onWheel={handleWheel}
          className="flex items-center gap-4 overflow-x-auto scrollbar-none px-8 md:px-12 pt-8 pb-16 -mt-4 -mb-10 scroll-smooth no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, idx) => {
            const { translateX, origin, isHovered: isCardHovered } = getCardTransform(idx);
            const isCW = title.toLowerCase().includes('continue');

            return (
              <MediaCard
                key={`${(item as any).media_type || ('file_path' in item ? 'movie' : 'series')}-${item.id}`}
                item={item}
                variant={variant}
                onClick={() => onItemClick?.(item)}
                onPlay={() => onPlay?.(item)}
                isControlledHover={true}
                isHovered={isCardHovered}
                translateX={translateX}
                transformOrigin={origin}
                onHoverStart={() => handleCardMouseEnter(idx)}
                onHoverEnd={handleCardMouseLeave}
                isContinueWatching={isCW}
              />
            );
          })}
        </div>

        {/* Scroll Right Button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-8 bottom-14 z-40 w-12 bg-black/70 hover:bg-black/95 text-white flex items-center justify-center transition-all duration-300 rounded-l backdrop-blur-xs ${
              isRailHovered && hoveredIdx === null ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll Right"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}
      </div>
    </div>
  );
};
