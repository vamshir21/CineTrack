import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { tmdbApi } from '../../api/tmdb';
import { RatingBadges } from '../common/RatingBadges';
import type { MediaItem } from '../../types';
import { isMovie } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatYear } from '../../utils/timeUtils';
import { getLanguageBadgeStyle } from '../../utils/languageUtils';

interface HeroSectionProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
  onPlaySomething?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  items,
  onPlay,
  onMoreInfo,
  onPlaySomething,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const isHeroHoveredRef = useRef(false);

  useEffect(() => {
    isHeroHoveredRef.current = isHeroHovered;
  }, [isHeroHovered]);

  const currentItem = items && items.length > 0 ? (items[currentIndex] || items[0]) : null;
  const isCurrentMovie = currentItem ? isMovie(currentItem) : true;

  // Rotten Tomatoes & IMDb Ratings for current hero item
  const { data: ratingsData } = useQuery({
    queryKey: ['ratings', isCurrentMovie ? 'movie' : 'tv', currentItem?.tmdb_id],
    queryFn: () =>
      currentItem?.tmdb_id
        ? tmdbApi.getRatings(isCurrentMovie ? 'movie' : 'tv', currentItem.tmdb_id)
        : null,
    enabled: !!currentItem?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  });

  // Slideshow auto-rotation: advances every 8 seconds, paused when hovering over the hero
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      if (isHeroHoveredRef.current) return;
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!items || items.length === 0 || !currentItem) {
    return (
      <div className="relative w-full h-[65vh] min-h-[480px] bg-gradient-to-r from-surface to-background flex items-center px-12">
        <div className="max-w-xl space-y-4">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-wide">
            Welcome to CineTrack
          </h1>
          <p className="text-neutral-300 text-base leading-relaxed">
            Your personal local media streaming powerhouse. Add media folders in Settings to populate your Netflix-style library with automatic TMDB metadata and artwork.
          </p>
        </div>
      </div>
    );
  }

  const movieItem = isCurrentMovie ? (currentItem as any) : null;
  const seriesItem = !isCurrentMovie ? (currentItem as any) : null;
  const releaseDate = movieItem?.release_date || seriesItem?.first_air_date || '';
  const year = formatYear(releaseDate || '');
  const genres = currentItem.genres?.slice(0, 3).join(' • ');
  const backdrop = currentItem.backdrop_path || currentItem.poster_path;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleMouseEnter = () => {
    isHeroHoveredRef.current = true;
    setIsHeroHovered(true);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return;
    }
    isHeroHoveredRef.current = false;
    setIsHeroHovered(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="hero-container relative w-full h-[70vh] min-h-[520px] max-h-[750px] overflow-hidden select-none bg-[#141414]"
    >
      {/* Background: High-Resolution Static Backdrop Shot */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id + '-' + (isCurrentMovie ? 'm' : 's')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <ImageWithFallback
              src={backdrop}
              alt={currentItem.title}
              className="w-full h-full object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Netflix Cinematic Gradient Overlays */}
      {/* 1. Left-to-right reading gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/70 to-transparent w-full md:w-3/4 z-10 pointer-events-none" />
      {/* 2. Bottom fade into content rails */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#141414] via-[#141414]/90 to-transparent z-10 pointer-events-none" />
      {/* 3. Top subtle shadow for navbar readability */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#141414]/80 to-transparent z-10 pointer-events-none" />

      {/* Featured Content Details */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end px-8 md:px-16 pb-28 sm:pb-32 md:pb-36 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            {/* Badges / Meta */}
            <div className="space-y-2.5">
              {/* Row 1: Featured, Year, Seasons, Languages, Genre */}
              <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm font-semibold tracking-wide text-neutral-300">
                <span className="bg-netflix text-white font-bold px-2.5 py-0.5 rounded text-xs shadow-md">
                  FEATURED
                </span>
                {year && <span>{year}</span>}
                {seriesItem?.number_of_seasons && (
                  <span>
                    {seriesItem.number_of_seasons} Season{seriesItem.number_of_seasons > 1 ? 's' : ''}
                  </span>
                )}
                {currentItem.languages && currentItem.languages.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {currentItem.languages.map((lang) => {
                      const style = getLanguageBadgeStyle(lang);
                      return (
                        <span
                          key={lang}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {lang}
                        </span>
                      );
                    })}
                  </div>
                )}
                {genres && <span className="text-neutral-400 hidden sm:inline">{genres}</span>}
              </div>

              {/* Row 2: Ratings side by side in the same row */}
              <div className="flex items-center overflow-x-auto scrollbar-none py-0.5">
                <RatingBadges
                  ratings={ratingsData}
                  tmdbFallback={currentItem.vote_average}
                  size="sm"
                  wrap={false}
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-md line-clamp-2">
              {currentItem.title}
            </h1>

            {/* Overview */}
            {currentItem.overview && (
              <p className="text-neutral-200 text-sm sm:text-base leading-relaxed line-clamp-3 drop-shadow text-shadow max-w-xl">
                {currentItem.overview}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => onPlay(currentItem)}
                className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded hover:bg-neutral-200 transition-colors shadow-lg active:scale-95"
              >
                <Play className="w-5 h-5 fill-black text-black" />
                <span className="text-black">Play</span>
              </button>
              <button
                onClick={() => onMoreInfo(currentItem)}
                className="flex items-center gap-2 bg-neutral-600/70 hover:bg-neutral-600/90 text-white font-semibold px-6 py-2.5 rounded backdrop-blur-sm transition-colors active:scale-95"
              >
                <Info className="w-5 h-5" />
                <span>More Info</span>
              </button>

              {onPlaySomething && (
                <button
                  onClick={onPlaySomething}
                  className="flex items-center gap-2 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 hover:text-white font-semibold px-4 py-2.5 rounded backdrop-blur-sm transition-colors border border-white/10 active:scale-95 text-sm"
                  title="Surprise Me (Play Something)"
                >
                  <Shuffle className="w-4 h-4 text-netflix" />
                  <span className="hidden sm:inline">Surprise Me</span>
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Right Carousel Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-28 sm:bottom-32 md:bottom-36 right-8 md:right-16 z-30 flex items-center gap-1.5">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 transition-all rounded-full ${
                idx === currentIndex ? 'w-6 bg-netflix' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Prev / Next Slide Controls */}
      {items.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2 text-white/50 hover:text-white hover:bg-black/40 rounded-full transition-all"
            aria-label="Previous Featured Slide"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2 text-white/50 hover:text-white hover:bg-black/40 rounded-full transition-all"
            aria-label="Next Featured Slide"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}
    </div>
  );
};
