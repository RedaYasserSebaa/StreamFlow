import axios from 'axios';
import type { Movie, Torrent } from '../types';

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

/** Extract a user-friendly error message from an API error response. */
export const getApiErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err) && err.response?.data?.error) {
    return err.response.data.error;
  }
  return 'An unexpected error occurred. Please try again later.';
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

export const deleteCurrentUser = async (baseUrl: string, token: string) => {
  const api = getBackendApi(baseUrl, token);
  const response = await api.delete('/api/auth/delete-me');
  return response.data;
};

export const changePassword = async (baseUrl: string, token: string, data: any) => {
  const api = getBackendApi(baseUrl, token);
  const response = await api.post('/api/auth/change-password', data);
  return response.data;
};

export const generateQuickConnectCode = async (baseUrl: string) => {
  const api = getBackendApi(baseUrl);
  const response = await api.post('/api/auth/quick-connect/generate');
  return response.data;
};

export const authorizeQuickConnectDevice = async (baseUrl: string, token: string, code: string) => {
  const api = getBackendApi(baseUrl, token);
  const response = await api.post('/api/auth/quick-connect/authorize', { code });
  return response.data;
};

export const pollQuickConnectStatus = async (baseUrl: string, code: string) => {
  const api = getBackendApi(baseUrl);
  const response = await api.get(`/api/auth/quick-connect/poll/${code}`);
  return response.data;
};

// Helper for image paths
export const getImagePath = (path: string, size: 'w500' | 'original' = 'w500') => 
  `https://image.tmdb.org/t/p/${size}${path}`;

// --- TMDB API functions (proxied through backend) ---

export const searchMovies = async (backendUrl: string, token: string, query: string): Promise<Movie[]> => {
  const api = getBackendApi(backendUrl, token);
  const response = await api.get('/api/tmdb/search', { params: { query } });
  return response.data.results;
};

export const fetchHomeData = async (backendUrl: string, token: string) => {
  const api = getBackendApi(backendUrl, token);
  const response = await api.get('/api/tmdb/home');
  return response.data;
};

export const discoverContent = async (
  backendUrl: string,
  token: string,
  type: 'movie' | 'tv',
  params: { genre?: number; year?: number; sort?: string; page?: number }
): Promise<{ results: Movie[]; total_pages: number }> => {
  const api = getBackendApi(backendUrl, token);
  const queryParams: Record<string, any> = {
    sort_by: params.sort || 'popularity.desc',
    page: params.page || 1,
  };
  if (params.genre) queryParams.with_genres = params.genre;
  if (params.year) {
    if (type === 'movie') queryParams.primary_release_year = params.year;
    else queryParams.first_air_date_year = params.year;
  }
  const response = await api.get(`/api/tmdb/discover/${type}`, { params: queryParams });
  return response.data;
};

export const getGenres = async (backendUrl: string, token: string, type: 'movie' | 'tv'): Promise<{ id: number; name: string }[]> => {
  const api = getBackendApi(backendUrl, token);
  const response = await api.get(`/api/tmdb/genres/${type}`);
  return response.data.genres;
};

export const fetchMovieDetails = async (backendUrl: string, token: string, id: number, type: 'movie' | 'tv'): Promise<any> => {
  const api = getBackendApi(backendUrl, token);
  const response = await api.get(`/api/tmdb/details/${type}/${id}`);
  return response.data;
};

export const fetchTVSeason = async (backendUrl: string, token: string, tvId: number, seasonNumber: number): Promise<any> => {
  const api = getBackendApi(backendUrl, token);
  const response = await api.get(`/api/tmdb/tv/${tvId}/season/${seasonNumber}`);
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

export const searchStreams = async (
  backendUrl: string, 
  token: string,
  title: string, 
  type: 'movie' | 'tv', 
  seasonEpi?: string,
  year?: string
): Promise<Torrent[]> => {
  const api = getBackendApi(backendUrl, token);
  const response = await api.post('/api/search', { title, type, seasonEpi, year });
  return response.data.results;
};
