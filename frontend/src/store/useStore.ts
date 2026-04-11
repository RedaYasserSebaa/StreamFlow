import { create } from 'zustand';
import type { UserConfig, Movie, User } from '../types';
import { syncUserData } from '../api';

interface AppState {
  user: User | null;
  config: UserConfig | null;
  setConfig: (config: UserConfig) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentView: 'home' | 'discover' | 'lists' | 'settings' | 'offline';
  setCurrentView: (view: 'home' | 'discover' | 'lists' | 'settings' | 'offline') => void;
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
  isAuthenticated: () => boolean;
  login: (user: User, data: any) => void;
  logout: () => void;
  subtitleStyle: {
    fontSize: number;
    fontFamily: string;
    color: string;
    background: boolean;
  };
  updateSubtitleStyle: (style: Partial<AppState['subtitleStyle']>) => void;
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const syncWithBackend = async (state: AppState) => {
  if (state.user?.token && state.config?.backend_url) {
    try {
      await syncUserData(state.config.backend_url, state.user.token, {
        config: state.config,
        userLists: state.userLists,
        continueWatching: state.continueWatching
      });
    } catch (err) {
      console.error('Failed to sync with backend:', err);
    }
  }
};

const DEFAULT_CONFIG: Partial<UserConfig> = {
  auto_scan_interval: 24,
  metadata_language: 'en-US',
  accent_color: '#3b82f6',
  glass_intensity: 12,
  autoplay: true,
  seek_interval: 10,
  default_language: 'en',
  min_seeders: 1,
  exclude_keywords: ''
};

export const useStore = create<AppState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('streamFlowUser') || 'null'),
  config: (() => {
    const saved = JSON.parse(localStorage.getItem('streamFlowConfig') || 'null');
    return saved ? { ...DEFAULT_CONFIG, ...saved } : null;
  })(),
  
  login: (user, data) => {
    localStorage.setItem('streamFlowUser', JSON.stringify(user));
    const finalConfig = data.config ? { ...DEFAULT_CONFIG, ...data.config } : get().config;
    if (finalConfig) {
      localStorage.setItem('streamFlowConfig', JSON.stringify(finalConfig));
    }
    if (data.userLists) {
      localStorage.setItem('myMovieLists', JSON.stringify(data.userLists));
    }
    if (data.continueWatching) {
      localStorage.setItem('continueWatching', JSON.stringify(data.continueWatching));
    }
    set({ 
      user, 
      config: finalConfig,
      userLists: data.userLists || {},
      continueWatching: data.continueWatching || []
    });
  },

  logout: () => {
    localStorage.removeItem('streamFlowUser');
    localStorage.removeItem('streamFlowConfig');
    localStorage.removeItem('myMovieLists');
    localStorage.removeItem('continueWatching');
    set({ user: null, config: null, userLists: {}, continueWatching: [], currentView: 'home' });
  },

  setConfig: (config) => {
    localStorage.setItem('streamFlowConfig', JSON.stringify(config));
    set({ config });
    syncWithBackend(get());
  },

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  currentView: 'home',
  setCurrentView: (currentView) => set({ currentView }),
  
  userLists: JSON.parse(localStorage.getItem('myMovieLists') || '{}'),
  setUserLists: (userLists) => {
    localStorage.setItem('myMovieLists', JSON.stringify(userLists));
    set({ userLists });
    syncWithBackend(get());
  },

  removeFromList: (listName, movieId) => {
    const state = get();
    const list = state.userLists[listName] || [];
    const newLists = { ...state.userLists, [listName]: list.filter((m) => m.id !== movieId) };
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    set({ userLists: newLists });
    syncWithBackend(get());
  },

  deleteList: (listName) => {
    const state = get();
    const newLists = { ...state.userLists };
    delete newLists[listName];
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    set({ userLists: newLists });
    syncWithBackend(get());
  },

  selectedMovie: null,
  setSelectedMovie: (selectedMovie) => set({ selectedMovie }),
  
  continueWatching: JSON.parse(localStorage.getItem('continueWatching') || '[]'),
  addToContinueWatching: (movie) => {
    const state = get();
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
    set({ continueWatching: newList });
    syncWithBackend(get());
  },

  isConfigured: () => {
    const config = get().config;
    const user = get().user;
    // Strictly wait for the setup_complete flag to be true
    return !!(user && config && config.setup_complete);
  },

  isAuthenticated: () => {
    return !!get().user?.token;
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

  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set({ toast: null });
    }, 3000);
  },

  addToList: (listName, movie) => {
    const state = get();
    const list = state.userLists[listName] || [];
    if (list.some((m) => m.id === movie.id)) {
      state.showToast(`${movie.title || movie.name} is already in ${listName}`, 'info');
      return;
    }
    const newLists = { ...state.userLists, [listName]: [...list, movie] };
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    set({ userLists: newLists });
    state.showToast(`Added to ${listName}!`, 'success');
    syncWithBackend(get());
  },

  createList: (listName) => {
    const state = get();
    if (state.userLists[listName]) {
      state.showToast(`List "${listName}" already exists`, 'error');
      return;
    }
    const newLists = { ...state.userLists, [listName]: [] };
    localStorage.setItem('myMovieLists', JSON.stringify(newLists));
    set({ userLists: newLists });
    state.showToast(`List "${listName}" created!`, 'success');
    syncWithBackend(get());
  },
}));
