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

// Pages
import Dashboard from './pages/Dashboard';
import Analyser from './pages/Analyser';
import Forecast from './pages/Forecast';
import Export from './pages/Export';
import Status from './pages/Status';

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
    <div className="min-h-screen text-text-primary antialiased flex flex-col relative overflow-x-hidden">
      {/* Aurora Wash Blobs (WDD §4.1) */}
      <div className="fixed -top-1/10 -right-1/10 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] rounded-full bg-[rgba(125,211,252,0.22)] filter blur-[60px] pointer-events-none z-0 animate-aurora-slow-1" />
      <div className="fixed top-1/5 -left-[15%] w-[70vw] h-[70vw] max-w-[500px] max-h-[500px] rounded-full bg-[rgba(107,94,228,0.10)] filter blur-[55px] pointer-events-none z-0 animate-aurora-slow-2" />
      <div className="fixed bottom-1/10 right-[15%] w-[40vw] h-[40vw] max-w-[300px] max-h-[300px] rounded-full bg-[rgba(232,121,249,0.09)] filter blur-[50px] pointer-events-none z-0 animate-aurora-slow-3" />

      {/* Main Layout Shell */}
      <TopNavBar isConnected={isConnected} />

      <main className="flex-1 relative z-10 pb-24 md:pb-6">
        <PageWrapper>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyser" element={<Analyser />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/export" element={<Export />} />
            <Route path="/status" element={<Status />} />
          </Routes>
        </PageWrapper>
      </main>

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
