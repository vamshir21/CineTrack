import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playbackApi } from '../api/playback';
import { usePlaybackStore } from '../store/playbackStore';
import type { Movie, Episode } from '../types';

export function usePlayback() {
  const queryClient = useQueryClient();
  const { status, setStatus, isPlayerOpen, setPlayerOpen } = usePlaybackStore();
  const wsRef = useRef<WebSocket | null>(null);

  const { data: playbackStatus } = useQuery({
    queryKey: ['playback', 'status'],
    queryFn: playbackApi.getStatus,
    refetchInterval: isPlayerOpen ? 2000 : false,
    enabled: isPlayerOpen,
  });

  useEffect(() => {
    if (playbackStatus) setStatus(playbackStatus);
  }, [playbackStatus, setStatus]);

  useEffect(() => {
    if (!isPlayerOpen) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || '127.0.0.1:8088';
      const ws = new WebSocket(`${protocol}//${host}/ws/playback`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStatus(data);
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        // WebSocket failed, rely on polling
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch {
      // WebSocket not available
    }
  }, [isPlayerOpen, setStatus]);

  const playMovie = useMutation({
    mutationFn: (movie: Movie) =>
      playbackApi.play({
        file_path: movie.file_path,
        position: movie.progress?.position ?? 0,
        media_type: 'movie',
        media_id: movie.id,
      }),
    onSuccess: () => {
      setPlayerOpen(true);
      queryClient.invalidateQueries({ queryKey: ['playback'] });
    },
  });

  const playEpisode = useMutation({
    mutationFn: (episode: Episode) =>
      playbackApi.play({
        file_path: episode.file_path ?? '',
        position: episode.progress?.position ?? 0,
        media_type: 'episode',
        media_id: episode.id,
      }),
    onSuccess: () => {
      setPlayerOpen(true);
      queryClient.invalidateQueries({ queryKey: ['playback'] });
    },
  });

  const pause = useMutation({ mutationFn: playbackApi.pause });
  const resume = useMutation({ mutationFn: playbackApi.resume });
  const stop = useMutation({
    mutationFn: playbackApi.stop,
    onSuccess: () => setPlayerOpen(false),
  });
  const seek = useMutation({ mutationFn: (pos: number) => playbackApi.seek(pos) });
  const setVolume = useMutation({ mutationFn: (level: number) => playbackApi.setVolume(level) });

  const togglePause = useCallback(() => {
    if (status?.paused) resume.mutate();
    else pause.mutate();
  }, [status, pause, resume]);

  return {
    status,
    isPlayerOpen,
    playMovie: playMovie.mutate,
    playEpisode: playEpisode.mutate,
    pause: pause.mutate,
    resume: resume.mutate,
    stop: stop.mutate,
    seek: seek.mutate,
    setVolume: setVolume.mutate,
    togglePause,
  };
}
