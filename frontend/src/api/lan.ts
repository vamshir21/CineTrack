import client from './client';
import type { LanInfo } from '../types';

export const lanApi = {
  getInfo: async (): Promise<LanInfo> => {
    const { data } = await client.get('/api/lan/info');
    return data;
  },
};
