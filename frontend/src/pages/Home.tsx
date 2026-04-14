import { useEffect, useState } from 'react';
import { fetchHomeData, getApiErrorMessage } from '../api';
import { useStore } from '../store/useStore';
import type { Movie } from '../types';
import MovieCard from '../components/features/MovieCard';

const Home = () => {
  const { config, user, continueWatching, showToast } = useStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config?.backend_url && user?.token) {
      fetchHomeData(config.backend_url, user.token).then((res) => {
        setError(null);
        setData(res);
      }).catch(err => {
        const message = getApiErrorMessage(err);
        setError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [config, user]);

  const renderRow = (title: string, movies: Movie[]) => (
    <div className="mb-12">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
        {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {movies.slice(0, 12).map((movie) => (
          <MovieCard key={movie.id} movie={movie} onClick={() => {}} />
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg font-semibold">{error}</p>
        <p className="text-muted/60 text-sm mt-2">Check your TMDB API key in Settings and try again.</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {continueWatching.length > 0 && renderRow('Continue Watching', continueWatching)}
      {data && (
        <>
          {renderRow('Trending This Week', data.trending)}
          {renderRow('Popular Movies', data.popularMovies)}
          {renderRow('Popular TV Shows', data.popularTv)}
        </>
      )}
    </div>
  );
};

export default Home;
