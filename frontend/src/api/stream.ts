import client from './client';

export const streamApi = {
  getMovieStreamUrl: (movieId: number): string => {
    return `/api/stream/movie/${movieId}`;
  },

  getEpisodeStreamUrl: (episodeId: number): string => {
    return `/api/stream/episode/${episodeId}`;
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
