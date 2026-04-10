import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Film, X, FolderOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import MovieCard from '../components/features/MovieCard';

const MyLists = () => {
  const { userLists, createList, deleteList, removeFromList } = useStore();
  const [newListName, setNewListName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const listNames = Object.keys(userLists);

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    createList(name);
    setNewListName('');
    setShowCreateModal(false);
  };

  const handleDeleteList = (name: string) => {
    deleteList(name);
    setConfirmDelete(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
            My Lists
          </h2>
          <p className="text-muted text-sm mt-1">{listNames.length} list{listNames.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-premium rounded-xl text-sm font-semibold hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all"
        >
          <Plus size={18} />
          New List
        </button>
      </div>

      {/* Lists */}
      {listNames.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <div className="inline-flex p-5 rounded-3xl bg-surface border border-white/5 mb-6">
            <FolderOpen size={48} className="text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No lists yet</h3>
          <p className="text-muted text-sm mb-6">Create your first list to start saving movies and TV shows.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-premium rounded-xl text-sm font-semibold hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all"
          >
            Create Your First List
          </button>
        </motion.div>
      ) : (
        <div className="space-y-10">
          {listNames.map((listName) => {
            const movies = userLists[listName];
            return (
              <motion.div
                key={listName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-6"
              >
                {/* List Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">{listName}</h3>
                    <p className="text-muted text-xs mt-0.5">{movies.length} item{movies.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {confirmDelete === listName ? (
                      <div className="flex items-center gap-2 animate-in">
                        <span className="text-xs text-accent-danger">Delete this list?</span>
                        <button
                          onClick={() => handleDeleteList(listName)}
                          className="px-3 py-1.5 rounded-lg bg-accent-danger/10 text-accent-danger text-xs font-medium hover:bg-accent-danger/20 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 rounded-lg bg-surface text-muted text-xs font-medium hover:bg-white/10 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(listName)}
                        className="p-2 rounded-lg text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Movie Grid */}
                {movies.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                    {movies.map((movie) => (
                      <div key={movie.id} className="relative group/card">
                        <MovieCard movie={movie} onClick={(m) => console.log(m)} />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromList(listName, movie.id); }}
                          className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/70 text-white/70 hover:text-accent-danger hover:bg-black/90 opacity-0 group-hover/card:opacity-100 transition-all z-10"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                    <Film size={28} className="mx-auto text-muted mb-3" />
                    <p className="text-muted text-sm">This list is empty.</p>
                    <p className="text-muted/60 text-xs mt-1">Browse movies and add them here.</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create List Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-3xl p-8 w-full max-w-md relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-premium rounded-t-3xl"></div>
              <h3 className="text-xl font-bold mb-6">Create New List</h3>
              <input
                type="text"
                placeholder="List name (e.g. Watch Later)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm mb-6"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                  className="px-5 py-2.5 bg-gradient-premium rounded-xl text-sm font-semibold hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all disabled:opacity-40"
                >
                  Create List
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyLists;
