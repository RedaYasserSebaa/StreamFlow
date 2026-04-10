import React from 'react';
import Sidebar from '../components/layout/Sidebar';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { searchQuery, setSearchQuery } = useStore();

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      
      <main className="ml-20 flex-1 px-8 py-8 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Top Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold tracking-tight"
              >
                StreamFlow <span className="text-accent-primary">Next-Gen</span>
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
              key={children?.toString()} // Trigger animation on route change
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
    </div>
  );
};

export default MainLayout;
