import { useRef, useCallback } from 'react';

interface UseHoverCardOptions {
  enterDelay?: number;
  leaveDelay?: number;
}

export function useHoverCard(
  onShow: () => void,
  onHide: () => void,
  options: UseHoverCardOptions = {}
) {
  const { enterDelay = 500, leaveDelay = 300 } = options;
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    enterTimer.current = setTimeout(onShow, enterDelay);
  }, [onShow, enterDelay]);

  const handleMouseLeave = useCallback(() => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    leaveTimer.current = setTimeout(onHide, leaveDelay);
  }, [onHide, leaveDelay]);

  const cancelHide = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  return { handleMouseEnter, handleMouseLeave, cancelHide };
}
