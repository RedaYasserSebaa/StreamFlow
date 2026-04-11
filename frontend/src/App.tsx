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
  const { currentView, isConfigured, searchQuery, isAuthenticated } = useStore();

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
