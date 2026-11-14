import client from './client';
import type { WatchlistItem } from '../types';

export const watchlistApi = {
  getWatchlist: async (): Promise<WatchlistItem[]> => {
    const { data } = await client.get('/api/watchlist');
    return data;
  },

  addToWatchlist: async (media_type: 'movie' | 'series', media_id: number): Promise<void> => {
    await client.post('/api/watchlist', { media_type, media_id });
  },

  removeFromWatchlist: async (media_type: 'movie' | 'series', media_id: number): Promise<void> => {
    await client.delete(`/api/watchlist/${media_type}/${media_id}`);
  },

  checkWatchlist: async (
    media_type: 'movie' | 'series',
    media_id: number
  ): Promise<{ in_watchlist: boolean }> => {
    const { data } = await client.get(`/api/watchlist/check/${media_type}/${media_id}`);
    return data;
  },
};
