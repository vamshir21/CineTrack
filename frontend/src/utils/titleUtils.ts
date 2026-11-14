export function cleanTitle(title: string): string {
  // Remove year patterns like (2021) or [2021]
  return title
    .replace(/\s*[\[(]\d{4}[\])]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMediaType(item: { file_path?: string; episode_count?: number }): 'movie' | 'series' {
  if ('episode_count' in item && item.episode_count !== undefined) return 'series';
  if ('file_path' in item && item.file_path) return 'movie';
  return 'series';
}
