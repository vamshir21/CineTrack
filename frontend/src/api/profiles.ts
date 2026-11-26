import client from './client';
import type { Profile } from '../types';

export const profilesApi = {
  list: async (): Promise<Profile[]> => {
    const { data } = await client.get('/api/profiles');
    return data;
  },

  get: async (profileId: number): Promise<Profile> => {
    const { data } = await client.get(`/api/profiles/${profileId}`);
    return data;
  },

  create: async (payload: { name: string; avatar: string; is_admin?: boolean }): Promise<Profile> => {
    const { data } = await client.post('/api/profiles', payload);
    return data;
  },

  update: async (profileId: number, payload: { name?: string; avatar?: string }): Promise<Profile> => {
    const { data } = await client.put(`/api/profiles/${profileId}`, payload);
    return data;
  },

  delete: async (profileId: number): Promise<void> => {
    await client.delete(`/api/profiles/${profileId}`);
  },
};
