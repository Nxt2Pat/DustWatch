import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import SchoolAqiHeroCard from '../components/SchoolAqiHeroCard';
import HourlySchoolForecast from '../components/HourlySchoolForecast';
import SummaryBanner from '../components/layout/SummaryBanner';
import ConstellationDivider from '../components/ui/ConstellationDivider';
import SchoolMap from '../components/SchoolMap';
import type { NodeData } from '../types/sensor';
import { Wifi, ShieldCheck, Thermometer, Droplets, Volume2, Wind, Eye, LayoutGrid, MapPin, BarChart2 } from 'lucide-react';

export default function Dashboard() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // States
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Filter nodes according to status in nodesMeta
  const activeNodes = Object.entries(latest)
    .filter(([id]) => {
      const meta = nodesMeta[id];
      return !meta || meta.active !== 0;
    })
    .map(([_, data]) => data);

  const onlineNodesCount = activeNodes.filter((node) => {
    const now = new Date().getTime();
    const ts = new Date(node.reading.timestamp).getTime();
    return (now - ts) / 1000 < 600;
  }).length;

  const isOnline = (timestamp: string, status?: string) => {
    if (status === 'offline') return false;
    const now = new Date().getTime();
    const ts = new Date(timestamp).getTime();
    return (now - ts) / 1000 < 600;
  };

  // Colors & Glow mappings matching the Air Quality Index standards
  const getAQIStyles = (aqi: number) => {
    if (aqi <= 50.0) return {
      text: 'text-[#0CA4A4]',
      border: 'border-[#0CA4A4]/30',
      bg: 'bg-[#0CA4A4]/10',
      glow: 'shadow-[0_8px_30px_-4px_rgba(12,164,164,0.2)] hover:border-[#0CA4A4]/60',
      dot: 'bg-[#0CA4A4]',
      label: 'ดีมาก (Good)'
    };
    if (aqi <= 100.0) return {
      text: 'text-amber-600',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      glow: 'shadow-[0_8px_30px_-4px_rgba(245,158,11,0.2)] hover:border-amber-500/60',
      dot: 'bg-amber-500',
      label: 'ปานกลาง (Moderate)'
    };
    if (aqi <= 150.0) return {
      text: 'text-orange-600',
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/10',
      glow: 'shadow-[0_8px_30px_-4px_rgba(249,115,22,0.2)] hover:border-orange-500/60',
      dot: 'bg-orange-500',
      label: 'เริ่มมีผลกระทบต่อกลุ่มเสี่ยง'
    };
    if (aqi <= 200.0) return {
      text: 'text-rose-600',
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
      glow: 'shadow-[0_8px_30px_-4px_rgba(244,63,94,0.2)] hover:border-rose-500/60',
      dot: 'bg-rose-500',
      label: 'เริ่มมีผลต่อสุขภาพ (Unhealthy)'
    };
    if (aqi <= 300.0) return {
      text: 'text-purple-600',
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/10',
      glow: 'shadow-[0_8px_30px_-4px_rgba(168,85,247,0.2)] hover:border-purple-500/60',
      dot: 'bg-purple-500',
      label: 'มีผลต่อสุขภาพมาก (Very Unhealthy)'
    };
    return {
      text: 'text-red-900',
      border: 'border-red-900/30',
      bg: 'bg-red-900/10',
      glow: 'shadow-[0_8px_30px_-4px_rgba(153,27,27,0.2)] hover:border-red-900/60',
      dot: 'bg-red-900',
      label: 'อันตรายร้ายแรง (Hazardous)'
    };
  };

  const getSignalStrength = (rssi?: number) => {
    if (!rssi) return 'ไม่มีข้อมูล';
    if (rssi >= -60) return 'เสถียรมาก (Excellent)';
    if (rssi >= -75) return 'ปานกลาง (Good)';
    return 'อ่อน (Weak)';
  };

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  return (
    <div className="relative z-10 space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      {/* 1. School AQI Hero Card */}
      <SchoolAqiHeroCard
        schoolName="โรงเรียนเทพศิรินทร์ สมุทรปราการ"
        totalNodes={activeNodes.length}
        onlineNodes={onlineNodesCount}
      />

      {/* 2. Hourly Reference Trend Line Chart */}
      <HourlySchoolForecast />

      {/* 3. Summary Statistics Banner */}
      <SummaryBanner />

      <ConstellationDivider label="สภาพแวดล้อมเครือข่ายสถานีตรวจวัดคุณภาพอากาศ" />

      {/* 4. Navigation View Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight font-sans">
            เครือข่ายสถานีตรวจวัดฝุ่นโรงเรียน (School Sensor Nodes)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            คลิกดูการวินิจฉัยและกราฟอนุกรมเวลาย้อนหลังแยกรายสถานีได้โดยตรง
          </p>
        </div>

        <div className="flex bg-gray-100/80 border border-gray-200/60 backdrop-blur-md p-1 rounded-full text-xs font-semibold">
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'map' ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25 font-bold' : 'text-[#0CA4A4] hover:text-[#088383]'
            }`}
          >
            <MapPin size={14} />
            <span>แผนที่ 3D โรงเรียน</span>
          </button>

          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'grid' ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25 font-bold' : 'text-gray-600 hover:text-[#0CA4A4]'
            }`}
          >
            <LayoutGrid size={14} />
            <span>รายการการ์ด</span>
          </button>
        </div>
      </div>

      {/* 5. Display Content based on View Mode */}
      {viewMode === 'map' ? (
        <div className="glass-card p-2 overflow-hidden fade-up">
          <SchoolMap />
        </div>
      ) : activeNodes.length === 0 ? (
        <div className="glass-card py-16 px-6 text-center flex flex-col items-center">
          <ShieldCheck size={48} className="text-[#0CA4A4] opacity-60 mb-3" />
          <h2 className="text-xl font-bold text-gray-900 font-sans">กำลังเตรียมเครือข่ายสถานี...</h2>
          <p className="text-gray-500 text-sm mt-1 max-w-sm">
            ระบบกำลังทำการประมวลผลข้อมูลการเชื่อมต่อจากโหนดตรวจวัดฝุ่นและสภาพแวดล้อม
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeNodes.map((node: NodeData, idx: number) => {
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
                className={`glass-card p-6 flex flex-col justify-between relative transition-all duration-300 ${
                  online ? aqiStyles.glow : 'opacity-70 border-rose-300'
                } ${isExpanded ? 'ring-2 ring-[#0CA4A4]/30 shadow-xl' : ''}`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {/* Simulated SIM Badge */}
                {isSim && (
                  <span className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/30 text-amber-700 font-mono text-[9px] font-bold px-2.5 py-0.5 rounded-full z-10">
                    SIMULATOR
                  </span>
                )}

                {/* Node Location Image Banner */}
                {meta?.image_url && (
                  <div className="w-full h-32 rounded-2xl overflow-hidden mb-3 relative shadow-sm border border-gray-100/80 group">
                    <img
                      src={meta.image_url}
                      alt={displayName}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-2.5">
                      <span className="text-[10px] font-mono text-white font-bold drop-shadow-md">
                        📍 {displayName}
                      </span>
                    </div>
                  </div>
                )}

                {/* Top header details */}
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <Link to={`/station/${nodeId}`} className="group/title flex-1 hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-mono tracking-widest text-[#0CA4A4] font-bold uppercase">
                        STATION {nodeId}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                        tag.toLowerCase().includes('outdoor') || tag.toLowerCase().includes('semi') || displayName.includes('ทางเดิน') || displayName.includes('สนาม')
                          ? 'bg-sky-500/10 text-sky-700 border-sky-500/20'
                          : 'bg-[#0CA4A4]/10 text-[#0CA4A4] border-[#0CA4A4]/20'
                      }`}>
                        {tag.toLowerCase().includes('outdoor') || tag.toLowerCase().includes('semi') || displayName.includes('ทางเดิน') || displayName.includes('สนาม')
                          ? '🌳 ภายนอก'
                          : '🏫 ในอาคาร'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 truncate max-w-[180px] font-sans group-hover/title:text-[#0CA4A4]">
                      {displayName}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-1.5 bg-gray-100/80 border border-gray-200/60 px-3 py-1 rounded-full">
                    <span className={`w-2 h-2 rounded-full ${
                      online ? 'bg-[#0CA4A4] shadow-[0_0_8px_rgba(12,164,164,0.6)] animate-pulse' : 'bg-rose-400'
                    }`} />
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider font-mono">
                      {online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Main Metrics */}
                <div className="grid grid-cols-2 gap-4 py-2">
                  <div className="flex flex-col justify-center border-r border-gray-100 pr-2">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider font-sans">
                      ดัชนีคุณภาพอากาศ
                    </span>
                    <span className={`text-4xl font-black font-mono leading-tight tracking-tight my-1 ${aqiStyles.text}`}>
                      {online ? Math.round(node.aqi.aqi_score) : '--'}
                    </span>
                    <div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block font-mono ${aqiStyles.text} ${aqiStyles.bg} border ${aqiStyles.border}`}>
                        {online ? aqiStyles.label : 'ขาดการเชื่อมต่อ'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center pl-2">
                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider font-sans">
                      ค่าฝุ่น PM2.5 (Instant)
                    </span>
                    <div className="text-2xl font-black text-gray-900 leading-tight my-1 font-mono">
                      {online && node.reading.pm.pm2_5 != null ? node.reading.pm.pm2_5.toFixed(1) : '--'}
                      <span className="text-xs text-gray-400 font-bold ml-1 font-sans">µg/m³</span>
                    </div>
                    {tag && (
                      <div>
                        <span className="inline-block bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                          {tag}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Metrics Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-gray-100 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-gray-50">
                    <span className="text-gray-500 flex items-center gap-1 font-medium">
                      <Thermometer size={13} className="text-amber-500" />
                      อุณหภูมิห้อง
                    </span>
                    <span className="font-bold text-gray-900 font-mono">
                      {online && node.reading.env.temperature !== undefined && node.reading.env.temperature !== null ? `${node.reading.env.temperature.toFixed(1)}°C` : '--'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-gray-50">
                    <span className="text-gray-500 flex items-center gap-1 font-medium">
                      <Droplets size={13} className="text-sky-500" />
                      ความชื้นห้อง
                    </span>
                    <span className="font-bold text-gray-900 font-mono">
                      {online && node.reading.env.humidity !== undefined && node.reading.env.humidity !== null ? `${node.reading.env.humidity.toFixed(1)}%` : '--'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-gray-50">
                    <span className="text-gray-500 flex items-center gap-1 font-medium">
                      <Wind size={13} className="text-[#0CA4A4]" />
                      ระดับมลพิษ IAQ
                    </span>
                    <span className="font-bold text-gray-900 font-mono">
                      {online && node.reading.env.iaq !== undefined && node.reading.env.iaq !== null ? `${node.reading.env.iaq.toFixed(1)}` : '--'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details section */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-dashed border-gray-200 grid grid-cols-1 gap-2 text-xs text-gray-600 bg-gray-50/80 p-3.5 rounded-2xl">
                    <div className="flex items-center gap-1">
                      <Wifi size={13} className="text-[#0CA4A4]" />
                      <span>เครือข่าย Wi-Fi:</span>
                      <span className="font-semibold text-gray-900 ml-auto font-mono">
                        {online && node.reading.meta.rssi != null ? getSignalStrength(node.reading.meta.rssi) : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Volume2 size={13} className="text-[#0CA4A4]" />
                      <span>ระดับเสียงรบกวน:</span>
                      <span className="font-semibold text-gray-900 ml-auto font-mono">
                        {online && node.reading.sound.db_avg != null ? `${node.reading.sound.db_avg.toFixed(0)} dB` : '--'}
                      </span>
                    </div>

                    <div className="flex justify-between border-t border-gray-200 pt-2 text-[10px] text-gray-400 font-mono mt-1">
                      <span>RSSI: {online ? `${node.reading.meta.rssi} dBm` : 'N/A'}</span>
                      <span>อัปเดต: {new Date(node.reading.timestamp).toLocaleTimeString('th-TH')} น.</span>
                    </div>
                  </div>
                )}

                {/* Card Action footer bar */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center gap-2">
                  <button
                    onClick={(e) => toggleExpand(nodeId, e)}
                    className="text-[11px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <Eye size={13} />
                    {isExpanded ? 'ซ่อนวินิจฉัย' : 'วินิจฉัยโหนด'}
                  </button>

                  <Link
                    to={`/station/${nodeId}`}
                    className="text-[11px] font-bold text-white bg-[#0CA4A4] hover:bg-[#088383] px-3 py-1.5 rounded-xl transition-all shadow-md shadow-[#0CA4A4]/20 flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <BarChart2 size={13} />
                    รายละเอียด & กราฟ →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
