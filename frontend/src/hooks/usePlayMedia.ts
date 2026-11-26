import { useBrowserPlayerStore } from '../store/browserPlayerStore';
import { usePlaybackStore } from '../store/playbackStore';
import { playbackApi } from '../api/playback';
import { isMovie, type MediaItem, type Movie, type Episode, type TVSeries } from '../types';

export const isLanClient = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. Explicit user override if configured in Settings / localStorage
  const pref = localStorage.getItem('cinetrack_player_mode');
  if (pref === 'vlc') return false;
  if (pref === 'web') return true;

  // 2. Default: local machine (Ubuntu desktop on localhost / 127.0.0.1) -> false (use VLC)
  // Remote clients (phones, tablets, TVs on LAN) -> true (use in-browser HTML5 player)
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return false;
  }
  return true;
};

export function usePlayMedia() {
  const { openMovie, openEpisode } = useBrowserPlayerStore();
  const { setPlayerOpen } = usePlaybackStore();

  const playMovie = async (movie: Movie, forceVlc = false, forceWeb = false) => {
    const isLan = isLanClient();
    const useWeb = (isLan || forceWeb) && !forceVlc;

    if (useWeb) {
      openMovie(movie);
    } else {
      if (!movie.file_path) return;
      setPlayerOpen(true);
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
    forceVlc = false,
    forceWeb = false
  ) => {
    const isLan = isLanClient();
    const useWeb = (isLan || forceWeb) && !forceVlc;

    if (useWeb) {
      openEpisode(episode, series);
    } else {
      if (!episode.file_path) return;
      setPlayerOpen(true);
      await playbackApi.play({
        file_path: episode.file_path,
        position: episode.progress?.position || 0,
        media_type: 'episode',
        media_id: episode.id,
      });
    }
  };

  const playMedia = async (item: MediaItem, forceVlc = false, forceWeb = false) => {
    const raw = item as any;
    const isEp = raw.media_type === 'episode' || 'season_number' in raw || 'series_id' in raw;
    if (isEp) {
      await playEpisode(raw as Episode, undefined, forceVlc, forceWeb);
    } else if (isMovie(item)) {
      await playMovie(item, forceVlc, forceWeb);
    }
  };

  return {
    playMovie,
    playEpisode,
    playMedia,
    isLanClient: isLanClient(),
  };
}
