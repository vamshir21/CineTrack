import client from './client';

export const tmdbApi = {
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
