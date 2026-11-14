export function getImageUrl(
  path: string | undefined | null,
  size: 'w300' | 'w500' | 'w1280' | 'original' = 'w500'
): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  // 1. Full URLs (http:// or https://)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 2. Relative API paths (e.g. "/api/images/movie_123_poster_w500.jpg")
  if (trimmed.startsWith('/api/images/')) {
    return trimmed;
  }
  if (trimmed.startsWith('api/images/')) {
    return `/${trimmed}`;
  }

  // 3. Local cached filename (e.g. "movie_123_poster_w500.jpg" or "series_...jpg")
  if (
    trimmed.startsWith('movie_') ||
    trimmed.startsWith('series_') ||
    trimmed.startsWith('season_') ||
    trimmed.startsWith('episode_')
  ) {
    const filename = trimmed.replace(/^\/+/, '');
    return `/api/images/${filename}`;
  }

  // 4. Raw TMDB path (e.g. "/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg" or "8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg")
  const cleanTmdb = trimmed.replace(/^\/+/, '');
  return `https://image.tmdb.org/t/p/${size}/${cleanTmdb}`;
}

export function getPosterUrl(path: string | undefined | null): string | null {
  return getImageUrl(path, 'w500');
}

export function getBackdropUrl(path: string | undefined | null): string | null {
  return getImageUrl(path, 'w1280');
}
