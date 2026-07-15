import { useState } from 'react';
import { useStore } from '../store';
import SummaryBanner from '../components/layout/SummaryBanner';
import ConstellationDivider from '../components/ui/ConstellationDivider';
import SchoolMap from '../components/SchoolMap';
import type { NodeData } from '../types/sensor';
import { Wifi, ShieldCheck, Thermometer, Droplets, Volume2, Wind, Eye, LayoutGrid, Map } from 'lucide-react';

export default function Dashboard() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // States
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Filter nodes according to status in nodesMeta (hide inactive ones)
  const activeNodes = Object.entries(latest)
    .filter(([id]) => {
      const meta = nodesMeta[id];
      return !meta || meta.active !== 0;
    })
    .map(([_, data]) => data);

  // Toggle detail view for classroom card
  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Colors & Glow mappings matching the Air Quality Index standards
  const getAQIStyles = (aqi: number) => {
    if (aqi <= 50.0) return { 
      text: 'text-[#10b981]', 
      border: 'border-[#10b981]/20', 
      bg: 'bg-[#10b981]/5', 
      glow: 'shadow-[0_4px_20px_-2px_rgba(16,185,129,0.12)] hover:border-[#10b981]/40',
      dot: 'bg-[#10b981]',
      label: 'ดี (Good)' 
    };
    if (aqi <= 100.0) return { 
      text: 'text-[#eab308]', 
      border: 'border-[#eab308]/20', 
      bg: 'bg-[#eab308]/5', 
      glow: 'shadow-[0_4px_20px_-2px_rgba(234,179,8,0.12)] hover:border-[#eab308]/40',
      dot: 'bg-[#eab308]',
      label: 'ปานกลาง (Moderate)' 
    };
    if (aqi <= 150.0) return { 
      text: 'text-[#f97316]', 
      border: 'border-[#f97316]/20', 
      bg: 'bg-[#f97316]/5', 
      glow: 'shadow-[0_4px_20px_-2px_rgba(249,115,22,0.12)] hover:border-[#f97316]/40',
      dot: 'bg-[#f97316]',
      label: 'เริ่มมีผลกระทบต่อกลุ่มเสี่ยง' 
    };
    if (aqi <= 200.0) return { 
      text: 'text-[#ef4444]', 
      border: 'border-[#ef4444]/20', 
      bg: 'bg-[#ef4444]/5', 
      glow: 'shadow-[0_4px_20px_-2px_rgba(239,68,68,0.12)] hover:border-[#ef4444]/40',
      dot: 'bg-[#ef4444]',
      label: 'เริ่มมีผลต่อสุขภาพ (Unhealthy)' 
    };
    if (aqi <= 300.0) return { 
      text: 'text-[#8b5cf6]', 
      border: 'border-[#8b5cf6]/20', 
      bg: 'bg-[#8b5cf6]/5', 
      glow: 'shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)] hover:border-[#8b5cf6]/40',
      dot: 'bg-[#8b5cf6]',
      label: 'มีผลต่อสุขภาพมาก (Very Unhealthy)' 
    };
    return { 
      text: 'text-[#991b1b]', 
      border: 'border-[#991b1b]/20', 
      bg: 'bg-[#991b1b]/5', 
      glow: 'shadow-[0_4px_20px_-2px_rgba(153,27,27,0.12)] hover:border-[#991b1b]/40',
      dot: 'bg-[#991b1b]',
      label: 'อันตรายร้ายแรง (Hazardous)' 
    };
  };

  const isOnline = (timestamp: string, status?: string) => {
    if (status === 'offline') return false;
    const now = new Date().getTime();
    const ts = new Date(timestamp).getTime();
    return (now - ts) / 1000 < 600;
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi >= -60) return 'สัญญาณแรงมาก';
    if (rssi >= -75) return 'สัญญาณปานกลาง';
    return 'สัญญาณอ่อน';
  };

  return (
    <div className="relative z-10 space-y-4">
      {/* 1. Statistics Summary Header Banner */}
      <SummaryBanner />

      {/* 2. Signature Divider */}
      <ConstellationDivider className="my-1 opacity-70" />

      {/* 3. View Switcher Toolbar */}
      <div className="flex justify-end mb-2 relative z-20">
        <div className="flex bg-black/[0.02] border border-black/[0.04] p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'map' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-primary'
            }`}
          >
            <Map size={14} />
            <span>มุมมองแผนที่ 3 มิติ (3D Map)</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'grid' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-primary'
            }`}
          >
            <LayoutGrid size={14} />
            <span>รายการการ์ด (Card View)</span>
          </button>
        </div>
      </div>

      {/* 4. Display Content based on View Mode */}
      {viewMode === 'map' ? (
        <SchoolMap />
      ) : activeNodes.length === 0 ? (
        <div className="premium-card py-16 px-6 text-center flex flex-col items-center">
          <ShieldCheck size={48} className="text-brand-primary opacity-60 mb-3" />
          <h2 className="text-xl font-bold font-serif text-text-primary">กำลังเตรียมเครือข่ายสถานี...</h2>
          <p className="text-text-secondary text-sm mt-1 max-w-sm">
            ระบบกำลังทำการประมวลผลข้อมูลการเชื่อมต่อจากโหนดตรวจวัดฝุ่นและสภาพแวดล้อม
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {activeNodes.map((node: NodeData) => {
            const nodeId = node.reading.node_id;
            const meta = nodesMeta[nodeId];
            
            const displayName = meta?.display_name || node.reading.location || nodeId;
            const tag = meta?.tag || '';
            const online = isOnline(node.reading.timestamp, node.status);
            
            const isSim = node.reading.meta.sim || 
                          nodeId.toUpperCase().startsWith("NODE_TEST") ||
                          nodeId.toLowerCase().includes("test") ||
                          nodeId.toLowerCase().includes("sim") ||
                          nodeId.toLowerCase().includes("sandbox");

            const aqiStyles = getAQIStyles(node.aqi.aqi_score);
            const isExpanded = !!expandedNodes[nodeId];

            return (
              <div 
                key={nodeId}
                className={`premium-card p-6 flex flex-col justify-between relative transition-all duration-300 ${
                  online ? aqiStyles.glow : 'opacity-70 border-red-500/10'
                } ${isExpanded ? 'ring-1 ring-brand-primary/20 shadow-xl' : ''}`}
                style={{ contentVisibility: 'auto' }}
              >
                {/* Simulated SIM Badge - Top Right */}
                {isSim && (
                  <span className="absolute top-4 right-4 bg-yellow-500/10 border border-yellow-500/25 text-yellow-500 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded">
                    SIMULATOR
                  </span>
                )}

                {/* Top header details (Aligned left nicely) */}
                <div className="flex items-center justify-between mb-4 border-b border-black/[0.03] pb-3">
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-brand-primary font-bold uppercase block mb-0.5">
                      STATION {nodeId}
                    </span>
                    <h3 className="text-base font-bold font-sans text-text-primary truncate max-w-[180px]">
                      {displayName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 bg-black/[0.02] border border-black/[0.04] px-2 py-1 rounded-lg">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-400'
                    }`} />
                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider font-mono">
                      {online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Main Metrics (AQI + PM2.5 Grid) */}
                <div className="grid grid-cols-2 gap-4 py-3">
                  {/* Left Column: AQI Indicator */}
                  <div className="flex flex-col justify-center border-r border-black/[0.04] pr-2">
                    <span className="text-[9px] text-text-secondary uppercase font-bold tracking-wider font-sans">
                      ดัชนีคุณภาพอากาศ
                    </span>
                    <span className={`text-4xl font-black font-mono leading-tight tracking-tight my-1 ${aqiStyles.text}`}>
                      {online ? Math.round(node.aqi.aqi_score) : '--'}
                    </span>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${aqiStyles.text} ${aqiStyles.bg} border ${aqiStyles.border}`}>
                        {online ? aqiStyles.label : 'ขาดการเชื่อมต่อ'}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: PM2.5 Value */}
                  <div className="flex flex-col justify-center pl-2">
                    <span className="text-[9px] text-text-secondary uppercase font-bold tracking-wider font-sans">
                      ค่าฝุ่น PM2.5 (Instant)
                    </span>
                    <div className="text-2xl font-black text-text-primary leading-tight my-1 font-mono">
                      {online ? `${node.reading.pm.pm2_5}` : '--'}
                      <span className="text-xs text-text-secondary font-bold ml-1 font-sans">µg/m³</span>
                    </div>
                    {tag && (
                      <div>
                        <span className="inline-block bg-indigo-500/10 text-indigo-500 border border-indigo-500/15 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Environmental Sub-Metrics Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-black/[0.03] text-xs font-sans">
                  {/* Temp */}
                  <div className="flex justify-between items-center py-1 border-b border-black/[0.02]">
                    <span className="text-text-secondary flex items-center gap-1 font-medium">
                      <Thermometer size={12} className="text-red-400" />
                      อุณหภูมิห้อง
                    </span>
                    <span className="font-semibold text-text-primary font-mono">
                      {online && node.reading.env.temperature !== undefined && node.reading.env.temperature !== null ? `${node.reading.env.temperature.toFixed(2)}°C` : '--'}
                    </span>
                  </div>

                  {/* Humid */}
                  <div className="flex justify-between items-center py-1 border-b border-black/[0.02]">
                    <span className="text-text-secondary flex items-center gap-1 font-medium">
                      <Droplets size={12} className="text-blue-400" />
                      ความชื้นห้อง
                    </span>
                    <span className="font-semibold text-text-primary font-mono">
                      {online && node.reading.env.humidity !== undefined && node.reading.env.humidity !== null ? `${node.reading.env.humidity.toFixed(2)}%` : '--'}
                    </span>
                  </div>

                  {/* IAQ */}
                  <div className="flex justify-between items-center py-1 border-b border-black/[0.02]">
                    <span className="text-text-secondary flex items-center gap-1 font-medium">
                      <Wind size={12} className="text-teal-400" />
                      ระดับมลพิษ IAQ
                    </span>
                    <span className="font-semibold text-text-primary font-mono">
                      {online && node.reading.env.iaq !== undefined && node.reading.env.iaq !== null ? `${node.reading.env.iaq.toFixed(2)}` : '--'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-dashed border-black/5 grid grid-cols-1 gap-1.5 text-xs text-text-secondary animate-fadeIn">
                    <div className="flex items-center gap-1">
                      <Wifi size={13} className="text-brand-primary" />
                      <span>เครือข่าย Wi-Fi:</span>
                      <span className="font-semibold text-text-primary ml-auto font-mono">
                        {online ? getSignalStrength(node.reading.meta.rssi) : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Volume2 size={13} className="text-brand-primary" />
                      <span>ระดับเสียงรบกวน:</span>
                      <span className="font-semibold text-text-primary ml-auto font-mono">
                        {online && node.reading.sound.db_avg ? `${node.reading.sound.db_avg.toFixed(0)} dB` : '--'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between border-t border-black/[0.03] pt-2 text-[9px] text-text-muted font-mono mt-1">
                      <span>RSSI: {online ? `${node.reading.meta.rssi} dBm` : 'N/A'}</span>
                      <span>อัปเดต: {new Date(node.reading.timestamp).toLocaleTimeString('th-TH')} น.</span>
                    </div>
                  </div>
                )}

                {/* Card Action footer bar */}
                <div className="mt-4 pt-3 border-t border-black/[0.03] flex justify-between items-center">
                  <button
                    onClick={(e) => toggleExpand(nodeId, e)}
                    className="text-[10px] font-bold text-brand-primary hover:text-brand-primary/80 transition-colors uppercase tracking-wider font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={12} />
                    {isExpanded ? 'Hide Diagnostics' : 'Show Diagnostics'}
                  </button>
                  
                  <span className="text-[9px] font-mono text-text-muted">
                    {online ? 'Status: Active' : 'Status: Offline'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
