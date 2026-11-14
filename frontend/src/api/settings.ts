import client from './client';
import type { Settings } from '../types';

export const settingsApi = {
  getSettings: async (): Promise<Settings> => {
    const { data } = await client.get('/api/settings');
    return data;
  },

  updateSetting: async (key: string, value: string): Promise<void> => {
    await client.put(`/api/settings/${key}`, { value });
  },

  updateSettingsBatch: async (settings: Record<string, string>): Promise<{ status: string; updated: number }> => {
    const { data } = await client.post('/api/settings/batch', settings);
    return data;
  },

  deleteSetting: async (key: string): Promise<void> => {
    await client.delete(`/api/settings/${key}`);
  },
};

