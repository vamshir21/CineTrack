import client from './client';
import type { CreditsData, TrailerData, UpcomingMovie, WatchProvider, CollectionDetail, MultiSourceRatings } from '../types';

export const tmdbApi = {
  getCredits: async (mediaType: 'movie' | 'tv' | 'series', tmdbId: number): Promise<CreditsData> => {
    const mt = mediaType === 'movie' ? 'movie' : 'tv';
    const { data } = await client.get(`/api/tmdb/${mt}/${tmdbId}/credits`);
    return data;
  },

  getTrailer: async (mediaType: 'movie' | 'tv' | 'series', tmdbId: number): Promise<TrailerData> => {
    const mt = mediaType === 'movie' ? 'movie' : 'tv';
    const { data } = await client.get(`/api/tmdb/${mt}/${tmdbId}/trailer`);
    return data;
  },

  getRatings: async (mediaType: 'movie' | 'tv' | 'series', tmdbId: number): Promise<MultiSourceRatings> => {
    const mt = mediaType === 'movie' ? 'movie' : 'tv';
    const { data } = await client.get(`/api/tmdb/${mt}/${tmdbId}/ratings`);
    return data;
  },

  getUpcoming: async (page = 1): Promise<{ results: UpcomingMovie[]; total_pages: number }> => {
    const { data } = await client.get('/api/tmdb/upcoming', { params: { page } });
    return data;
  },

  getNowPlaying: async (page = 1): Promise<{ results: UpcomingMovie[]; total_pages: number }> => {
    const { data } = await client.get('/api/tmdb/now-playing', { params: { page } });
    return data;
  },

  getOttReleases: async (page = 1): Promise<{ results: UpcomingMovie[]; total_pages: number }> => {
    const { data } = await client.get('/api/tmdb/ott-releases', { params: { page } });
    return data;
  },

  searchOtt: async (q: string, page = 1): Promise<{ results: UpcomingMovie[]; total_pages: number; total_results: number }> => {
    const { data } = await client.get('/api/tmdb/search-ott', { params: { q, page } });
    return data;
  },

  getWatchProviders: async (mediaType: 'movie' | 'tv' | 'series', tmdbId: number): Promise<{ flatrate: WatchProvider[]; rent: WatchProvider[]; buy: WatchProvider[]; link?: string }> => {
    const mt = mediaType === 'movie' ? 'movie' : 'tv';
    const { data } = await client.get(`/api/tmdb/${mt}/${tmdbId}/providers`);
    return data;
  },

  getCollection: async (collectionId: number): Promise<CollectionDetail> => {
    const { data } = await client.get(`/api/tmdb/collection/${collectionId}`);
    return data;
  },

  search: async (q: string, type?: 'movie' | 'tv') => {
    const { data } = await client.get('/api/tmdb/search', {
      params: { q, type },
    });
    return data;
  },

  matchMovie: async (id: number, tmdb_id: number) => {
    const { data } = await client.post(`/api/tmdb/match/movie/${id}`, { tmdb_id });
    return data;
  },

  matchSeries: async (id: number, tmdb_id: number) => {
    const { data } = await client.post(`/api/tmdb/match/series/${id}`, { tmdb_id });
    return data;
  },

  getConfig: async () => {
    const { data } = await client.get('/api/tmdb/config');
    return data;
  },

  refreshMovie: async (id: number) => {
    const { data } = await client.post(`/api/tmdb/refresh/movie/${id}`);
    return data;
  },

  refreshSeries: async (id: number) => {
    const { data } = await client.post(`/api/tmdb/refresh/series/${id}`);
    return data;
  },

  testConnection: async (): Promise<{ status: string; message: string }> => {
    const { data } = await client.get('/api/tmdb/test');
    return data;
  },

  testKey: async (apiKey: string): Promise<{ status: string; message: string }> => {
    const { data } = await client.post('/api/tmdb/test-key', { api_key: apiKey });
    return data;
  },

  syncAll: async (): Promise<{ status: string; matched_movies: number; matched_series: number; message: string }> => {
    const { data } = await client.post('/api/tmdb/sync-all');
    return data;
  },
};
