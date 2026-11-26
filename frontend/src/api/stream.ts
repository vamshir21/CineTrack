import client from './client';

export interface TrackItem {
  id: string;
  label: string;
  language: string;
  default: boolean;
}

export interface MediaTracks {
  audio_tracks: TrackItem[];
  subtitle_tracks: TrackItem[];
}

export const streamApi = {
  getMovieStreamUrl: (movieId: number): string => {
    return `/api/stream/movie/${movieId}`;
  },

  getEpisodeStreamUrl: (episodeId: number): string => {
    return `/api/stream/episode/${episodeId}`;
  },

  getTracks: async (mediaType: 'movie' | 'episode', mediaId: number): Promise<MediaTracks> => {
    const { data } = await client.get(`/api/stream/tracks/${mediaType}/${mediaId}`);
    return data;
  },

  reportProgress: async (payload: {
    media_type: 'movie' | 'episode';
    media_id: number;
    position_seconds: number;
    duration_seconds: number;
    completed?: boolean;
  }): Promise<void> => {
    await client.post('/api/stream/progress', payload);
  },
};
