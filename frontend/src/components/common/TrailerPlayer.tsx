import React, { useRef, useEffect } from 'react';

interface TrailerPlayerProps {
  videoKey: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  className?: string;
}

export const TrailerPlayer: React.FC<TrailerPlayerProps> = ({
  videoKey,
  autoPlay = true,
  muted = true,
  controls = false,
  loop = false,
  onEnded,
  className = '',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const totalDurationRef = useRef<number>(0);
  const currentPosRef = useRef<number>(0);
  const hasPlayedRef = useRef<boolean>(false);
  const playStartTimeRef = useRef<number>(0);
  const hasEndedCalledRef = useRef<boolean>(false);

  // Send "listening" command to YouTube embed so it posts player state change events
  const pingListening = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: 1 }),
          '*'
        );
      } catch {
        // Ignore cross-origin access issues
      }
    }
  };

  useEffect(() => {
    // Reset state on new video
    totalDurationRef.current = 0;
    currentPosRef.current = 0;
    hasPlayedRef.current = false;
    playStartTimeRef.current = 0;
    hasEndedCalledRef.current = false;

    if (!onEnded) return;

    // Ping periodically for the first few seconds to ensure YouTube registers the listener
    pingListening();
    const pingInterval = setInterval(pingListening, 1500);
    const stopPing = setTimeout(() => clearInterval(pingInterval), 6000);

    const handleMessage = (event: MessageEvent) => {
      // Validate origin loosely to support youtube.com and youtube-nocookie.com
      if (
        event.origin &&
        !event.origin.includes('youtube.com') &&
        !event.origin.includes('youtube-nocookie.com')
      ) {
        return;
      }

      try {
        let data = event.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (!data) return;

        // 1. Process infoDelivery events to track playback progress and duration
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.duration === 'number' && data.info.duration > 15) {
            totalDurationRef.current = data.info.duration;
          }
          if (typeof data.info.currentTime === 'number') {
            currentPosRef.current = data.info.currentTime;
          }
          if (data.info.playerState === 1) { // State 1: PLAYING
            hasPlayedRef.current = true;
            if (!playStartTimeRef.current) {
              playStartTimeRef.current = Date.now();
            }
          }
        }

        console.log('[TrailerPlayer] postMessage:', data.event, data.info);

        // Also track onStateChange = 1 (PLAYING)
        if (data.event === 'onStateChange' && data.info === 1) {
          hasPlayedRef.current = true;
          if (!playStartTimeRef.current) {
            playStartTimeRef.current = Date.now();
          }
        }

        // Video must have actually been playing before it can ever be considered completed
        if (!hasPlayedRef.current || hasEndedCalledRef.current) {
          console.log('[TrailerPlayer] Ignored: hasPlayedRef=', hasPlayedRef.current, 'hasEndedCalled=', hasEndedCalledRef.current);
          return;
        }

        const dur = totalDurationRef.current;
        const cur = currentPosRef.current;
        const elapsed = playStartTimeRef.current ? (Date.now() - playStartTimeRef.current) / 1000 : 0;

        // Condition A: Playhead reached within 1.5s of the full known duration
        const reachedDurationEnd = dur >= 20 && cur >= dur - 1.5;

        // Condition B: YouTube signaled ENDED state (onStateChange === 0 or info.playerState === 0)
        // MUST satisfy minimum playback time (cur >= 20s or elapsed >= 25s) so intro ad-pods do NOT trigger early completion!
        const isEndedState =
          (data.event === 'onStateChange' && data.info === 0) ||
          (data.info && data.info.playerState === 0);

        const isLegitimateVideoEnd =
          isEndedState && (cur >= 20 || elapsed >= 25 || (dur >= 20 && cur >= dur - 2.5));

        console.log('[TrailerPlayer] Check end:', { dur, cur, elapsed, reachedDurationEnd, isEndedState, isLegitimateVideoEnd });

        if (reachedDurationEnd || isLegitimateVideoEnd) {
          console.log('[TrailerPlayer] >>> CALLING ONENDED <<<');
          hasEndedCalledRef.current = true;
          onEnded();
        }
      } catch {
        // Ignore non-JSON postMessages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearInterval(pingInterval);
      clearTimeout(stopPing);
      window.removeEventListener('message', handleMessage);
    };
  }, [videoKey, onEnded]);

  if (!videoKey) return null;

  // Construct YouTube embed query
  const queryParams = new URLSearchParams({
    autoplay: autoPlay ? '1' : '0',
    mute: muted ? '1' : '0',
    controls: controls ? '1' : '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    enablejsapi: '1',
    origin: window.location.origin,
  });

  if (loop && !onEnded) {
    queryParams.set('loop', '1');
    queryParams.set('playlist', videoKey);
  }

  return (
    <div className={`relative w-full h-full overflow-hidden pointer-events-none ${className}`}>
      <iframe
        ref={iframeRef}
        onLoad={pingListening}
        src={`https://www.youtube-nocookie.com/embed/${videoKey}?${queryParams.toString()}`}
        title="Official Trailer"
        className="w-full h-full object-cover scale-[1.35] origin-center border-0 pointer-events-none"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        loading="lazy"
      />
    </div>
  );
};
