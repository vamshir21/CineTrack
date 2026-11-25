import client from './client';
import type {
  Movie,
  TVSeries,
  HomeData,
  Episode,
  LibraryStats,
  MovieCollection,
  CollectionDetail,
  PersonFilmographyResponse,
  VibeDefinition,
  VibeItemsResponse,
  VibeSurpriseResponse,
} from '../types';

export const libraryApi = {
  getMovies: async (): Promise<Movie[]> => {
    const { data } = await client.get('/api/library/movies');
    return data;
  },

  getMovie: async (id: number): Promise<Movie> => {
    const { data } = await client.get(`/api/library/movies/${id}`);
    return data;
  },

  getSeries: async (): Promise<TVSeries[]> => {
    const { data } = await client.get('/api/library/series');
    return data;
  },

  getSeriesById: async (id: number): Promise<TVSeries> => {
    const { data } = await client.get(`/api/library/series/${id}`);
    return data;
  },

  getSeasonEpisodes: async (seriesId: number, seasonNum: number): Promise<Episode[]> => {
    const { data } = await client.get(
      `/api/library/series/${seriesId}/seasons/${seasonNum}/episodes`
    );
    return data;
  },

  getRecentlyAdded: async () => {
    const { data } = await client.get('/api/library/recently-added');
    return data;
  },

  getContinueWatching: async () => {
    const { data } = await client.get('/api/library/continue-watching');
    return data;
  },

  getNextEpisode: async (episodeId: number) => {
    const { data } = await client.get(`/api/library/episodes/${episodeId}/next`);
    return data;
  },

  getRandomItem: async (excludeId?: number): Promise<Movie | TVSeries> => {
    const params = excludeId ? { exclude_id: excludeId } : {};
    const { data } = await client.get('/api/library/random', { params });
    return data;
  },

  getHome: async (): Promise<HomeData> => {
    const { data } = await client.get('/api/library/home');
    return data;
  },

  deleteMovie: async (id: number, deleteFile: boolean = false) => {
    const { data } = await client.delete(`/api/library/movies/${id}`, {
      params: { delete_file: deleteFile },
    });
    return data;
  },

  deleteSeries: async (id: number, deleteFile: boolean = false) => {
    const { data } = await client.delete(`/api/library/series/${id}`, {
      params: { delete_file: deleteFile },
    });
    return data;
  },

  deleteEpisode: async (id: number, deleteFile: boolean = false) => {
    const { data } = await client.delete(`/api/library/episodes/${id}`, {
      params: { delete_file: deleteFile },
    });
    return data;
  },

  markWatched: async (mediaType: string, mediaId: number) => {
    const { data } = await client.post('/api/library/watched', {
      media_type: mediaType,
      media_id: mediaId,
    });
    return data;
  },

  markUnwatched: async (mediaType: string, mediaId: number) => {
    const { data } = await client.post('/api/library/unwatched', {
      media_type: mediaType,
      media_id: mediaId,
    });
    return data;
  },

  getStats: async (): Promise<LibraryStats> => {
    const { data } = await client.get('/api/library/stats');
    return data;
  },

  getMoreLikeThis: async (mediaType: 'movie' | 'series' | 'tv', itemId: number, limit = 6): Promise<(Movie | TVSeries)[]> => {
    const { data } = await client.get(`/api/library/more-like-this/${mediaType}/${itemId}`, {
      params: { limit },
    });
    return data;
  },

  getCollections: async (): Promise<MovieCollection[]> => {
    const { data } = await client.get('/api/library/collections');
    return data;
  },

  getCollectionDetail: async (collectionId: number): Promise<CollectionDetail> => {
    const { data } = await client.get(`/api/library/collections/${collectionId}`);
    return data;
  },

  getPersonFilmography: async (personId: number): Promise<PersonFilmographyResponse> => {
    const { data } = await client.get(`/api/library/person/${personId}/filmography`);
    return data;
  },

  getVibes: async (): Promise<VibeDefinition[]> => {
    const { data } = await client.get('/api/library/vibes');
    return data;
  },

  getVibeTitles: async (vibeKey: string): Promise<VibeItemsResponse> => {
    const { data } = await client.get(`/api/library/vibes/${vibeKey}`);
    return data;
  },

  getVibeSurprise: async (vibeKey?: string): Promise<VibeSurpriseResponse> => {
    const params = vibeKey ? { vibe: vibeKey } : {};
    const { data } = await client.get('/api/library/vibes/surprise', { params });
    return data;
  },
};


