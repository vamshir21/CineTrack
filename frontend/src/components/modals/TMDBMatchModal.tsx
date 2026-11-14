import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tmdbApi } from '../../api/tmdb';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface TMDBMatchModalProps {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  currentTitle: string;
  onClose: () => void;
  onMatched?: () => void;
}

export const TMDBMatchModal: React.FC<TMDBMatchModalProps> = ({
  mediaType,
  mediaId,
  currentTitle,
  onClose,
  onMatched,
}) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState(currentTitle);
  const [activeQuery, setActiveQuery] = useState(currentTitle);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['tmdbSearch', mediaType, activeQuery],
    queryFn: () => tmdbApi.search(activeQuery, mediaType),
    enabled: activeQuery.trim().length > 0,
  });

  const matchMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      if (mediaType === 'movie') {
        return tmdbApi.matchMovie(mediaId, tmdbId);
      } else {
        return tmdbApi.matchSeries(mediaId, tmdbId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      onMatched?.();
      onClose();
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveQuery(searchQuery.trim());
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-10 w-full max-w-2xl bg-[#1e1e1e] border border-neutral-700 text-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div>
              <h3 className="text-lg font-bold">Match with TMDB</h3>
              <p className="text-xs text-neutral-400">Select the correct title to fetch artwork & metadata</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="p-4 border-b border-neutral-800 bg-[#252525]">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search TMDB title..."
                  className="w-full bg-[#181818] border border-neutral-700 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-netflix"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-netflix hover:bg-netflix-hover rounded text-xs font-bold transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-neutral-400 text-sm">Searching TMDB...</div>
            ) : candidates && candidates.length > 0 ? (
              candidates.map((c: any) => {
                const posterUrl = c.poster_path
                  ? `https://image.tmdb.org/t/p/w342${c.poster_path}`
                  : null;

                return (
                  <div
                    key={c.tmdb_id}
                    className="flex items-start gap-4 p-3 bg-[#262626] hover:bg-[#2e2e2e] rounded-lg transition-colors border border-neutral-800"
                  >
                    <div className="w-16 h-24 bg-neutral-900 rounded overflow-hidden shrink-0">
                      <ImageWithFallback
                        src={posterUrl}
                        alt={c.title}
                        fallbackTitle={c.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{c.title}</h4>
                        {c.year && <span className="text-xs text-neutral-400 shrink-0">{c.year}</span>}
                      </div>

                      {c.score !== undefined && (
                        <div className="flex items-center gap-1 text-[11px] text-green-400 font-semibold mt-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{Math.round(c.score * 100)}% Match</span>
                        </div>
                      )}

                      <p className="text-xs text-neutral-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {c.overview || 'No description available.'}
                      </p>
                    </div>

                    <button
                      onClick={() => matchMutation.mutate(c.tmdb_id)}
                      disabled={matchMutation.isPending}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-xs font-bold rounded transition-colors self-center"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{matchMutation.isPending ? 'Matching...' : 'Select'}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-neutral-500 text-sm">
                No TMDB titles found. Try modifying the search query.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
