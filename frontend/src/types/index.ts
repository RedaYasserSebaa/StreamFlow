export interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
  media_type: 'movie' | 'tv';
  number_of_seasons?: number;
  number_of_episodes?: number;
  isLocal?: boolean;
  localPath?: string;
  localId?: string;
}

export interface Torrent {
  title: string;
  seeders: number;
  leechers: number;
  magnet: string;
  size: number;
  indexer: string;
  isLocal?: boolean;
}

export interface UserConfig {
  // Core Services
  tmdb_api_key: string | null;
  jackett_api_key: string | null;
  jackett_ip: string;
  jackett_port: number;
  backend_url: string;
  subtitle_api_key?: string;
  
  // Library
  movies_path?: string;
  tv_shows_path?: string;
  auto_scan_interval?: number;
  metadata_language?: string;
  
  // Appearance
  accent_color?: string;
  glass_intensity?: number;
  
  // Player
  autoplay?: boolean;
  seek_interval?: number;
  default_language?: string;
  
  // Search
  min_seeders?: number;
  exclude_keywords?: string;
  
  setup_complete?: boolean;
}

export interface User {
  username: string;
  token?: string;
}

export interface StreamStats {
  speed: number;
  peers: number;
  downloaded: number;
  progress: number;
}
