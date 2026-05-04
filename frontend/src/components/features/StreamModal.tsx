import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Loader2, Magnet } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fetchMovieDetails, fetchTVSeason, searchStreams, getImagePath } from '../../api';
import TorrentList from './TorrentList';
import type { Torrent } from '../../types';

const StreamModal = () => {
  const { selectedMovie, setSelectedMovie, config, user, userLists, addToList } = useStore();
  const [details, setDetails] = useState<any>(null);
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loadingTorrents, setLoadingTorrents] = useState(false);
  const [selectedList, setSelectedList] = useState('');
  
  // Filter States
  const [qualityFilter, setQualityFilter] = useState('all');
  const [indexerFilter, setIndexerFilter] = useState('all');

  // TV State
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);

  useEffect(() => {
    if (selectedMovie && config?.tmdb_api_key) {
      fetchMovieDetails(config.tmdb_api_key, selectedMovie.id, selectedMovie.media_type)
        .then((data: any) => {
          setDetails(data);
          if (selectedMovie.media_type === 'tv') {
            // Initial episodes load
            fetchTVSeason(config.tmdb_api_key!, selectedMovie.id, 1).then((s: any) => setEpisodes(s.episodes));
          }
        });
    }
  }, [selectedMovie, config]);

  const handleSeasonChange = async (season: number) => {
    setSelectedSeason(season);
    if (config?.tmdb_api_key && selectedMovie) {
      const data = await fetchTVSeason(config.tmdb_api_key, selectedMovie.id, season);
      setEpisodes(data.episodes);
      setSelectedEpisode(1);
    }
  };

  const handleSearch = async () => {
    if (!selectedMovie || !config?.backend_url) return;
    setLoadingTorrents(true);
    try {
      let seasonEpi = '';
      if (selectedMovie.media_type === 'tv') {
        seasonEpi = `S${selectedSeason.toString().padStart(2, '0')}E${selectedEpisode.toString().padStart(2, '0')}`;
      }
      const title = selectedMovie.title || selectedMovie.name || '';
      const year = (selectedMovie.release_date || (selectedMovie as any).first_air_date)?.split('-')[0];
      const results = await searchStreams(
        config.backend_url, 
        user?.token || '',
        title, 
        selectedMovie.media_type, 
        seasonEpi,
        year
      );
      setTorrents(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTorrents(false);
    }
  };

  // Derived Filter Data
  const getQuality = (title: string) => title.match(/2160p|4K|1080p|720p|480p/i)?.[0] || 'SD';
  
  const availableQualities = Array.from(new Set(torrents.map(t => getQuality(t.title))));
  const availableIndexers = Array.from(new Set(torrents.map(t => t.indexer).filter(Boolean)));

  const filteredTorrents = torrents.filter(t => {
    const qMatch = qualityFilter === 'all' || getQuality(t.title) === qualityFilter;
    const iMatch = indexerFilter === 'all' || t.indexer === indexerFilter;
    return qMatch && iMatch;
  });

  if (!selectedMovie) return null;

  const selectClasses = "premium-select";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        onClick={() => setSelectedMovie(null)}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-[98vw] lg:max-w-[1600px] h-[92vh] glass rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row border border-white/10 shadow-2xl"
      >
        <button 
          onClick={() => setSelectedMovie(null)}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-white/10 transition-all border border-white/5"
        >
          <X size={20} />
        </button>

        {/* LEFT PANE: POSTER */}
        <div className="flex-1 min-h-[40vh] md:h-full relative bg-black/40 overflow-hidden">
          <img 
            src={getImagePath(selectedMovie.poster_path, 'original')} 
            className="w-full h-full object-cover"
            alt="Poster"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          <div className="absolute bottom-12 left-12 right-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-2xl uppercase italic">
                {selectedMovie.title || selectedMovie.name}
              </h1>
              <div className="flex items-center gap-4">
                <span className="px-4 py-1.5 rounded-full bg-accent-primary text-white text-sm font-black italic uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                  {selectedMovie.media_type}
                </span>
                <span className="text-white/80 font-bold text-lg">
                  {selectedMovie.release_date || (selectedMovie as any).first_air_date ? new Date(selectedMovie.release_date || (selectedMovie as any).first_air_date!).getFullYear() : 'N/A'}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* SIDE PANE: INFO & STREAMS (increased width) */}
        <div className="w-full lg:w-[480px] xl:w-[580px] h-full border-l border-white/5 bg-white/[0.02] flex flex-col overflow-hidden">
          {/* Scrollable Content Container */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {/* 1. MOVIE INFO SECTION (TOP) */}
            <div className="space-y-4">
              <h2 className="text-2xl font-black leading-tight text-white">{selectedMovie.title || selectedMovie.name}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-accent-primary/10 text-accent-primary text-[10px] font-black border border-accent-primary/20 uppercase tracking-widest">
                  {selectedMovie.release_date || (selectedMovie as any).first_air_date ? new Date(selectedMovie.release_date || (selectedMovie as any).first_air_date!).getFullYear() : 'N/A'}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-accent-secondary bg-accent-secondary/10 px-3 py-1 rounded-lg border border-accent-secondary/20 uppercase tracking-widest">
                  ⭐ {selectedMovie.vote_average.toFixed(1)}
                </span>
                {selectedMovie.media_type === 'tv' && (
                  <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-black border border-green-500/20 uppercase tracking-widest">
                    {details?.number_of_seasons} Seasons
                  </span>
                )}
              </div>
              <p className="text-sm text-muted leading-relaxed">
                {selectedMovie.overview}
              </p>
            </div>

            {/* 2. ADD TO COLLECTION */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4">
              <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-widest font-black">
                <Plus size={14} className="text-accent-primary" />
                ADD TO COLLECTION
              </div>
              <div className="space-y-3">
                <select 
                  className={selectClasses}
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                >
                  <option value="">Choose a list...</option>
                  {Object.keys(userLists).map(list => (
                    <option key={list} value={list}>{list}</option>
                  ))}
                </select>
                <button 
                  onClick={() => selectedList && addToList(selectedList, selectedMovie)}
                  disabled={!selectedList}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/5 disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  Save to List
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* 3. TABS & SEARCH CONTROLS */}
            <div className="space-y-6">
              <div className="flex p-3 bg-white/5 rounded-xl border border-white/10 items-center justify-center gap-2">
                <Magnet size={14} className="text-accent-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Available Streams</span>
              </div>

              {/* TV Selectors */}
              {selectedMovie.media_type === 'tv' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted uppercase tracking-wider font-semibold px-1">Season</label>
                      <select 
                        value={selectedSeason}
                        onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                        className={selectClasses}
                      >
                        {Array.from({ length: details?.number_of_seasons || 1 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Season {i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted uppercase tracking-wider font-semibold px-1">Episode</label>
                      <select 
                        value={selectedEpisode}
                        onChange={(e) => setSelectedEpisode(parseInt(e.target.value))}
                        className={selectClasses}
                      >
                        {episodes.map(ep => (
                          <option key={ep.episode_number} value={ep.episode_number}>
                            Ep {ep.episode_number}: {ep.name.slice(0, 15)}...
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={loadingTorrents}
                className="w-full py-3.5 bg-gradient-premium hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loadingTorrents ? <Loader2 size={16} className="animate-spin" /> : <Magnet size={16} className="group-hover:scale-110 transition-transform" />}
                FIND MAGNETS
              </button>

              {/* Filters UI */}
              {torrents.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-muted uppercase tracking-widest font-bold px-1">Quality</label>
                    <select 
                      value={qualityFilter}
                      onChange={(e) => setQualityFilter(e.target.value)}
                      className={selectClasses}
                    >
                      <option value="all">All</option>
                      {availableQualities.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-muted uppercase tracking-widest font-bold px-1">Indexer</label>
                    <select 
                      value={indexerFilter}
                      onChange={(e) => setIndexerFilter(e.target.value)}
                      className={selectClasses}
                    >
                      <option value="all">All</option>
                      {availableIndexers.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 4. TORRENT LIST (BOTTOM) */}
            <div className="space-y-4 h-full">
               <div className="flex items-center justify-between">
                 <div className="text-[10px] text-muted uppercase tracking-widest font-black">AVAILABLE STREAMS</div>
                 {filteredTorrents.length > 0 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-muted">{filteredTorrents.length} Results</span>}
               </div>
               <TorrentList torrents={filteredTorrents} loading={loadingTorrents} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StreamModal;
