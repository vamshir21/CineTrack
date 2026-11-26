import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  SkipForward,
  Loader2,
  Tv,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useBrowserPlayerStore } from '../../store/browserPlayerStore';
import { streamApi } from '../../api/stream';
import { libraryApi } from '../../api/library';
import { formatTime } from '../../utils/timeUtils';
import type { Episode } from '../../types';

export const BrowserPlayerModal: React.FC = () => {
  const { isOpen, activeMedia, closePlayer, openEpisode } = useBrowserPlayerStore();
  const queryClient = useQueryClient();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimerRef = useRef<any>(null);
  const progressReportTimerRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Next episode tracking for series
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountdownCancelled, setIsCountdownCancelled] = useState(false);

  // Fetch next episode if active media is an episode
  useEffect(() => {
    if (!isOpen || !activeMedia || activeMedia.mediaType !== 'episode') {
      setNextEpisode(null);
      return;
    }
    let isSubscribed = true;
    libraryApi
      .getNextEpisode(activeMedia.id)
      .then((res) => {
        if (isSubscribed && res?.has_next && res.next_episode) {
          setNextEpisode(res.next_episode);
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, activeMedia?.id, activeMedia?.mediaType]);

  // Report progress to backend
  const syncProgress = useCallback(
    async (completed = false) => {
      if (!activeMedia || !videoRef.current) return;
      const pos = videoRef.current.currentTime || 0;
      const dur = videoRef.current.duration || duration || 0;
      if (dur <= 0) return;

      const isDone = completed || pos / dur >= 0.92;
      try {
        await streamApi.reportProgress({
          media_type: activeMedia.mediaType,
          media_id: activeMedia.id,
          position_seconds: pos,
          duration_seconds: dur,
          completed: isDone,
        });
      } catch (err) {
        // Silently catch network errors during streaming progress updates
      }
    },
    [activeMedia, duration]
  );

  // Periodic progress reporting (every 8 seconds)
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    progressReportTimerRef.current = setInterval(() => {
      syncProgress();
    }, 8000);

    return () => {
      if (progressReportTimerRef.current) {
        clearInterval(progressReportTimerRef.current);
      }
    };
  }, [isOpen, isPlaying, syncProgress]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isPlaying, resetControlsTimeout]);

  // Handle Close & Invalidate Cache
  const handleClose = useCallback(() => {
    syncProgress();
    closePlayer();
    queryClient.invalidateQueries({ queryKey: ['home'] });
    queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    queryClient.invalidateQueries({ queryKey: ['library'] });
    queryClient.invalidateQueries({ queryKey: ['watchlist'] });
  }, [syncProgress, closePlayer, queryClient]);

  // Handle Fullscreen Toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      syncProgress();
    }
  }, [syncProgress]);

  // Seek +/- 10s
  const handleSeekDelta = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  }, []);

  // Keyboard Shortcuts inside Player
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      resetControlsTimeout();
      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleSeekDelta(-10);
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleSeekDelta(10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const next = Math.min(1, videoRef.current.volume + 0.1);
          videoRef.current.volume = next;
          setVolume(next);
          setIsMuted(false);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const next = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = next;
          setVolume(next);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, togglePlay, handleSeekDelta, toggleFullscreen, handleClose, resetControlsTimeout]);

  // Video Event Handlers
  const handleLoadedMetadata = () => {
    if (!videoRef.current || !activeMedia) return;
    const dur = videoRef.current.duration;
    setDuration(dur);

    // Resume from startPosition if available
    if (activeMedia.startPosition > 0 && activeMedia.startPosition < dur - 10) {
      videoRef.current.currentTime = activeMedia.startPosition;
      setCurrentTime(activeMedia.startPosition);
    }
    videoRef.current.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Update buffered
    if (videoRef.current.buffered.length > 0) {
      setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }

    // Trigger next episode countdown when remaining < 15 seconds
    const dur = videoRef.current.duration;
    if (nextEpisode && dur > 30 && dur - cur <= 15 && !isCountdownCancelled && countdown === null) {
      setCountdown(10);
    }
  };

  // Next Episode Countdown Timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextEpisode) {
        syncProgress(true);
        openEpisode(nextEpisode);
        setCountdown(null);
        setIsCountdownCancelled(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, nextEpisode, openEpisode, syncProgress]);

  // Cycle speed: 1x -> 1.25x -> 1.5x -> 0.75x
  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  if (!isOpen || !activeMedia) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
      className="fixed inset-0 z-[200] bg-black select-none overflow-hidden flex items-center justify-center font-sans"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={activeMedia.streamUrl}
        preload="auto"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          syncProgress(true);
          if (nextEpisode && !isCountdownCancelled) {
            setCountdown(5);
          }
        }}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-xs">
          <Loader2 className="w-14 h-14 text-netflix animate-spin" />
          <span className="text-white text-xs font-semibold tracking-wider uppercase bg-black/60 px-3 py-1 rounded">
            Streaming...
          </span>
        </div>
      )}

      {/* Top Header Bar */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-30 pointer-events-auto"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className="p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-white transition-all transform active:scale-95"
                title="Back to CineTrack"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-lg md:text-xl font-black text-white tracking-tight drop-shadow-md">
                  {activeMedia.title}
                </h1>
                {activeMedia.subtitle && (
                  <p className="text-xs md:text-sm text-neutral-300 font-medium">
                    {activeMedia.subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider">
                <Tv className="w-3.5 h-3.5" />
                LAN Direct Play
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Episode Floating Card (Netflix-style) */}
      <AnimatePresence>
        {countdown !== null && nextEpisode && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="absolute bottom-24 right-8 z-40 bg-neutral-900/95 border border-neutral-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md max-w-sm w-full text-white pointer-events-auto"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
              Up Next in {countdown}s
            </div>
            <h4 className="font-bold text-base line-clamp-1 mb-1">
              S{nextEpisode.season_number} E{nextEpisode.episode_number}: {nextEpisode.title || 'Next Episode'}
            </h4>
            {nextEpisode.overview && (
              <p className="text-xs text-neutral-400 line-clamp-2 mb-4">{nextEpisode.overview}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  syncProgress(true);
                  openEpisode(nextEpisode);
                  setCountdown(null);
                }}
                className="flex-1 py-2 rounded bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Play Now
              </button>
              <button
                onClick={() => {
                  setCountdown(null);
                  setIsCountdownCancelled(true);
                }}
                className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls Bar */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-3 z-30 pointer-events-auto"
          >
            {/* Scrub Bar */}
            <div
              className="relative w-full h-3 flex items-center cursor-pointer group"
              onClick={(e) => {
                if (!videoRef.current || duration <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const newPos = (clickX / rect.width) * duration;
                videoRef.current.currentTime = newPos;
                setCurrentTime(newPos);
              }}
            >
              {/* Background track */}
              <div className="absolute inset-0 h-1.5 my-auto bg-neutral-700/80 rounded-full group-hover:h-2.5 transition-all">
                {/* Buffered track */}
                <div
                  className="h-full bg-neutral-500/60 rounded-full"
                  style={{ width: `${bufferedPercent}%` }}
                />
              </div>

              {/* Played track */}
              <div
                className="absolute left-0 h-1.5 my-auto bg-red-600 rounded-full group-hover:h-2.5 transition-all"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Scrubber thumb */}
              <div
                className="absolute w-4 h-4 rounded-full bg-red-600 shadow-md border-2 border-white scale-0 group-hover:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-white pt-1">
              {/* Left: Play/Pause, Seek, Time */}
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="p-2 hover:bg-neutral-800 rounded-full text-white transition-all transform active:scale-95"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                </button>

                <button
                  onClick={() => handleSeekDelta(-10)}
                  className="p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Rewind 10s (Left Arrow)"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleSeekDelta(10)}
                  className="p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Forward 10s (Right Arrow)"
                >
                  <RotateCw className="w-5 h-5" />
                </button>

                {nextEpisode && (
                  <button
                    onClick={() => {
                      syncProgress(true);
                      openEpisode(nextEpisode);
                    }}
                    className="p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                    title={`Next: S${nextEpisode.season_number} E${nextEpisode.episode_number}`}
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                )}

                {/* Volume & Mute */}
                <div className="flex items-center gap-2 group/volume ml-2">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                        setIsMuted(videoRef.current.muted);
                      }
                    }}
                    className="p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                    title="Mute / Unmute (M)"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (videoRef.current) {
                        videoRef.current.volume = val;
                        videoRef.current.muted = false;
                        setIsMuted(false);
                      }
                    }}
                    className="w-16 sm:w-20 accent-red-600 h-1 bg-neutral-600 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Time Display */}
                <div className="text-xs sm:text-sm font-medium text-neutral-300 select-none ml-2">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-neutral-500 mx-1.5">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right: Speed & Fullscreen */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSpeedCycle}
                  className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-xs font-bold text-neutral-200 transition-colors"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="p-2 hover:bg-neutral-800 rounded-full text-white transition-all transform active:scale-95"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
