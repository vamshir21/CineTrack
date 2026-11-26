import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '../api/library';
import { MediaCard } from '../components/cards/MediaCard';
import { MovieDetailModal } from '../components/modals/MovieDetailModal';
import { CollectionRail } from '../components/rails/CollectionRail';
import { CollectionDetailModal } from '../components/modals/CollectionDetailModal';
import { usePlaybackStore } from '../store/playbackStore';
import { usePlayMedia } from '../hooks/usePlayMedia';
import type { Movie } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const MoviesPage: React.FC = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const { setPlayerOpen } = usePlaybackStore();
  const { playMovie } = usePlayMedia();

  const { data: movies, isLoading } = useQuery({
    queryKey: ['movies'],
    queryFn: libraryApi.getMovies,
  });

  const { data: collections } = useQuery({
    queryKey: ['library-collections'],
    queryFn: libraryApi.getCollections,
    staleTime: 1000 * 60 * 5,
  });

  const allGenres = useMemo(() => {
    if (!movies) return [];
    const set = new Set<string>();
    movies.forEach((m) => m.genres?.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [movies]);

  const allLanguages = useMemo(() => {
    if (!movies) return [];
    const set = new Set<string>();
    movies.forEach((m) => m.languages?.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [movies]);

  const filteredMovies = useMemo(() => {
    if (!movies) return [];
    let list = [...movies];

    if (selectedGenre !== 'all') {
      list = list.filter((m) => m.genres?.includes(selectedGenre));
    }

    if (selectedLanguage !== 'all') {
      list = list.filter((m) => m.languages?.includes(selectedLanguage));
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    } else if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [movies, selectedGenre, selectedLanguage, sortBy]);

  const handlePlay = async (movie: Movie) => {
    playMovie(movie);
    setPlayerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] pt-24 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] pt-24 px-8 md:px-12 pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-wide">Movies</h1>
          <p className="text-xs text-neutral-400 mt-1">{filteredMovies.length} movies in local library</p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          {/* Genre select */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-netflix cursor-pointer"
          >
            <option value="all">All Genres</option>
            {allGenres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Language select */}
          {allLanguages.length > 0 && (
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-netflix cursor-pointer"
            >
              <option value="all">All Languages</option>
              {allLanguages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}

          {/* Sort select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#2a2a2a] text-white border border-neutral-700 rounded px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-netflix cursor-pointer"
          >
            <option value="recent">Recently Added</option>
            <option value="rating">Top Rated</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Franchises & Collections Binge Rail */}
      {collections && collections.length > 0 && selectedGenre === 'all' && (
        <div className="-mx-8 md:-mx-12 mb-8">
          <CollectionRail
            title="Franchises & Movie Sagas"
            subtitle="Browse and binge complete movie sagas in order"
            collections={collections}
            onSelectCollection={(cid) => setSelectedCollectionId(cid)}
          />
        </div>
      )}

      {/* Grid of Movie Cards */}
      {filteredMovies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {filteredMovies.map((movie) => (
            <MediaCard
              key={movie.id}
              item={movie}
              variant="poster"
              onClick={() => setSelectedMovie(movie)}
              onPlay={() => handlePlay(movie)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-neutral-500">
          <p className="text-lg font-semibold">No movies found</p>
          <p className="text-xs mt-1">Add folders and scan media in Settings to import movies.</p>
        </div>
      )}

      {/* Movie Detail Modal */}
      {selectedMovie && (
        <MovieDetailModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={(m) => {
            setSelectedMovie(null);
            handlePlay(m);
          }}
        />
      )}

      {/* Franchise & Collection Detail Modal */}
      {selectedCollectionId && (
        <CollectionDetailModal
          collectionId={selectedCollectionId}
          onClose={() => setSelectedCollectionId(null)}
          onPlayMovie={(m) => {
            setSelectedCollectionId(null);
            handlePlay(m);
          }}
          onSelectMovie={(m) => {
            setSelectedCollectionId(null);
            setSelectedMovie(m);
          }}
        />
      )}

    </div>
  );
};
