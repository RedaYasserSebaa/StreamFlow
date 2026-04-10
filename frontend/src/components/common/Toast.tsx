import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';

const Toast = () => {
  const { toast } = useStore();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl glass border border-white/10 shadow-2xl flex items-center gap-3 min-w-[300px] ${
            toast.type === 'success' ? 'border-accent-primary/30' : 
            toast.type === 'error' ? 'border-red-500/30' : 'border-white/10'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${
            toast.type === 'success' ? 'bg-accent-primary animate-pulse' : 
            toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`} />
          <p className="text-sm font-medium text-white">{toast.message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
