import React from 'react';
import type { MultiSourceRatings } from '../../types';

interface RatingBadgesProps {
  ratings?: MultiSourceRatings | null;
  tmdbFallback?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  wrap?: boolean;
}

export const RatingBadges: React.FC<RatingBadgesProps> = ({
  ratings,
  tmdbFallback,
  className = '',
  size = 'md',
  wrap = true,
}) => {
  const imdb = ratings?.imdb_rating;
  const rtCritic = ratings?.rt_critic;
  const rtAudience = ratings?.rt_audience;
  const tmdb = ratings?.tmdb_rating || tmdbFallback;

  if (!imdb && !rtCritic && !rtAudience && !tmdb) return null;

  const isSmall = size === 'sm';

  return (
    <div className={`flex items-center gap-2 ${wrap ? 'flex-wrap' : 'flex-nowrap shrink-0'} ${className}`}>
      {/* 1. IMDb Rating */}
      {imdb && (
        <div
          title={ratings?.imdb_votes ? `IMDb: ${imdb}/10 (${ratings.imdb_votes} votes)` : `IMDb: ${imdb}/10`}
          className="flex items-center rounded overflow-hidden shadow-sm border border-amber-600/60 bg-neutral-900"
        >
          <span className="bg-[#f5c518] text-black font-black px-1.5 py-0.5 text-[10px] tracking-tighter">
            IMDb
          </span>
          <span className="px-1.5 py-0.5 text-[11px] font-bold text-white font-mono">
            {imdb.toFixed(1)}
          </span>
        </div>
      )}

      {/* 2. Rotten Tomatoes Critic Score (Tomatometer) */}
      {rtCritic !== undefined && rtCritic !== null && (
        <div
          title={`Rotten Tomatoes Critic Score: ${rtCritic}%`}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700/80 shadow-sm"
        >
          {rtCritic >= 60 ? (
            <span className="text-xs" role="img" aria-label="Fresh Tomato">
              🍅
            </span>
          ) : (
            <span className="text-xs" role="img" aria-label="Rotten Splat">
              🟢
            </span>
          )}
          <span className={`text-[11px] font-extrabold ${rtCritic >= 60 ? 'text-red-400' : 'text-emerald-400'}`}>
            {rtCritic}%
          </span>
        </div>
      )}

      {/* 3. Rotten Tomatoes Audience Score (Popcorn) */}
      {rtAudience !== undefined && rtAudience !== null && (
        <div
          title={`Audience Score: ${rtAudience}%`}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700/80 shadow-sm"
        >
          <span className="text-xs" role="img" aria-label="Popcorn">
            🍿
          </span>
          <span className="text-[11px] font-extrabold text-amber-300">
            {rtAudience}%
          </span>
        </div>
      )}

      {/* 4. TMDB Rating */}
      {tmdb && (!imdb || !isSmall) && (
        <div
          title={`TMDB: ${tmdb.toFixed(1)}/10`}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-cyan-800/60 shadow-sm"
        >
          <span className="text-[9px] font-black text-cyan-400 tracking-wider">TMDB</span>
          <span className="text-[11px] font-bold text-cyan-200 font-mono">
            {tmdb.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
};
