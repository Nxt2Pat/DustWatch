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
  const [tempConfigs, setTempConfigs] = useState<Record<string, { active: number; display_name: string; tag: string; status: string; confirmed: number; pos_x: number; pos_y: number; floor: number }>>({});
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
    const configs: Record<string, { active: number; display_name: string; tag: string; status: string; confirmed: number; pos_x: number; pos_y: number; floor: number }> = {};
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
        
        {/* Settings trigger */}
        <button
          onClick={handleOpenSettings}
          className="text-gray-400 hover:text-white transition-colors text-xs font-bold font-mono px-3 py-1 rounded-xl border border-white/5 bg-white/5 cursor-pointer flex items-center gap-1.5"
        >
          ⚙️ Manage Nodes
        </button>
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
                
                {/* Node Selector */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 font-mono">
                    เลือกโหนดเพื่อแก้ไข (Select Node)
                  </label>
                  <select
                    value={selectedNodeIdForEdit || ''}
                    onChange={(e) => setSelectedNodeIdForEdit(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#0d101a] text-xs text-white focus:outline-none cursor-pointer font-mono"
                  >
                    {Object.keys(tempConfigs).map((id) => (
                      <option key={id} value={id}>
                        {id} {tempConfigs[id].display_name ? `(${tempConfigs[id].display_name})` : ''} {tempConfigs[id].active === 0 ? ' [Disabled]' : ''}
                      </option>
                    ))}
                  </select>
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

                      {/* Display name */}
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Display Name</label>
                        <input
                          type="text"
                          value={conf.display_name}
                          onChange={(e) => setTempConfigs({
                            ...tempConfigs,
                            [id]: { ...conf, display_name: e.target.value }
                          })}
                          className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none"
                        />
                      </div>

                      {/* Custom tag */}
                      <div>
                        <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Custom Tag</label>
                        <input
                          type="text"
                          value={conf.tag}
                          placeholder="e.g. Room A"
                          onChange={(e) => setTempConfigs({
                            ...tempConfigs,
                            [id]: { ...conf, tag: e.target.value }
                          })}
                          className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none"
                        />
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
    </div>
  );
}
