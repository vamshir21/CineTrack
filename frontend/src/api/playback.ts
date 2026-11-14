import client from './client';
import type { PlaybackStatus } from '../types';

export const playbackApi = {
  play: async (params: {
    file_path: string;
    position?: number;
    media_type: string;
    media_id: number;
  }): Promise<void> => {
    await client.post('/api/playback/play', params);
  },

  pause: async (): Promise<void> => {
    await client.post('/api/playback/pause');
  },

  resume: async (): Promise<void> => {
    await client.post('/api/playback/resume');
  },

  stop: async (): Promise<void> => {
    await client.post('/api/playback/stop');
  },

  seek: async (position: number): Promise<void> => {
    await client.post('/api/playback/seek', { position });
  },

  setVolume: async (level: number): Promise<void> => {
    await client.post('/api/playback/volume', { level });
  },

  setSpeed: async (rate: number): Promise<void> => {
    await client.post('/api/playback/speed', { rate });
  },

  getStatus: async (): Promise<PlaybackStatus> => {
    const { data } = await client.get('/api/playback/status');
    return data;
  },

  getSubtitles: async () => {
    const { data } = await client.get('/api/playback/subtitles');
    return data;
  },

  selectSubtitle: async (track_id: number): Promise<void> => {
    await client.post('/api/playback/subtitles/select', { track_id });
  },

  removeFromContinueWatching: async (media_type: string, media_id: number): Promise<void> => {
    await client.post('/api/playback/continue-watching/remove', { media_type, media_id });
  },
};
