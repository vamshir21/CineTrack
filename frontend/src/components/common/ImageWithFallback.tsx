import { useState, useEffect } from 'react';
import { getImageUrl } from '../../utils/imageUtils';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackTitle,
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);
  const imageUrl = getImageUrl(src);

  useEffect(() => {
    setError(false);
  }, [src]);

  const gradients = [
    'from-purple-900 to-blue-900',
    'from-red-900 to-orange-900',
    'from-green-900 to-teal-900',
    'from-indigo-900 to-purple-900',
    'from-gray-800 to-gray-900',
  ];

  const gradient = fallbackTitle
    ? gradients[fallbackTitle.charCodeAt(0) % gradients.length]
    : gradients[0];

  if (!imageUrl || error) {
    return (
      <div
        className={`bg-gradient-to-br ${gradient} flex items-center justify-center p-3 relative overflow-hidden ${className}`}
        aria-label={alt}
      >
        {fallbackTitle ? (
          <span className="text-white text-xs font-bold line-clamp-2 leading-tight drop-shadow text-center">
            {fallbackTitle}
          </span>
        ) : (
          <div className="text-white/20 flex flex-col items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        console.warn('Image failed to load:', imageUrl);
        setError(true);
      }}
      loading="lazy"
    />
  );
}
