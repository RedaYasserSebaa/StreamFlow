import { useEffect } from 'react';
import Home from './pages/Home';
import Setup from './pages/Setup';
import Discover from './pages/Discover';
import MyLists from './pages/MyLists';
import Settings from './pages/Settings';
import SearchResults from './pages/SearchResults';
import MainLayout from './layout/MainLayout';
import { useStore } from './store/useStore';
import Toast from './components/common/Toast';

function App() {
  const { currentView, isConfigured, searchQuery, isAuthenticated, config } = useStore();

  useEffect(() => {
    if (config?.accent_color) {
      document.documentElement.style.setProperty('--accent-primary', config.accent_color);
    }
    if (config?.glass_intensity !== undefined) {
      document.documentElement.style.setProperty('--glass-blur', `${config.glass_intensity}px`);
    }
  }, [config?.accent_color, config?.glass_intensity]);

  if (!isAuthenticated() || !isConfigured()) {
    return (
      <>
        <Setup />
        <Toast />
      </>
    );
  }

  const renderContent = () => {
    if (searchQuery.trim().length > 0) {
      return <SearchResults />;
    }

    switch (currentView) {
      case 'home':
        return <Home />;
      case 'discover':
        return <Discover />;
      case 'lists':
        return <MyLists />;
      case 'settings':
        return <Settings />;
      default:
        return <Home />;
    }
  };

  return (
    <>
      <MainLayout>
        {renderContent()}
      </MainLayout>
      <Toast />
    </>
  );
}

export default App;
