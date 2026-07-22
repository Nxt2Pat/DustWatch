import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useWebSocket from './hooks/useWebSocket';
import { useStore } from './store';
import { request } from './api/client';
import TopNavBar from './components/layout/TopNavBar';
import BottomTabBar from './components/layout/BottomTabBar';
import PageWrapper from './components/layout/PageWrapper';
import Footer from './components/layout/Footer';
import type { NodeMeta, NodeData, AlertData } from './types/sensor';

import DynamicBackground from './components/layout/DynamicBackground';

// Pages
import Dashboard from './pages/Dashboard';
import CampusMapPage from './pages/CampusMapPage';
import Analyser from './pages/Analyser';
import Forecast from './pages/Forecast';
import Export from './pages/Export';
import Status from './pages/Status';
import StationDetailPage from './pages/StationDetailPage';

function AppShell() {
  const { isConnected } = useWebSocket();
  const setInitialNodes = useStore((state) => state.setInitialNodes);
  const setNodesMeta = useStore((state) => state.setNodesMeta);
  const setInitialAlerts = useStore((state) => state.setInitialAlerts);

  useEffect(() => {
    // 1. Fetch Node configuration metadata from SQLite
    const fetchNodesMeta = async () => {
      const response = await request<NodeMeta[]>('/nodes');
      if (response.ok && response.data) {
        const metaMap: Record<string, NodeMeta> = {};
        response.data.forEach((node) => {
          metaMap[node.id] = node;
        });
        setNodesMeta(metaMap);
      } else {
        console.error('ไม่สามารถดึงข้อมูลรายชื่อสถานี:', response.error);
      }
    };

    // 2. Fetch Latest Readings Cache from memory cache
    const fetchLatestReadings = async () => {
      const response = await request<Record<string, NodeData>>('/readings');
      if (response.ok && response.data) {
        setInitialNodes(response.data);
      } else {
        console.error('ไม่สามารถดึงข้อมูลเซนเซอร์ล่าสุด:', response.error);
      }
    };

    // 3. Fetch Alerts history logs
    const fetchAlertsHistory = async () => {
      const response = await request<AlertData[]>('/alerts?limit=100');
      if (response.ok && response.data) {
        setInitialAlerts(response.data);
      } else {
        console.error('ไม่สามารถดึงประวัติการแจ้งเตือน:', response.error);
      }
    };

    fetchNodesMeta();
    fetchLatestReadings();
    fetchAlertsHistory();
  }, [setInitialNodes, setNodesMeta, setInitialAlerts]);

  return (
    <div className="min-h-screen text-slate-800 antialiased flex flex-col relative overflow-x-hidden bg-slate-50">
      {/* Dynamic Background Layer */}
      <DynamicBackground />

      {/* Light Ambient Accent Blobs */}
      <div className="fixed -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-emerald-100/40 filter blur-[80px] pointer-events-none z-0" />
      <div className="fixed top-1/3 -left-20 w-[400px] h-[400px] rounded-full bg-teal-100/30 filter blur-[70px] pointer-events-none z-0" />"

      {/* Main Layout Shell */}
      <TopNavBar isConnected={isConnected} />

      <main className="flex-1 relative z-10 pb-20 md:pb-6 px-3 sm:px-6 pt-4">
        <PageWrapper>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/station/:id" element={<StationDetailPage />} />
            <Route path="/map" element={<CampusMapPage />} />
            <Route path="/analyser" element={<Analyser />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/export" element={<Export />} />
            <Route path="/status" element={<Status />} />
          </Routes>
        </PageWrapper>
      </main>"

      <BottomTabBar />
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;

