import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Shuffle, X, Star, Calendar, Sparkles } from 'lucide-react';
import { libraryApi } from '../../api/library';
import { playbackApi } from '../../api/playback';
import { getImageUrl } from '../../utils/imageUtils';
import type { MediaItem, TVSeries } from '../../types';
import { isMovie } from '../../types';

interface PlaySomethingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlaySomethingModal: React.FC<PlaySomethingModalProps> = ({ isOpen, onClose }) => {
  const [item, setItem] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const pickRandom = async (excludeId?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const picked = await libraryApi.getRandomItem(excludeId);
      setItem(picked);
    } catch (err: any) {
      setError('No items available in your library. Add media folders in Settings first!');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      pickRandom();
    } else {
      setItem(null);
    }
  }, [isOpen]);

  const handlePlay = async () => {
    if (!item) return;

    if (isMovie(item)) {
      if (!item.file_path) return;
      await playbackApi.play({
        file_path: item.file_path,
        position: item.progress?.position || 0,
        media_type: 'movie',
        media_id: item.id,
      });
      onClose();
    } else {
      const series = item as TVSeries;
      let targetFile = '';
      let targetEpId = 0;
      let pos = 0;

      // Find first episode
      try {
        const fullSeries = (await libraryApi.getSeriesById(series.id)) as any;
        const s1 = fullSeries.seasons?.[0];
        if (s1) {
          const eps = await libraryApi.getSeasonEpisodes(series.id, s1.season_number);
          if (eps && eps.length > 0) {
            targetFile = eps[0].file_path || '';
            targetEpId = eps[0].id;
            pos = eps[0].progress?.position || 0;
          }
        }
      } catch {}

      if (targetFile) {
        await playbackApi.play({
          file_path: targetFile,
          position: pos,
          media_type: 'episode',
          media_id: targetEpId,
        });
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl bg-[#181818] border border-neutral-700/80 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors border border-white/10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4 text-neutral-400">
              <div className="relative">
                <Shuffle className="w-12 h-12 text-netflix animate-spin" />
                <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2 animate-bounce" />
              </div>
              <p className="text-sm font-semibold tracking-wide">Finding something great to watch...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-4">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={onClose}
                className="bg-neutral-800 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          ) : item ? (
            <div>
              {/* Header Backdrop */}
              <div className="relative h-64 sm:h-72 w-full bg-neutral-900">
                {item.backdrop_path ? (
                  <img
                    src={getImageUrl(item.backdrop_path, 'original') || ''}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-neutral-600 font-bold text-2xl">
                    {item.title}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/80 via-transparent to-transparent" />

                {/* Badge */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-netflix animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-white">
                    PLAY SOMETHING
                  </span>
                </div>

                {/* Title & metadata on backdrop */}
                <div className="absolute bottom-4 left-6 right-6">
                  <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md tracking-tight">
                    {item.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-300">
                    <span className="text-green-400 font-bold font-mono">
                      {Math.round(((item.vote_average || 7.5) / 10) * 100)}% Match
                    </span>

                    {item.vote_average && (
                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {item.vote_average.toFixed(1)}
                      </span>
                    )}

                    {(('release_date' in item && item.release_date) ||
                      ('first_air_date' in (item as any) && (item as any).first_air_date)) && (
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Calendar className="w-3 h-3" />
                        {('release_date' in item ? item.release_date : (item as any).first_air_date)?.slice(0, 4)}
                      </span>
                    )}

                    <span className="border border-neutral-600 text-neutral-300 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                      {isMovie(item) ? 'Movie' : 'TV Series'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-5">
                {/* Genres */}
                {item.genres && item.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.genres.map((g) => (
                      <span
                        key={g}
                        className="bg-neutral-800 text-neutral-300 text-[11px] px-2.5 py-1 rounded-md border border-neutral-700 font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Overview */}
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed line-clamp-3">
                  {item.overview || 'No synopsis available for this title.'}
                </p>

                {/* Action Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    onClick={handlePlay}
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Play Now</span>
                  </button>

                  <button
                    onClick={() => pickRandom(item.id)}
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-[#2a2a2a] hover:bg-[#333] text-white px-6 py-3 rounded-xl text-sm font-bold transition-all border border-neutral-700 active:scale-95"
                  >
                    <Shuffle className="w-4 h-4 text-netflix" />
                    <span>Play Something Else</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
