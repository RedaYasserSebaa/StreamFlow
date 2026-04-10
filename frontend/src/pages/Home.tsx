import { useEffect, useState } from 'react';
import { fetchHomeData } from '../api';
import { useStore } from '../store/useStore';
import type { Movie } from '../types';
import MovieCard from '../components/features/MovieCard';

const Home = () => {
  const { config } = useStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (config?.tmdb_api_key) {
      fetchHomeData(config.tmdb_api_key).then((res) => {
        setData(res);
        setLoading(setLoading as any);
      }).catch(err => console.error(err))
      .finally(() => setLoading(false));
    }
  }, [config]);

  const renderRow = (title: string, movies: Movie[]) => (
    <div className="mb-12">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
        {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {movies.slice(0, 12).map((movie) => (
          <MovieCard key={movie.id} movie={movie} onClick={(m) => console.log(m)} />
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

  return (
    <div>
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
