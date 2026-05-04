import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Key, Server, CheckCircle, Network, ChevronRight,
  AlertCircle, Loader2, User, Lock, UserPlus, LogIn,
  Smartphone, Clock
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { 
  getBackendApi, loginUser, registerUser, 
  deleteCurrentUser, pollQuickConnectStatus, 
  generateQuickConnectCode, fetchProfiles, loginProfile
} from '../api';

const Setup = () => {
  const { config, setConfig, login, logout, showToast, isAuthenticated, user } = useStore();
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'quick' | 'profiles'>('signup');
  const [quickCode, setQuickCode] = useState<{ code: string, expiresAt: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [profiles, setProfiles] = useState<any[]>([]);
  
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
    subtitle_api_key: config?.subtitle_api_key || '',
    setup_complete: config?.setup_complete || false
  });

  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({
    type: 'idle',
    message: ''
  });

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for Quick Connect status
  useEffect(() => {
    let pollInterval: any;
    let timerInterval: any;

    if (authMode === 'quick' && !quickCode && !isLoading) {
      const initQuickConnect = async () => {
        setIsLoading(true);
        try {
          const deviceName = `${window.navigator.platform} (${window.navigator.appName})`;
          const res = await generateQuickConnectCode(formData.backend_url, deviceName);
          if (res.success) {
            setQuickCode({ code: res.code, expiresAt: res.expiresAt });
          }
        } catch (err) {
          showToast('Failed to initialize Quick Connect', 'error');
        } finally {
          setIsLoading(false);
        }
      };
      initQuickConnect();
    }

    if (quickCode) {
      // Countdown timer
      timerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((quickCode.expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) setQuickCode(null);
      }, 1000);

      // Status polling
      pollInterval = setInterval(async () => {
        try {
          const res = await pollQuickConnectStatus(formData.backend_url, quickCode.code);
          if (res.success && res.status === 'authorized') {
            login({ username: res.user.username, token: res.token }, res.user);
            showToast('Device linked successfully!', 'success');
            if (res.user.config) {
              setFormData(f => ({ ...f, ...res.user.config }));
            }
            setStep(2);
          }
        } catch (err) {
          // Silent fail on polling errors
        }
      }, 3000);
    }

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [authMode, quickCode, formData.backend_url, isLoading]);

  useEffect(() => {
    if (step === 1 && !isAuthenticated()) {
      const loadProfiles = async () => {
        try {
          const res = await fetchProfiles(formData.backend_url);
          if (res.success && res.users && res.users.length > 0) {
            setProfiles(res.users);
            setAuthMode('profiles');
          }
        } catch (err) {
          // Silent fail
        }
      };
      loadProfiles();
    }
  }, [formData.backend_url, isAuthenticated, step]);

  useEffect(() => {
    if (isAuthenticated() && step === 1) {
      setStep(2);
    }
  }, [isAuthenticated, step]);

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

  const handleProfileLogin = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await loginProfile(formData.backend_url, userId);
      if (res.success) {
        login({ username: res.user.username, token: res.token }, res.user);
        showToast(`Welcome back, ${res.user.username}!`, 'success');
        setStep(2);
        if (res.user.config) {
          setFormData(f => ({ ...f, ...res.user.config }));
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to login with profile', 'error');
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

  const handleBackToAuth = async () => {
    if (isAuthenticated()) {
      try {
        setIsLoading(true);
        if (user?.token) {
          await deleteCurrentUser(formData.backend_url, user.token);
        }
        logout();
        showToast('Account deleted and logged out.', 'info');
      } catch (err) {
        console.error('Failed to delete account:', err);
        logout(); // Ensure we still logout even if delete fails
      } finally {
        setIsLoading(false);
      }
    }
    setStep(1);
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const api = getBackendApi(formData.backend_url, user?.token);
      
      const configToSave = {
        ...formData,
        setup_complete: true
      };

      // Update global config
      await api.post('/api/config', configToSave);
      
      // Update user-specific config if logged in
      if (user?.token) {
        await api.post('/api/user/data', {
          config: configToSave
        });
      }

      setConfig(configToSave);
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
              ? (authMode === 'signup' ? 'Create an account to get started' : 'Login to your existing account')
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
            <motion.div 
              key={authMode === 'quick' ? 'quick-step' : 'auth-step'}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="space-y-6"
            >
              {authMode === 'profiles' ? (
                <div className="space-y-8 pb-4">
                  <div className="text-center space-y-2 mb-8">
                    <h3 className="font-bold text-xl">Who's watching?</h3>
                    <p className="text-sm text-muted">Select your profile to continue</p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-8">
                    {profiles.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProfileLogin(p.id)}
                        disabled={isLoading}
                        className="flex flex-col items-center gap-4 group transition-all hover:scale-105 disabled:opacity-50"
                      >
                        <div 
                          className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg border-4 border-transparent group-hover:border-white transition-all shadow-black/50 overflow-hidden"
                          style={{ backgroundColor: !p.avatar ? p.accent_color : 'transparent' }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-5xl font-black text-white drop-shadow-md">{p.username.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="font-bold text-muted group-hover:text-white transition-colors">{p.username}</span>
                      </button>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      disabled={isLoading}
                      className="flex flex-col items-center gap-4 group transition-all hover:scale-105 disabled:opacity-50"
                    >
                      <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg border-4 border-white/10 bg-white/5 group-hover:border-white/30 transition-all">
                        <UserPlus size={40} className="text-muted group-hover:text-white transition-colors" />
                      </div>
                      <span className="font-bold text-muted group-hover:text-white transition-colors">Add Profile</span>
                    </button>
                  </div>
                </div>
              ) : authMode === 'quick' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-accent-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-accent-primary/20">
                      <Smartphone className="text-accent-primary" size={28} />
                    </div>
                    <div className="text-center space-y-2 mb-8">
                      <h3 className="font-bold text-lg">Quick Connect</h3>
                      <p className="text-xs text-muted">Enter this code on your already logged-in device</p>
                    </div>

                    {!quickCode ? (
                       <div className="py-8 flex justify-center">
                         <Loader2 className="text-accent-primary animate-spin" size={32} />
                       </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-accent-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="text-5xl font-black tracking-[0.3em] text-white font-mono relative z-10">
                            {quickCode.code}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/10">
                            <Clock size={12} className={timeLeft < 60 ? 'text-accent-danger animate-pulse' : 'text-accent-primary'} />
                            <span className={timeLeft < 60 ? 'text-accent-danger' : 'text-muted'}>
                              Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-accent-primary font-bold animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                            Waiting for authorization...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => setQuickCode(null)}
                      className="w-full text-[10px] text-muted font-black uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Generate New Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="w-full text-xs text-muted font-bold hover:text-white transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAuth} className="space-y-6">
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
                    
                    <div className="mt-6 flex flex-col gap-3 items-center">
                      <p className="text-xs text-muted">
                        {authMode === 'signup' ? 'Already have an account?' : 'Need a new account?'}
                        <button
                          type="button"
                          onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                          className="ml-1 text-accent-primary font-bold hover:underline"
                        >
                          {authMode === 'signup' ? 'Login' : 'Sign Up'}
                        </button>
                      </p>
                      
                      <div className="h-px w-20 bg-white/5 my-1"></div>

                      <button
                        type="button"
                        onClick={() => setAuthMode('quick')}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent-primary transition-all"
                      >
                        <Smartphone size={14} />
                        Login with Quick Connect
                      </button>
                      
                      {profiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAuthMode('profiles')}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted hover:text-accent-primary transition-all mt-2"
                        >
                          <User size={14} />
                          Back to Profiles
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
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
                <button
                  type="button"
                  onClick={handleBackToAuth}
                  className="flex-1 px-6 py-4 rounded-2xl bg-surface border border-white/10 text-sm font-bold text-muted hover:text-white transition-all shadow-lg flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] bg-gradient-premium hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                  Complete Setup
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
