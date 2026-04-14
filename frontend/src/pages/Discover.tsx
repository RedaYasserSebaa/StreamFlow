import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ChevronDown, Loader2 } from 'lucide-react';
import { discoverContent, getGenres, getApiErrorMessage } from '../api';
import { useStore } from '../store/useStore';
import type { Movie } from '../types';
import MovieCard from '../components/features/MovieCard';

type ContentType = 'movie' | 'tv';
type SortOption = { label: string; value: string };

const SORT_OPTIONS: SortOption[] = [
  { label: 'Most Popular', value: 'popularity.desc' },
  { label: 'Top Rated', value: 'vote_average.desc' },
  { label: 'Newest First', value: 'primary_release_date.desc' },
  { label: 'Revenue', value: 'revenue.desc' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 50 }, (_, i) => currentYear - i);

const Discover = () => {
  const { config, user, showToast } = useStore();
  const [contentType, setContentType] = useState<ContentType>('movie');
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | undefined>();
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [selectedSort, setSelectedSort] = useState('popularity.desc');
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch genres when content type changes
  useEffect(() => {
    if (!config?.backend_url || !user?.token) return;
    getGenres(config.backend_url, user.token, contentType).then(setGenres).catch(err => {
      const message = getApiErrorMessage(err);
      showToast(message, 'error');
    });
  }, [config, user, contentType]);

  // Fetch results when filters change
  const fetchResults = useCallback(async (pageNum: number = 1) => {
    if (!config?.backend_url || !user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await discoverContent(config.backend_url, user.token, contentType, {
        genre: selectedGenre,
        year: selectedYear,
        sort: selectedSort,
        page: pageNum,
      });
      if (pageNum === 1) {
        setResults(data.results);
      } else {
        setResults(prev => [...prev, ...data.results]);
      }
      setTotalPages(data.total_pages);
      setPage(pageNum);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [config, user, contentType, selectedGenre, selectedYear, selectedSort]);

  useEffect(() => {
    fetchResults(1);
  }, [fetchResults]);

  const loadMore = () => {
    if (page < totalPages) fetchResults(page + 1);
  };

  const selectClasses = "premium-select";

  return (
    <div>
      {/* Filters Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-8"
      >
        <button 
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 text-sm font-semibold text-white mb-4 md:hidden"
        >
          <Filter size={16} />
          Filters
          <ChevronDown size={14} className={`transform transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`${filtersOpen ? 'block' : 'hidden md:block'}`}>
          {/* Content Type Toggle */}
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <span className="text-xs text-muted uppercase tracking-wider font-semibold">Type</span>
            <div className="flex bg-surface rounded-xl p-1 border border-white/5">
              <button
                onClick={() => { setContentType('movie'); setSelectedGenre(undefined); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  contentType === 'movie'
                    ? 'bg-accent-primary text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                    : 'text-muted hover:text-white'
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => { setContentType('tv'); setSelectedGenre(undefined); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  contentType === 'tv'
                    ? 'bg-accent-primary text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                    : 'text-muted hover:text-white'
                }`}
              >
                TV Shows
              </button>
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Genre */}
            <div className="space-y-1.5 w-full md:w-56">
              <label className="text-[10px] text-muted uppercase tracking-wider font-semibold px-1">Genre</label>
              <select
                value={selectedGenre ?? ''}
                onChange={(e) => setSelectedGenre(e.target.value ? Number(e.target.value) : undefined)}
                className={selectClasses}
              >
                <option value="">All Genres</option>
                {genres.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div className="space-y-1.5 w-full md:w-56">
              <label className="text-[10px] text-muted uppercase tracking-wider font-semibold px-1">Year</label>
              <select
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
                className={selectClasses}
              >
                <option value="">All Years</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="space-y-1.5 w-full md:w-56">
              <label className="text-[10px] text-muted uppercase tracking-wider font-semibold px-1">Sort By</label>
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className={selectClasses}
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Clear */}
            <button
              onClick={() => { setSelectedGenre(undefined); setSelectedYear(undefined); setSelectedSort('popularity.desc'); }}
              className="text-xs text-muted hover:text-accent-danger transition-colors py-2.5 px-3"
            >
              Clear All
            </button>
          </div>
        </div>
      </motion.div>

      {/* Active Filters Summary */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {selectedGenre && (
          <span className="px-3 py-1 rounded-full bg-accent-primary/10 text-accent-primary text-xs font-medium border border-accent-primary/20">
            {genres.find(g => g.id === selectedGenre)?.name}
          </span>
        )}
        {selectedYear && (
          <span className="px-3 py-1 rounded-full bg-accent-secondary/10 text-accent-secondary text-xs font-medium border border-accent-secondary/20">
            {selectedYear}
          </span>
        )}
      </div>

      {/* Results Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${contentType}-${selectedGenre}-${selectedYear}-${selectedSort}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
        >
          {results.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onClick={(m) => console.log(m)} />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Loading / Load More */}
      <div className="flex justify-center mt-10 mb-6">
        {loading ? (
          <Loader2 size={28} className="animate-spin text-accent-primary" />
        ) : page < totalPages ? (
          <button
            onClick={loadMore}
            className="px-8 py-3 rounded-2xl glass glass-hover text-sm font-semibold transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          >
            Load More
          </button>
        ) : results.length > 0 ? (
          <p className="text-muted text-xs">You've reached the end</p>
        ) : null}
      </div>

      {!loading && results.length === 0 && (
        <div className="text-center py-20">
          {error ? (
            <>
              <p className="text-red-400 text-lg font-semibold">{error}</p>
              <p className="text-muted/60 text-sm mt-2">Check your TMDB API key in Settings and try again.</p>
            </>
          ) : (
            <>
              <p className="text-muted text-lg">No results found for these filters.</p>
              <p className="text-muted/60 text-sm mt-2">Try adjusting your genre, year, or sort settings.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Discover;
