import MainLayout from './layout/MainLayout';
import Home from './pages/Home';
import { useStore } from './store/useStore';

function App() {
  const { currentView } = useStore();

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <Home />;
      case 'discover':
        return <div className="text-center py-20 text-muted">Discover Page Coming Soon</div>;
      case 'lists':
        return <div className="text-center py-20 text-muted">My Lists Coming Soon</div>;
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
