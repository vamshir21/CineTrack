export interface Movie {
  id: number;
  title: string;
  file_path: string;
  tmdb_id?: number;
  overview?: string;
  release_date?: string;
  runtime?: number;
  poster_path?: string;
  backdrop_path?: string;
  genres?: string[];
  vote_average?: number;
  file_size?: number;
  added_at: string;
  progress?: { position: number; duration: number; completed: boolean };
}

export interface TVSeries {
  id: number;
  title: string;
  tmdb_id?: number;
  overview?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  genres?: string[];
  vote_average?: number;
  number_of_seasons?: number;
  episode_count?: number;
  next_episode?: Episode;
  progress?: { position: number; duration: number; completed: boolean };
  added_at: string;
}

export interface Season {
  id: number;
  series_id: number;
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string;
  episode_count: number;
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  series_id: number;
  season_number: number;
  episode_number: number;
  title: string;
  file_path?: string;
  overview?: string;
  still_path?: string;
  runtime?: number;
  file_size?: number;
  progress?: { position: number; duration: number; completed: boolean };
}

export interface LibraryStats {
  total_movies: number;
  total_series: number;
  total_seasons: number;
  total_episodes: number;
  total_size_bytes: number;
  total_size_formatted: string;
  total_watch_seconds: number;
  total_watch_formatted: string;
  completed_titles: number;
}

export interface WatchHistory {
  id: number;
  media_type: 'movie' | 'episode';
  media_id: number;
  position_seconds: number;
  duration_seconds: number;
  watched_at: string;
  completed: boolean;
}

export interface WatchlistItem {
  id: number;
  media_type: 'movie' | 'series';
  media_id: number;
  added_at: string;
  details?: Movie | TVSeries;
}

export interface HomeData {
  featured: (Movie | TVSeries)[];
  rails: {
    continue_watching: (Movie | TVSeries)[];
    recently_added: (Movie | TVSeries)[];
    popular_movies: Movie[];
    all_series: TVSeries[];
    watchlist: (Movie | TVSeries)[];
  };
}

export interface PlaybackStatus {
  playing: boolean;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
  rate: number;
  media_path?: string;
  media_type?: string;
  media_id?: number;
  completed?: boolean;
  completed_episode_id?: number;
}

export interface ScanStatus {
  running: boolean;
  progress: number;
  total: number;
  current_file: string;
  errors: string[];
}

export interface MediaFolder {
  id: number;
  path: string;
  name: string;
  created_at: string;
}

export interface Settings {
  [key: string]: string;
}

export interface SearchResult {
  movies: Movie[];
  series: TVSeries[];
  episodes: Episode[];
}

export type MediaItem = Movie | TVSeries;

export function isMovie(item: MediaItem): item is Movie {
  return 'file_path' in item && !('episode_count' in item);
}

export function isTVSeries(item: MediaItem): item is TVSeries {
  return 'episode_count' in item || 'number_of_seasons' in item;
}
