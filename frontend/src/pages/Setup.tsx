import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Key, Server, CheckCircle, Network, ChevronRight, 
  AlertCircle, Loader2, User, Lock, UserPlus, LogIn, Mail
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getBackendApi, loginUser, registerUser } from '../api';

const Setup = () => {
  const { config, setConfig, login, showToast, isAuthenticated } = useStore();
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  
  const [authData, setAuthData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [formData, setFormData] = useState({
    tmdb_api_key: config?.tmdb_api_key || '',
    jackett_api_key: config?.jackett_api_key || '',
    jackett_ip: config?.jackett_ip || 'localhost',
    jackett_port: config?.jackett_port || 9117,
    backend_url: config?.backend_url || window.location.origin,
    subtitle_api_key: config?.subtitle_api_key || ''
  });

  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({
    type: 'idle',
    message: ''
  });

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      setStep(2);
    }
  }, [isAuthenticated]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authMode === 'signup' && authData.password !== authData.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const authFunc = authMode === 'login' ? loginUser : registerUser;
      const res = await authFunc(formData.backend_url, authData);
      
      if (res.success) {
        login({ username: res.user.username, token: res.token }, res.user);
        
        if (authMode === 'login' && res.user.config && res.user.config.tmdb_api_key) {
          showToast(`Welcome back, ${res.user.username}!`, 'success');
        } else {
          setStep(2);
          if (res.user.config) {
            setFormData({ ...formData, ...res.user.config });
          }
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Authentication failed. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const api = getBackendApi(formData.backend_url);
      await api.post('/api/config', formData);
      setConfig(formData);
      showToast('Configuration saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save configuration', 'error');
    } finally {
      setIsLoading(false);
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
          <h1 className="text-3xl font-bold">
            {step === 1 ? 'Welcome to StreamFlow' : 'Service Configuration'}
          </h1>
          <p className="text-muted mt-2">
            {step === 1 
              ? authMode === 'signup' ? 'Create an account to get started' : 'Login to your existing account'
              : 'Configure your API keys and media services'}
          </p>
        </div>

        {/* Step Indicator */}
        {!isAuthenticated() && (
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-accent-primary' : 'bg-white/10'}`}></div>
            <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-accent-primary' : 'bg-white/10'}`}></div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form 
              key="auth-step"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleAuth} 
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase tracking-wider px-1 flex items-center gap-2">
                    <User size={12} /> Username
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    required
                    className={inputClasses}
                    value={authData.username}
                    onChange={(e) => setAuthData({...authData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-muted uppercase tracking-wider px-1 flex items-center gap-2">
                    <Lock size={12} /> Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    required
                    className={inputClasses}
                    value={authData.password}
                    onChange={(e) => setAuthData({...authData, password: e.target.value})}
                  />
                </div>
                {authMode === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-[10px] text-muted uppercase tracking-wider px-1 flex items-center gap-2">
                      <Lock size={12} /> Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm your password"
                      required
                      className={inputClasses}
                      value={authData.confirmPassword}
                      onChange={(e) => setAuthData({...authData, confirmPassword: e.target.value})}
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-premium hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : authMode === 'signup' ? <UserPlus size={20} /> : <LogIn size={20} />}
                  {authMode === 'signup' ? 'Create Account' : 'Login Now'}
                </button>
                
                <p className="text-center mt-4 text-xs text-muted">
                  {authMode === 'signup' ? 'Already have an account?' : 'Need a new account?'}
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                    className="ml-1 text-accent-primary font-bold hover:underline"
                  >
                    {authMode === 'signup' ? 'Login' : 'Sign Up'}
                  </button>
                </p>
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="config-step"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleConfigSubmit} 
              className="space-y-8"
            >
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

              {/* Subtitle Section (Optional) */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-accent-secondary font-semibold text-sm">
                  <Mail size={16} />
                  SUBTITLE API (OPTIONAL)
                </div>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Enter Subtitle API key (optional)"
                    className={inputClasses}
                    value={formData.subtitle_api_key}
                    onChange={(e) => setFormData({...formData, subtitle_api_key: e.target.value})}
                  />
                  <p className="text-[10px] text-muted flex items-center gap-1 px-1">
                    <AlertCircle size={10} />
                    This feature will be implemented in a future update.
                  </p>
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

              <div className="flex gap-4">
                {!isAuthenticated() && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 px-6 py-4 rounded-2xl bg-surface border border-white/5 text-sm font-bold text-muted hover:text-white transition-all"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`${isAuthenticated() ? 'w-full' : 'flex-[2]'} bg-gradient-premium hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  Save Configuration
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Setup;
