import { motion } from 'framer-motion';
import { Magnet, PlayCircle, ArrowUp, ArrowDown } from 'lucide-react';
import type { Torrent } from '../../types';

interface TorrentListProps {
  torrents: Torrent[];
  onSelect: (torrent: Torrent) => void;
  loading: boolean;
}

const getQualityColor = (quality: string) => {
  if (quality.includes('4K') || quality.includes('2160p')) return 'bg-purple-500';
  if (quality.includes('1080p')) return 'bg-blue-500';
  if (quality.includes('720p')) return 'bg-green-500';
  return 'bg-amber-500';
};

const formatSize = (bytes: number) => {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(2);
};

const TorrentList = ({ torrents, onSelect, loading }: TorrentListProps) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl border border-white/5"></div>
        ))}
      </div>
    );
  }

  if (torrents.length === 0) {
    return (
      <div className="text-center py-10 text-muted italic text-sm">
        No streams found. Try a different search.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {torrents.map((torrent, idx) => {
        const quality = torrent.title.match(/2160p|4K|1080p|720p|480p/i)?.[0] || 'SD';
        
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelect(torrent)}
            className={`p-4 border rounded-xl cursor-pointer transition-all flex items-center justify-between group ${
              torrent.isLocal 
                ? 'bg-accent-primary/10 border-accent-primary/40 hover:bg-accent-primary/20' 
                : 'bg-white/5 border-white/10 hover:bg-accent-primary/10 hover:border-accent-primary/30'
            }`}
          >
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`font-semibold text-sm truncate ${torrent.isLocal ? 'text-accent-primary' : 'text-white group-hover:text-accent-primary'} transition-colors`}>
                  {torrent.isLocal ? torrent.title.replace('[LOCAL] ', '') : torrent.title}
                </div>
                {torrent.isLocal && (
                  <span className="px-1.5 py-0.5 rounded-md bg-accent-primary text-[8px] font-black text-white uppercase tracking-tighter">
                    Verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-bold text-accent-secondary">
                  {formatSize(torrent.size)}<span className="text-xs font-normal text-muted ml-0.5">GB</span>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase ${getQualityColor(quality)}`}>
                  {quality}
                </span>
                {torrent.indexer && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase ${torrent.isLocal ? 'bg-accent-primary' : 'bg-pink-500'}`}>
                    {torrent.indexer}
                  </span>
                )}
                {!torrent.isLocal && (
                  <>
                    <span className="flex items-center gap-1 text-accent-secondary text-xs font-semibold">
                      <ArrowUp size={12} /> {torrent.seeders}
                    </span>
                    <span className="flex items-center gap-1 text-accent-danger text-xs font-semibold">
                      <ArrowDown size={12} /> {torrent.leechers}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!torrent.isLocal && (
                <a 
                  href={torrent.magnet} 
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted hover:text-accent-danger transition-colors"
                  title="Magnet Link"
                >
                  <Magnet size={20} />
                </a>
              )}
              <PlayCircle size={32} className={`${torrent.isLocal ? 'text-accent-primary' : 'text-accent-primary/70'} group-hover:text-accent-primary group-hover:scale-110 transition-transform`} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default TorrentList;
