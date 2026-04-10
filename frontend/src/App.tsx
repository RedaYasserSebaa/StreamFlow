import Home from './pages/Home';
import Setup from './pages/Setup';
import Discover from './pages/Discover';
import MyLists from './pages/MyLists';
import MainLayout from './layout/MainLayout';
import { useStore } from './store/useStore';

function App() {
  const { currentView, isConfigured } = useStore();

  if (!isConfigured()) {
    return <Setup />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <Home />;
      case 'discover':
        return <Discover />;
      case 'lists':
        return <MyLists />;
      case 'settings':
        return <Setup />;
      default:
        return <Home />;
    }
  };

  return (
    <MainLayout>
      {renderContent()}
    </MainLayout>
  );
}

export default App;
