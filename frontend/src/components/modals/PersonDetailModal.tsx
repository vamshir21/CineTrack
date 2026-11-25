import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Film,
  Calendar,
  MapPin,
  CheckCircle2,
  Tv,
  Sparkles,
  User,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../../api/library';
import { tmdbApi } from '../../api/tmdb';
import type { Movie, TVSeries, PersonCredit } from '../../types';
import { isMovie } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { TrailerPlayer } from '../common/TrailerPlayer';

interface PersonDetailModalProps {
  personId: number | null;
  personName?: string;
  onClose: () => void;
  onPlayMovie: (movie: Movie) => void;
  onSelectMovie?: (movie: Movie) => void;
  onPlaySeries?: (series: TVSeries) => void;
  onSelectSeries?: (series: TVSeries) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  personId,
  personName,
  onClose,
  onPlayMovie,
  onSelectMovie,
  onPlaySeries,
  onSelectSeries,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'other'>('library');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [selectedCreditForTrailer, setSelectedCreditForTrailer] = useState<PersonCredit | null>(null);

  const { data: filmography, isLoading, error } = useQuery({
    queryKey: ['person-filmography', personId],
    queryFn: () => (personId ? libraryApi.getPersonFilmography(personId) : null),
    enabled: !!personId,
  });

  const { data: trailerData } = useQuery({
    queryKey: ['trailer', selectedCreditForTrailer?.media_type || 'movie', selectedCreditForTrailer?.id],
    queryFn: () =>
      selectedCreditForTrailer
        ? tmdbApi.getTrailer(selectedCreditForTrailer.media_type, selectedCreditForTrailer.id)
        : null,
    enabled: !!selectedCreditForTrailer?.id,
  });

  if (!personId) return null;

  const person = filmography?.person;
  const inLibrary = filmography?.in_library || [];
  const otherWorks = filmography?.other_works || [];

  const getProviders = (providers?: any) => {
    if (!providers) return { flatrate: [], rent: [], buy: [] };
    if (Array.isArray(providers)) return { flatrate: providers, rent: [], buy: [] };
    return {
      flatrate: providers.flatrate || [],
      rent: providers.rent || [],
      buy: providers.buy || [],
    };
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-4xl bg-[#181818] rounded-xl overflow-hidden shadow-2xl z-10 border border-neutral-800 my-8 flex flex-col max-h-[90vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-neutral-800 text-white transition-colors border border-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : error || !person ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <User className="w-12 h-12 text-neutral-600 mb-3" />
              <p className="text-base font-bold text-white">
                Could not load filmography {personName ? `for ${personName}` : ''}
              </p>
              <p className="text-xs mt-1">Check your connection to TMDB.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header Profile Section */}
              <div className="p-6 sm:p-8 bg-gradient-to-b from-neutral-900 via-[#181818] to-[#181818] border-b border-neutral-800">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Portrait Avatar */}
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-neutral-800 border-4 border-netflix shadow-xl flex-shrink-0">
                    {person.profile_url ? (
                      <ImageWithFallback
                        src={person.profile_url}
                        alt={person.name}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                        <User className="w-12 h-12" />
                      </div>
                    )}
                  </div>

