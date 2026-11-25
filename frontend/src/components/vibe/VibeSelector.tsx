import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Dices,
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../../api/library';
import type { MediaItem } from '../../types';
import { MediaCard } from '../cards/MediaCard';

interface VibeSelectorProps {
  onItemClick: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onOpenSurprise: (vibeKey?: string) => void;
  className?: string;
}

export const VibeSelector: React.FC<VibeSelectorProps> = ({
  onItemClick,
  onPlay,
  onOpenSurprise,
  className = '',
}) => {
  const [selectedVibeKey, setSelectedVibeKey] = useState<string | null>(null);

  // Fetch all vibe definitions with library counts
  const { data: vibes, isLoading } = useQuery({
    queryKey: ['vibes-list'],
    queryFn: libraryApi.getVibes,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch items for currently selected vibe
  const { data: vibeItemsData, isLoading: isLoadingItems } = useQuery({
    queryKey: ['vibe-items', selectedVibeKey],
    queryFn: () => (selectedVibeKey ? libraryApi.getVibeTitles(selectedVibeKey) : null),
    enabled: !!selectedVibeKey,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !vibes || vibes.length === 0) {
    return null;
  }

  const activeVibe = vibes.find((v) => v.key === selectedVibeKey);

  return (
    <section className={`px-4 md:px-12 py-6 space-y-4 ${className}`}>
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-netflix/20 text-netflix border border-netflix/30">
              <Compass className="w-4 h-4" />
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>Browse by Vibe & Mood</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-amber-600 text-white uppercase tracking-wider">
                Curated
              </span>
            </h2>
          </div>
          <p className="text-xs md:text-sm text-neutral-400">
            Pick your mood tonight: from mind-bending sci-fi to pulse-pounding survival & high-octane action
          </p>
        </div>

        {/* Surprise Me Shuffle Button */}
        <button
          onClick={() => onOpenSurprise(selectedVibeKey || undefined)}
          className="group flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-red-900/30 transition-all duration-300 active:scale-95 border border-white/20 shrink-0"
        >
          <Dices className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span>Surprise Me by Vibe</span>
        </button>
      </div>

      {/* Vibe Cards Grid / Carousel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
        {vibes.map((vibe) => {
          const isSelected = selectedVibeKey === vibe.key;

          return (
            <motion.div
              key={vibe.key}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedVibeKey(isSelected ? null : vibe.key)}
              className={`cursor-pointer relative p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between select-none ${
                isSelected
                  ? 'bg-gradient-to-b from-neutral-800 to-neutral-900 border-netflix shadow-lg shadow-red-950/40 ring-1 ring-netflix'
                  : 'bg-gradient-to-b from-neutral-900/90 to-neutral-950/90 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/60'
              }`}
            >
              {/* Top Row: Emoji & Count Badge */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-2xl filter drop-shadow">{vibe.emoji}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${
                    isSelected
                      ? 'bg-netflix text-white border-netflix'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {vibe.count} {vibe.count === 1 ? 'title' : 'titles'}
                </span>
              </div>

              {/* Middle: Vibe Name & Tagline */}
              <div className="space-y-1">
                <h3
                  className={`text-xs md:text-sm font-bold tracking-tight line-clamp-1 ${
                    isSelected ? 'text-white' : 'text-neutral-200 group-hover:text-white'
                  }`}
                >
                  {vibe.name}
                </h3>
                <p className="text-[11px] text-neutral-400 line-clamp-2 leading-snug">
                  {vibe.tagline}
                </p>
              </div>

              {/* Bottom: Quick Action */}
              <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-neutral-400">
                  {isSelected ? 'Viewing' : 'Explore'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSurprise(vibe.key);
                  }}
                  title={`Shuffle within ${vibe.name}`}
                  className="p-1 rounded-md hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                >
                  <Dices className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected Vibe Content Rail */}
      <AnimatePresence>
        {selectedVibeKey && activeVibe && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden pt-2"
          >
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{activeVibe.emoji}</span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      {activeVibe.name} Titles in Library
                    </h3>
                    <p className="text-xs text-neutral-400">
                      {activeVibe.tagline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenSurprise(activeVibe.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-netflix hover:bg-red-700 text-white font-bold text-xs shadow transition-all active:scale-95"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Shuffle this vibe</span>
                  </button>

                  <button
                    onClick={() => setSelectedVibeKey(null)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {isLoadingItems ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Loading {activeVibe.name} selections...
                </div>
              ) : vibeItemsData && vibeItemsData.items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5 md:gap-6 pt-1">
                  {vibeItemsData.items.map((item) => (
                    <MediaCard
                      key={`${item.id}-${(item as any).media_type || 'movie'}`}
                      item={item}
                      variant="poster"
                      onClick={() => onItemClick(item)}
                      onPlay={() => onPlay(item)}
                      fluidWidth={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-neutral-500">
                  No titles found for this vibe in your library.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
