import React from 'react';
import { motion } from 'framer-motion';
import { Star, Search } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Movie } from '../../types';
import { getImagePath } from '../../api';

interface MovieCardProps {
  movie: Movie;
  onClick: (movie: Movie) => void;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie, onClick }) => {
  const { setSelectedMovie } = useStore();
  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;
  const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';

  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.02 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group cursor-pointer relative"
      onClick={() => {
        onClick(movie);
        setSelectedMovie(movie);
      }}
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-lg border border-white/5 bg-surface/50">
        <img
          src={getImagePath(movie.poster_path)}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Search size={48} className="text-accent-primary drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
        </div>

        {/* Rating Badge */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg glass text-xs font-bold flex items-center gap-1">
          <Star size={12} className="text-yellow-500 fill-yellow-500" />
          {movie.vote_average.toFixed(1)}
        </div>
      </div>

      <div className="mt-3 px-1">
        <h3 className="text-sm font-semibold truncate group-hover:text-accent-primary transition-colors">
          {title}
        </h3>
        <p className="text-xs text-muted mt-1">{year}</p>
      </div>
    </motion.div>
  );
};

export default MovieCard;
