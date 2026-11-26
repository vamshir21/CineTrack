import { useBrowserPlayerStore } from '../store/browserPlayerStore';
import { playbackApi } from '../api/playback';
import { isMovie, type MediaItem, type Movie, type Episode, type TVSeries } from '../types';

export const isLanClient = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
};

export function usePlayMedia() {
  const { openMovie, openEpisode } = useBrowserPlayerStore();

  const playMovie = async (movie: Movie, forceVlc = false) => {
    if (!forceVlc || isLanClient()) {
      openMovie(movie);
    } else {
      if (!movie.file_path) return;
      await playbackApi.play({
        file_path: movie.file_path,
        position: movie.progress?.position || 0,
        media_type: 'movie',
        media_id: movie.id,
      });
    }
  };

  const playEpisode = async (
    episode: Episode,
    series?: TVSeries | { id: number; title: string },
    forceVlc = false
  ) => {
    if (!forceVlc || isLanClient()) {
      openEpisode(episode, series);
    } else {
      if (!episode.file_path) return;
      await playbackApi.play({
        file_path: episode.file_path,
        position: episode.progress?.position || 0,
        media_type: 'episode',
        media_id: episode.id,
      });
    }
  };

  const playMedia = async (item: MediaItem, forceVlc = false) => {
    const raw = item as any;
    const isEp = raw.media_type === 'episode' || 'season_number' in raw || 'series_id' in raw;
    if (isEp) {
      await playEpisode(raw as Episode, undefined, forceVlc);
    } else if (isMovie(item)) {
      await playMovie(item, forceVlc);
    }
  };

  return {
    playMovie,
    playEpisode,
    playMedia,
    isLanClient: isLanClient(),
  };
}
