import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Key, Server, CheckCircle, Network, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getBackendApi } from '../api';

const Setup = () => {
  const { config, setConfig } = useStore();
  const [formData, setFormData] = useState({
    tmdb_api_key: config?.tmdb_api_key || '',
    jackett_api_key: config?.jackett_api_key || '',
    jackett_ip: config?.jackett_ip || 'localhost',
    jackett_port: config?.jackett_port || 9117,
    backend_url: config?.backend_url || window.location.origin
  });

  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({
    type: 'idle',
    message: ''
  });

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const testJackett = async () => {
    setTestStatus({ type: 'loading', message: 'Testing connection...' });
    try {
      const api = getBackendApi(formData.backend_url);
      const res = await api.post('/api/test-jackett', {
        jackett_ip: formData.jackett_ip,
        jackett_port: formData.jackett_port,
        jackett_api_key: formData.jackett_api_key
      });

      if (res.data.success) {
        setTestStatus({ type: 'success', message: 'Connected successfully!' });
      } else {
        setTestStatus({ type: 'error', message: res.data.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestStatus({ type: 'error', message: err.response?.data?.error || 'Could not reach backend' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const api = getBackendApi(formData.backend_url);
      await api.post('/api/config', formData);
      setConfig(formData); // This will trigger the redirect in App.tsx
    } catch (err) {
      alert('Failed to save configuration. Please ensure the backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm glass";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full glass p-8 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-premium"></div>
        
        <div className="text-center mb-10">
          <div className="mb-4">
            <img src="/favicon.png" alt="Logo" className="w-16 h-16 mx-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          </div>
          <h1 className="text-3xl font-bold">Welcome to StreamFlow</h1>
          <p className="text-muted mt-2">Let's set up your media services</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* TMDB Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-accent-primary font-semibold text-sm">
              <Key size={16} />
              THEMOVIEDB (TMDB) API
            </div>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Enter your TMDB API key"
                required
                className={inputClasses}
                value={formData.tmdb_api_key}
                onChange={(e) => setFormData({...formData, tmdb_api_key: e.target.value})}
              />
              <p className="text-[10px] text-muted flex items-center gap-1 px-1">
                <AlertCircle size={10} />
                Get it from <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-accent-primary hover:underline">themoviedb.org</a>
              </p>
            </div>
          </section>

          {/* Jackett Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-accent-primary font-semibold text-sm">
              <Search size={16} />
              JACKETT CONFIGURATION
            </div>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter your Jackett API key"
                required
                className={inputClasses}
                value={formData.jackett_api_key}
                onChange={(e) => setFormData({...formData, jackett_api_key: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase tracking-wider px-1">Host/IP</label>
                  <input
                    type="text"
                    required
                    className={inputClasses}
                    value={formData.jackett_ip}
                    onChange={(e) => setFormData({...formData, jackett_ip: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase tracking-wider px-1">Port</label>
                  <input
                    type="number"
                    required
                    className={inputClasses}
                    value={formData.jackett_port}
                    onChange={(e) => setFormData({...formData, jackett_port: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={testJackett}
                disabled={testStatus.type === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface hover:bg-white/10 text-sm font-medium transition-colors border border-white/5 disabled:opacity-50"
              >
                {testStatus.type === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Network size={16} />}
                Test Jackett
              </button>
              
              <AnimatePresence mode="wait">
                {testStatus.message && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`text-xs font-medium flex items-center gap-1.5 ${testStatus.type === 'success' ? 'text-accent-secondary' : 'text-accent-danger'}`}
                  >
                    {testStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {testStatus.message}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Advanced Section */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center gap-2 text-muted hover:text-white transition-colors text-xs font-medium"
            >
              <ChevronRight size={14} className={`transform transition-transform ${isAdvancedOpen ? 'rotate-90' : ''}`} />
              Advanced Settings
            </button>
            
            <AnimatePresence>
              {isAdvancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-2">
                    <label className="text-[10px] text-muted uppercase tracking-wider px-1 flex items-center gap-1">
                      <Server size={10} /> Backend URL
                    </label>
                    <input
                      type="url"
                      className={inputClasses}
                      value={formData.backend_url}
                      onChange={(e) => setFormData({...formData, backend_url: e.target.value})}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-premium hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
            Complete Setup
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Setup;
