import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Lock, Key, Search, HardDrive, Save, 
  CheckCircle, Loader2, Network, ShieldCheck,
  ChevronRight, Laptop, FolderOpen, Database, Zap, Smartphone
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getBackendApi, changePassword, authorizeQuickConnectDevice } from '../api';

const Settings = () => {
  const { config, setConfig, user, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<'quick' | 'profile' | 'config' | 'local'>('quick');
  const [isLoading, setIsLoading] = useState(false);

  // Quick Connect State
  const [connectCode, setConnectCode] = useState('');

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

  const [formData, setFormData] = useState({
    tmdb_api_key: config?.tmdb_api_key || '',
    jackett_api_key: config?.jackett_api_key || '',
    jackett_ip: config?.jackett_ip || 'localhost',
    jackett_port: config?.jackett_port || 9117,
    backend_url: config?.backend_url || window.location.origin,
    subtitle_api_key: config?.subtitle_api_key || '',
    movies_path: config?.movies_path || '',
    tv_shows_path: config?.tv_shows_path || '',
    setup_complete: config?.setup_complete || true
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

  const handleConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const api = getBackendApi(formData.backend_url);
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

  const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:border-accent-primary transition-all text-sm";
  const labelClasses = "text-[10px] text-muted uppercase tracking-widest font-black mb-1.5 flex items-center gap-2";

  const tabs = [
    { id: 'quick', label: 'Quick Connect', icon: Smartphone },
    { id: 'profile', label: 'User Info & Password', icon: User },
    { id: 'config', label: 'Configurations Settings', icon: Key },
    { id: 'local', label: 'Local Files', icon: HardDrive },
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
              onClick={() => setActiveTab(tab.id)}
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
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
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
                    <p className="text-sm text-muted">Update your account password</p>
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
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div
                key="config"
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
                        value={formData.tmdb_api_key}
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
                        value={formData.jackett_api_key}
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

            {activeTab === 'local' && (
              <motion.div
                key="local"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-accent-secondary/10 border border-accent-secondary/20">
                    <FolderOpen className="text-accent-secondary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">Local Library Paths</h2>
                    <p className="text-sm text-muted">Point StreamFlow to your stored media collections</p>
                  </div>
                </div>

                <form onSubmit={handleConfigSave} className="space-y-6 max-w-2xl">
                  <div className="glass p-8 rounded-3xl border border-white/10 space-y-6">
                    <div className="space-y-2">
                      <label className={labelClasses}><HardDrive size={14} className="text-accent-secondary" /> Movies Folder Path</label>
                      <input 
                        type="text" 
                        placeholder="e.g. C:\MyMedia\Movies"
                        className={inputClasses}
                        value={formData.movies_path}
                        onChange={(e) => setFormData({...formData, movies_path: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}><HardDrive size={14} className="text-accent-secondary" /> TV Shows Folder Path</label>
                      <input 
                        type="text" 
                        placeholder="e.g. C:\MyMedia\TV"
                        className={inputClasses}
                        value={formData.tv_shows_path}
                        onChange={(e) => setFormData({...formData, tv_shows_path: e.target.value})}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-premium text-white text-sm font-black hover:shadow-lg hover:shadow-accent-primary/30 transition-all disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Library Paths
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
