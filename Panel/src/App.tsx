import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import TopNavBar from './components/layout/TopNavBar';
import PageWrapper from './components/layout/PageWrapper';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Alerts from './pages/Alerts';
import DevLogs from './pages/DevLogs';
import StationDetail from './pages/StationDetail';
import TimeSeriesLab from './pages/TimeSeriesLab';
import MLPortal from './pages/MLPortal';
import ConnectionStatus from './pages/ConnectionStatus';
import NSCDetails from './pages/NSCDetails';
import MapBuilder from './pages/MapBuilder';
import BottomTabBar from './components/layout/BottomTabBar';

function AppShell() {
  const { isConnected } = useWebSocket();

  return (
    <div className="min-h-screen text-gray-100 antialiased selection:bg-blue-500/30 flex flex-col relative overflow-x-hidden">
      {/* Background elements */}
      <div className="star-field"></div>
      <div className="nebula-glow-teal"></div>
      <div className="nebula-glow-violet"></div>

      <TopNavBar isConnected={isConnected} />

      <main className="flex-1 relative z-10 pb-24 md:pb-6">
        <PageWrapper>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/timeseries" element={<TimeSeriesLab />} />
            <Route path="/ml" element={<MLPortal />} />
            <Route path="/map-builder" element={<MapBuilder />} />
            <Route path="/status" element={<ConnectionStatus />} />
            <Route path="/station/:id" element={<StationDetail />} />
            <Route path="/history" element={<History />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/dev/logs" element={<DevLogs />} />
            <Route path="/nsc" element={<NSCDetails />} />
          </Routes>
        </PageWrapper>
      </main>

      <BottomTabBar />

      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
