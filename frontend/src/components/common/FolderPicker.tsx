import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, ChevronRight, ArrowUp, X, Loader2, Check } from 'lucide-react';
import { getBackendApi } from '../../api';
import { useStore } from '../../store/useStore';

interface Directory {
  name: string;
  path: string;
}

interface BrowseResponse {
  current: string;
  parent: string | null;
  directories: Directory[];
}

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

const FolderPicker = ({ isOpen, onClose, onSelect, initialPath }: FolderPickerProps) => {
  const { config, user } = useStore();
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = async (dirPath?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const api = getBackendApi(config?.backend_url || 'http://localhost:7676', user?.token);
      const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await api.get<BrowseResponse>(`/api/browse${params}`);
      setCurrentPath(res.data.current);
      setParentPath(res.data.parent);
      setDirectories(res.data.directories);
    } catch {
      setError('Could not browse this directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      browse(initialPath || undefined);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="glass w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <h3 className="text-lg font-black text-white">Select Folder</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {/* Current Path */}
          <div className="px-5 py-3 bg-white/5 border-b border-white/5">
            <p className="text-xs text-muted font-mono truncate">
              {currentPath || 'Root'}
            </p>
          </div>

          {/* Directory List */}
          <div className="max-h-80 overflow-y-auto p-3 space-y-1">
            {/* Go Up */}
            {parentPath !== null && (
              <button
                onClick={() => browse(parentPath)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <ArrowUp size={18} className="text-accent-primary shrink-0" />
                <span className="text-sm text-muted">..</span>
              </button>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-accent-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : directories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted">No subdirectories found</p>
              </div>
            ) : (
              directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => browse(dir.path)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-left group"
                >
                  <Folder size={18} className="text-accent-secondary shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{dir.name}</span>
                  <ChevronRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-white/10">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-muted hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (currentPath) {
                  onSelect(currentPath);
                  onClose();
                }
              }}
              disabled={!currentPath}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-premium text-white text-sm font-bold hover:shadow-lg hover:shadow-accent-primary/30 transition-all disabled:opacity-50"
            >
              <Check size={16} />
              Select This Folder
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FolderPicker;
