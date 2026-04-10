import Sidebar from '../components/layout/Sidebar';
import StreamModal from '../components/features/StreamModal';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { searchQuery, setSearchQuery, selectedMovie, setCurrentView } = useStore();

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      
      <main className="ml-20 flex-1 py-8">
        <div className="w-full px-6 md:px-10">
          {/* ... existing header code ... */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div 
              className="cursor-pointer group"
              onClick={() => { setCurrentView('home'); setSearchQuery(''); }}
            >
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold tracking-tight text-[#3f83f2] group-hover:opacity-80 transition-opacity"
              >
                StreamFlow
              </motion.h1>
              <p className="text-muted text-sm mt-2">Discover and stream your favorite content instantly.</p>
            </div>

            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent-primary transition-colors" size={20} />
              <input
                type="text"
                placeholder="Search movies, tv shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-white/5 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm glass shadow-lg"
              />
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {selectedMovie && <StreamModal />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMovie && <StreamModal />}
      </AnimatePresence>
    </div>
  );
};

export default MainLayout;
