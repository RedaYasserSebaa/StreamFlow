import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2 } from 'lucide-react';
import { searchMovies } from '../api';
import { useStore } from '../store/useStore';
import type { Movie } from '../types';
import MovieCard from '../components/features/MovieCard';

const SearchResults = () => {
  const { config, searchQuery } = useStore();
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const performSearch = async () => {
      if (!config?.tmdb_api_key || !searchQuery.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await searchMovies(config.tmdb_api_key, searchQuery);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 500); // Debounce
    return () => clearTimeout(timer);
  }, [config, searchQuery]);

  return (
    <div className="pb-12 text-white">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 rounded-2xl bg-accent-primary/10 border border-accent-primary/20">
          <Search size={24} className="text-accent-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Search Results</h2>
          <p className="text-muted text-sm mt-1">Found {results.length} items for "{searchQuery}"</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={48} className="animate-spin text-accent-primary" />
        </div>
      ) : results.length > 0 ? (
        <motion.div 
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
        >
          {results.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onClick={() => {}} />
          ))}
        </motion.div>
      ) : searchQuery.trim() ? (
        <div className="text-center py-20">
          <p className="text-muted text-lg">No results found for "{searchQuery}"</p>
          <p className="text-muted/60 text-sm mt-2">Try searching for something else.</p>
        </div>
      ) : null}
    </div>
  );
};

export default SearchResults;
