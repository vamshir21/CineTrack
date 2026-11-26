import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import { MediaCard } from '../cards/MediaCard';
import type { MediaItem } from '../../types';

interface ContentRailProps {
  title: string;
  items: MediaItem[];
  variant?: 'poster' | 'backdrop';
  onItemClick?: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  isTop10?: boolean;
}

export const ContentRail: React.FC<ContentRailProps> = ({
  title,
  items,
  variant = 'poster',
  onItemClick,
  onPlay,
  isTop10 = false,
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

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  const hoverEnabled = settings?.hover_preview_enabled !== 'false';
  const hoverDelay = Number(settings?.hover_delay_ms) || 500;
  const cardSize = (settings?.card_size as 'small' | 'medium' | 'large') || 'medium';

  // Row-level hover calculation: adjacent cards slide away to make room
  // Poster: base 200px, expanded 315px -> expansion 115px
  // Backdrop: base 295px, expanded 385px -> expansion 90px
  const isPoster = variant === 'poster';
  const expansionWidth = isPoster ? 115 : 90;
  const halfExpansion = Math.round(expansionWidth / 2);
  const isRailElevated = isRailHovered || hoveredIdx !== null;

  const handleCardMouseEnter = (index: number) => {
    if (window.innerWidth < 640) return;
    if (!hoverEnabled) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredIdx(index);
    }, hoverDelay);
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
      className={`relative mb-8 group/rail ${isRailElevated ? 'z-30' : 'z-10'}`}
      onMouseEnter={() => setIsRailHovered(true)}
      onMouseLeave={() => {
        setIsRailHovered(false);
        handleCardMouseLeave();
      }}
    >
      {/* Rail Title */}
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-white px-4 sm:px-8 md:px-12 mb-2 sm:mb-3 tracking-wide flex items-center gap-2">
        <span>{title}</span>
        <span className="text-xs text-neutral-400 font-normal">({items.length})</span>
      </h2>

      {/* Rail Container */}
      <div className="relative">
        {/* Scroll Left Button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className={`absolute left-0 z-40 w-10 sm:w-12 bg-black/70 hover:bg-black/95 text-white flex items-center justify-center transition-all duration-300 rounded-r backdrop-blur-xs ${
              isPoster
                ? 'top-3 bottom-6 sm:top-10 sm:bottom-24'
                : 'top-4 bottom-6 sm:top-16 sm:bottom-56'
            } ${
              isRailHovered && hoveredIdx === null ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll Left"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Scrolling Items with Row Shift Accommodation */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onWheel={handleWheel}
          className={`flex items-center gap-2.5 sm:gap-4 overflow-x-auto scrollbar-none px-4 sm:px-8 md:px-12 scroll-smooth no-scrollbar ${
            isPoster
              ? 'pt-3 pb-6 sm:pt-10 sm:pb-24 -mt-2 -mb-4 sm:-mt-6 sm:-mb-16'
              : 'pt-4 pb-6 sm:pt-16 sm:pb-56 -mt-2 -mb-4 sm:-mt-12 sm:-mb-44'
          }`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, idx) => {
            const { translateX, origin, isHovered: isCardHovered } = getCardTransform(idx);
            const isCW = title.toLowerCase().includes('continue');

            return (
              <div
                key={`${(item as any).media_type || ('file_path' in item ? 'movie' : 'series')}-${item.id}`}
                className="flex items-center shrink-0"
              >
                {isTop10 && (
                  <div className="relative shrink-0 -mr-6 sm:-mr-8 select-none pointer-events-none z-0">
                    <svg
                      className="w-20 h-44 sm:w-24 sm:h-52 md:w-28 md:h-60"
                      viewBox="0 0 100 200"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <text
                        x="50%"
                        y="60%"
                        dominantBaseline="middle"
                        textAnchor="middle"
                        fontSize={idx === 9 ? '135' : '175'}
                        fontWeight="900"
                        stroke="#595959"
                        strokeWidth="6"
                        fill="#141414"
                        className="font-black"
                      >
                        {idx + 1}
                      </text>
                    </svg>
                  </div>
                )}
                <MediaCard
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
                  cardSize={cardSize}
                />
              </div>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 z-40 w-10 sm:w-12 bg-black/70 hover:bg-black/95 text-white flex items-center justify-center transition-all duration-300 rounded-l backdrop-blur-xs ${
              isPoster
                ? 'top-3 bottom-6 sm:top-10 sm:bottom-24'
                : 'top-4 bottom-6 sm:top-16 sm:bottom-56'
            } ${
              isRailHovered && hoveredIdx === null ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Scroll Right"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}
      </div>
    </div>
  );
};
