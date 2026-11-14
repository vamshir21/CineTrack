import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, X } from 'lucide-react';
import { playbackApi } from '../../api/playback';
import { libraryApi } from '../../api/library';
import { settingsApi } from '../../api/settings';
import { usePlaybackStore } from '../../store/playbackStore';
import { formatTime } from '../../utils/timeUtils';
import { getImageUrl } from '../../utils/imageUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const PlayerOverlay: React.FC = () => {
  const { status, setStatus } = usePlaybackStore();
  const queryClient = useQueryClient();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [dismissedForEpisode, setDismissedForEpisode] = useState<number | null>(null);
  const lastActiveEpisodeIdRef = useRef<number | null>(null);

  // Poll playback status every 1.5 seconds to track VLC
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const state = await playbackApi.getStatus();
        if (active) {
          setStatus(state);
        }
      } catch {
        // VLC closing or backend unreachable
      }
    }, 1500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [setStatus]);

  // Load settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  const isEpisode = status?.media_type === 'episode';
  const currentEpisodeId = isEpisode && status?.media_id ? status.media_id : null;
  const completedEpisodeId = status?.completed_episode_id || null;

  // Track episode ID (either currently playing or just completed)
  const targetEpisodeId = currentEpisodeId || completedEpisodeId || lastActiveEpisodeIdRef.current;

  useEffect(() => {
    if (currentEpisodeId) {
      lastActiveEpisodeIdRef.current = currentEpisodeId;
    }
  }, [currentEpisodeId]);

  // Query next episode for the target episode
  const { data: nextEpisodeData } = useQuery({
    queryKey: ['next-episode', targetEpisodeId],
    queryFn: () => libraryApi.getNextEpisode(targetEpisodeId!),
    enabled: !!targetEpisodeId,
  });

  const nextEpisode = nextEpisodeData?.has_next ? nextEpisodeData.next_episode : null;

  const autoNextEnabled = settings?.auto_next_episode !== 'false';
  const initialCountdown = Math.max(5, Number(settings?.next_episode_countdown || 15));

  const position = status?.position || 0;
  const duration = status?.duration || 0;
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;
  const remaining = duration > 0 && position > 0 ? duration - position : 9999;

  // STRICT, PREDICTABLE TRIGGER:
  // Must NOT trigger randomly!
  // 1. autoNext is enabled AND a valid next episode exists.
  // 2. User has NOT dismissed the timer for this episode.
  // 3. EITHER:
  //    A) Episode is in genuine final credits:
  //       - Video duration is known and >= 60 seconds (not a loading stub)
  //       - Played at least 30 seconds
  //       - Remaining time is 40 seconds or less
  //       - Watched at least 90% of the entire episode
  //    B) Episode just completed (status.completed === true)
  const isDismissed = dismissedForEpisode !== null && dismissedForEpisode === targetEpisodeId;

  const isAtEndCredits =
    !!status?.playing &&
    duration >= 60 &&
    position >= 30 &&
    remaining > 0 &&
    remaining <= 40 &&
    progressPct >= 90;

  const isJustCompleted = !!status?.completed && !!status?.completed_episode_id;

  const shouldShowTimer =
    autoNextEnabled &&
    !!nextEpisode &&
    !isDismissed &&
    (isAtEndCredits || isJustCompleted);

  // If user seeks backwards away from end-credits while playing, cancel and reset timer
  useEffect(() => {
    if (status?.playing && (remaining > 45 || progressPct < 88)) {
      if (countdown !== null) {
        setCountdown(null);
      }
    }
  }, [remaining, progressPct, status?.playing, countdown]);

  // Start countdown when shouldShowTimer becomes true
  useEffect(() => {
    if (shouldShowTimer && countdown === null) {
      setCountdown(initialCountdown);
    } else if (!shouldShowTimer && !isJustCompleted) {
      setCountdown(null);
    }
  }, [shouldShowTimer, isJustCompleted, countdown, initialCountdown]);

  // Countdown tick
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handlePlayNextEpisode();
    }
  }, [countdown]);

  const handlePlayNextEpisode = async () => {
    if (!nextEpisode?.file_path) return;
    setCountdown(null);
    try {
      await playbackApi.play({
        file_path: nextEpisode.file_path,
        position: 0,
        media_type: 'episode',
        media_id: nextEpisode.id,
      });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    } catch (e) {
      console.error('Failed to start next episode:', e);
    }
  };

  const handleDismissTimer = () => {
    if (targetEpisodeId) {
      setDismissedForEpisode(targetEpisodeId);
    }
    setCountdown(null);
  };

  const handleStopPlayback = async () => {
    try {
      await playbackApi.stop();
    } catch {}
    setCountdown(null);
    queryClient.invalidateQueries({ queryKey: ['home'] });
    queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
  };

  // If nothing is playing and no completion timer is active, hide overlay
  if ((!status || !status.playing) && !shouldShowTimer) {
    return null;
  }

  // Circular timer math
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const currentCountdown = countdown ?? initialCountdown;
  const progressFraction = Math.max(0, Math.min(1, currentCountdown / initialCountdown));
  const strokeDashoffset = circumference * (1 - progressFraction);

  return (
    <AnimatePresence>
      {shouldShowTimer && countdown !== null && nextEpisode ? (
        /* 1. Netflix Next Episode Circular Timer Card */
        <motion.div
          key="next-episode-timer-card"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 right-6 z-50 bg-[#181818]/95 backdrop-blur-xl border border-neutral-700/90 rounded-2xl shadow-2xl p-5 max-w-md w-full select-none"
        >
          <div className="flex items-start justify-between gap-3">
            {/* Circular Countdown Ring */}
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="#2c2c2c"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="#E50914"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                <span className="text-lg font-black text-white font-mono leading-none">
                  {currentCountdown}
                </span>
                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                  SEC
                </span>
              </div>
            </div>

            {/* Episode Meta */}
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-netflix text-white shadow-sm">
                  UP NEXT
                </span>
                <span className="text-xs font-semibold text-neutral-300">
                  Skipping in {currentCountdown}s
                </span>
              </div>
              <p className="text-white text-sm font-bold truncate">
                {nextEpisode.series_title || 'Next Episode'}
              </p>
              <p className="text-xs text-neutral-300 truncate">
                S{nextEpisode.season_number} E{nextEpisode.episode_number}: {nextEpisode.title || `Episode ${nextEpisode.episode_number}`}
              </p>
            </div>

            {/* Next Episode Thumbnail */}
            {nextEpisode.backdrop_path && (
              <div className="w-20 h-12 rounded-lg overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/60 relative">
                <img
                  src={getImageUrl(nextEpisode.backdrop_path) || ''}
                  alt={nextEpisode.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-white text-white drop-shadow" />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-neutral-800">
            <button
              onClick={handlePlayNextEpisode}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Play Now</span>
            </button>
            <button
              onClick={handleDismissTimer}
              className="flex items-center justify-center gap-1.5 bg-[#262626] hover:bg-[#333] text-neutral-300 hover:text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all border border-neutral-700 active:scale-95"
              title="Cancel countdown and watch credits"
            >
              <X className="w-3.5 h-3.5" />
              <span>Watch Credits</span>
            </button>
          </div>
        </motion.div>
      ) : status?.playing ? (
        /* 2. Standard Native VLC Playing Status Pill */
        <motion.div
          key="vlc-status-pill"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 right-6 z-50 bg-[#181818]/95 backdrop-blur-md border border-neutral-700/80 rounded-xl shadow-2xl p-4 max-w-sm flex items-center gap-3.5 select-none"
        >
          {/* Pulsing VLC indicator */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-netflix/20 border border-netflix/40 flex items-center justify-center text-netflix">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-xs font-bold truncate">Playing in Native VLC</p>
              <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              Use VLC window for controls, shortcuts & fullscreen
            </p>
            {duration > 0 && position > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-netflix transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {formatTime(position)} / {formatTime(duration)}
                </span>
              </div>
            )}
          </div>

          {/* Quick Stop Button */}
          <button
            onClick={handleStopPlayback}
            className="flex-shrink-0 p-2 rounded-lg bg-neutral-800 hover:bg-red-600/80 text-neutral-300 hover:text-white transition-colors"
            title="Stop VLC Playback"
            aria-label="Stop VLC Playback"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
