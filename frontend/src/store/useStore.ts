import { create } from 'zustand';
import type { UserConfig, Movie } from '../types';

interface AppState {
  config: UserConfig | null;
  setConfig: (config: UserConfig) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentView: 'home' | 'discover' | 'lists' | 'settings';
  setCurrentView: (view: 'home' | 'discover' | 'lists' | 'settings') => void;
  userLists: Record<string, Movie[]>;
  setUserLists: (lists: Record<string, Movie[]>) => void;
  addToList: (listName: string, movie: Movie) => void;
  removeFromList: (listName: string, movieId: number) => void;
  createList: (listName: string) => void;
  deleteList: (listName: string) => void;
  selectedMovie: Movie | null;
  setSelectedMovie: (movie: Movie | null) => void;
  continueWatching: Movie[];
  addToContinueWatching: (movie: Movie) => void;
  isConfigured: () => boolean;
  subtitleStyle: {
    fontSize: number;
    fontFamily: string;
    color: string;
    background: boolean;
  };
  updateSubtitleStyle: (style: Partial<AppState['subtitleStyle']>) => void;
}

export const useStore = create<AppState>((set, get) => ({
  config: JSON.parse(localStorage.getItem('streamFlowConfig') || 'null'),
  setConfig: (config) => {
    localStorage.setItem('streamFlowConfig', JSON.stringify(config));
    set({ config });
  },
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  currentView: 'home',
  setCurrentView: (currentView) => set({ currentView }),
  userLists: JSON.parse(localStorage.getItem('myMovieLists') || '{}'),
  setUserLists: (userLists) => {
    localStorage.setItem('myMovieLists', JSON.stringify(userLists));
    set({ userLists });
  },
  addToList: (listName, movie) => set((state) => {
    const list = state.userLists[listName] || [];
    if (list.some((m) => m.id === movie.id)) return state;
    const newLists = { ...state.userLists, [listName]: [...list, movie] };
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    return { userLists: newLists };
  }),
  removeFromList: (listName, movieId) => set((state) => {
    const list = state.userLists[listName] || [];
    const newLists = { ...state.userLists, [listName]: list.filter((m) => m.id !== movieId) };
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    return { userLists: newLists };
  }),
  createList: (listName) => set((state) => {
    if (state.userLists[listName]) return state;
    const newLists = { ...state.userLists, [listName]: [] };
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    return { userLists: newLists };
  }),
  deleteList: (listName) => set((state) => {
    const newLists = { ...state.userLists };
    delete newLists[listName];
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    return { userLists: newLists };
  }),
  selectedMovie: null,
  setSelectedMovie: (selectedMovie) => set({ selectedMovie }),
  continueWatching: JSON.parse(localStorage.getItem('continueWatching') || '[]'),
  addToContinueWatching: (movie) => set((state) => {
    // Media objects to simplify storage
    const movieData = {
      id: movie.id,
      title: movie.title || movie.name,
      name: movie.name,
      poster_path: movie.poster_path,
      release_date: movie.release_date || movie.first_air_date,
      vote_average: movie.vote_average,
      overview: movie.overview,
      media_type: movie.media_type
    };
    
    const filtered = state.continueWatching.filter(m => m.id !== movie.id);
    const newList = [movieData as Movie, ...filtered].slice(0, 15);
    localStorage.setItem('continueWatching', JSON.stringify(newList));
    return { continueWatching: newList };
  }),
  isConfigured: () => {
    const config = get().config;
    return !!(config && config.tmdb_api_key && config.jackett_api_key);
  },
  subtitleStyle: JSON.parse(localStorage.getItem('subtitleStyle') || JSON.stringify({
    fontSize: 24,
    fontFamily: 'Inter, sans-serif',
    color: '#ffffff',
    background: true
  })),
  updateSubtitleStyle: (style) => set((state) => {
    const newStyle = { ...state.subtitleStyle, ...style };
    localStorage.setItem('subtitleStyle', JSON.stringify(newStyle));
    return { subtitleStyle: newStyle };
  }),
}));
