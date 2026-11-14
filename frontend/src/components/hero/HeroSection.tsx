import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { MediaItem } from '../../types';
import { isMovie } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { formatYear } from '../../utils/timeUtils';

interface HeroSectionProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ items, onPlay, onMoreInfo }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!items || items.length === 0) {
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

  const currentItem = items[currentIndex] || items[0];
  const isCurrentMovie = isMovie(currentItem);
  const releaseDate = isCurrentMovie ? currentItem.release_date : currentItem.first_air_date;
  const year = formatYear(releaseDate || '');
  const rating = currentItem.vote_average ? currentItem.vote_average.toFixed(1) : null;
  const genres = currentItem.genres?.slice(0, 3).join(' • ');
  const backdrop = currentItem.backdrop_path || currentItem.poster_path;

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % items.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);

  return (
    <div className="relative w-full h-[70vh] min-h-[520px] max-h-[750px] overflow-hidden select-none bg-[#141414]">
      {/* Background Backdrop with Crossfade */}
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
            <div className="flex items-center gap-3 text-xs md:text-sm font-semibold tracking-wide text-neutral-300">
              <span className="bg-netflix text-white font-bold px-2 py-0.5 rounded text-xs">
                FEATURED
              </span>
              {rating && (
                <span className="flex items-center gap-1 text-green-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {rating}
                </span>
              )}
              {year && <span>{year}</span>}
              {!isCurrentMovie && currentItem.number_of_seasons && (
                <span>{currentItem.number_of_seasons} Season{currentItem.number_of_seasons > 1 ? 's' : ''}</span>
              )}
              {genres && <span className="text-neutral-400 hidden sm:inline">{genres}</span>}
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
                <Play className="w-5 h-5 fill-black" />
                <span>Play</span>
              </button>
              <button
                onClick={() => onMoreInfo(currentItem)}
                className="flex items-center gap-2 bg-neutral-600/70 hover:bg-neutral-600/90 text-white font-semibold px-6 py-2.5 rounded backdrop-blur-sm transition-colors active:scale-95"
              >
                <Info className="w-5 h-5" />
                <span>More Info</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

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

      {/* Carousel Dots */}
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
    </div>
  );
};
