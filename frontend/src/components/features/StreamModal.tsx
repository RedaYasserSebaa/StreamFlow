import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, Plus, Loader2, Download, Users, HardDrive, Type, Settings2, FileUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fetchMovieDetails, fetchTVSeason, searchStreams, fetchStreamStats, getImagePath, srt2vtt } from '../../api';
import VideoPlayer from './VideoPlayer';
import TorrentList from './TorrentList';
import type { Torrent } from '../../types';

const StreamModal = () => {
  const { selectedMovie, setSelectedMovie, config, userLists, addToList, addToContinueWatching, subtitleStyle, updateSubtitleStyle } = useStore();
  const [details, setDetails] = useState<any>(null);
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loadingTorrents, setLoadingTorrents] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedList, setSelectedList] = useState('');
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Filter States
  const [qualityFilter, setQualityFilter] = useState('all');
  const [indexerFilter, setIndexerFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'streams' | 'local'>('streams');

  // Subtitle States
  const [customSubtitles, setCustomSubtitles] = useState<{ src: string; label: string }[]>([]);
  const [showSubSettings, setShowSubSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TV State
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);

  const statsInterval = useRef<any>(null);

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

    return () => {
      if (statsInterval.current) clearInterval(statsInterval.current);
    };
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
      const results = await searchStreams(config.backend_url, title, selectedMovie.media_type, seasonEpi);
      setTorrents(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTorrents(false);
    }
  };

  const handlePlay = (torrent: Torrent) => {
    if (!config?.backend_url) return;
    
    let url = '';
    if (torrent.isLocal && torrent.magnet.startsWith('local://')) {
      const filePath = torrent.magnet.replace('local://', '');
      url = `${config.backend_url}/api/stream/local?path=${encodeURIComponent(filePath)}`;
    } else {
      url = `${config.backend_url}/api/stream?magnet=${encodeURIComponent(torrent.magnet)}&indexer=${encodeURIComponent(torrent.indexer || '')}`;
    }

    setStreamUrl(url);
    setIsBuffering(true);
    
    if (selectedMovie) {
      addToContinueWatching(selectedMovie);
    }

    // Start stats interval (only for torrents)
    if (statsInterval.current) clearInterval(statsInterval.current);
    if (!torrent.isLocal) {
      statsInterval.current = setInterval(async () => {
        try {
          const s = await fetchStreamStats(config.backend_url, torrent.magnet);
          setStats(s);
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    } else {
      setStats(null); // Clear stats for local playback
    }
  };

  const handleSubtitleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let content = event.target?.result as string;
      if (file.name.endsWith('.srt')) {
        content = srt2vtt(content);
      }

      const blob = new Blob([content], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      
      setCustomSubtitles(prev => [
        ...prev,
        { src: url, label: file.name }
      ]);
    };
    reader.readAsText(file);
  };

  const formatSpeed = (speed: number) => {
    if (speed > 1024 * 1024) return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
    if (speed > 1024) return `${(speed / 1024).toFixed(0)} KB/s`;
    return `${speed} B/s`;
  };

  // Derived Filter Data
  const getQuality = (title: string) => title.match(/2160p|4K|1080p|720p|480p/i)?.[0] || 'SD';
  
  const availableQualities = Array.from(new Set(torrents.map(t => getQuality(t.title))));
  const availableIndexers = Array.from(new Set(torrents.map(t => t.indexer).filter(Boolean)));

  const filteredTorrents = torrents.filter(t => {
    const qMatch = qualityFilter === 'all' || getQuality(t.title) === qualityFilter;
    const iMatch = indexerFilter === 'all' || t.indexer === indexerFilter;
    const tMatch = (activeTab === 'local' && t.isLocal) || (activeTab === 'streams' && !t.isLocal);
    return qMatch && iMatch && tMatch;
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

        {/* LEFT PANE: PLAYER (50%) */}
        <div className="flex-1 min-h-[40vh] md:h-full relative bg-black/20 flex flex-col">
          {streamUrl ? (
            <div className="flex-1 relative">
              <VideoPlayer 
                src={streamUrl} 
                subtitles={customSubtitles}
                subtitleStyle={subtitleStyle}
                onPlaying={() => setIsBuffering(false)}
                onWaiting={() => setIsBuffering(true)}
              />
              <AnimatePresence>
                {isBuffering && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20"
                  >
                    <Loader2 size={48} className="animate-spin text-accent-primary mb-4" />
                    <p className="text-white font-bold tracking-widest uppercase text-xs">Buffering Stream...</p>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Stats Overlay */}
              <div className="absolute top-6 left-6 z-30 flex gap-3">
                {stats && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider"
                  >
                    <div className="flex items-center gap-1.5 text-accent-secondary">
                      <Download size={12} /> {formatSpeed(stats.speed)}
                    </div>
                    <div className="w-px h-3 bg-white/20" />
                    <div className="flex items-center gap-1.5 text-accent-primary">
                      <Users size={12} /> {stats.peers} Peers
                    </div>
                    {stats.progress > 0 && (
                      <>
                        <div className="w-px h-3 bg-white/20" />
                        <div className="flex items-center gap-1.5 text-purple-400">
                          <HardDrive size={12} /> {stats.progress}%
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Subtitle Controls Overlay */}
              <div className="absolute top-6 right-6 z-30 flex flex-col items-end gap-3">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleSubtitleImport}
                    accept=".srt,.vtt"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-accent-primary/20 hover:border-accent-primary/30 transition-all"
                  >
                    <FileUp size={14} className="text-accent-primary" /> Import Subtitles
                  </button>
                  <button
                    onClick={() => setShowSubSettings(!showSubSettings)}
                    className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all"
                  >
                    <Settings2 size={16} />
                  </button>
                </div>

                <AnimatePresence>
                  {showSubSettings && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="w-64 p-5 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl space-y-5"
                    >
                      <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-widest font-black border-b border-white/5 pb-3">
                        <Type size={14} className="text-accent-primary" />
                        Subtitle Styling
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-muted font-bold uppercase">
                          <span>Font Size</span>
                          <span className="text-accent-primary">{subtitleStyle.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="16"
                          max="96"
                          value={subtitleStyle.fontSize}
                          onChange={(e) => updateSubtitleStyle({ fontSize: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-primary"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-muted font-bold uppercase">Font Family</label>
                        <select
                          value={subtitleStyle.fontFamily}
                          onChange={(e) => updateSubtitleStyle({ fontFamily: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-[11px] focus:outline-none focus:border-accent-primary transition-all appearance-none cursor-pointer"
                        >
                          <option value="Inter, sans-serif">Inter (Default)</option>
                          <option value="Arial, sans-serif">Arial</option>
                          <option value="'Courier New', monospace">Courier New</option>
                          <option value="'Times New Roman', serif">Times New Roman</option>
                          <option value="Verdana, sans-serif">Verdana</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] text-muted font-bold uppercase">Color</label>
                          <div className="relative group">
                            <input
                              type="color"
                              value={subtitleStyle.color}
                              onChange={(e) => updateSubtitleStyle({ color: e.target.value })}
                              className="w-full h-8 bg-transparent border-none rounded cursor-pointer"
                            />
                            <div 
                              className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none" 
                              style={{ backgroundColor: subtitleStyle.color }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-muted font-bold uppercase">Background</label>
                          <button
                            onClick={() => updateSubtitleStyle({ background: !subtitleStyle.background })}
                            className={`w-full h-8 rounded-lg border transition-all text-[10px] font-bold uppercase ${
                              subtitleStyle.background 
                                ? 'bg-accent-primary/20 border-accent-primary text-accent-primary' 
                                : 'bg-white/5 border-white/10 text-muted'
                            }`}
                          >
                            {subtitleStyle.background ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative group cursor-pointer" onClick={handleSearch}>
              <img 
                src={getImagePath(selectedMovie.backdrop_path || selectedMovie.poster_path, 'original')} 
                className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000"
                alt="Backdrop"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                <PlayCircle size={64} className="text-white/50 group-hover:text-accent-primary group-hover:scale-110 transition-all drop-shadow-2xl" />
                <p className="text-white/60 font-medium tracking-wide">Select a stream to start playing</p>
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE PANE: STREAMS (20%) */}
        <div className="w-full md:w-[35%] lg:w-[20%] h-full border-x border-white/5 bg-white/[0.02] p-6 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 relative">
            <button 
              onClick={() => setActiveTab('streams')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg z-10 ${activeTab === 'streams' ? 'text-white' : 'text-muted hover:text-white'}`}
            >
              <PlayCircle size={14} />
              Streams
            </button>
            <button 
              onClick={() => setActiveTab('local')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg z-10 ${activeTab === 'local' ? 'text-white' : 'text-muted hover:text-white'}`}
            >
              <HardDrive size={14} />
              Local
            </button>
            <motion.div 
              className="absolute inset-y-1 bg-gradient-premium rounded-lg shadow-lg"
              initial={false}
              animate={{ 
                left: activeTab === 'streams' ? '4px' : '50%',
                right: activeTab === 'streams' ? '50%' : '4px'
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          {/* TV Selectors */}
          {selectedMovie.media_type === 'tv' && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
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
            {loadingTorrents ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} className="group-hover:scale-110 transition-transform" />}
            FIND STREAMS
          </button>

          {/* Filters UI */}
          {torrents.length > 0 && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-500">
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

          <TorrentList torrents={filteredTorrents} onSelect={handlePlay} loading={loadingTorrents} />
        </div>

        {/* RIGHT PANE: INFO (20%) */}
        <div className="hidden lg:flex lg:w-[20%] h-full p-8 flex-col gap-8 bg-white/[0.04]">
          <div className="space-y-4">
            <h2 className="text-2xl font-black leading-tight text-white">{selectedMovie.title || selectedMovie.name}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-accent-primary/10 text-accent-primary text-xs font-bold border border-accent-primary/20">
                {selectedMovie.release_date || selectedMovie.first_air_date ? new Date(selectedMovie.release_date || selectedMovie.first_air_date!).getFullYear() : 'N/A'}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-accent-secondary bg-accent-secondary/10 px-3 py-1 rounded-lg border border-accent-secondary/20">
                ⭐ {selectedMovie.vote_average.toFixed(1)}
              </span>
              {selectedMovie.media_type === 'tv' && (
                <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20 uppercase tracking-tighter">
                  {details?.number_of_seasons} Seasons
                </span>
              )}
            </div>
            <p className="text-sm text-muted leading-relaxed max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedMovie.overview}
            </p>
          </div>

          <div className="mt-auto space-y-4 pt-8 border-t border-white/5">
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
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/5 disabled:opacity-30"
              >
                Add Movie to List
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StreamModal;
