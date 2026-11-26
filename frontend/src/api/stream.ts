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
  getMovieStreamUrl: (movieId: number, audioTrack: number = 0): string => {
    return audioTrack > 0
      ? `/api/stream/movie/${movieId}?audio=${audioTrack}`
      : `/api/stream/movie/${movieId}`;
  },

  getEpisodeStreamUrl: (episodeId: number, audioTrack: number = 0): string => {
    return audioTrack > 0
      ? `/api/stream/episode/${episodeId}?audio=${audioTrack}`
      : `/api/stream/episode/${episodeId}`;
  },

  getTracks: async (mediaType: 'movie' | 'episode', mediaId: number): Promise<MediaTracks> => {
    const { data } = await client.get(`/api/stream/tracks/${mediaType}/${mediaId}`);
    return data;
  },

  prepareAudio: async (
    mediaType: 'movie' | 'episode',
    mediaId: number,
    audioTrack: number
  ): Promise<void> => {
    await client.post(`/api/stream/prepare-audio/${mediaType}/${mediaId}`, {
      audio_track: audioTrack,
    });
  },

  getSubtitleUrl: (mediaType: 'movie' | 'episode', mediaId: number, trackId: string): string => {
    return `/api/stream/subtitles/${mediaType}/${mediaId}?track=${trackId}`;
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