                  {/* Biography & Personal Details */}
                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                      {person.known_for_department && (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-netflix text-white">
                          {person.known_for_department}
                        </span>
                      )}
                      {inLibrary.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
                          <CheckCircle2 className="w-3 h-3" />
                          {inLibrary.length} in Your Library
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {person.name}
                    </h1>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-neutral-400 mt-2">
                      {person.birthday && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Born {person.birthday}
                        </span>
                      )}
                      {person.place_of_birth && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {person.place_of_birth}
                        </span>
                      )}
                    </div>

                    {/* Bio Snippet */}
                    {person.biography && (
                      <div className="mt-3">
                        <p
                          className={`text-xs sm:text-sm text-neutral-300 leading-relaxed ${
                            !bioExpanded ? 'line-clamp-3' : ''
                          }`}
                        >
                          {person.biography}
                        </p>
                        {person.biography.length > 250 && (
                          <button
                            onClick={() => setBioExpanded(!bioExpanded)}
                            className="text-xs text-netflix hover:underline font-semibold mt-1"
                          >
                            {bioExpanded ? 'Show Less' : 'Read Full Biography'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-neutral-800/80">
                  <button
                    onClick={() => setActiveTab('library')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'library'
                        ? 'bg-netflix text-white shadow-md'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>In Your Library</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px]">
                      {inLibrary.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('other')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'other'
                        ? 'bg-white text-black shadow-md'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5 text-blue-500" />
                    <span>Other Works & Where to Stream</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-neutral-700 text-[10px]">
                      {otherWorks.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Scrollable Filmography Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
                {activeTab === 'library' ? (
                  inLibrary.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500">
                      <Film className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-semibold text-neutral-300">No titles in your local library yet</p>
                      <p className="text-xs text-neutral-500 mt-1">Check the "Other Works" tab to explore titles streaming on OTT.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {inLibrary.map((item, idx) => {
                        const isMovieItem = item.local_item && isMovie(item.local_item);
                        const localMovie = isMovieItem ? (item.local_item as Movie) : null;
                        const localSeries = !isMovieItem && item.local_item ? (item.local_item as TVSeries) : null;

                        return (
                          <div
                            key={`${item.id}-${item.role || ''}-${idx}`}
                            className="flex items-center gap-3.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                          >
                            <div className="w-16 h-24 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0">
                              {item.poster_url ? (
                                <ImageWithFallback
                                  src={item.poster_url}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                  <Film className="w-6 h-6" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                In Local Library
                              </span>
                              <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                              {item.role && (
                                <p className="text-xs text-neutral-400 truncate">as {item.role}</p>
                              )}
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {item.release_date ? item.release_date.slice(0, 4) : ''}
                                {item.vote_average ? ` • ★ ${item.vote_average.toFixed(1)}` : ''}
                              </p>

                              <div className="flex items-center gap-2 mt-2">
                                {localMovie && (
                                  <button
                                    onClick={() => onPlayMovie(localMovie)}
                                    className="flex items-center gap-1.5 bg-netflix hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold transition-all active:scale-95 shadow"
                                  >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Play</span>
                                  </button>
                                )}
                                {localMovie && onSelectMovie && (
                                  <button
                                    onClick={() => onSelectMovie(localMovie)}
                                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700"
                                  >
                                    Details
                                  </button>
                                )}
                                {localSeries && onPlaySeries && (
                                  <button
                                    onClick={() => onPlaySeries(localSeries)}
                                    className="flex items-center gap-1.5 bg-netflix hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold transition-all active:scale-95 shadow"
                                  >
                                    <Play className="w-3 h-3 fill-white" />
                                    <span>Watch Show</span>
                                  </button>
                                )}
                                {localSeries && onSelectSeries && (
                                  <button
                                    onClick={() => onSelectSeries(localSeries)}
                                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700"
                                  >
                                    Episodes
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div>
                    <p className="text-xs text-neutral-400 mb-4">
                      Browse top acclaimed titles and find where to stream them legally across Netflix, Prime Video, Apple TV+, and Disney+.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {otherWorks.map((item, idx) => {
                        const { flatrate } = getProviders(item.providers);

                        return (
                          <div
                            key={`${item.id}-${item.role || ''}-${idx}`}
                            className="flex items-center gap-3.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                          >
                            <div className="w-16 h-24 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0">
                              {item.poster_url ? (
                                <ImageWithFallback
                                  src={item.poster_url}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                  <Film className="w-6 h-6" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                              {item.role && (
                                <p className="text-xs text-neutral-400 truncate">as {item.role}</p>
                              )}
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {item.release_date ? item.release_date.slice(0, 4) : ''}
                                {item.vote_average ? ` • ★ ${item.vote_average.toFixed(1)}` : ''}
                              </p>

                              {/* Streaming Platforms */}
                              {flatrate.length > 0 ? (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <span className="text-[10px] font-black text-blue-400">Stream on:</span>
                                  <div className="flex items-center gap-1 overflow-hidden">
                                    {flatrate.slice(0, 3).map((p: any) => (
                                      <div
                                        key={p.provider_id || p.provider_name}
                                        title={p.provider_name}
                                        className="w-5 h-5 rounded overflow-hidden bg-neutral-800 shadow"
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
                              ) : (
                                <p className="text-[11px] text-neutral-500 italic mt-2">Theatrical / VOD</p>
                              )}

                              {/* Trailer Button */}
                              <button
                                onClick={() => setSelectedCreditForTrailer(item)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-netflix hover:underline mt-2"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Watch Trailer</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* In-Modal Trailer Player Overlay */}
              {selectedCreditForTrailer && (
                <div className="p-4 bg-black/90 border-t border-neutral-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">
                      Trailer: {selectedCreditForTrailer.title}
                    </span>
                    <button
                      onClick={() => setSelectedCreditForTrailer(null)}
                      className="text-xs text-neutral-400 hover:text-white"
                    >
                      Close Trailer
                    </button>
                  </div>
                  {trailerData?.trailer ? (
                    <div className="max-w-xl mx-auto rounded-lg overflow-hidden border border-neutral-800">
                      <TrailerPlayer videoKey={trailerData.trailer.key} autoPlay={true} />
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 text-center py-4 italic">
                      Trailer preview not available.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
