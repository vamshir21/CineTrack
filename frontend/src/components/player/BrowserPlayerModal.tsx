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
  Loader2,
  Lock,
  Unlock,
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
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<any>(null);
  const progressReportTimerRef = useRef<any>(null);
  const savedTimeRef = useRef<number>(0);

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Stream URL Override (for audio track switching)
  const [streamUrlOverride, setStreamUrlOverride] = useState<string | null>(null);
  const [isSwitchingAudio, setIsSwitchingAudio] = useState(false);
  const [audioSwitchMessage, setAudioSwitchMessage] = useState('Switching audio track...');

  // Audio & Subtitles Dialog State
  const [isAudioSubtitlesOpen, setIsAudioSubtitlesOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<TrackItem[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<TrackItem[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('0');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
  const [activeModalTab, setActiveModalTab] = useState<'audio' | 'subtitles'>('audio');

  // Double tap ripple state (strictly isolated left/right zones)
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [doubleTapCount, setDoubleTapCount] = useState(10);
  const doubleTapTimerRef = useRef<any>(null);
  const lastLeftTapTimeRef = useRef<number>(0);
  const lastRightTapTimeRef = useRef<number>(0);

  // Swipe gesture HUD state (volume only)
  const [hudFeedback, setHudFeedback] = useState<{ type: 'volume'; value: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; val: number; isSwipe: boolean } | null>(null);

  // Scrub bar hover & drag state (with Netflix-style preview box)
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState<{ x: number; percent: number; time: number } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; percent: number; time: number } | null>(null);

  // Next episode tracking
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountdownCancelled, setIsCountdownCancelled] = useState(false);

  // Reset states when media changes
  useEffect(() => {
    if (activeMedia) {
      setStreamUrlOverride(null);
      setSelectedAudioId('0');
      setSelectedSubtitleId('off');
      savedTimeRef.current = activeMedia.startPosition || 0;
    }
  }, [activeMedia?.id, activeMedia?.mediaType]);

  // Fetch real audio & subtitle tracks from ffprobe via backend
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

  // Apply subtitle selection to textTracks whenever subtitle selection changes
  const applySubtitleTrack = useCallback((trackId: string) => {
    if (!videoRef.current || !videoRef.current.textTracks) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (trackId === 'off') {
        tracks[i].mode = 'disabled';
      } else {
        const matches = i === Number(trackId);
        tracks[i].mode = matches ? 'showing' : 'disabled';
      }
    }
  }, []);

  useEffect(() => {
    applySubtitleTrack(selectedSubtitleId);
  }, [selectedSubtitleId, applySubtitleTrack]);

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
    if (isLocked || isAudioSubtitlesOpen || isScrubbing) return;
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 4000);
    }
  }, [isPlaying, isLocked, isAudioSubtitlesOpen, isScrubbing]);

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

  // Precise Play / Pause toggle
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

  // Touch Swipe for Volume on the Right Side of Screen
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLocked || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const width = window.innerWidth;
    if (touch.clientX > width * 0.7) {
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        val: volume,
        isSwipe: false,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isLocked || !touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaY = touchStartRef.current.y - touch.clientY;

    if (Math.abs(deltaY) > 15) {
      touchStartRef.current.isSwipe = true;
      const height = window.innerHeight;
      const change = deltaY / (height * 0.4);
      const nextVol = Math.max(0, Math.min(1, touchStartRef.current.val + change));

      setVolume(nextVol);
      if (videoRef.current) {
        videoRef.current.volume = nextVol;
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      setHudFeedback({ type: 'volume', value: Math.round(nextVol * 100) });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setTimeout(() => setHudFeedback(null), 1200);
  };

  // Cycle aspect ratio
  const cycleAspectRatio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const modes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
    const next = modes[(modes.indexOf(aspectRatioMode) + 1) % modes.length];
    setAspectRatioMode(next);
    showToast(`Aspect Ratio: ${next.toUpperCase()}`);
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

  // Real Audio Track Switcher with Backend Remux & Fast Playback
  const handleSelectAudio = async (track: TrackItem) => {
    if (track.id === selectedAudioId) {
      setIsAudioSubtitlesOpen(false);
      return;
    }
    if (!activeMedia || !videoRef.current) return;

    setSelectedAudioId(track.id);
    localStorage.setItem('cinetrack_preferred_audio', track.id);

    const pos = videoRef.current.currentTime || 0;
    savedTimeRef.current = pos;
    setIsSwitchingAudio(true);
    setAudioSwitchMessage(`Switching audio to ${track.label}...`);

    try {
      if (track.id !== '0') {
        await streamApi.prepareAudio(activeMedia.mediaType, activeMedia.id, Number(track.id));
      }
      const newUrl =
        activeMedia.mediaType === 'movie'
          ? streamApi.getMovieStreamUrl(activeMedia.id, Number(track.id))
          : streamApi.getEpisodeStreamUrl(activeMedia.id, Number(track.id));

      setStreamUrlOverride(newUrl);
      showToast(`Audio Track: ${track.label}`);
    } catch (e) {
      showToast('Error switching audio track');
    } finally {
      setIsSwitchingAudio(false);
      setIsAudioSubtitlesOpen(false);
    }
  };

  // Real Subtitle Track Selector with WebVTT
  const handleSelectSubtitle = (track: TrackItem) => {
    setSelectedSubtitleId(track.id);
    localStorage.setItem('cinetrack_preferred_sub', track.id);
    applySubtitleTrack(track.id);
    showToast(track.id === 'off' ? 'Subtitles Off' : `Subtitles: ${track.label}`);
    setIsAudioSubtitlesOpen(false);
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

    const restoreTime = savedTimeRef.current > 0 ? savedTimeRef.current : activeMedia.startPosition;
    if (restoreTime > 0 && restoreTime < dur - 5) {
      videoRef.current.currentTime = restoreTime;
      setCurrentTime(restoreTime);
      savedTimeRef.current = 0;
    }

    applySubtitleTrack(selectedSubtitleId);

    videoRef.current.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    if (videoRef.current.buffered.length > 0) {
      for (let i = 0; i < videoRef.current.buffered.length; i++) {
        if (
          videoRef.current.buffered.start(i) <= cur &&
          cur <= videoRef.current.buffered.end(i)
        ) {
          setBufferedEnd(videoRef.current.buffered.end(i));
          break;
        }
      }
    }
  };

  // Auto next episode countdown
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
    showToast(`Speed: ${nextSpeed}x`);
  };

  // ── SCRUB BAR INTERACTION (Smooth Click & Drag + Netflix Preview Box) ────
  const calcScrubPosition = useCallback(
    (clientX: number): { x: number; percent: number; time: number } | null => {
      if (!scrubBarRef.current || duration <= 0) return null;
      const rect = scrubBarRef.current.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const percent = (clampedX / rect.width) * 100;
      const time = (clampedX / rect.width) * duration;
      return { x: clampedX, percent, time };
    },
    [duration]
  );

  // Mouse drag listeners on window for continuous drag
  useEffect(() => {
    if (!isScrubbing) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      const pos = calcScrubPosition(e.clientX);
      if (pos) {
        setScrubPosition(pos);
      }
    };

    const onGlobalMouseUp = (e: MouseEvent) => {
      const pos = calcScrubPosition(e.clientX);
      if (pos && videoRef.current) {
        videoRef.current.currentTime = pos.time;
        setCurrentTime(pos.time);
      }
      setIsScrubbing(false);
      setScrubPosition(null);
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isScrubbing, calcScrubPosition]);

  // Touch handlers for mobile scrub dragging
  const handleTouchStartScrub = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    const pos = calcScrubPosition(e.touches[0].clientX);
    if (!pos) return;
    setIsScrubbing(true);
    setScrubPosition(pos);
  };

  const handleTouchMoveScrub = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    const pos = calcScrubPosition(e.touches[0].clientX);
    if (pos) {
      setScrubPosition(pos);
    }
  };

  const handleTouchEndScrub = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (scrubPosition && videoRef.current) {
      videoRef.current.currentTime = scrubPosition.time;
      setCurrentTime(scrubPosition.time);
    }
    setIsScrubbing(false);
    setScrubPosition(null);
  };

  if (!isOpen || !activeMedia) return null;

  const currentStreamUrl = streamUrlOverride || activeMedia.streamUrl;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  // Active scrubbing preview
  const activePreview = scrubPosition || hoverPosition;
  const displayedPercent = isScrubbing && scrubPosition ? scrubPosition.percent : progressPercent;
  const displayedTime = isScrubbing && scrubPosition ? scrubPosition.time : currentTime;

  // Clamped preview box coordinates to prevent overflow off screen
  const scrubBarWidth = scrubBarRef.current?.getBoundingClientRect().width || 600;
  const clampedPreviewX = activePreview
    ? Math.max(75, Math.min(scrubBarWidth - 75, activePreview.x))
    : 0;

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
      {/* Video Element with WebVTT Subtitle Tracks */}
      <video
        ref={videoRef}
        key={currentStreamUrl}
        src={currentStreamUrl}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
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
      >
        {/* Dynamic WebVTT Subtitle Tracks */}
        {subtitleTracks
          .filter((track) => track.id !== 'off')
          .map((track) => (
            <track
              key={track.id}
              kind="subtitles"
              src={streamApi.getSubtitleUrl(activeMedia.mediaType, activeMedia.id, track.id)}
              srcLang={track.language || 'en'}
              label={track.label}
              default={track.id === selectedSubtitleId}
            />
          ))}
      </video>

      {/* ── INTERACTION OVERLAY LAYERS ────────────────────────────────────── */}
      {/* 1. Left 25% Zone: Double-Tap Rewind (-10s) */}
      <div
        onClick={handleLeftDoubleTap}
        className="absolute left-0 top-16 bottom-24 w-1/4 z-20 cursor-pointer pointer-events-auto"
        title="Double-tap to rewind 10s"
      />

      {/* 2. Right 25% Zone: Double-Tap Forward (+10s) */}
      <div
        onClick={handleRightDoubleTap}
        className="absolute right-0 top-16 bottom-24 w-1/4 z-20 cursor-pointer pointer-events-auto"
        title="Double-tap to forward 10s"
      />

      {/* 3. Center 50% Zone: Click to Toggle Play/Pause or Controls */}
      <div
        onClick={handleCenterClick}
        className="absolute left-1/4 right-1/4 top-16 bottom-24 z-10 cursor-pointer pointer-events-auto"
      />

      {/* Audio Track Switching Overlay */}
      <AnimatePresence>
        {isSwitchingAudio && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto"
          >
            <Loader2 className="w-12 h-12 text-netflix animate-spin mb-3" />
            <span className="text-white text-sm font-bold tracking-wide">{audioSwitchMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Big Play / Pause Animated Ripple Indicator on tap */}
      <AnimatePresence>
        {centerIconState && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="p-5 sm:p-6 rounded-full bg-black/80 border border-white/20 text-white shadow-2xl pointer-events-none"
            >
              {centerIconState === 'play' ? (
                <Play className="w-12 h-12 sm:w-14 sm:h-14 fill-white translate-x-0.5" />
              ) : (
                <Pause className="w-12 h-12 sm:w-14 sm:h-14 fill-white" />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Double Tap Visual Indicator */}
      <AnimatePresence>
        {doubleTapSide && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.2 }}
            className={`absolute top-0 bottom-0 ${
              doubleTapSide === 'left' ? 'left-0 rounded-r-full pr-12 pl-6' : 'right-0 rounded-l-full pl-12 pr-6'
            } w-1/3 flex flex-col items-center justify-center bg-white/10 backdrop-blur-xs pointer-events-none z-30`}
          >
            <div className="p-4 rounded-full bg-black/75 border border-white/20 text-white flex flex-col items-center shadow-2xl">
              {doubleTapSide === 'left' ? (
                <RotateCcw className="w-8 h-8 sm:w-10 sm:h-10 mb-1 animate-pulse text-white" />
              ) : (
                <RotateCw className="w-8 h-8 sm:w-10 sm:h-10 mb-1 animate-pulse text-white" />
              )}
              <span className="text-xs sm:text-sm font-black tracking-wider">
                {doubleTapSide === 'left' ? `-${doubleTapCount}s` : `+${doubleTapCount}s`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe HUD Feedback (Volume only) */}
      <AnimatePresence>
        {hudFeedback && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="bg-black/85 border border-white/20 rounded-2xl px-6 py-4 flex flex-col items-center gap-2 pointer-events-none shadow-2xl backdrop-blur-md"
            >
              <Volume2 className="w-8 h-8 text-white" />
              <div className="w-32 h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full transition-all"
                  style={{ width: `${hudFeedback.value}%` }}
                />
              </div>
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                Volume: {hudFeedback.value}%
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 bg-black/85 border border-neutral-700 px-5 py-2 rounded-full text-xs font-bold text-white shadow-xl pointer-events-none backdrop-blur-md flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering Spinner */}
      {isBuffering && !isSwitchingAudio && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-xs z-30">
          <Loader2 className="w-12 h-12 text-netflix animate-spin" />
          <span className="text-white text-[11px] font-semibold tracking-wider uppercase bg-black/60 px-3 py-1 rounded">
            Buffering...
          </span>
        </div>
      )}

      {/* Screen Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/40">
          <button
            onClick={() => setIsLocked(false)}
            className="flex items-center gap-2 bg-black/85 hover:bg-black text-white border border-white/30 px-6 py-3 rounded-full text-sm font-bold shadow-2xl backdrop-blur-md transition-all active:scale-95"
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
            className="absolute top-0 left-0 right-0 p-3 sm:p-5 md:p-6 pt-[max(0.75rem,env(safe-area-inset-top))] px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] bg-gradient-to-b from-black/95 via-black/50 to-transparent flex items-center justify-between z-30 pointer-events-auto"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
              <button
                onClick={handleClose}
                className="p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-neutral-800 text-white transition-all transform active:scale-95 flex-shrink-0"
                title="Back to CineTrack"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base md:text-lg font-black text-white tracking-tight drop-shadow-md truncate">
                  {activeMedia.title}
                </h1>
                {activeMedia.subtitle && (
                  <p className="text-[10px] sm:text-xs text-neutral-300 font-medium truncate">
                    {activeMedia.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAudioSubtitlesOpen(true);
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-black/60 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-200 transition-colors shadow-sm active:scale-95"
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
                className="p-1.5 sm:p-2 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                title="Lock Screen Touch Controls"
              >
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={cycleAspectRatio}
                className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-black/60 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-neutral-200 transition-colors"
                title="Cycle Aspect Ratio"
              >
                <Scan className="w-3.5 h-3.5 text-netflix" />
                <span className="capitalize">{aspectRatioMode}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DEAD-CENTER CONTROLS (Mathematically Centered via Flexbox) ──────── */}
      <AnimatePresence>
        {controlsVisible && !isLocked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-6 sm:gap-10 pointer-events-auto"
            >
              {/* -10s circular button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeekDelta(-10);
                }}
                className="p-3.5 sm:p-4 rounded-full bg-black/75 hover:bg-neutral-800 text-white border border-white/20 active:scale-90 transition-all flex flex-col items-center justify-center shadow-2xl backdrop-blur-sm"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="text-[9px] font-black tracking-tighter mt-0.5">10</span>
              </button>

              {/* Big center Play/Pause button */}
              <button
                onClick={togglePlay}
                className="p-5 sm:p-7 rounded-full bg-netflix/95 hover:bg-netflix text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center border border-white/20"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 sm:w-11 sm:h-11 fill-white" />
                ) : (
                  <Play className="w-8 h-8 sm:w-11 sm:h-11 fill-white translate-x-0.5" />
                )}
              </button>

              {/* +10s circular button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeekDelta(10);
                }}
                className="p-3.5 sm:p-4 rounded-full bg-black/75 hover:bg-neutral-800 text-white border border-white/20 active:scale-90 transition-all flex flex-col items-center justify-center shadow-2xl backdrop-blur-sm"
                title="Forward 10 seconds"
              >
                <RotateCw className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="text-[9px] font-black tracking-tighter mt-0.5">10</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RESPONSIVE AUDIO & SUBTITLES MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {isAudioSubtitlesOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full max-w-xl bg-[#181818] border-t sm:border border-neutral-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl text-white text-left max-h-[85vh] flex flex-col"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsAudioSubtitlesOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <MessageSquare className="w-5 h-5 text-netflix" />
                <h3 className="text-lg sm:text-xl font-black">Audio & Subtitles</h3>
              </div>

              {/* Mobile Tab Switcher */}
              <div className="flex sm:hidden border-b border-neutral-800 mb-4">
                <button
                  onClick={() => setActiveModalTab('audio')}
                  className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors ${
                    activeModalTab === 'audio'
                      ? 'border-netflix text-white'
                      : 'border-transparent text-neutral-400'
                  }`}
                >
                  Audio Language ({audioTracks.length})
                </button>
                <button
                  onClick={() => setActiveModalTab('subtitles')}
                  className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors ${
                    activeModalTab === 'subtitles'
                      ? 'border-netflix text-white'
                      : 'border-transparent text-neutral-400'
                  }`}
                >
                  Subtitles ({subtitleTracks.length})
                </button>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 sm:divide-x sm:divide-neutral-800 overflow-y-auto flex-1 pr-1">
                {/* Audio Column */}
                <div className={`space-y-2 ${activeModalTab !== 'audio' ? 'hidden sm:block' : ''}`}>
                  <h4 className="hidden sm:block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Audio Language
                  </h4>
                  <div className="space-y-1.5">
                    {audioTracks.length > 0 ? (
                      audioTracks.map((track) => {
                        const isChosen = selectedAudioId === track.id;
                        return (
                          <button
                            key={track.id}
                            onClick={() => handleSelectAudio(track)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition text-left ${
                              isChosen
                                ? 'bg-white/15 text-white font-bold ring-1 ring-white/20'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                            }`}
                          >
                            <span className="truncate pr-2">{track.label}</span>
                            {isChosen && <Check className="w-4 h-4 text-netflix flex-shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-neutral-500 py-3">Default stereo audio</p>
                    )}
                  </div>
                </div>

                {/* Subtitles Column */}
                <div className={`space-y-2 sm:pl-6 ${activeModalTab !== 'subtitles' ? 'hidden sm:block' : ''}`}>
                  <h4 className="hidden sm:block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Subtitles
                  </h4>
                  <div className="space-y-1.5">
                    {subtitleTracks.map((track) => {
                      const isChosen = selectedSubtitleId === track.id;
                      return (
                        <button
                          key={track.id}
                          onClick={() => handleSelectSubtitle(track)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition text-left ${
                            isChosen
                              ? 'bg-white/15 text-white font-bold ring-1 ring-white/20'
                              : 'text-neutral-400 hover:text-white hover:bg-white/5 font-medium'
                          }`}
                        >
                          <span className="truncate pr-2">{track.label}</span>
                          {isChosen && <Check className="w-4 h-4 text-netflix flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-5 pt-3 border-t border-neutral-800 flex justify-end">
                <button
                  onClick={() => setIsAudioSubtitlesOpen(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-netflix hover:bg-netflix-hover text-white font-bold rounded-xl text-xs shadow transition active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Next Episode Floating Card */}
      <AnimatePresence>
        {countdown !== null && nextEpisode && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="absolute bottom-24 right-3 sm:right-6 z-40 bg-neutral-900/95 border border-neutral-700/80 rounded-xl p-4 shadow-2xl backdrop-blur-md max-w-sm w-full text-white pointer-events-auto"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">
              Up Next in {countdown}s
            </div>
            <h4 className="font-bold text-sm line-clamp-1 mb-1">
              S{nextEpisode.season_number} E{nextEpisode.episode_number}: {nextEpisode.title || 'Next Episode'}
            </h4>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  syncProgress(true);
                  openEpisode(nextEpisode);
                  setCountdown(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
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
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM CONTROLS BAR (Full Width Netflix Draggable Scrub Bar) ───── */}
      <AnimatePresence>
        {controlsVisible && !isLocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 md:p-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 z-30 pointer-events-auto"
          >
            {/* FULL-WIDTH DRAGGABLE SCRUB BAR WITH NETFLIX PREVIEW BOX */}
            <div
              ref={scrubBarRef}
              className="relative w-full h-9 sm:h-9 flex items-center cursor-pointer group py-2.5 touch-none"
              onMouseMove={(e) => {
                if (!isScrubbing) {
                  const pos = calcScrubPosition(e.clientX);
                  setHoverPosition(pos);
                }
              }}
              onMouseLeave={() => {
                if (!isScrubbing) setHoverPosition(null);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const pos = calcScrubPosition(e.clientX);
                if (pos) {
                  setIsScrubbing(true);
                  setScrubPosition(pos);
                }
              }}
              onTouchStart={handleTouchStartScrub}
              onTouchMove={handleTouchMoveScrub}
              onTouchEnd={handleTouchEndScrub}
            >
              {/* NETFLIX-STYLE FLOATING PREVIEW BOX */}
              {activePreview && (
                <div
                  className="absolute bottom-8 pointer-events-none z-50 flex flex-col items-center transition-all duration-75"
                  style={{
                    left: `${clampedPreviewX}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="w-32 sm:w-40 bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center">
                    {/* Backdrop Thumbnail if available */}
                    {activeMedia.backdropUrl ? (
                      <div className="w-full h-18 sm:h-22 bg-neutral-950 relative overflow-hidden">
                        <img
                          src={activeMedia.backdropUrl}
                          alt="preview"
                          className="w-full h-full object-cover opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      </div>
                    ) : null}
                    <div className="w-full py-1.5 px-2 bg-black/95 text-center">
                      <span className="font-mono text-xs sm:text-sm font-black text-white tracking-wider">
                        {formatTime(activePreview.time)}
                      </span>
                    </div>
                  </div>
                  {/* Downward triangle caret pointing to scrub line */}
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black -mt-0.5" />
                </div>
              )}

              {/* Background Track */}
              <div className="absolute inset-x-0 h-1.5 group-hover:h-2.5 transition-all bg-neutral-700/80 rounded-full overflow-hidden">
                {/* Buffered Track */}
                <div
                  className="h-full bg-neutral-500/60 rounded-full"
                  style={{ width: `${bufferedPercent}%` }}
                />
              </div>

              {/* Played Red Track */}
              <div
                className="absolute left-0 h-1.5 group-hover:h-2.5 transition-all bg-red-600 rounded-full"
                style={{ width: `${displayedPercent}%` }}
              />

              {/* Scrubber Thumb */}
              <div
                className={`absolute w-4 h-4 rounded-full bg-red-600 shadow-xl border-2 border-white -translate-x-1/2 pointer-events-none transition-transform ${
                  isScrubbing
                    ? 'scale-125'
                    : 'scale-100 sm:scale-0 sm:group-hover:scale-100'
                }`}
                style={{ left: `${displayedPercent}%` }}
              />
            </div>

            {/* CONTROLS ROW */}
            <div className="flex items-center justify-between text-white pt-0.5">
              {/* Left Controls: Play/Pause, Rewind, Forward, Volume, Time */}
              <div className="flex items-center gap-1.5 sm:gap-3">
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
                  className="hidden sm:inline-flex p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Rewind 10s (Left Arrow)"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeekDelta(10);
                  }}
                  className="hidden sm:inline-flex p-1.5 sm:p-2 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Forward 10s (Right Arrow)"
                >
                  <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Volume Slider (Desktop) */}
                <div className="hidden md:flex items-center gap-2 group/volume ml-1">
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
                      <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <span className="font-mono">{formatTime(displayedTime)}</span>
                  <span className="text-neutral-500 mx-1">/</span>
                  <span className="font-mono">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls: Audio/Subtitles, Aspect, Speed, PiP, Fullscreen */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAudioSubtitlesOpen(true);
                  }}
                  className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                  title="Audio & Subtitles (S)"
                >
                  <MessageSquare className="w-4 h-4 text-netflix" />
                  <span className="hidden sm:inline text-xs font-bold">Audio & Subtitles</span>
                </button>

                <button
                  onClick={cycleAspectRatio}
                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition flex items-center gap-1"
                  title="Aspect Ratio"
                >
                  <Scan className="w-3.5 h-3.5 text-netflix" />
                  <span className="hidden sm:inline capitalize">{aspectRatioMode}</span>
                </button>

                <button
                  onClick={handleSpeedCycle}
                  className="px-2 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-xs font-bold text-neutral-200 transition-colors"
                  title="Playback Speed"
                >
                  {playbackSpeed}x
                </button>

                <button
                  onClick={togglePiP}
                  className="hidden sm:inline-block p-1.5 hover:bg-neutral-800 rounded-full text-neutral-300 hover:text-white transition-colors"
                  title="Picture in Picture"
                >
                  <PictureInPicture2 className="w-4 h-4" />
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
