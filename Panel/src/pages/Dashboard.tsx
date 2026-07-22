import { useState, useEffect } from 'react';
import { useStore } from '../store';
import type { NodeMeta } from '../store';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import AQIGaugeCard from '../components/cards/AQIGaugeCard';
import SummaryBanner from '../components/layout/SummaryBanner';
import SparkLine from '../components/charts/SparkLine';
import AlertTicker from '../components/alerts/AlertTicker';
import EmptyState from '../components/ui/EmptyState';
import MapPositionEditor from '../components/MapPositionEditor';
import BackgroundManagerModal from '../components/BackgroundManagerModal';

import { getApiBaseUrl } from '../api/sourceConfig';

const API_BASE = getApiBaseUrl();

interface SystemHealth {
  status: string;
  services?: { sqlite?: string; influxdb?: string; mqtt?: string };
  uptime_seconds?: number;
}


export default function Dashboard() {
  useSEO(
    'DustWatch — Real-time Air Quality Network',
    'Real-time PM2.5 monitoring, dynamic AQI gauges, and environment alerts for educational and classroom air quality safety.'
  );

  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);
  const setNodesMeta = useStore((state) => state.setNodesMeta);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedNodeIdForEdit, setSelectedNodeIdForEdit] = useState<string | null>(null);
  const [tempConfigs, setTempConfigs] = useState<Record<string, { active: number; display_name: string; tag: string; status: string; confirmed: number; pos_x: number; pos_y: number; floor: number; image_url: string }>>({});
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  // Fetch backend health on mount and poll every 15s
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/health`);
        const json = await res.json();
        if (json.ok && json.data) setSystemHealth(json.data);
        else if (json.status) setSystemHealth(json as SystemHealth);
      } catch {
        setSystemHealth({ status: 'offline' });
      }
    };
    fetchHealth();
    const timer = setInterval(fetchHealth, 15000);
    return () => clearInterval(timer);
  }, []);;

  // Combine all nodes from nodesMeta and latest to support managing offline stations
  const allNodeIds = Array.from(new Set([...Object.keys(nodesMeta), ...Object.keys(latest)]));

  const visibleNodeEntries = allNodeIds
    .map((id) => {
      const meta = nodesMeta[id];
      const data = latest[id];
      
      if (data) {
        return [id, data] as const;
      }
      
      const placeholderData = {
        reading: {
          node_id: id,
          timestamp: meta?.created_at || new Date().toISOString(),
          location: meta?.location || 'Offline Station',
          pm: { pm1_0: null, pm2_5: null, pm10: null },
          env: { temperature: null, humidity: null, iaq: null },
          sound: { db_avg: null, db_peak: null },
          meta: { rssi: null, uptime_s: null, sim: false }
        },
        aqi: { aqi_score: 0, aqi_level: 'Offline' },
        status: meta?.status || 'unconfirmed',
        dcs: undefined
      };
      
      return [id, placeholderData] as const;
    })
    .filter(([id]) => {
      const meta = nodesMeta[id];
      return !meta || meta.active !== 0;
    });

  const handleOpenSettings = () => {
    const configs: Record<string, { active: number; display_name: string; tag: string; status: string; confirmed: number; pos_x: number; pos_y: number; floor: number; image_url: string }> = {};
    let firstActiveId: string | null = null;
    allNodeIds.forEach((id) => {
      const meta = nodesMeta[id];
      const nodeData = latest[id];
      const active = meta ? meta.active : 1;
      configs[id] = {
        active,
        display_name: meta ? meta.display_name : (nodeData?.reading.location || id),
        tag: meta ? (meta.tag ?? '') : '',
        status: meta ? (meta.status ?? 'unconfirmed') : 'unconfirmed',
        confirmed: meta ? (meta.confirmed ?? 0) : 0,
        pos_x: meta ? (meta.pos_x ?? 0.0) : 0.0,
        pos_y: meta ? (meta.pos_y ?? 0.0) : 0.0,
        floor: meta ? (meta.floor ?? 1) : 1,
        image_url: meta ? (meta.image_url ?? '') : '',
      };
      if (active === 1 && !firstActiveId) {
        firstActiveId = id;
      }
    });
    setTempConfigs(configs);
    setSelectedNodeIdForEdit(firstActiveId || allNodeIds[0] || null);
    setIsSettingsOpen(true);
  };

  const handlePositionChange = (nodeId: string, coords: { pos_x: number; pos_y: number; floor: number }) => {
    setTempConfigs((prev) => {
      const existing = prev[nodeId];
      if (!existing) return prev;
      return {
        ...prev,
        [nodeId]: {
          ...existing,
          pos_x: coords.pos_x,
          pos_y: coords.pos_y,
          floor: coords.floor
        }
      };
    });
  };

  const handleSaveSettings = async () => {
    try {
      const apiBase = getApiBaseUrl();
      await Promise.all(
        Object.entries(tempConfigs).map(async ([id, cfg]) => {
          await fetch(`${apiBase}/api/v1/nodes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg),
          });
        })
      );
      
      // Refetch and update store metadata
      const nodesRes = await fetch(`${apiBase}/api/v1/nodes`);
      const nodesJson = await nodesRes.json();
      if (nodesJson.ok && nodesJson.data) {
        const metaRecord: Record<string, NodeMeta> = {};
        nodesJson.data.forEach((n: any) => {
          metaRecord[n.id] = n;
        });
        setNodesMeta(metaRecord);
      }
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Failed to update node settings", err);
    }
  };

  const [isHealthCustomizerOpen, setIsHealthCustomizerOpen] = useState(false);
  const [healthAnnouncement, setHealthAnnouncement] = useState('');
  const [healthOutdoor, setHealthOutdoor] = useState('');
  const [healthSensitive, setHealthSensitive] = useState('');
  const [healthVentilation, setHealthVentilation] = useState('');
  const [healthSaveMsg, setHealthSaveMsg] = useState<string | null>(null);

  // Load custom health settings when modal opens
  const handleOpenHealthCustomizer = () => {
    try {
      const saved = localStorage.getItem('dustwatch_health_custom_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setHealthAnnouncement(parsed.announcement || '');
        setHealthOutdoor(parsed.outdoor || '');
        setHealthSensitive(parsed.sensitive || '');
        setHealthVentilation(parsed.ventilation || '');
      }
    } catch (e) {
      console.error("Failed to load health settings", e);
    }
    setHealthSaveMsg(null);
    setIsHealthCustomizerOpen(true);
  };

  const handleSaveHealthCustomizer = () => {
    const payload = {
      announcement: healthAnnouncement.trim(),
      outdoor: healthOutdoor.trim(),
      sensitive: healthSensitive.trim(),
      ventilation: healthVentilation.trim(),
    };

    localStorage.setItem('dustwatch_health_custom_settings', JSON.stringify(payload));

    // Broadcast across tabs to frontend
    try {
      const channel = new BroadcastChannel('dustwatch_health_settings');
      channel.postMessage(payload);
      channel.close();
    } catch (e) {
      console.error("Broadcast failed", e);
    }

    setHealthSaveMsg('บันทึกและส่งสัญญาณอัปเดตไปยังหน้าเว็บหลักและมือถือเรียบร้อยแล้ว!');
    setTimeout(() => {
      setHealthSaveMsg(null);
      setIsHealthCustomizerOpen(false);
    }, 1200);
  };

  // ─── Dynamic Background Manager States & Handlers ───
  const [isBgManagerOpen, setIsBgManagerOpen] = useState(false);
  const [bgConfig, setBgConfig] = useState<{
    image_url: string;
    blur_px: number;
    opacity: number;
    overlay_mode: string;
    active: number;
  }>({
    image_url: '',
    blur_px: 4,
    opacity: 0.65,
    overlay_mode: 'dark',
    active: 1
  });
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [bgSaveMsg, setBgSaveMsg] = useState<string | null>(null);

  const handleOpenBgManager = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/system/background`);
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setBgConfig(json.data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch bg config from API', e);
    }
    setIsBgManagerOpen(true);
  };

  const handleUploadBgFile = async (file: File) => {
    setIsUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/system/background/upload`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.ok && json.data?.image_url) {
        setBgConfig(prev => ({ ...prev, image_url: json.data.image_url }));
        setBgSaveMsg('อัปโหลดไฟล์ภาพเรียบร้อยแล้ว');
        setTimeout(() => setBgSaveMsg(null), 3000);
      } else {
        alert(json.error || 'Failed to upload image file');
      }
    } catch (e) {
      console.error('Failed to upload image', e);
      alert('Upload failed');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleSaveBgManager = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/system/background`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bgConfig)
      });
      
      // Save to localStorage & broadcast via BroadcastChannel
      localStorage.setItem('dustwatch_bg_config', JSON.stringify(bgConfig));
      try {
        const channel = new BroadcastChannel('dustwatch_background');
        channel.postMessage(bgConfig);
        channel.close();
      } catch (e) {}

      setBgSaveMsg('บันทึกรูปภาพและส่งสัญญาณแสดงผลไปยังเว็บหลักเรียบร้อยแล้ว!');
      setTimeout(() => {
        setBgSaveMsg(null);
        setIsBgManagerOpen(false);
      }, 1500);
    } catch (e) {
      console.error('Failed to save background config', e);
      alert('Failed to save background settings');
    }
  };

  // ─── Node Photo Upload States & Handlers ───
  const [isUploadingNodePhoto, setIsUploadingNodePhoto] = useState(false);

  const handleUploadNodePhoto = async (nodeId: string, file: File) => {
    setIsUploadingNodePhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/nodes/${nodeId}/upload-image`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.ok && json.data?.image_url) {
        setTempConfigs((prev) => ({
          ...prev,
          [nodeId]: { ...prev[nodeId], image_url: json.data.image_url }
        }));
      } else {
        alert(json.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch (e) {
      console.error('Failed to upload node photo', e);
      alert('อัปโหลดไม่สำเร็จ');
    } finally {
      setIsUploadingNodePhoto(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── System Health Bar ─── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-[11px] font-mono">
        <span className="text-gray-500 uppercase font-bold tracking-wider">Backend Status</span>
        <span className="text-white/10">|</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${systemHealth?.services?.sqlite === 'ok' ? 'bg-green-400' : 'bg-red-500'}`}></span>
          <span className={systemHealth?.services?.sqlite === 'ok' ? 'text-green-400' : 'text-red-400'}>SQLite</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${systemHealth?.services?.influxdb === 'ok' ? 'bg-green-400' : 'bg-red-500'}`}></span>
          <span className={systemHealth?.services?.influxdb === 'ok' ? 'text-green-400' : 'text-red-400'}>InfluxDB</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${systemHealth?.services?.mqtt === 'ok' ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`}></span>
          <span className={systemHealth?.services?.mqtt === 'ok' ? 'text-green-400' : 'text-yellow-400'}>MQTT</span>
        </span>
        {systemHealth?.uptime_seconds && (
          <span className="ml-auto text-gray-600">
            Uptime: <span className="text-gray-400">{Math.round(systemHealth.uptime_seconds / 60)}m</span>
          </span>
        )}
        {!systemHealth && (
          <span className="text-gray-600 animate-pulse">Connecting to backend...</span>
        )}
      </div>

      {/* ─── Summary Statistics Banner ─── */}
      <SummaryBanner />

      {/* ─── Scrolling Alert Ticker ─── */}
      <AlertTicker />

      {/* ─── Project Overview Card (DustWatch & Creators) ─── */}
      <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-white/[0.01] backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌬️</span>
            <h3 className="text-base font-bold text-white font-mono tracking-wide">โครงงาน DustWatch — เครือข่ายตรวจวัดฝุ่นและพยากรณ์คุณภาพอากาศในโรงเรียน</h3>
          </div>
          <p className="text-xs text-gray-400 max-w-3xl leading-relaxed">
            ระบบ IoT ตรวจวัดคุณภาพอากาศภายในอาคารและห้องเรียนแบบ Real-time พร้อมผสานเอนจินปัญญาประดิษฐ์ (XGBoost/LightGBM) คาดการณ์ฝุ่น PM2.5 ล่วงหน้า และระบบจัดการโมเดล (MLOps Portal) เพื่อการวิเคราะห์และทำนายคุณภาพอากาศอย่างอัจฉริยะ
          </p>
          <div className="text-[10px] text-gray-500 font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>ผู้จัดทำ: นายธีรัชชัย ผาสุขพันธ์, นายณัฐภัทร ปัดไธสง, นายณภัทร แสนสมบัติ</span>
            <span>•</span>
            <span>การแข่งขันพัฒนาโปรแกรมคอมพิวเตอร์แห่งประเทศไทย (NSC)</span>
          </div>
        </div>
        <Link
          to="/nsc"
          className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 border border-blue-400/20 shadow-lg shadow-blue-500/15 transition-all text-center whitespace-nowrap cursor-pointer font-mono"
        >
          อ่านรายละเอียดเพิ่มเติม →
        </Link>
      </div>

      {/* Header Label with settings button */}
      <div className="border-b border-white/5 pb-2 flex justify-between items-center">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
          Air Quality Stations
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Health Customizer Trigger */}
          <button
            onClick={handleOpenHealthCustomizer}
            className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs font-bold font-mono px-3 py-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 cursor-pointer flex items-center gap-1.5"
          >
            📢 ประกาศ & คำแนะนำสุขภาพ
          </button>

          {/* Background Manager Trigger */}
          <button
            onClick={handleOpenBgManager}
            className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-bold font-mono px-3 py-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 cursor-pointer flex items-center gap-1.5"
          >
            🖼️ รูปพื้นหลัง
          </button>

          {/* Settings trigger */}
          <button
            onClick={handleOpenSettings}
            className="text-gray-400 hover:text-white transition-colors text-xs font-bold font-mono px-3 py-1 rounded-xl border border-white/5 bg-white/5 cursor-pointer flex items-center gap-1.5"
          >
            ⚙️ Manage Nodes
          </button>
        </div>
      </div>


      {/* ─── Device Toggle Checklist ─── */}
      <div className="p-5 rounded-3xl border border-white/5 bg-gradient-to-r from-blue-950/20 to-indigo-950/20 backdrop-blur-md space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
          <div>
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-2">
              🔌 รายชื่อเครื่องวัดฝุ่นทั้งหมด (DustWatch Stations Configuration)
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              ติ๊กเพื่อเลือกเปิดใช้งานเครื่องวัดฝุ่นที่ต้องการแสดงผลในระบบ (และซ่อนเครื่องที่ไม่ต้องการแสดง)
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2.5 py-1 rounded-full shrink-0 self-start sm:self-auto">
            {allNodeIds.filter(id => !nodesMeta[id] || nodesMeta[id].active !== 0).length} / {allNodeIds.length} Active Stations
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2.5">
          {allNodeIds.map((id) => {
            const meta = nodesMeta[id];
            const isActive = !meta || meta.active !== 0;
            const displayName = meta?.display_name || latest[id]?.reading.location || id;
            return (
              <label
                key={id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border text-xs font-mono transition-all duration-200 cursor-pointer select-none hover:scale-[1.02] ${
                  isActive
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-md shadow-blue-500/5 hover:border-blue-400/50'
                    : 'bg-white/[0.01] border-white/5 text-gray-500 hover:border-white/15'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={async (e) => {
                    const nextActive = e.target.checked ? 1 : 0;
                    
                    // Optimistic update of nodesMeta in store to keep UI responsive
                    const updatedMeta = { ...nodesMeta };
                    const currentMeta = updatedMeta[id] || {
                      id,
                      display_name: displayName,
                      location: latest[id]?.reading.location || 'Offline Station',
                      active: 1,
                      created_at: new Date().toISOString(),
                    };
                    updatedMeta[id] = { ...currentMeta, active: nextActive };
                    setNodesMeta(updatedMeta);

                    // Call API to persist
                    try {
                      const payload = {
                        active: nextActive,
                        tag: currentMeta.tag ?? '',
                        display_name: currentMeta.display_name || displayName,
                        status: currentMeta.status ?? 'unconfirmed',
                        confirmed: currentMeta.confirmed ?? 0,
                        pos_x: currentMeta.pos_x ?? 0.0,
                        pos_y: currentMeta.pos_y ?? 0.0,
                        floor: currentMeta.floor ?? 1,
                      };
                      await fetch(`${API_BASE}/api/v1/nodes/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                    } catch (err) {
                      console.error(`Failed to toggle node active state for ${id}`, err);
                      // Rollback on error
                      const rollbackMeta = { ...nodesMeta };
                      rollbackMeta[id] = { ...currentMeta, active: isActive ? 1 : 0 };
                      setNodesMeta(rollbackMeta);
                    }
                  }}
                  className="h-4 w-4 rounded border-white/20 bg-[#0d101a] text-blue-500 cursor-pointer focus:ring-0 focus:ring-offset-0 transition-colors"
                />
                <span className="font-bold">{displayName}</span>
                <span className="text-[9px] opacity-60">({id})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ─── Station Cards Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleNodeEntries.map(([nodeId, nodeData]) => {
          const { reading, aqi, status, dcs } = nodeData;
          const meta = nodesMeta[nodeId];
          const displayName = meta?.display_name || reading.location;
          const tag = meta?.tag;
          const isSim = reading.meta.sim || 
                        nodeId.toUpperCase().startsWith("NODE_TEST") ||
                        nodeId.toLowerCase().includes("test") ||
                        nodeId.toLowerCase().includes("sim") ||
                        nodeId.toLowerCase().includes("sandbox");
          
          const now = new Date().getTime();
          const ts = new Date(reading.timestamp).getTime();
          const isOnline = latest[nodeId] !== undefined && (now - ts) / 1000 < 600;

          return (
            <Link
              key={nodeId}
              to={`/station/${nodeId}`}
              className="group relative glass-card p-6 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-white/25 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Header: Location & Station ID */}
              <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono ${
                      isOnline 
                        ? 'text-green-400 border-green-500/25 bg-green-500/10' 
                        : 'text-red-400 border-red-500/25 bg-red-500/10 animate-pulse'
                    }`}>
                      ● {isOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="text-xs font-bold font-mono tracking-widest text-blue-500 uppercase">
                      Station {reading.node_id}
                    </span>
                    {tag && (
                      <span className="px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono text-indigo-400 border-indigo-500/25 bg-indigo-500/10">
                        {tag}
                      </span>
                    )}
                    {isSim && (
                      <span className="px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono text-yellow-400 border-yellow-500/25 bg-yellow-500/10">
                        Simulation
                      </span>
                    )}
                    {dcs !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono ${
                        dcs >= 0.85 
                          ? 'text-green-400 border-green-500/25 bg-green-500/10' 
                          : dcs >= 0.60
                          ? 'text-yellow-400 border-yellow-500/25 bg-yellow-500/10'
                          : 'text-red-400 border-red-500/25 bg-red-500/10'
                      }`}>
                        DCS: {Math.round(dcs * 100)}%
                      </span>
                    )}
                    {status && (
                      <span className="px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider font-mono text-gray-400 border-white/5 bg-white/5">
                        {status}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-100 group-hover:text-white transition-colors mt-1">
                    {displayName}
                  </h3>
                  <div className="text-[10px] font-mono font-bold text-cyan-400/90 mt-0.5 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20">ID / Codename: {nodeId}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-gray-500 shrink-0">
                  {isOnline ? new Date(reading.timestamp).toLocaleTimeString() : 'OFFLINE'}
                </span>
              </div>

              {/* Core Metrics Content: Split Left (PM2.5 + Sparkline) & Right (AQI Circle Gauge) */}
              <div className="grid grid-cols-5 gap-6 items-center my-2">
                {/* Left Side: PM2.5 Instant value + Sparkline Trend */}
                <div className="col-span-3 space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono tracking-tighter text-white">
                      {reading.pm.pm2_5 ?? '--'}
                    </span>
                    <span className="text-sm font-bold text-gray-400">µg/m³ PM2.5</span>
                  </div>
                  
                  {/* 1-Hour Trend Sparkline */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                      1-Hour Trend
                    </span>
                    <SparkLine nodeId={nodeId} currentVal={reading.pm.pm2_5 ?? 0} />
                  </div>
                </div>

                {/* Right Side: Circular Gauge */}
                <div className="col-span-2 flex justify-end">
                  <AQIGaugeCard score={aqi.aqi_score} level={aqi.aqi_level} />
                </div>
              </div>

              {/* Sub-Metrics grid */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl border border-white/5 bg-white/[0.02] mt-4">
                <div className="text-center">
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Temp</span>
                  <span className="font-mono text-sm text-gray-200">
                    {reading.env.temperature !== undefined && reading.env.temperature !== null ? `${reading.env.temperature.toFixed(2)}` : '--'}°C
                  </span>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Humidity</span>
                  <span className="font-mono text-sm text-gray-200">
                    {reading.env.humidity !== undefined && reading.env.humidity !== null ? `${reading.env.humidity.toFixed(2)}` : '--'}%
                  </span>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">IAQ Index</span>
                  <span className="font-mono text-sm text-gray-200">
                    {reading.env.iaq !== undefined && reading.env.iaq !== null ? `${reading.env.iaq.toFixed(2)}` : '--'}
                  </span>
                </div>
              </div>

              {/* Bottom Status bar */}
              <div className="flex justify-between items-center mt-5 pt-3 border-t border-white/5 text-[11px] font-mono text-gray-500">
                <div className="flex gap-4">
                  <span>RSSI: <span className="text-gray-300 font-bold">{reading.meta.rssi ?? 'N/A'} dBm</span></span>
                  <span>Uptime: <span className="text-gray-300">{reading.meta.uptime_s ? `${Math.round(reading.meta.uptime_s / 60)}m` : 'N/A'}</span></span>
                </div>
                <span className="text-blue-400 font-bold group-hover:text-blue-300 transition-colors flex items-center gap-1">
                  View Charts <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </div>
            </Link>
          );
        })}

        {visibleNodeEntries.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title="No active stations connected"
              message="All stations have been disabled or we are waiting for MQTT sensor broadcasts. Click 'Manage Nodes' to customize displays."
            />
          </div>
        )}
      </div>

      {/* ─── Node Settings Modal Overlay ─── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0a0d16] shadow-2xl p-6 space-y-6 max-h-[90vh] flex flex-col justify-between">
            <div className="border-b border-white/5 pb-3">
              <h3 className="text-lg font-black text-white">Manage Air Quality Stations</h3>
              <p className="text-xs text-gray-400 mt-1">Configure active status tags, custom names, and drag positions in 3D</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden min-h-[450px]">
              {/* Left Column: Form & Node Selector (col-span-5) */}
              <div className="lg:col-span-5 space-y-4 overflow-y-auto pr-1 no-scrollbar flex flex-col">
                
                {/* Node Selector Checklist */}
                <div className="flex flex-col space-y-1.5">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 font-mono">
                    เลือกเครื่องวัดฝุ่นที่ต้องการแสดงผลและแก้ไข (Select & Toggle Stations)
                  </label>
                  <div className="border border-white/10 rounded-2xl bg-[#0d101a] max-h-[200px] overflow-y-auto p-1.5 space-y-1">
                    {Object.keys(tempConfigs).map((id) => {
                      const conf = tempConfigs[id];
                      const isSelected = selectedNodeIdForEdit === id;
                      return (
                        <div
                          key={id}
                          onClick={() => setSelectedNodeIdForEdit(id)}
                          className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-500/10 border border-blue-500/20' 
                              : 'hover:bg-white/[0.02] border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={conf.active === 1}
                              onChange={(e) => {
                                e.stopPropagation();
                                setTempConfigs({
                                  ...tempConfigs,
                                  [id]: { ...conf, active: e.target.checked ? 1 : 0 }
                                });
                              }}
                              className="h-4 w-4 rounded border-white/10 bg-transparent text-blue-500 cursor-pointer"
                            />
                            <div className="text-left font-mono">
                              <span className="text-xs font-bold text-gray-200">
                                {conf.display_name || id}
                              </span>
                              <span className="block text-[9px] text-gray-500">
                                ID: {id} {conf.tag ? `• ${conf.tag}` : ''}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full ${
                            conf.active === 1 
                              ? 'text-green-400 bg-green-500/10 border border-green-500/20' 
                              : 'text-gray-500 bg-gray-500/10 border border-gray-500/20'
                          }`}>
                            {conf.active === 1 ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedNodeIdForEdit && tempConfigs[selectedNodeIdForEdit] && (() => {
                  const id = selectedNodeIdForEdit;
                  const conf = tempConfigs[id];
                  const isSimNode = id.toUpperCase().startsWith("NODE_TEST") || latest[id]?.reading.meta.sim;
                  return (
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] space-y-4 flex-1">
                      
                      {/* Active & Confirmed Toggles */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            id={`active-${id}`}
                            checked={conf.active === 1}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, active: e.target.checked ? 1 : 0 }
                            })}
                            className="h-4 w-4 rounded border-white/10 bg-transparent text-blue-500 cursor-pointer"
                          />
                          <label htmlFor={`active-${id}`} className="text-xs text-gray-200 font-bold select-none cursor-pointer uppercase font-mono">
                            Active Node
                          </label>
                          {isSimNode && (
                            <span className="ml-1.5 px-1 py-0.5 rounded text-[8px] font-bold bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 uppercase font-mono">
                              Sim
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`confirmed-${id}`}
                            checked={conf.confirmed === 1}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, confirmed: e.target.checked ? 1 : 0 }
                            })}
                            className="h-4 w-4 rounded border-white/10 bg-transparent text-blue-500 cursor-pointer"
                          />
                          <label htmlFor={`confirmed-${id}`} className="text-[10px] text-gray-400 font-bold select-none cursor-pointer uppercase font-mono">
                            Confirmed
                          </label>
                        </div>
                      </div>

                      {/* Hardware Codename & Display Name */}
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">
                            Hardware Codename (ชื่อรหัสเดิมในระบบ)
                          </label>
                          <div className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-mono font-bold text-blue-400 flex items-center justify-between">
                            <span>{id}</span>
                            <span className="text-[9px] font-normal text-gray-500 uppercase">Fixed Identifier</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">
                            Display Name (ชื่อแสดง / ชื่อเล่นประจำจุด)
                          </label>
                          <input
                            type="text"
                            value={conf.display_name}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, display_name: e.target.value }
                            })}
                            placeholder="เช่น ห้องเรียน ป.4/1 หรือ โดมกิจกรรม"
                            className="w-full px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-gray-100 focus:outline-none focus:border-blue-500"
                          />
                          {/* Quick preset buttons */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {['ห้องเรียน 4/1', 'ห้องเรียน 4/2', 'โดมกิจกรรมกลางแจ้ง', 'สนามฟุตบอล', 'โรงอาหาร', 'ห้องสมุด'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setTempConfigs({
                                  ...tempConfigs,
                                  [id]: { ...conf, display_name: preset }
                                })}
                                className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Environment Type */}
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Environment Type (ใน/นอกอาคาร)</label>
                        <select
                          value={conf.tag.toLowerCase().includes('outdoor') ? 'outdoor' : (conf.tag.toLowerCase().includes('indoor') ? 'indoor' : conf.tag || 'indoor')}
                          onChange={(e) => setTempConfigs({
                            ...tempConfigs,
                            [id]: { ...conf, tag: e.target.value }
                          })}
                          className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-xs text-gray-200 focus:outline-none cursor-pointer"
                        >
                          <option value="indoor">ภายในอาคาร (Indoor)</option>
                          <option value="outdoor">ภายนอกอาคาร (Outdoor)</option>
                        </select>
                      </div>

                      {/* Node Image Photo */}
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">
                          Node Location Photo (รูปภาพจุดติดตั้ง / ห้องเรียนประจำโหนด)
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1">
                            <span>📷 {isUploadingNodePhoto ? 'กำลังอัปโหลด...' : 'อัปโหลดภาพ'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingNodePhoto}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleUploadNodePhoto(id, e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <input
                            type="text"
                            value={conf.image_url || ''}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, image_url: e.target.value }
                            })}
                            placeholder="หรือวาง URL รูปภาพ..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        {conf.image_url && (
                          <div className="mt-2 h-20 w-full rounded-xl overflow-hidden border border-white/10 relative group">
                            <img src={conf.image_url} alt="Node Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setTempConfigs({
                                ...tempConfigs,
                                [id]: { ...conf, image_url: '' }
                              })}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white p-1 rounded-md text-[10px] font-mono cursor-pointer"
                            >
                              ✕ ลบรูป
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Deployment Status</label>
                        <select
                          value={conf.status || 'unconfirmed'}
                          onChange={(e) => setTempConfigs({
                            ...tempConfigs,
                            [id]: { ...conf, status: e.target.value }
                          })}
                          className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-xs text-gray-200 focus:outline-none cursor-pointer"
                        >
                          <option value="deployed">Deployed</option>
                          <option value="testing">Testing</option>
                          <option value="placement">Placement</option>
                          <option value="unconfirmed">Unconfirmed</option>
                        </select>
                      </div>

                      {/* Manual coordinate inputs */}
                      <div className="grid grid-cols-3 gap-3 bg-white/[0.01] p-3 rounded-xl border border-white/5 mt-2">
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">Floor</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={conf.floor}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, floor: parseInt(e.target.value) || 1 }
                            })}
                            className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">3D X</label>
                          <input
                            type="number"
                            step="0.5"
                            value={conf.pos_x}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, pos_x: parseFloat(e.target.value) || 0.0 }
                            })}
                            className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">3D Y</label>
                          <input
                            type="number"
                            step="0.5"
                            value={conf.pos_y}
                            onChange={(e) => setTempConfigs({
                              ...tempConfigs,
                              [id]: { ...conf, pos_y: parseFloat(e.target.value) || 0.0 }
                            })}
                            className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                    </div>
                  );
                })()}

              </div>

              {/* Right Column: 3D Map positioning editor (col-span-7) */}
              <div className="lg:col-span-7 h-full min-h-[400px]">
                <MapPositionEditor
                  selectedNodeId={selectedNodeIdForEdit}
                  tempConfigs={tempConfigs}
                  onPositionChange={handlePositionChange}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 border border-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer shadow-lg shadow-blue-500/25"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── School Health & Air Safety Customizer Modal ─── */}
      {isHealthCustomizerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0b0e17] border border-cyan-500/30 rounded-3xl p-6 w-full max-w-2xl space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <div>
                  <h3 className="text-sm font-extrabold text-white font-mono tracking-tight">
                    จัดการประกาศ & คำแนะนำสุขภาพโรงเรียน (School Health Customizer)
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    แก้ไขประกาศด่วนและข้อความคำแนะนำสุขภาพ การกดบันทึกจะส่งสัญญาณอัปเดตไปยังหน้าเว็บหลักและมือถือทันที
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHealthCustomizerOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {healthSaveMsg && (
              <div className="bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs px-4 py-3 rounded-2xl font-mono font-bold animate-fadeIn">
                ✨ {healthSaveMsg}
              </div>
            )}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar text-xs">
              {/* Field 1: Urgent Notice */}
              <div>
                <label className="block text-xs font-bold text-cyan-400 font-mono mb-1.5">
                  📢 ประกาศพิเศษด่วนจากโรงเรียน (Urgent School Notice) — ปล่อยว่างถ้าไม่มีประกาศ
                </label>
                <textarea
                  rows={2}
                  value={healthAnnouncement}
                  onChange={(e) => setHealthAnnouncement(e.target.value)}
                  placeholder="เช่น: แจ้งนักเรียนทุกชั้นปี สัปดาห์นี้เตรียมสอบกลางภาค งดใช้เสียงและย้ายกิจกรรมพละเข้าโดม"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
              </div>

              {/* Field 2: Outdoor Activity Override */}
              <div>
                <label className="block text-xs font-bold text-gray-300 font-mono mb-1.5">
                  ⚽ คำแนะนำกิจกรรมพลศึกษา & กลางแจ้ง (Outdoor Activities Advice) — ปล่อยว่างเพื่อใช้ค่าจาก AQI อัตโนมัติ
                </label>
                <input
                  type="text"
                  value={healthOutdoor}
                  onChange={(e) => setHealthOutdoor(e.target.value)}
                  placeholder="เช่น: งดออกกำลังกายกลางแจ้ง ให้ทำกิจกรรมในร่มแทน"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
              </div>

              {/* Field 3: Sensitive Shield Override */}
              <div>
                <label className="block text-xs font-bold text-gray-300 font-mono mb-1.5">
                  🫁 คำแนะนำกลุ่มเปราะบาง (Sensitive Shield Advice) — ปล่อยว่างเพื่อใช้ค่าจาก AQI อัตโนมัติ
                </label>
                <input
                  type="text"
                  value={healthSensitive}
                  onChange={(e) => setHealthSensitive(e.target.value)}
                  placeholder="เช่น: นักเรียนที่มีโรคประจำตัว (หอบหืด/ภูมิแพ้) ควรหลีกเลี่ยงฝุ่นละออง"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
              </div>

              {/* Field 4: Classroom Ventilation Override */}
              <div>
                <label className="block text-xs font-bold text-gray-300 font-mono mb-1.5">
                  🪟 คำแนะนำการถ่ายเทอากาศห้องเรียน (Ventilation Advice) — ปล่อยว่างเพื่อใช้ค่าจาก AQI อัตโนมัติ
                </label>
                <input
                  type="text"
                  value={healthVentilation}
                  onChange={(e) => setHealthVentilation(e.target.value)}
                  placeholder="เช่น: ให้ปิดประตูหน้าต่างห้องเรียน และเปิดระบบกรองอากาศด่วน"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <button
                onClick={() => {
                  setHealthAnnouncement('');
                  setHealthOutdoor('');
                  setHealthSensitive('');
                  setHealthVentilation('');
                }}
                className="text-xs text-gray-400 hover:text-rose-400 transition-colors font-mono cursor-pointer"
              >
                🗑️ ล้างข้อความทั้งหมด (Reset to Defaults)
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsHealthCustomizerOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 border border-white/10 cursor-pointer font-mono"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveHealthCustomizer}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-cyan-500 hover:bg-cyan-600 cursor-pointer shadow-lg shadow-cyan-500/25 font-mono"
                >
                  💾 บันทึกและส่งสัญญาณอัปเดต (Save & Broadcast)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dynamic Background Manager Modal Overlay ─── */}
      <BackgroundManagerModal
        isOpen={isBgManagerOpen}
        onClose={() => setIsBgManagerOpen(false)}
        config={bgConfig}
        onChangeConfig={(newConfig) => setBgConfig(newConfig)}
        onSave={handleSaveBgManager}
        onUploadFile={handleUploadBgFile}
        isUploading={isUploadingBg}
        saveMsg={bgSaveMsg}
      />
    </div>
  );
}
