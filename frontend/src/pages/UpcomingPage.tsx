import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clapperboard,
  Tv,
  Film,
  Sparkles,
  Search,
  Star,
  Play,
  X,
  Clock,
  CheckCircle2,
  Globe2,
} from 'lucide-react';
import { tmdbApi } from '../api/tmdb';
import { libraryApi } from '../api/library';
import { playbackApi } from '../api/playback';
import { usePlaybackStore } from '../store/playbackStore';
import type { UpcomingMovie, Movie } from '../types';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TrailerPlayer } from '../components/common/TrailerPlayer';
import { getLanguageBadgeStyle } from '../utils/languageUtils';
import { motion, AnimatePresence } from 'framer-motion';

type TabType = 'all' | 'theaters' | 'upcoming' | 'ott';
type SearchFilterType = 'all' | 'ott' | 'rent';

export const UpcomingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilterType>('all');
  const [selectedMovieForTrailer, setSelectedMovieForTrailer] = useState<UpcomingMovie | null>(null);
  const { setPlayerOpen } = usePlaybackStore();

  const isSearchMode = searchQuery.trim().length >= 2;

  // Local library movies to cross-reference
  const { data: localMovies } = useQuery({
    queryKey: ['movies'],
    queryFn: libraryApi.getMovies,
    staleTime: 1000 * 60 * 5,
  });

  const localMoviesByTmdb = useMemo(() => {
    const map = new Map<number, Movie>();
    (localMovies || []).forEach((m) => {
      if (m.tmdb_id) map.set(m.tmdb_id, m);
    });
    return map;
  }, [localMovies]);

  // Global TMDB & OTT search query
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ['tmdb-search-ott', searchQuery.trim()],
    queryFn: () => tmdbApi.searchOtt(searchQuery.trim()),
    enabled: isSearchMode,
    staleTime: 1000 * 60 * 5,
  });

  // Feeds for regular Upcoming Hub
  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: ['tmdb-upcoming'],
    queryFn: () => tmdbApi.getUpcoming(1),
    staleTime: 1000 * 60 * 30,
  });

  const { data: nowPlayingData, isLoading: loadingNowPlaying } = useQuery({
    queryKey: ['tmdb-now-playing'],
    queryFn: () => tmdbApi.getNowPlaying(1),
    staleTime: 1000 * 60 * 30,
  });

  const { data: ottData, isLoading: loadingOtt } = useQuery({
    queryKey: ['tmdb-ott'],
    queryFn: () => tmdbApi.getOttReleases(1),
    staleTime: 1000 * 60 * 30,
  });

  // Trailer query
  const { data: trailerData } = useQuery({
    queryKey: ['trailer', 'movie', selectedMovieForTrailer?.id],
    queryFn: () => (selectedMovieForTrailer ? tmdbApi.getTrailer('movie', selectedMovieForTrailer.id) : null),
    enabled: !!selectedMovieForTrailer,
  });

  const isLoadingFeeds = loadingUpcoming || loadingNowPlaying || loadingOtt;

  // Helper to normalize watch providers
  const getProviders = (providers?: any) => {
    if (!providers) return { flatrate: [], rent: [], buy: [] };
    if (Array.isArray(providers)) return { flatrate: providers, rent: [], buy: [] };
    return {
      flatrate: providers.flatrate || [],
      rent: providers.rent || [],
      buy: providers.buy || [],
    };
  };

  // Aggregate standard upcoming feeds
  const allFeedItems = useMemo(() => {
    const list: (UpcomingMovie & { feedType: 'theaters' | 'upcoming' | 'ott' })[] = [];
    const seenIds = new Set<number>();

    (ottData?.results || []).forEach((m) => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        list.push({ ...m, feedType: 'ott' });
      }
    });

    (nowPlayingData?.results || []).forEach((m) => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        list.push({ ...m, feedType: 'theaters' });
      }
    });

    (upcomingData?.results || []).forEach((m) => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        list.push({ ...m, feedType: 'upcoming' });
      }
    });

    return list;
  }, [upcomingData, nowPlayingData, ottData]);

  // Tab filter for standard feed
  const displayedFeedItems = useMemo(() => {
    let items = allFeedItems;
    if (activeTab === 'theaters') {
      items = items.filter((i) => i.feedType === 'theaters');
    } else if (activeTab === 'upcoming') {
      items = items.filter((i) => i.feedType === 'upcoming');
    } else if (activeTab === 'ott') {
      items = items.filter((i) => i.feedType === 'ott');
    }
    return items;
  }, [allFeedItems, activeTab]);

  // Filtered search results
  const displayedSearchResults = useMemo(() => {
    const results = searchData?.results || [];
    if (searchFilter === 'ott') {
      return results.filter((m) => getProviders(m.providers).flatrate.length > 0);
    }
    if (searchFilter === 'rent') {
      return results.filter((m) => {
        const p = getProviders(m.providers);
        return p.rent.length > 0 || p.buy.length > 0;
      });
    }
    return results;
  }, [searchData, searchFilter]);

  const handlePlayLocalMovie = async (movie: Movie) => {
    if (!movie.file_path) return;
    await playbackApi.play({
      file_path: movie.file_path,
      position: movie.progress?.position || 0,
      media_type: 'movie',
      media_id: movie.id,
    });
    setPlayerOpen(true);
  };

  const getReleaseBadge = (item: UpcomingMovie & { feedType?: 'theaters' | 'upcoming' | 'ott' }) => {
    if (item.feedType === 'theaters') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-red-600/90 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
          <Clapperboard className="w-3 h-3" />
          In Theaters
        </span>
      );
    }

    const { flatrate } = getProviders(item.providers);
    if ((item.feedType === 'ott' || isSearchMode) && flatrate.length > 0) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-blue-600/90 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
          <Tv className="w-3 h-3" />
          On OTT
        </span>
      );
    }

    if (item.days_until !== undefined) {
      if (item.days_until === 0) {
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm">
            Releasing Today
          </span>
        );
      }
      if (item.days_until > 0 && item.days_until <= 30) {
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/90 text-black font-extrabold text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
            <Clock className="w-3 h-3" />
            In {item.days_until} {item.days_until === 1 ? 'day' : 'days'}
          </span>
        );
      }
    }

    if (item.release_date) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-neutral-800/90 text-neutral-200 font-semibold text-[10px] border border-neutral-700">
          {item.release_date}
        </span>
      );
    }

    return null;
  };

  const renderMovieCard = (item: UpcomingMovie, feedType?: 'theaters' | 'upcoming' | 'ott') => {
    const localMatch = localMoviesByTmdb.get(item.id);
    const { flatrate, rent } = getProviders(item.providers);
    const langStyle = item.language_name ? getLanguageBadgeStyle(item.language_name) : getLanguageBadgeStyle('English');

    return (
      <div
        key={item.id}
        className="group relative bg-[#1c1c1c] rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/70 flex flex-col"
      >
        {/* Poster image container */}
        <div className="relative aspect-[2/3] w-full bg-neutral-900 overflow-hidden">
          {item.poster_url ? (
            <ImageWithFallback
              src={item.poster_url}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600">
              <Film className="w-10 h-10" />
            </div>
          )}

          {/* Top Left Badges: Release / OTT status */}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            {getReleaseBadge({ ...item, feedType })}
            {localMatch && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[9px] uppercase tracking-wider shadow-md flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                In Library
              </span>
            )}
          </div>

          {/* Top Right Badges: Rating & Language */}
          <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
            {item.vote_average && item.vote_average > 0 ? (
              <div className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-amber-400 text-[10px] font-black flex items-center gap-1 border border-neutral-700/60 shadow">
                <Star className="w-2.5 h-2.5 fill-amber-400" />
                {item.vote_average.toFixed(1)}
              </div>
            ) : null}

            {item.language_name && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm ${langStyle.bg} ${langStyle.text} ${langStyle.border}`}
              >
                {item.language_name}
              </span>
            )}
          </div>

          {/* Bottom Streaming / Rental Providers Strip */}
          {flatrate.length > 0 ? (
            <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-1.5 p-1 rounded-md bg-black/85 backdrop-blur-md border border-neutral-800">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider pl-1">
                Stream:
              </span>
              <div className="flex items-center gap-1 overflow-hidden">
                {flatrate.slice(0, 4).map((p: any) => (
                  <div
                    key={p.provider_id || p.provider_name}
                    title={p.provider_name}
                    className="w-5 h-5 rounded overflow-hidden flex-shrink-0 bg-neutral-800 shadow"
                  >
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.provider_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-black flex items-center justify-center h-full text-white">
                        {p.provider_name[0]}
                      </span>
                    )}
                  </div>
                ))}
                {flatrate.length > 4 && (
                  <span className="text-[8px] text-neutral-400 font-bold">+{flatrate.length - 4}</span>
                )}
              </div>
            </div>
          ) : rent.length > 0 ? (
            <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-1.5 p-1 rounded-md bg-black/85 backdrop-blur-md border border-neutral-800">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider pl-1">
                Rent:
              </span>
              <div className="flex items-center gap-1 overflow-hidden">
                {rent.slice(0, 3).map((p: any) => (
                  <div
                    key={p.provider_id || p.provider_name}
                    title={p.provider_name}
                    className="w-5 h-5 rounded overflow-hidden flex-shrink-0 bg-neutral-800 shadow"
                  >
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.provider_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[8px] font-black flex items-center justify-center h-full text-white">
                        {p.provider_name[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Hover Overlay with Trailer & Play Button */}
          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2.5 p-4 z-20">
            {localMatch ? (
              <button
                onClick={() => handlePlayLocalMovie(localMatch)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play from Library</span>
              </button>
            ) : null}

            <button
              onClick={() => setSelectedMovieForTrailer(item)}
              className="flex items-center gap-2 bg-netflix hover:bg-red-700 text-white px-4 py-2 rounded-full font-bold text-xs transition-all shadow-lg active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Watch Trailer</span>
            </button>

            {item.release_date && (
              <span className="text-[11px] text-neutral-300 font-medium">
                {item.release_date}
              </span>
            )}
          </div>
        </div>

        {/* Card Details */}
        <div className="p-3 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-1">
              <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors line-clamp-1">
                {item.title}
              </h3>
            </div>
            {item.overview && (
              <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                {item.overview}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
            <span className="font-medium">{item.release_date || 'TBD'}</span>
            <button
              onClick={() => setSelectedMovieForTrailer(item)}
              className="text-netflix hover:underline text-[11px] font-semibold flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Trailer
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#141414] pt-24 px-6 sm:px-8 md:px-12 pb-24 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header with Title and Search Input */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-800/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-netflix text-white">
                COMING SOON & OTT HUB
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                Search Any Movie • Theatrical & OTT Availability
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {isSearchMode ? 'Movie & OTT Search' : 'Upcoming & OTT Releases'}
            </h1>
            <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
              Search any movie worldwide to see which OTT platform streams it (Netflix, Prime Video, Disney+, Apple TV+), ratings, audio languages, and official trailers.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any movie on TMDB & OTT..."
              className="w-full bg-[#202020] border border-neutral-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-netflix transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Mode UI vs Feed Mode UI */}
        {isSearchMode ? (
          <div>
            {/* Search Mode Sub-header & Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <Globe2 className="w-4 h-4 text-netflix" />
                <span>
                  Results for <strong className="text-white">"{searchQuery}"</strong>
                  {searchData && ` (${searchData.total_results || displayedSearchResults.length} found)`}
                </span>
              </div>

              {/* Search Filters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSearchFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    searchFilter === 'all'
                      ? 'bg-white text-black shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  All Matches
                </button>
                <button
                  onClick={() => setSearchFilter('ott')}
                  className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    searchFilter === 'ott'
                      ? 'bg-netflix text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  Streaming on OTT
                </button>
                <button
                  onClick={() => setSearchFilter('rent')}
                  className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    searchFilter === 'rent'
                      ? 'bg-netflix text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Rent / Buy
                </button>
              </div>
            </div>

            {/* Search Results Grid */}
            {isSearching ? (
              <div className="h-96 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner />
                <p className="text-xs text-neutral-400">Searching TMDB & OTT platforms for "{searchQuery}"...</p>
              </div>
            ) : displayedSearchResults.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-center">
                <Film className="w-12 h-12 text-neutral-600 mb-3" />
                <p className="text-base font-bold text-neutral-300">No movies found for "{searchQuery}"</p>
                <p className="text-xs text-neutral-500 mt-1">Try another title spelling or keyword.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 mt-8">
                {displayedSearchResults.map((m) => renderMovieCard(m))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Standard Feed Tab Filters */}
            <div className="flex items-center gap-2 mt-6 overflow-x-auto no-scrollbar pb-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'all'
                    ? 'bg-white text-black shadow-md'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                All Releases ({allFeedItems.length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'upcoming'
                    ? 'bg-netflix text-white shadow-md'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Coming Soon ({upcomingData?.results?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('theaters')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'theaters'
                    ? 'bg-netflix text-white shadow-md'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                In Theaters Now ({nowPlayingData?.results?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('ott')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'ott'
                    ? 'bg-netflix text-white shadow-md'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                Streaming & OTT ({ottData?.results?.length || 0})
              </button>
            </div>

            {/* Standard Feed Grid */}
            {isLoadingFeeds ? (
              <div className="h-96 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : displayedFeedItems.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-center">
                <Film className="w-12 h-12 text-neutral-600 mb-3" />
                <p className="text-base font-bold text-neutral-300">No releases found</p>
                <p className="text-xs text-neutral-500 mt-1">Try switching tabs.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 mt-8">
                {displayedFeedItems.map((item) => renderMovieCard(item, item.feedType))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trailer Modal */}
      {selectedMovieForTrailer && (
        <AnimatePresence>
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="fixed inset-0" onClick={() => setSelectedMovieForTrailer(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-[#181818] rounded-xl overflow-hidden shadow-2xl z-10 border border-neutral-800 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">
                    {selectedMovieForTrailer.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                    {selectedMovieForTrailer.release_date && (
                      <span>Release: {selectedMovieForTrailer.release_date}</span>
                    )}
                    {selectedMovieForTrailer.language_name && (
                      <>
                        <span>•</span>
                        <span>{selectedMovieForTrailer.language_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMovieForTrailer(null)}
                  className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {trailerData?.trailer ? (
                <div className="rounded-lg overflow-hidden border border-neutral-800 shadow-md">
                  <TrailerPlayer videoKey={trailerData.trailer.key} autoPlay={true} />
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center bg-neutral-900 rounded-lg">
                  <Film className="w-10 h-10 text-neutral-600 mb-2" />
                  <p className="text-sm font-semibold text-neutral-300">
                    Trailer preview not available yet
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Check back closer to the release date!
                  </p>
                </div>
              )}

              {selectedMovieForTrailer.overview && (
                <div className="mt-4 pt-4 border-t border-neutral-800">
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {selectedMovieForTrailer.overview}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
