import { Home, Compass, List, Settings } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { motion } from 'framer-motion';

const Sidebar = () => {
  const { currentView, setCurrentView } = useStore();

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'discover', icon: Compass, label: 'Discover' },
    { id: 'lists', icon: List, label: 'My Lists' },
  ];

  return (
    <motion.nav 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-8 glass z-50 border-r border-white/5"
    >
      <div className="mb-12">
        <img src="/favicon.png" alt="Logo" className="w-10 h-10 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
      </div>

      <div className="flex flex-col gap-6 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
              className={`p-3 rounded-xl transition-all duration-300 group relative ${
                isActive 
                  ? 'bg-accent-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={24} />
              <span className="absolute left-full ml-4 px-2 py-1 bg-surface border border-white/10 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <button 
        onClick={() => setCurrentView('settings')}
        className={`p-3 transition-colors group relative ${
          currentView === 'settings' ? 'bg-accent-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'text-muted hover:text-white hover:bg-white/5'
        } rounded-xl`}
      >
        <Settings size={24} />
        <span className="absolute left-full ml-4 px-2 py-1 bg-surface border border-white/10 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          Settings
        </span>
      </button>
    </motion.nav>
  );
};

export default Sidebar;
