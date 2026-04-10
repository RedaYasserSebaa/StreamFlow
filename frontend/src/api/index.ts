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

export const getBackendApi = (baseUrl: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const instance = axios.create({
    baseURL: baseUrl,
    headers
  });
  return instance;
};

// Auth API
export const loginUser = async (baseUrl: string, credentials: any) => {
  const api = getBackendApi(baseUrl);
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
};

export const registerUser = async (baseUrl: string, credentials: any) => {
  const api = getBackendApi(baseUrl);
  const response = await api.post('/api/auth/register', credentials);
  return response.data;
};

// User Data Sync
export const syncUserData = async (baseUrl: string, token: string, data: any) => {
  const api = getBackendApi(baseUrl, token);
  const response = await api.post('/api/user/data', data);
  return response.data;
};

export const fetchUserData = async (baseUrl: string, token: string) => {
  const api = getBackendApi(baseUrl, token);
  const response = await api.get('/api/user/data');
  return response.data;
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

export const discoverContent = async (
  apiKey: string,
  type: 'movie' | 'tv',
  params: { genre?: number; year?: number; sort?: string; page?: number }
): Promise<{ results: Movie[]; total_pages: number }> => {
  const api = getTmdbApi(apiKey);
  const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
  const queryParams: Record<string, any> = {
    sort_by: params.sort || 'popularity.desc',
    page: params.page || 1,
  };
  if (params.genre) queryParams.with_genres = params.genre;
  if (params.year) {
    if (type === 'movie') queryParams.primary_release_year = params.year;
    else queryParams.first_air_date_year = params.year;
  }
  const response = await api.get(endpoint, { params: queryParams });
  return {
    results: response.data.results.map((m: any) => ({ ...m, media_type: type })),
    total_pages: response.data.total_pages,
  };
};

export const getGenres = async (apiKey: string, type: 'movie' | 'tv'): Promise<{ id: number; name: string }[]> => {
  const api = getTmdbApi(apiKey);
  const endpoint = type === 'movie' ? '/genre/movie/list' : '/genre/tv/list';
  const response = await api.get(endpoint);
  return response.data.genres;
};

export const fetchMovieDetails = async (apiKey: string, id: number, type: 'movie' | 'tv'): Promise<any> => {
  const api = getTmdbApi(apiKey);
  const response = await api.get(`/${type}/${id}`);
  return response.data;
};

export const fetchTVSeason = async (apiKey: string, tvId: number, seasonNumber: number): Promise<any> => {
  const api = getTmdbApi(apiKey);
  const response = await api.get(`/tv/${tvId}/season/${seasonNumber}`);
  return response.data;
};

export const fetchStreamStats = async (backendUrl: string, magnet: string) => {
  const response = await axios.get(`${backendUrl}/api/stream/stats?magnet=${encodeURIComponent(magnet)}`);
  return response.data;
};

export const srt2vtt = (srt: string) => {
  let vtt = "WEBVTT\n\n";
  vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
};

export const searchStreams = async (backendUrl: string, title: string, type: 'movie' | 'tv', seasonEpi?: string): Promise<Torrent[]> => {
  const api = getBackendApi(backendUrl);
  const response = await api.post('/api/search', { title, type, seasonEpi });
  return response.data.results;
};
