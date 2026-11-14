interface ProgressBarProps {
  position: number;
  duration: number;
  className?: string;
  height?: number;
}

export function ProgressBar({ position, duration, className = '', height = 3 }: ProgressBarProps) {
  if (!duration) return null;
  const pct = Math.min(100, (position / duration) * 100);

  return (
    <div
      className={`w-full bg-white/30 rounded-full overflow-hidden ${className}`}
      style={{ height: `${height}px` }}
    >
      <div
        className="h-full bg-netflix rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
