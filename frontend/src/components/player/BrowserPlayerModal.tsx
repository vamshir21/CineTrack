import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  ArrowLeft,
  SkipForward,
  Loader2,
  Tv,
  Lock,
  Unlock,
  Sun,
  PictureInPicture2,
  Scan,
  MessageSquare,
  Check,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useBrowserPlayerStore } from '../../store/browserPlayerStore';
import { streamApi, type TrackItem } from '../../api/stream';
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

  // Playback state
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

  // Big center play/pause ripple indicator
  const [centerIconState, setCenterIconState] = useState<'play' | 'pause' | null>(null);

  // Rich Player Features
  const [isLocked, setIsLocked] = useState(false);
  const [aspectRatioMode, setAspectRatioMode] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [brightness, setBrightness] = useState(1); // 0.5 to 1.5
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio & Subtitles Dialog State
  const [isAudioSubtitlesOpen, setIsAudioSubtitlesOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<TrackItem[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<TrackItem[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('0');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');

  // Double tap ripple state (strictly isolated)
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [doubleTapCount, setDoubleTapCount] = useState(10);
  const doubleTapTimerRef = useRef<any>(null);
  const lastLeftTapTimeRef = useRef<number>(0);
  const lastRightTapTimeRef = useRef<number>(0);

  // Swipe gesture HUD state
  const [hudFeedback, setHudFeedback] = useState<{ type: 'volume' | 'brightness'; value: number } | null>(null);
  const hudTimerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number; val: number; side: 'left' | 'right'; isSwipe: boolean } | null>(null);

  // Scrub bar hover tooltip
  const [hoverPosition, setHoverPosition] = useState<{ x: number; time: number } | null>(null);

  // Next episode tracking
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountdownCancelled, setIsCountdownCancelled] = useState(false);

  // Fetch audio & subtitle tracks when media opens
  useEffect(() => {
    if (!isOpen || !activeMedia) return;

    streamApi
      .getTracks(activeMedia.mediaType, activeMedia.id)
      .then((res) => {
        if (res) {
          setAudioTracks(res.audio_tracks || []);
          setSubtitleTracks(res.subtitle_tracks || []);

          // Load preferences from localStorage if exists
          const savedAudio = localStorage.getItem('cinetrack_preferred_audio');
          if (savedAudio && res.audio_tracks?.some((t) => t.id === savedAudio)) {
            setSelectedAudioId(savedAudio);
          } else if (res.audio_tracks && res.audio_tracks.length > 0) {
            setSelectedAudioId(res.audio_tracks[0].id);
          }

          const savedSub = localStorage.getItem('cinetrack_preferred_sub');
          if (savedSub && res.subtitle_tracks?.some((t) => t.id === savedSub)) {
            setSelectedSubtitleId(savedSub);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, activeMedia?.id, activeMedia?.mediaType]);

  // Auto Fullscreen & Landscape Orientation on Mobile
  useEffect(() => {
    if (!isOpen) return;

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 800;

    if (isMobile && containerRef.current) {
      try {
        if (!document.fullscreenElement) {
          if (containerRef.current.requestFullscreen) {
            containerRef.current.requestFullscreen().catch(() => {});
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            (containerRef.current as any).webkitRequestFullscreen();
          }
        }
      } catch (e) {}

      try {
        const orientation = screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
        if (orientation && orientation.lock) {
          orientation.lock('landscape').catch(() => {});
        }
      } catch (e) {}
    }

    return () => {
      try {
        const orientation = screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
        if (orientation && orientation.unlock) {
          orientation.unlock();
        }
      } catch (e) {}
    };
  }, [isOpen]);

  // Fetch next episode
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

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Report progress
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
      } catch (err) {}
    },
    [activeMedia, duration]
  );

  // Periodic progress sync
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
    if (isLocked || isAudioSubtitlesOpen) return;
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [isPlaying, isLocked, isAudioSubtitlesOpen]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isPlaying, resetControlsTimeout]);

  // Close player
  const handleClose = useCallback(() => {
    syncProgress();
    closePlayer();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['home'] });
    queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    queryClient.invalidateQueries({ queryKey: ['library'] });
    queryClient.invalidateQueries({ queryKey: ['watchlist'] });
  }, [syncProgress, closePlayer, queryClient]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Precise Play / Pause toggle without ANY seek side-effects
  const togglePlay = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      if (e) e.stopPropagation();
      if (isLocked) return;
      if (!videoRef.current) return;

      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setCenterIconState('play');
      } else {
        videoRef.current.pause();
        syncProgress();
        setCenterIconState('pause');
      }

      setTimeout(() => setCenterIconState(null), 500);
      resetControlsTimeout();
    },
    [isLocked, syncProgress, resetControlsTimeout]
  );

  // Seek +/- 10s
  const handleSeekDelta = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    const target = Math.max(0, Math.min(dur, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  }, []);

  // Dedicated Left Zone Double-Tap (-10s)
  const handleLeftDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const now = Date.now();
    if (now - lastLeftTapTimeRef.current < 280) {
      // Rapid double tap confirmed
      handleSeekDelta(-10);
      setDoubleTapSide('left');
      setDoubleTapCount((prev) => (doubleTapSide === 'left' ? prev + 10 : 10));

      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
      doubleTapTimerRef.current = setTimeout(() => {
        setDoubleTapSide(null);
        setDoubleTapCount(10);
      }, 700);
      lastLeftTapTimeRef.current = 0;
    } else {
      lastLeftTapTimeRef.current = now;
      // Single tap toggles controls
      setTimeout(() => {
        if (lastLeftTapTimeRef.current !== 0) {
          setControlsVisible((prev) => !prev);
          lastLeftTapTimeRef.current = 0;
        }
      }, 280);
    }
  };

  // Dedicated Right Zone Double-Tap (+10s)
  const handleRightDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const now = Date.now();
    if (now - lastRightTapTimeRef.current < 280) {
      // Rapid double tap confirmed
      handleSeekDelta(10);
      setDoubleTapSide('right');
      setDoubleTapCount((prev) => (doubleTapSide === 'right' ? prev + 10 : 10));

      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
      doubleTapTimerRef.current = setTimeout(() => {
        setDoubleTapSide(null);
        setDoubleTapCount(10);
      }, 700);
      lastRightTapTimeRef.current = 0;
    } else {
      lastRightTapTimeRef.current = now;
      // Single tap toggles controls
      setTimeout(() => {
        if (lastRightTapTimeRef.current !== 0) {
          setControlsVisible((prev) => !prev);
          lastRightTapTimeRef.current = 0;
        }
      }, 280);
    }
  };

  // Center screen click ONLY toggles controls or play/pause
  const handleCenterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    if (controlsVisible) {
      togglePlay();
    } else {
      setControlsVisible(true);
      resetControlsTimeout();
    }
  };

  // Touch Swipe on Mobile for Volume & Brightness
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLocked || e.touches.length !== 1 || !containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const xRatio = (touch.clientX - rect.left) / rect.width;
    const side = xRatio < 0.5 ? 'left' : 'right';
    const initVal = side === 'left' ? brightness : volume;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      val: initVal,
      side,
      isSwipe: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1 || !containerRef.current) return;
    const touch = e.touches[0];
    const deltaY = touchStartRef.current.y - touch.clientY;

    if (Math.abs(deltaY) > 20) {
      touchStartRef.current.isSwipe = true;
    }

    if (!touchStartRef.current.isSwipe) return;

    const rect = containerRef.current.getBoundingClientRect();
    const change = (deltaY / (rect.height * 0.7)) * 1;

    if (touchStartRef.current.side === 'right') {
      // Volume
      const nextVol = Math.max(0, Math.min(1, touchStartRef.current.val + change));
      setVolume(nextVol);
      if (videoRef.current) {
        videoRef.current.volume = nextVol;
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      setHudFeedback({ type: 'volume', value: Math.round(nextVol * 100) });
    } else {
      // Brightness (0.5 to 1.5)
      const nextBright = Math.max(0.5, Math.min(1.5, touchStartRef.current.val + change * 0.8));
      setBrightness(nextBright);
      setHudFeedback({ type: 'brightness', value: Math.round(((nextBright - 0.5) / 1.0) * 100) });
    }

    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudFeedback(null);
    }, 1200);
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  // Aspect Ratio cycle
  const cycleAspectRatio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (aspectRatioMode === 'contain') {
      setAspectRatioMode('cover');
      showToast('Fill Screen (Cropped Black Bars)');
    } else if (aspectRatioMode === 'cover') {
      setAspectRatioMode('fill');
      showToast('16:9 Stretch');
    } else {
      setAspectRatioMode('contain');
      showToast('Original (Fit Screen)');
    }
  };

  // Picture in Picture
  const togglePiP = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {}
  };

  // Select Audio Track
  const handleSelectAudio = (track: TrackItem) => {
    setSelectedAudioId(track.id);
    localStorage.setItem('cinetrack_preferred_audio', track.id);

    // If native audioTracks supported
    if (videoRef.current && (videoRef.current as any).audioTracks) {
      const tracks = (videoRef.current as any).audioTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].enabled = i === Number(track.id);
      }
    }
    showToast(`Audio Track: ${track.label}`);
  };

  // Select Subtitle Track
  const handleSelectSubtitle = (track: TrackItem) => {
    setSelectedSubtitleId(track.id);
    localStorage.setItem('cinetrack_preferred_sub', track.id);

    // If native textTracks supported
    if (videoRef.current && videoRef.current.textTracks) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        if (track.id === 'off') {
          tracks[i].mode = 'disabled';
        } else {
          tracks[i].mode = tracks[i].language === track.language ? 'showing' : 'disabled';
        }
      }
    }
    showToast(track.id === 'off' ? 'Subtitles Off' : `Subtitles: ${track.label}`);
  };

  // Keyboard navigation
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
          setHudFeedback({ type: 'volume', value: Math.round(next * 100) });
          setTimeout(() => setHudFeedback(null), 1000);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const next = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = next;
          setVolume(next);
          setHudFeedback({ type: 'volume', value: Math.round(next * 100) });
          setTimeout(() => setHudFeedback(null), 1000);
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
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setIsAudioSubtitlesOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isAudioSubtitlesOpen) {
          setIsAudioSubtitlesOpen(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAudioSubtitlesOpen, togglePlay, handleSeekDelta, toggleFullscreen, handleClose, resetControlsTimeout]);

  // Video Events
  const handleLoadedMetadata = () => {
    if (!videoRef.current || !activeMedia) return;
    const dur = videoRef.current.duration;
    setDuration(dur);

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

    if (videoRef.current.buffered.length > 0) {
      setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }

    const dur = videoRef.current.duration;
    if (nextEpisode && dur > 30 && dur - cur <= 15 && !isCountdownCancelled && countdown === null) {
      setCountdown(10);
    }
  };

  // Next Episode Countdown
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

  // Speed Cycle
  const handleSpeedCycle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
    showToast(`Playback Speed: ${nextSpeed}x`);
  };

  if (!isOpen || !activeMedia) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const objectFitClass =
    aspectRatioMode === 'cover'
      ? 'object-cover'
      : aspectRatioMode === 'fill'
      ? 'object-fill'
      : 'object-contain';

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[200] bg-black select-none overflow-hidden flex items-center justify-center font-sans"
    >
      {/* Video Element with CSS Brightness Filter */}
      <video
        ref={videoRef}
        src={activeMedia.streamUrl}
        preload="auto"
        playsInline
        style={{ filter: `brightness(${brightness})` }}
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
        className={`w-full h-full ${objectFitClass} transition-all duration-150`}
      />

      {/* ── INTERACTION OVERLAY LAYERS ────────────────────────────────────── */}
      {/* 1. Left 22% Zone: Double-Tap Rewind (-10s) */}
      <div
        onClick={handleLeftDoubleTap}
        className="absolute left-0 top-16 bottom-20 w-[22%] z-20 cursor-pointer pointer-events-auto"
        title="Double-tap to rewind 10s"
      />

      {/* 2. Right 22% Zone: Double-Tap Forward (+10s) */}
      <div
        onClick={handleRightDoubleTap}
        className="absolute right-0 top-16 bottom-20 w-[22%] z-20 cursor-pointer pointer-events-auto"
        title="Double-tap to forward 10s"
      />

      {/* 3. Center 56% Zone: Click to Toggle Play/Pause or Controls */}
      <div
        onClick={handleCenterClick}
        className="absolute left-[22%] right-[22%] top-16 bottom-20 z-10 cursor-pointer pointer-events-auto"
      />

      {/* Center Big Play / Pause Animated Indicator */}
      <AnimatePresence>
        {centerIconState && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 p-6 rounded-full bg-black/75 border border-white/20 text-white shadow-2xl pointer-events-none"
          >
            {centerIconState === 'play' ? (
              <Play className="w-14 h-14 fill-white translate-x-0.5" />
            ) : (
              <Pause className="w-14 h-14 fill-white" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Visual Indicator & Ripple Wave */}
      <AnimatePresence>
        {doubleTapSide && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.2 }}
            className={`absolute top-0 bottom-0 ${
              doubleTapSide === 'left' ? 'left-0 rounded-r-full pr-14 pl-6' : 'right-0 rounded-l-full pl-14 pr-6'
            } w-1/3 flex flex-col items-center justify-center bg-white/10 backdrop-blur-xs pointer-events-none z-30`}
          >
            <div className="p-4 rounded-full bg-black/70 border border-white/20 text-white flex flex-col items-center shadow-2xl">
              {doubleTapSide === 'left' ? (
                <RotateCcw className="w-10 h-10 mb-1.5 animate-pulse text-white" />
              ) : (
                <RotateCw className="w-10 h-10 mb-1.5 animate-pulse text-white" />
              )}
              <span className="text-sm font-black tracking-wider">
                {doubleTapSide === 'left' ? `-${doubleTapCount}s` : `+${doubleTapCount}s`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Swipe HUD Feedback (Volume & Brightness) */}
      <AnimatePresence>
        {hudFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-black/85 border border-white/20 rounded-2xl px-6 py-4 flex flex-col items-center gap-2 pointer-events-none shadow-2xl backdrop-blur-md"
          >
            {hudFeedback.type === 'volume' ? (
              <Volume2 className="w-8 h-8 text-white" />
            ) : (
              <Sun className="w-8 h-8 text-amber-400" />
            )}
            <div className="w-32 h-2 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  hudFeedback.type === 'volume' ? 'bg-red-600' : 'bg-amber-400'
                } rounded-full`}
                style={{ width: `${hudFeedback.value}%` }}
              />
            </div>
            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
              {hudFeedback.type}: {hudFeedback.value}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-black/85 border border-neutral-700 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-xl pointer-events-none backdrop-blur-md flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-xs z-30">
          <Loader2 className="w-14 h-14 text-netflix animate-spin" />
          <span className="text-white text-xs font-semibold tracking-wider uppercase bg-black/60 px-3 py-1 rounded">
            Buffering...
          </span>
        </div>
      )}

      {/* Screen Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/40">
          <button
            onClick={() => setIsLocked(false)}
            className="flex items-center gap-2 bg-black/80 hover:bg-black text-white border border-white/30 px-6 py-3 rounded-full text-sm font-bold shadow-2xl backdrop-blur-md transition-all active:scale-95"
          >
            <Unlock className="w-4 h-4 text-amber-400" />
            <span>Screen Locked • Tap to Unlock</span>
          </button>
        </div>
      )}

      {/* ── TOP HEADER BAR ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 p-4 sm:p-6 md:p-8 bg-gradient-to-b from-black/95 via-black/50 to-transparent flex items-center justify-between z-30 pointer-events-auto"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={handleClose}
                className="p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-white transition-all transform active:scale-95 flex-shrink-0"
                title="Back to CineTrack"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight drop-shadow-md truncate">
                  {activeMedia.title}
                </h1>
                {activeMedia.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-300 font-medium truncate">
                    {activeMedia.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Top Right: Audio & Subtitles, Screen Lock, Aspect Ratio */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAudioSubtitlesOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-200 transition-colors shadow-sm"
                title="Audio & Subtitle Tracks"
              >
                <MessageSquare className="w-3.5 h-3.5 text-netflix" />
                <span className="hidden sm:inline">Audio & Subtitles</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLocked(true);
                }}
                className="p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                title="Lock Screen Touch Controls"
              >
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={cycleAspectRatio}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-200 transition-colors"
                title="Cycle Aspect Ratio (Fit / Fill Screen)"
              >
                <Scan className="w-3.5 h-3.5 text-netflix" />
                <span className="capitalize">{aspectRatioMode}</span>
              </button>

              <span className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider">
                <Tv className="w-3.5 h-3.5" />
                cinema.local
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NETFLIX AUDIO & SUBTITLES MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {isAudioSubtitlesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#181818] border border-neutral-700 rounded-2xl p-6 sm:p-8 shadow-2xl text-white text-left"
            >
              <button
                onClick={() => setIsAudioSubtitlesOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-6">
                <MessageSquare className="w-5 h-5 text-netflix" />
                <h3 className="text-xl font-black">Audio & Subtitles</h3>
              </div>

              <div className="grid grid-cols-2 gap-6 sm:gap-8 divide-x divide-neutral-800">
                {/* Audio Column */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Audio Language
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
                    {audioTracks.length > 0 ? (
                      audioTracks.map((track) => {
                        const isChosen = selectedAudioId === track.id;
                        return (
                          <button
                            key={track.id}
                            onClick={() => handleSelectAudio(track)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition text-left ${
                              isChosen
                                ? 'bg-white/10 text-white font-bold'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                            }`}
                          >
                            <span>{track.label}</span>
                            {isChosen && <Check className="w-4 h-4 text-netflix flex-shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-neutral-500">Default stereo audio</p>
                    )}
                  </div>
                </div>

                {/* Subtitles Column */}
                <div className="space-y-3 pl-6 sm:pl-8">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Subtitles
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
                    {subtitleTracks.map((track) => {
                      const isChosen = selectedSubtitleId === track.id;
                      return (
                        <button
                          key={track.id}
                          onClick={() => handleSelectSubtitle(track)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition text-left ${
                            isChosen
                              ? 'bg-white/10 text-white font-bold'
                              : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                          }`}
                        >
                          <span>{track.label}</span>
                          {isChosen && <Check className="w-4 h-4 text-netflix flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Brightness Adjustment inside settings for TVs & Desktops */}
              <div className="mt-6 pt-5 border-t border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Brightness: {Math.round(brightness * 100)}%</span>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    value={brightness}
                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 h-1 bg-neutral-700 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => setBrightness(1)}
                    className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 bg-neutral-800 rounded font-bold"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsAudioSubtitlesOpen(false)}
                  className="px-6 py-2 bg-netflix hover:bg-netflix-hover text-white font-bold rounded-lg text-xs shadow transition"
                >
                  Apply & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Next Episode Floating Card (Netflix-style) */}
      <AnimatePresence>
        {countdown !== null && nextEpisode && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="absolute bottom-24 right-4 sm:right-8 z-40 bg-neutral-900/95 border border-neutral-700/80 rounded-xl p-5 shadow-2xl backdrop-blur-md max-w-sm w-full text-white pointer-events-auto"
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
                onClick={(e) => {
                  e.stopPropagation();
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
                onClick={(e) => {
                  e.stopPropagation();
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

      {/* ── BOTTOM CONTROLS BAR ────────────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 sm:gap-3 z-30 pointer-events-auto"
          >
            {/* Scrub Bar Container */}
            <div
              className="relative w-full h-4 flex items-center cursor-pointer group"
              onMouseMove={(e) => {
                if (duration <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const hoverX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const targetTime = (hoverX / rect.width) * duration;
                setHoverPosition({ x: hoverX, time: targetTime });
              }}
              onMouseLeave={() => setHoverPosition(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!videoRef.current || duration <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const newPos = (clickX / rect.width) * duration;
                videoRef.current.currentTime = newPos;
                setCurrentTime(newPos);
              }}
            >
              {/* Floating Hover Timestamp Tooltip */}
              {hoverPosition && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-neutral-700 text-[11px] font-bold text-white shadow pointer-events-none"
                  style={{ left: `${hoverPosition.x}px` }}
                >
                  {formatTime(hoverPosition.time)}
                </div>
              )}

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
              {/* Left Controls: Play, Rewind 10s, Forward 10s, Volume, Time */}
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={togglePlay}
                  className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-white transition-all transform active:scale-95"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeekDelta(-10);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Rewind 10s (Left Arrow)"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeekDelta(10);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Forward 10s (Right Arrow)"
                >
                  <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {nextEpisode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      syncProgress(true);
                      openEpisode(nextEpisode);
                    }}
                    className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                    title={`Next: S${nextEpisode.season_number} E${nextEpisode.episode_number}`}
                  >
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                {/* Volume & Mute */}
                <div className="hidden sm:flex items-center gap-2 group/volume ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                        setIsMuted(videoRef.current.muted);
                      }
                    }}
                    className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                    title="Mute / Unmute (M)"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      e.stopPropagation();
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
                <div className="text-xs sm:text-sm font-medium text-neutral-300 select-none ml-1 sm:ml-2">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-neutral-500 mx-1">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls: Audio/Subtitles, Aspect Ratio, Speed, PiP, Fullscreen */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAudioSubtitlesOpen(true);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Audio & Subtitle Settings (S)"
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-netflix" />
                </button>

                <button
                  onClick={cycleAspectRatio}
                  className="sm:hidden p-1.5 rounded bg-neutral-800/80 text-neutral-300 hover:text-white"
                  title="Cycle Aspect Ratio"
                >
                  <Scan className="w-4 h-4" />
                </button>

                <button
                  onClick={togglePiP}
                  className="hidden sm:inline-block p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Picture in Picture"
                >
                  <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={handleSpeedCycle}
                  className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-xs font-bold text-neutral-200 transition-colors"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                  className="p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-white transition-all transform active:scale-95"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
