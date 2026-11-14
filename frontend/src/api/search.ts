import client from './client';
import type { SearchResult } from '../types';

export const searchApi = {
  search: async (q: string, type?: string): Promise<SearchResult> => {
    const { data } = await client.get('/api/search', { params: { q, type } });
    return data;
  },
};
