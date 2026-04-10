import { create } from 'zustand';
import type { UserConfig, Movie } from '../types';

interface AppState {
  config: UserConfig | null;
  setConfig: (config: UserConfig) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentView: 'home' | 'discover' | 'lists';
  setCurrentView: (view: 'home' | 'discover' | 'lists') => void;
  userLists: Record<string, Movie[]>;
  setUserLists: (lists: Record<string, Movie[]>) => void;
  addToList: (listName: string, movie: Movie) => void;
  removeFromList: (listName: string, movieId: number) => void;
}

export const useStore = create<AppState>((set) => ({
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
}));
