import { create } from 'zustand';
import type { Movie, Episode, TVSeries } from '../types';
import { streamApi } from '../api/stream';
import { getBackdropUrl, getPosterUrl } from '../utils/imageUtils';

export interface ActiveMedia {
  mediaType: 'movie' | 'episode';
  id: number;
  title: string;
  subtitle?: string;
  streamUrl: string;
  startPosition: number;
  duration?: number;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  backdropUrl?: string | null;
  posterUrl?: string | null;
}

interface BrowserPlayerState {
  isOpen: boolean;
  activeMedia: ActiveMedia | null;
  openMovie: (movie: Movie) => void;
  openEpisode: (episode: Episode, series?: TVSeries | { id: number; title: string }) => void;
  closePlayer: () => void;
}

export const useBrowserPlayerStore = create<BrowserPlayerState>((set) => ({
  isOpen: false,
  activeMedia: null,

  openMovie: (movie: Movie) => {
    const startPosition = movie.progress?.position || 0;
    set({
      isOpen: true,
      activeMedia: {
        mediaType: 'movie',
        id: movie.id,
        title: movie.title,
        subtitle: movie.release_date ? new Date(movie.release_date).getFullYear().toString() : undefined,
        streamUrl: streamApi.getMovieStreamUrl(movie.id),
        startPosition,
        duration: movie.runtime ? movie.runtime * 60 : undefined,
        backdropUrl: getBackdropUrl(movie.backdrop_path),
        posterUrl: getPosterUrl(movie.poster_path),
      },
    });
  },

  openEpisode: (episode: Episode, series?: TVSeries | { id: number; title: string }) => {
    const startPosition = episode.progress?.position || 0;
    const seriesTitle = series?.title || '';
    const subtitle = `S${episode.season_number} E${episode.episode_number}${episode.title ? ` • ${episode.title}` : ''}`;

    set({
      isOpen: true,
      activeMedia: {
        mediaType: 'episode',
        id: episode.id,
        title: seriesTitle ? `${seriesTitle}: ${subtitle}` : subtitle,
        subtitle: episode.title || undefined,
        streamUrl: streamApi.getEpisodeStreamUrl(episode.id),
        startPosition,
        seriesId: series?.id || (episode as any).series_id,
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        backdropUrl: getBackdropUrl(episode.still_path || (series as any)?.backdrop_path),
        posterUrl: getPosterUrl((series as any)?.poster_path),
      },
    });
  },

  closePlayer: () => {
    set({ isOpen: false, activeMedia: null });
  },
}));
