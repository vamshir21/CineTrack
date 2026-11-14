import client from './client';
import type { ScanStatus, MediaFolder } from '../types';

export const scannerApi = {
  getFolders: async (): Promise<MediaFolder[]> => {
    const { data } = await client.get('/api/scanner/folders');
    return data;
  },

  addFolder: async (path: string, name: string): Promise<MediaFolder> => {
    const { data } = await client.post('/api/scanner/folders', { path, name });
    return data;
  },

  deleteFolder: async (id: number): Promise<void> => {
    await client.delete(`/api/scanner/folders/${id}`);
  },

  startScan: async (): Promise<void> => {
    await client.post('/api/scanner/scan');
  },

  getScanStatus: async (): Promise<ScanStatus> => {
    const { data } = await client.get('/api/scanner/scan/status');
    return data;
  },

  cancelScan: async (): Promise<void> => {
    await client.post('/api/scanner/scan/cancel');
  },
};
