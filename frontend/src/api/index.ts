import axios from 'axios';
import type { Movie, Torrent } from '../types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export const getTmdbApi = (apiKey: string) => {
  const instance = axios.create({
    baseURL: TMDB_BASE,
    params: { api_key: apiKey },
  });
  return instance;
};

export const getBackendApi = (baseUrl: string) => {
  const instance = axios.create({
    baseURL: baseUrl,
  });
  return instance;
};

// Helper for image paths
export const getImagePath = (path: string, size: 'w500' | 'original' = 'w500') => 
  `https://image.tmdb.org/t/p/${size}${path}`;

export const searchMovies = async (apiKey: string, query: string): Promise<Movie[]> => {
  const api = getTmdbApi(apiKey);
  const response = await api.get('/search/multi', { params: { query } });
  return response.data.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
};

export const fetchHomeData = async (apiKey: string) => {
  const api = getTmdbApi(apiKey);
  const [popMovies, popTv, trending] = await Promise.all([
    api.get('/movie/popular'),
    api.get('/tv/popular'),
    api.get('/trending/all/week'),
  ]);

  return {
    popularMovies: popMovies.data.results.map((m: any) => ({ ...m, media_type: 'movie' })),
    popularTv: popTv.data.results.map((m: any) => ({ ...m, media_type: 'tv' })),
    trending: trending.data.results,
  };
};

export const searchStreams = async (backendUrl: string, title: string, type: 'movie' | 'tv', seasonEpi?: string): Promise<Torrent[]> => {
  const api = getBackendApi(backendUrl);
  const response = await api.post('/api/search', { title, type, seasonEpi });
  return response.data.results;
};
