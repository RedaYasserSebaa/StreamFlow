import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Key, Search, Save,
  CheckCircle, Loader2, Network, ShieldCheck,
  ChevronRight, Laptop, Database, Zap, Smartphone,
  RefreshCw, Trash2
} from 'lucide-react';
import type { UserConfig } from '../types';
import { useStore } from '../store/useStore';
import { 
  getBackendApi, 
  changePassword, 
  authorizeQuickConnectDevice, 
  logoutUser,
  fetchUserSessions,
  revokeSession
} from '../api';

const Settings = () => {
  const { config, setConfig, user, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<'quick' | 'security' | 'services' | 'player' | 'tuning'>('quick');
  const [isLoading, setIsLoading] = useState(false);

  // Quick Connect State
  const [connectCode, setConnectCode] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [isFetchingSessions, setIsFetchingSessions] = useState(false);

  const loadSessions = async () => {
    if (!config?.backend_url || !user?.token) return;
    setIsFetchingSessions(true);
    try {
      const res = await fetchUserSessions(config.backend_url, user.token);
      if (res.success) {
        setSessions(res.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setIsFetchingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!config?.backend_url || !user?.token) return;
    try {
      const res = await revokeSession(config.backend_url, user.token, sessionId);
      if (res.success) {
        showToast('Device disconnected successfully', 'success');
        loadSessions();
      }
    } catch (err) {
      showToast('Failed to disconnect device', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'quick') {
      loadSessions();
    }
  }, []);

  // Re-fetch when tab changes to quick
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'quick') {
      loadSessions();
    }
  };

  const handleAuthorizeDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (connectCode.length !== 6) {
      showToast('Please enter a 6-character code', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (!user?.token || !config?.backend_url) return;
      const res = await authorizeQuickConnectDevice(config.backend_url, user.token, connectCode);
      if (res.success) {
        showToast('Device authorized successfully!', 'success');
        setConnectCode('');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to authorize device', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Form States
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [formData, setFormData] = useState<UserConfig>({
    tmdb_api_key: config?.tmdb_api_key || '',
    jackett_api_key: config?.jackett_api_key || '',
    jackett_ip: config?.jackett_ip || 'localhost',
    jackett_port: config?.jackett_port || 9117,
    backend_url: config?.backend_url || window.location.origin,
    subtitle_api_key: config?.subtitle_api_key || '',
    setup_complete: config?.setup_complete || true,
    avatar: config?.avatar || '',
    
    metadata_language: config?.metadata_language || 'en-US',
    accent_color: config?.accent_color || '#3b82f6',
    glass_intensity: config?.glass_intensity || 12,
    autoplay: config?.autoplay ?? true,
    seek_interval: config?.seek_interval || 10,
    default_language: config?.default_language || 'en',
    min_seeders: config?.min_seeders || 1,
    exclude_keywords: config?.exclude_keywords ?? ''
  });

  const [testStatus, setTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({
    type: 'idle',
    message: ''
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (!user?.token || !config?.backend_url) return;
      await changePassword(config.backend_url, user.token, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      showToast('Password updated successfuly', 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update password', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      if (!user?.token || !config?.backend_url) return;
      await axios.delete(`${config.backend_url}/api/auth/delete-me`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      showToast('Account deleted successfully', 'success');
      logoutUser();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete account', 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!user?.token) throw new Error('Not authenticated');
      
      const api = getBackendApi(formData.backend_url, user.token);
      
      // Update user-specific data
      await api.post('/api/user/data', {
        config: formData
      });
      
      // Also update global config if this is the first setup or for backward compatibility
      // But primarily we care about the user matching what they see
      await api.post('/api/config', formData);
      
      setConfig(formData);
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const testJackett = async () => {
    setTestStatus({ type: 'loading', message: 'Testing...' });
    try {
      const api = getBackendApi(formData.backend_url);
      const res = await api.post('/api/test-jackett', {
        jackett_ip: formData.jackett_ip,
        jackett_port: formData.jackett_port,
        jackett_api_key: formData.jackett_api_key
      });

      if (res.data.success) {
        setTestStatus({ type: 'success', message: 'Connected!' });
      } else {
        setTestStatus({ type: 'error', message: res.data.error || 'Failed' });
      }
    } catch (err: any) {
      setTestStatus({ type: 'error', message: 'Error' });
    }
  };



  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setFormData((f: UserConfig) => ({ ...f, avatar: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:border-accent-primary transition-all text-sm";
  const labelClasses = "text-[10px] text-muted uppercase tracking-widest font-black mb-1.5 flex items-center gap-2";

  const tabs = [
    { id: 'quick', label: 'Quick Connect', icon: Smartphone },
    { id: 'security', label: 'User Security', icon: ShieldCheck },
    { id: 'services', label: 'Media Services', icon: Laptop },
    { id: 'player', label: 'Interface & Player', icon: Zap },
    { id: 'tuning', label: 'Search Tuning', icon: Search },
  ] as const;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Settings Sub-Sidebar */}
      <div className="w-72 h-full border-r border-white/5 bg-black/20 p-8 flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-3">
            <Database className="text-accent-primary" size={20} />
            Settings
          </h1>
          <p className="text-[10px] text-muted uppercase tracking-widest font-bold mt-1">Manage your experience</p>
        </div>

        <nav className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group ${activeTab === tab.id ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-muted hover:text-white hover:bg-white/5'}`}
            >
              <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : 'text-accent-primary group-hover:scale-110 transition-transform'} />
              <span className="text-xs font-bold tracking-tight">{tab.label}</span>
              {activeTab === tab.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5">
          <p className="text-[10px] text-muted font-bold leading-relaxed uppercase tracking-widest opacity-60">
            Current User
          </p>
          <p className="text-xs font-black text-white truncate mt-1">{user?.username || 'Guest'}</p>
        </div>
      </div>

      {/* Settings Content Area */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-accent-primary/5 via-transparent to-transparent">
        <div className="max-w-4xl mx-auto p-12">
          <AnimatePresence mode="wait">
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-accent-primary/10 border border-accent-primary/20">
                    <ShieldCheck className="text-accent-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Security Settings</h2>
                    <p className="text-sm text-muted">Update your account password and security preferences</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="glass p-8 rounded-3xl border border-white/10 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                       <label className={labelClasses}><Lock size={12} /> Current Password</label>
                       <input
                         type="password"
                         className={inputClasses}
                         placeholder="Confirm your current identity"
                         required
                         value={passwordData.currentPassword}
                         onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className={labelClasses}><Key size={12} /> New Password</label>
                       <input
                         type="password"
                         className={inputClasses}
                         placeholder="Choose a strong password"
                         required
                         value={passwordData.newPassword}
                         onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className={labelClasses}><CheckCircle size={12} /> Confirm New Password</label>
                       <input
                         type="password"
                         className={inputClasses}
                         placeholder="Repeat your new password"
                         required
                         value={passwordData.confirmPassword}
                         onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                       />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-premium text-white text-sm font-black hover:shadow-lg hover:shadow-accent-primary/30 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Update Password
                  </button>
                </form>

                <div className="border-t border-white/10 pt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <Trash2 className="text-red-500" size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">Delete Account</h2>
                      <p className="text-sm text-muted">Permanently remove your account and all data</p>
                    </div>
                  </div>
                  <div className="glass p-6 rounded-3xl border border-red-500/20">
                    <p className="text-sm text-red-400/80 mb-6">
                      This action cannot be undone. Your account, watch history, and preferences will be permanently deleted.
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="px-6 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-black"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>

                {showDeleteModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass max-w-md w-full p-8 rounded-3xl border border-red-500/20"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-2xl bg-red-500/20">
                          <Trash2 className="text-red-500" size={28} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white">Delete Account?</h3>
                          <p className="text-sm text-muted">This cannot be undone</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted mb-8">
                        Are you sure you want to delete your account? All your data including watch history, lists, and preferences will be permanently removed.
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(false)}
                          disabled={isDeleting}
                          className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-sm font-black disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all text-sm font-black disabled:opacity-50"
                        >
                          {isDeleting ? <Loader2 size={18} className="animate-spin" /> : 'Yes, Delete'}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'services' && (
              <motion.div
                key="services"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-accent-primary/10 border border-accent-primary/20">
                    <Laptop className="text-accent-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Service Connectivity</h2>
                    <p className="text-sm text-muted">Configure your API providers and backend services</p>
                  </div>
                </div>

                <form onSubmit={handleConfigSave} className="space-y-6 max-w-2xl">
                  <div className="glass p-8 rounded-3xl border border-white/10 space-y-8">
                    {/* TMDB */}
                    <div className="space-y-4">
                      <label className={labelClasses}><Search size={14} className="text-accent-primary" /> TMDB API Key</label>
                      <input 
                        type="password" 
                        className={inputClasses}
                        value={formData.tmdb_api_key || ''}
                        onChange={(e) => setFormData({...formData, tmdb_api_key: e.target.value})}
                      />
                    </div>

                    {/* Jackett */}
                    <div className="space-y-6 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className={labelClasses}><Network size={14} className="text-accent-primary" /> Jackett Search Engine</label>
                        <button 
                          type="button"
                          onClick={testJackett}
                          className="text-[10px] font-black text-accent-primary hover:underline flex items-center gap-1 uppercase tracking-widest"
                        >
                          {testStatus.type === 'loading' ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                          Test Connection
                        </button>
                      </div>
                      <input 
                        type="password" 
                        placeholder="Jackett API Key"
                        className={inputClasses}
                        value={formData.jackett_api_key || ''}
                        onChange={(e) => setFormData({...formData, jackett_api_key: e.target.value})}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          type="text" 
                          placeholder="Host (e.g. localhost)"
                          className={inputClasses}
                          value={formData.jackett_ip}
                          onChange={(e) => setFormData({...formData, jackett_ip: e.target.value})}
                        />
                        <input 
                          type="number" 
                          placeholder="Port"
                          className={inputClasses}
                          value={formData.jackett_port}
                          onChange={(e) => setFormData({...formData, jackett_port: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-premium text-white text-sm font-black hover:shadow-lg hover:shadow-accent-primary/30 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Configuration
                  </button>
                </form>
              </motion.div>
            )}



            {activeTab === 'player' && (
              <motion.div
                key="player"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-accent-primary/10 border border-accent-primary/20">
                    <Zap className="text-accent-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Interface & Player</h2>
                    <p className="text-sm text-muted">Customize how the application looks and behaves</p>
                  </div>
                </div>

                <form onSubmit={handleConfigSave} className="space-y-6 max-w-2xl">
                  {/* Appearance */}
                  <div className="glass p-8 rounded-3xl border border-white/10 space-y-8">
                    <div className="space-y-4">
                      <label className={labelClasses}>Profile Avatar</label>
                      <div className="flex items-center gap-6">
                        <div 
                          className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-lg"
                          style={{ backgroundColor: !formData.avatar ? formData.accent_color : 'transparent' }}
                        >
                          {formData.avatar ? (
                            <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl font-black text-white drop-shadow-md">{user?.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-xs font-bold text-white cursor-pointer inline-block">
                            Upload Image
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleAvatarUpload}
                            />
                          </label>
                          <p className="text-[10px] text-muted">Recommended: Square image, max 5MB. Will be resized to 256x256.</p>
                          {formData.avatar && (
                            <button
                              type="button"
                              onClick={() => setFormData((f: UserConfig) => ({ ...f, avatar: '' }))}
                              className="text-[10px] text-accent-danger hover:underline font-bold block"
                            >
                              Remove Avatar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <label className={labelClasses}>Accent Color Theme</label>
                      <div className="flex flex-wrap gap-3">
                        {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'].map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setFormData({...formData, accent_color: color})}
                            className={`w-10 h-10 rounded-full border-4 transition-all ${formData.accent_color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center text-[10px] text-muted font-bold uppercase mb-1">
                        <span>Glassmorphism Blur</span>
                        <span className="text-accent-primary">{formData.glass_intensity}px</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="24"
                        value={formData.glass_intensity}
                        onChange={(e) => setFormData({...formData, glass_intensity: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-primary"
                      />
                    </div>
                  </div>

                  {/* Player Preferences */}
                  <div className="glass p-8 rounded-3xl border border-white/10 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold text-white">Autoplay Next Episode</label>
                        <p className="text-[10px] text-muted">Automatically play the next episode when current ends</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, autoplay: !formData.autoplay})}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.autoplay ? 'bg-accent-primary' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.autoplay ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                        <label className={labelClasses}>Seek Interval</label>
                        <select 
                          className="premium-select"
                          value={formData.seek_interval}
                          onChange={(e) => setFormData({...formData, seek_interval: parseInt(e.target.value)})}
                        >
                          <option value={5}>5 Seconds</option>
                          <option value={10}>10 Seconds (Default)</option>
                          <option value={15}>15 Seconds</option>
                          <option value={30}>30 Seconds</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClasses}>Default Language</label>
                        <select 
                          className="premium-select"
                          value={formData.default_language}
                          onChange={(e) => setFormData({...formData, default_language: e.target.value})}
                        >
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                          <option value="ar">Arabic</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-premium text-white text-sm font-black hover:shadow-lg hover:shadow-accent-primary/30 transition-all"
                  >
                    <Save size={18} />
                    Save Preferences
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'tuning' && (
              <motion.div
                key="tuning"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-accent-primary/10 border border-accent-primary/20">
                    <Search className="text-accent-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Search Tuning</h2>
                    <p className="text-sm text-muted">Optimize stream discovery and metadata quality</p>
                  </div>
                </div>

                <form onSubmit={handleConfigSave} className="space-y-6 max-w-2xl">
                  <div className="glass p-8 rounded-3xl border border-white/10 space-y-8">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-muted font-bold uppercase mb-1">
                        <span>Minimum Seeders</span>
                        <span className="text-accent-primary">{formData.min_seeders}</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={formData.min_seeders}
                        onChange={(e) => setFormData({...formData, min_seeders: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-primary"
                      />
                      <p className="text-[10px] text-muted italic mt-1">Streams with fewer seeders will be hidden from results.</p>
                    </div>

                    <div className="space-y-2 pt-6 border-t border-white/5">
                      <label className={labelClasses}>Exclude Keywords</label>
                      <textarea 
                        className={`${inputClasses} h-24 resize-none`}
                        placeholder="e.g. CAM, TS, HDCAM, TeleSync"
                        value={formData.exclude_keywords}
                        onChange={(e) => setFormData({...formData, exclude_keywords: e.target.value})}
                      />
                      <p className="text-[10px] text-muted">Separate keywords with commas. Results containing these words will be filtered out.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-6 border-t border-white/5">
                      <div className="space-y-2">
                        <label className={labelClasses}>Metadata Language (TMDB)</label>
                        <select 
                          className="premium-select"
                          value={formData.metadata_language}
                          onChange={(e) => setFormData({...formData, metadata_language: e.target.value})}
                        >
                          <option value="en-US">English (US)</option>
                          <option value="es-ES">Spanish (ES)</option>
                          <option value="fr-FR">French (FR)</option>
                          <option value="de-DE">German (DE)</option>
                          <option value="ar-SA">Arabic (SA)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-premium text-white text-sm font-black hover:shadow-lg hover:shadow-accent-primary/30 transition-all"
                  >
                    <Save size={18} />
                    Save Tuning
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'quick' && (
              <motion.div
                key="quick"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-accent-primary/10 border border-accent-primary/20">
                    <Smartphone className="text-accent-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Quick Connect</h2>
                    <p className="text-sm text-muted">Authorize a new device instantly using its connection code</p>
                  </div>
                </div>

                <div className="max-w-xl space-y-6">
                  <div className="glass p-8 rounded-3xl border border-white/10 space-y-8 text-center">
                    <div className="space-y-6 py-4">
                      <div className="w-20 h-20 bg-accent-primary/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-accent-primary/5">
                        <Zap className="text-accent-primary animate-pulse" size={32} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold">Connect a New Device</h3>
                        <p className="text-sm text-muted px-8">Enter the 6-character code displayed on the device you want to link to your account.</p>
                      </div>

                      <form onSubmit={handleAuthorizeDevice} className="space-y-6">
                        <div className="p-2 bg-white/5 rounded-2xl border border-white/10 max-w-[280px] mx-auto">
                          <input
                            type="text"
                            placeholder="E.G. A1B2C3"
                            required
                            maxLength={6}
                            className="w-full bg-transparent border-none py-4 px-4 text-center text-3xl font-black tracking-[0.4em] focus:ring-0 uppercase placeholder:text-white/10"
                            value={connectCode}
                            onChange={(e) => setConnectCode(e.target.value.toUpperCase())}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="px-12 py-4 rounded-2xl bg-gradient-premium text-white text-sm font-black hover:shadow-lg hover:shadow-accent-primary/30 transition-all disabled:opacity-50 mx-auto flex items-center gap-2"
                        >
                          {isLoading ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                          Authorize Device
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                      <ShieldCheck size={12} /> Security Notice
                    </h4>
                    <p className="text-xs text-muted leading-relaxed">
                      Only authorize devices that you physically control. Authorizing a device gives it full access to your account, search history, and media library.
                    </p>
                  </div>

                  {/* Connected Devices List */}
                  <div className="space-y-6 pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Laptop size={18} className="text-accent-primary" />
                        Connected Devices
                      </h3>
                      <button 
                        onClick={loadSessions}
                        disabled={isFetchingSessions}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted hover:text-white"
                      >
                        <RefreshCw size={14} className={isFetchingSessions ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {isFetchingSessions && sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted gap-3">
                          <Loader2 size={24} className="animate-spin text-accent-primary" />
                          <p className="text-xs font-bold uppercase tracking-widest">Loading sessions...</p>
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="glass p-8 rounded-3xl border border-white/5 text-center space-y-2">
                          <p className="text-sm text-muted font-medium">No other devices connected.</p>
                          <p className="text-[10px] text-muted/60 uppercase tracking-widest font-black">Your current session is managed separately</p>
                        </div>
                      ) : (
                        sessions.map((session) => (
                          <div key={session.id} className="glass p-4 rounded-2xl border border-white/10 flex items-center justify-between group hover:border-accent-primary/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-xl bg-white/5 text-accent-primary group-hover:scale-110 transition-transform">
                                <Smartphone size={20} />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                  {session.deviceName}
                                  {session.ip === '::1' || session.ip === '127.0.0.1' ? (
                                    <span className="text-[8px] bg-accent-primary/20 text-accent-primary px-1.5 py-0.5 rounded-full uppercase font-black">Local</span>
                                  ) : null}
                                </h4>
                                <div className="flex items-center gap-3 mt-1">
                                  <p className="text-[10px] text-muted flex items-center gap-1">
                                    <Network size={10} /> {session.ip}
                                  </p>
                                  <span className="w-1 h-1 rounded-full bg-white/10" />
                                  <p className="text-[10px] text-muted flex items-center gap-1">
                                    <RefreshCw size={10} /> {new Date(session.lastActive).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-all"
                              title="Disconnect Device"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
};

export default Settings;
