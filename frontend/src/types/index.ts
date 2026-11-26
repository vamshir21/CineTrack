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
  languages?: string[];
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
  languages?: string[];
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
  languages?: string[];
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

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string;
  profile_url?: string;
  order?: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path?: string;
  profile_url?: string;
}

export interface CreditsData {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface TrailerVideo {
  key: string;
  name: string;
  type: string;
  site: string;
  official: boolean;
}

export interface TrailerData {
  trailer: TrailerVideo | null;
  videos: TrailerVideo[];
}

export interface MovieCollection {
  collection_id: number;
  collection_name: string;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  local_movies_count: number;
  movies: Movie[];
}

export interface CollectionPart {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_url?: string;
  backdrop_url?: string;
  vote_average?: number;
  in_library: boolean;
  local_movie?: Movie;
}

export interface CollectionDetail {
  id: number;
  name: string;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  parts: CollectionPart[];
  owned_count: number;
  total_count: number;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_url?: string;
}

export interface WatchProvidersGroup {
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  link?: string;
}

export interface UpcomingMovie {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  days_until?: number;
  vote_average?: number;
  poster_url?: string;
  backdrop_url?: string;
  genre_ids?: number[];
  genres?: string[];
  popularity?: number;
  original_language?: string;
  language_name?: string;
  providers?: WatchProvider[] | WatchProvidersGroup;
}

export interface MultiSourceRatings {
  tmdb_id: number;
  imdb_id?: string;
  tmdb_rating?: number;
  imdb_rating?: number;
  imdb_votes?: string;
  rt_critic?: number;
  rt_audience?: number;
  metascore?: number;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  place_of_birth?: string;
  known_for_department?: string;
  profile_url?: string;
}

export interface PersonCredit {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  release_date?: string;
  vote_average?: number;
  role?: string;
  poster_url?: string;
  backdrop_url?: string;
  popularity?: number;
  in_library: boolean;
  local_item?: Movie | TVSeries;
  providers?: WatchProvidersGroup | WatchProvider[];
}

export interface PersonFilmographyResponse {
  person: PersonDetails;
  in_library: PersonCredit[];
  other_works: PersonCredit[];
  total_credits: number;
}

export interface VibeDefinition {
  key: string;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  badge_color: string;
  count: number;
  preview_titles: string[];
}

export interface VibeItemsResponse {
  vibe: VibeDefinition;
  items: (Movie | TVSeries)[];
  count: number;
}

export interface VibeSurpriseResponse {
  item: Movie | TVSeries;
  vibe: {
    key: string;
    name: string;
    emoji: string;
    tagline: string;
    badge_color: string;
  };
}

export interface Profile {
  id: number;
  name: string;
  avatar: string;
  is_admin: boolean;
  created_at: string;
}

export interface LanInfo {
  lan_ip: string;
  port: number;
  lan_url: string;
  hostname: string;
}

export type MediaItem = Movie | TVSeries;

export function isMovie(item: MediaItem): item is Movie {
  return 'file_path' in item && !('episode_count' in item);
}

export function isTVSeries(item: MediaItem): item is TVSeries {
  return 'episode_count' in item || 'number_of_seasons' in item;
}
