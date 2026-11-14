import client from './client';
import type { Movie, TVSeries, HomeData } from '../types';

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

  getSeasonEpisodes: async (seriesId: number, seasonNum: number) => {
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

  getHome: async (): Promise<HomeData> => {
    const { data } = await client.get('/api/library/home');
    return data;
  },

  deleteMovie: async (id: number) => {
    await client.delete(`/api/library/movies/${id}`);
  },

  deleteSeries: async (id: number) => {
    await client.delete(`/api/library/series/${id}`);
  },
};
