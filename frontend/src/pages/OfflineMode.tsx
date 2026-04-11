import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';
import MovieCard from '../components/features/MovieCard';
import { HardDrive, RefreshCw, FolderOpen } from 'lucide-react';
import type { Movie } from '../types';
import Section from '../components/common/Section';

const OfflineMode = () => {
  const { config, user } = useStore();
  const [localMedia, setLocalMedia] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLocalMedia = async (force = false) => {
    if (!config?.backend_url) return;

    setIsRefreshing(force);
    if (!force) setIsLoading(true);

    try {
      const response = await axios.get(`${config.backend_url}/api/local${force ? '?refresh=true' : ''}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (response.data.success) {
        setLocalMedia(response.data.results);
      }
    } catch (err) {
      console.error('Failed to fetch local media:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLocalMedia();
  }, [config?.backend_url]);

  const movies = localMedia.filter(m => m.media_type === 'movie');
  const tvShows = localMedia.filter(m => m.media_type === 'tv');

  if (!config?.movies_path && !config?.tv_shows_path) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <FolderOpen size={64} className="text-muted mb-6" />
        <h2 className="text-2xl font-bold mb-2">No Local Folders Configured</h2>
        <p className="text-muted max-w-md mb-8">
          To see your local library here, go to Settings and configure your Movie and TV Show paths.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent-primary/10 rounded-2xl text-accent-primary">
            <HardDrive size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Offline Mode</h1>
            <p className="text-muted">Your local media library, enriched with TMDB metadata</p>
          </div>
        </div>

        <button
          onClick={() => fetchLocalMedia(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh Scan</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : localMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HardDrive size={48} className="text-muted mb-4 opacity-20" />
          <p className="text-muted italic">No media files found in your configured paths.</p>
        </div>
      ) : (
        <>
          {movies.length > 0 && (
            <Section title="Local Movies">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {movies.map((movie) => (
                  <MovieCard key={movie.localId || movie.id} movie={movie} onClick={() => { }} />
                ))}
              </div>
            </Section>
          )}

          {tvShows.length > 0 && (
            <Section title="Local TV Shows">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {tvShows.map((show) => (
                  <MovieCard key={show.localId || show.id} movie={show} onClick={() => { }} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

export default OfflineMode;
