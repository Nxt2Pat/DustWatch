import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { request } from '../api/client';
import {
  ArrowLeft, Thermometer, Droplets, Wind, Volume2, Wifi,
  Activity, RefreshCw, Sparkles, BarChart2, Info
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface HistoryPoint {
  timestamp: string;
  pm2_5?: number;
  pm10?: number;
  temperature?: number;
  humidity?: number;
  iaq?: number;
  [key: string]: any;
}

interface HorizonPrediction {
  horizon_h: number;
  pm25_pred: number;
  pm25_lower: number;
  pm25_upper: number;
  confidence: number;
  model_type: string;
}

interface NodePredictionData {
  node_id: string;
  generated_at: string;
  model_tier: string;
  horizons: HorizonPrediction[];
}

const timeRanges = [
  { label: '1 ชม.', start: '-1h', interval: '1m' },
  { label: '6 ชม.', start: '-6h', interval: '5m' },
  { label: '24 ชม.', start: '-24h', interval: '15m' },
  { label: '3 วัน', start: '-3d', interval: '30m' },
  { label: '7 วัน', start: '-7d', interval: '1h' },
];

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const nodeData = useStore((state) => state.latest[id ?? '']);
  const nodesMeta = useStore((state) => state.nodesMeta);
  const meta = nodesMeta[id ?? ''];

  const displayName = meta?.display_name || nodeData?.reading.location || id || 'Unknown Station';
  const tag = meta?.tag || '';
  const isOutdoor = tag.toLowerCase().includes('outdoor') || tag.toLowerCase().includes('semi') || displayName.includes('ทางเดิน') || displayName.includes('สนาม');

  // Online status (packet in last 10 minutes)
  const isOnline = !!nodeData && (() => {
    const now = new Date().getTime();
    const ts = new Date(nodeData.reading.timestamp).getTime();
    return (now - ts) / 1000 < 600;
  })();

  // States
  const [selectedRange, setSelectedRange] = useState(timeRanges[2]); // Default 24h
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [predictionData, setPredictionData] = useState<NodePredictionData | null>(null);
  const [isLoadingPred, setIsLoadingPred] = useState<boolean>(false);
  const [activeMetric, setActiveMetric] = useState<'pm2_5' | 'pm10' | 'temperature' | 'humidity' | 'iaq'>('pm2_5');

  // Fetch History for this specific node
  const fetchHistory = async () => {
    if (!id) return;
    setIsLoadingHistory(true);
    try {
      const res = await request<HistoryPoint[]>(`/readings/${id}/history?start=${selectedRange.start}&interval=${selectedRange.interval}`);
      if (res.ok && Array.isArray(res.data)) {
        const formatted = res.data.map((pt) => ({
          ...pt,
          timeLabel: new Date(pt.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          dateLabel: new Date(pt.timestamp).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
        }));
        setHistory(formatted);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to fetch node history:', err);
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch AI Predictions for this node
  const fetchPrediction = async () => {
    if (!id) return;
    setIsLoadingPred(true);
    try {
      const res = await request<NodePredictionData>(`/readings/${id}/prediction`);
      if (res.ok && res.data) {
        setPredictionData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch prediction:', err);
    } finally {
      setIsLoadingPred(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [id, selectedRange]);

  useEffect(() => {
    fetchPrediction();
  }, [id]);

  // AQI Color Helpers
  const getAQIInfo = (score: number) => {
    if (score <= 25) return { label: 'ดีมาก (Excellent)', color: '#0CA4A4', bg: 'bg-[#0CA4A4]/10 text-[#0CA4A4] border-[#0CA4A4]/30' };
    if (score <= 50) return { label: 'ดี (Good)', color: '#10B981', bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' };
    if (score <= 100) return { label: 'ปานกลาง (Moderate)', color: '#F59E0B', bg: 'bg-amber-500/10 text-amber-700 border-amber-500/30' };
    if (score <= 150) return { label: 'เริ่มมีผลต่อสุขภาพ (Unhealthy Sensitive)', color: '#F97316', bg: 'bg-orange-500/10 text-orange-700 border-orange-500/30' };
    if (score <= 200) return { label: 'มีผลต่อสุขภาพ (Unhealthy)', color: '#EF4444', bg: 'bg-rose-500/10 text-rose-700 border-rose-500/30' };
    return { label: 'อันตราย (Hazardous)', color: '#8B5CF6', bg: 'bg-purple-500/10 text-purple-700 border-purple-500/30' };
  };

  const aqiScore = Math.round(nodeData?.aqi?.aqi_score ?? 0);
  const aqiInfo = getAQIInfo(aqiScore);
  const pm25Val = nodeData?.reading?.pm?.pm2_5;
  const pm10Val = nodeData?.reading?.pm?.pm10;
  const tempVal = nodeData?.reading?.env?.temperature;
  const humidVal = nodeData?.reading?.env?.humidity;
  const iaqVal = nodeData?.reading?.env?.iaq;
  const soundVal = nodeData?.reading?.sound?.db_avg;
  const rssiVal = nodeData?.reading?.meta?.rssi;
  const dcsVal = nodeData?.dcs != null ? Math.round(nodeData.dcs * 100) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* ─── Breadcrumb & Header Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border border-white/80 glass-card shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold font-mono"
          >
            <ArrowLeft size={16} />
            <span>กลับ Dashboard</span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#0CA4A4] uppercase px-2 py-0.5 rounded-md bg-[#0CA4A4]/10 border border-[#0CA4A4]/20">
                STATION ID: {id}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono ${
                isOutdoor
                  ? 'bg-sky-500/10 text-sky-700 border-sky-500/20'
                  : 'bg-[#0CA4A4]/10 text-[#0CA4A4] border-[#0CA4A4]/20'
              }`}>
                {isOutdoor ? '🌳 ภายนอกอาคาร / ทางเดิน' : '🏫 ภายในอาคารเรียน'}
              </span>
              {dcsVal !== null && (
                <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border ${
                  dcsVal >= 85 ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                }`}>
                  DCS Confidence: {dcsVal}%
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-sans">
              {displayName}
            </h1>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white/80 border border-gray-200/80 px-4 py-2 rounded-2xl shadow-sm">
          <span className={`w-3 h-3 rounded-full ${
            isOnline ? 'bg-[#0CA4A4] shadow-[0_0_10px_rgba(12,164,164,0.6)] animate-pulse' : 'bg-rose-500'
          }`} />
          <div>
            <span className="text-xs font-bold text-gray-900 font-mono block">
              {isOnline ? 'ONLINE (พร้อมใช้งาน)' : 'OFFLINE (ขาดการติดต่อ)'}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {nodeData ? `อัปเดต: ${new Date(nodeData.reading.timestamp).toLocaleTimeString('th-TH')} น.` : 'ไม่มีข้อมูล'}
            </span>
          </div>
        </div>
      </div>

      {/* Node Location Photo Banner */}
      {meta?.image_url && (
        <div className="relative w-full h-56 sm:h-72 rounded-3xl overflow-hidden glass-card border border-white/80 shadow-xl group">
          <img
            src={meta.image_url}
            alt={displayName}
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent flex items-end p-6">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#0CA4A4] bg-[#0CA4A4]/20 border border-[#0CA4A4]/40 px-2.5 py-1 rounded-md uppercase backdrop-blur-md">
                LOCATION PHOTO • {displayName}
              </span>
              <p className="text-xs text-gray-200 mt-1 font-sans">
                ภาพสถานที่ติดตั้งเครื่องวัดคุณภาพอากาศและตรวจวัดสภาพแวดล้อมจริงประจำโหนด
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Hero Summary Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Big AQI Score Gauge */}
        <div className="md:col-span-4 glass-card p-6 border border-white/80 shadow-xl flex flex-col justify-between items-center text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#0CA4A4]/10 blur-2xl pointer-events-none" />
          
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 font-mono mb-2">
            ดัชนีคุณภาพอากาศ (AIR QUALITY INDEX)
          </span>

          <div className="my-3 relative flex items-center justify-center w-36 h-36 rounded-full border-4 border-[#0CA4A4]/20 bg-white/60 backdrop-blur-md shadow-inner">
            <div className="text-center">
              <span className="block text-5xl font-black font-mono text-gray-900 tracking-tighter">
                {isOnline ? aqiScore : '--'}
              </span>
              <span className="block text-[10px] font-bold uppercase text-gray-400 font-mono">AQI SCORE</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <span className={`inline-block w-full py-1.5 px-3 rounded-xl border text-xs font-bold font-mono ${aqiInfo.bg}`}>
              {isOnline ? aqiInfo.label : 'ขาดการเชื่อมต่อ'}
            </span>
            <p className="text-xs text-gray-500 font-medium">
              {isOutdoor ? 'ค่าดัชนีคุณภาพอากาศบริเวณทางเดิน/ลานกิจกรรม' : 'ค่าดัชนีคุณภาพอากาศภายในห้องเรียน'}
            </p>
          </div>
        </div>

        {/* PM2.5 Instant + Detailed Sub-metrics */}
        <div className="md:col-span-8 glass-card p-6 border border-white/80 shadow-xl space-y-5">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
              <Activity size={16} className="text-[#0CA4A4]" />
              ข้อมูลตรวจวัดสภาพแวดล้อม Real-time
            </h3>
            <button
              onClick={fetchHistory}
              className="text-xs font-mono text-[#0CA4A4] hover:text-[#088383] flex items-center gap-1 font-bold cursor-pointer"
            >
              <RefreshCw size={12} /> รีเฟรช
            </button>
          </div>

          {/* Metric Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* PM2.5 */}
            <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 font-sans block">PM2.5 Instant</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-gray-900">
                  {isOnline && pm25Val != null ? pm25Val.toFixed(1) : '--'}
                </span>
                <span className="text-xs font-bold text-gray-400 font-sans">µg/m³</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-[#0CA4A4] block">เกณฑ์มาตรฐาน PCD</span>
            </div>

            {/* PM10 */}
            <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 font-sans block">PM10 Instant</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-gray-900">
                  {isOnline && pm10Val != null ? pm10Val.toFixed(1) : '--'}
                </span>
                <span className="text-xs font-bold text-gray-400 font-sans">µg/m³</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-600 block">ฝุ่นหยาบระบายอากาศ</span>
            </div>

            {/* Temperature */}
            <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 font-sans block flex items-center gap-1">
                <Thermometer size={12} className="text-amber-500" /> อุณหภูมิ
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-gray-900">
                  {isOnline && tempVal != null ? tempVal.toFixed(1) : '--'}
                </span>
                <span className="text-xs font-bold text-gray-400 font-sans">°C</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-amber-600 block">สภาวะความร้อนห้อง</span>
            </div>

            {/* Humidity */}
            <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 font-sans block flex items-center gap-1">
                <Droplets size={12} className="text-sky-500" /> ความชื้น
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-gray-900">
                  {isOnline && humidVal != null ? humidVal.toFixed(1) : '--'}
                </span>
                <span className="text-xs font-bold text-gray-400 font-sans">%</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-sky-600 block">ความชื้นสัมพัทธ์</span>
            </div>
          </div>

          {/* Secondary Diagnostic Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100 text-xs">
              <span className="text-gray-500 font-medium flex items-center gap-1.5">
                <Wind size={14} className="text-[#0CA4A4]" /> IAQ Index
              </span>
              <span className="font-bold text-gray-900 font-mono">
                {isOnline && iaqVal != null ? iaqVal.toFixed(1) : '--'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100 text-xs">
              <span className="text-gray-500 font-medium flex items-center gap-1.5">
                <Volume2 size={14} className="text-[#0CA4A4]" /> เสียงรบกวน
              </span>
              <span className="font-bold text-gray-900 font-mono">
                {isOnline && soundVal != null ? `${soundVal.toFixed(0)} dBA` : '--'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 border border-gray-100 text-xs">
              <span className="text-gray-500 font-medium flex items-center gap-1.5">
                <Wifi size={14} className="text-[#0CA4A4]" /> สัญญาณ Wi-Fi
              </span>
              <span className="font-bold text-gray-900 font-mono">
                {isOnline && rssiVal != null ? `${rssiVal} dBm` : '--'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── DEDICATED INTERACTIVE CHART SECTION ─── */}
      <div className="glass-card p-6 border border-white/80 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 font-sans flex items-center gap-2">
              <BarChart2 size={20} className="text-[#0CA4A4]" />
              กราฟแนวโน้มพฤติกรรมข้อมูลย้อนหลังของโหนด {displayName}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 font-sans">
              เลือกช่วงเวลาและพารามิเตอร์ที่ต้องการวิเคราะห์แนวโน้มโดยละเอียด
            </p>
          </div>

          {/* Range Selector Pills */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200/60 font-mono text-xs">
            {timeRanges.map((range) => (
              <button
                key={range.start}
                onClick={() => setSelectedRange(range)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedRange.start === range.start
                    ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/20'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Selector Pills */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveMetric('pm2_5')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
              activeMetric === 'pm2_5' ? 'bg-[#0CA4A4] text-white border-[#0CA4A4]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            ฝุ่น PM2.5 (µg/m³)
          </button>
          <button
            onClick={() => setActiveMetric('pm10')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
              activeMetric === 'pm10' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            ฝุ่น PM10 (µg/m³)
          </button>
          <button
            onClick={() => setActiveMetric('temperature')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
              activeMetric === 'temperature' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            อุณหภูมิ (°C)
          </button>
          <button
            onClick={() => setActiveMetric('humidity')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
              activeMetric === 'humidity' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            ความชื้น (%)
          </button>
          <button
            onClick={() => setActiveMetric('iaq')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
              activeMetric === 'iaq' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            มลพิษ IAQ
          </button>
        </div>

        {/* Recharts Render Viewport */}
        <div className="w-full h-[350px] pt-2">
          {isLoadingHistory ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs font-mono space-y-2">
              <RefreshCw size={24} className="animate-spin text-[#0CA4A4]" />
              <span>กำลังโหลดข้อมูลย้อนหลังจากฐานข้อมูล InfluxDB...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs font-mono space-y-2 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <Info size={24} className="text-gray-400" />
              <span>ไม่พบข้อมูลอนุกรมเวลาสำหรับช่วงเวลา {selectedRange.label}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={
                        activeMetric === 'pm2_5' ? '#0CA4A4' :
                        activeMetric === 'pm10' ? '#059669' :
                        activeMetric === 'temperature' ? '#F59E0B' :
                        activeMetric === 'humidity' ? '#0284C7' : '#8B5CF6'
                      }
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={
                        activeMetric === 'pm2_5' ? '#0CA4A4' :
                        activeMetric === 'pm10' ? '#059669' :
                        activeMetric === 'temperature' ? '#F59E0B' :
                        activeMetric === 'humidity' ? '#0284C7' : '#8B5CF6'
                      }
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="timeLabel" stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace' }}
                />
                <Area
                  type="monotone"
                  dataKey={activeMetric}
                  name={
                    activeMetric === 'pm2_5' ? 'ฝุ่น PM2.5 (µg/m³)' :
                    activeMetric === 'pm10' ? 'ฝุ่น PM10 (µg/m³)' :
                    activeMetric === 'temperature' ? 'อุณหภูมิ (°C)' :
                    activeMetric === 'humidity' ? 'ความชื้น (%)' : 'มลพิษ IAQ'
                  }
                  stroke={
                    activeMetric === 'pm2_5' ? '#0CA4A4' :
                    activeMetric === 'pm10' ? '#059669' :
                    activeMetric === 'temperature' ? '#F59E0B' :
                    activeMetric === 'humidity' ? '#0284C7' : '#8B5CF6'
                  }
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#metricGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ─── DEDICATED AI FORECAST SECTION FOR THIS NODE ─── */}
      <div className="glass-card p-6 border border-white/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-[#0CA4A4]/15 text-[#0CA4A4] border border-[#0CA4A4]/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-sans tracking-tight">
                ผลการพยากรณ์ปัญญาประดิษฐ์ (AI PM2.5 Forecast) สำหรับโหนด {displayName}
              </h3>
              <p className="text-xs text-gray-500 font-sans">
                โมเดล Machine Learning (XGBoost / LightGBM) คาดการณ์ระดับฝุ่นละอองล่วงหน้าในอีก 1h, 3h, 6h
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#0CA4A4] bg-[#0CA4A4]/10 border border-[#0CA4A4]/20 px-2.5 py-1 rounded-full uppercase">
            Model: {predictionData?.model_tier || 'Cold-Start Heuristics'}
          </span>
        </div>

        {isLoadingPred ? (
          <div className="text-xs text-gray-400 font-mono text-center py-6 animate-pulse">กำลังคำนวณผลพยากรณ์ AI...</div>
        ) : predictionData?.horizons && predictionData.horizons.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {predictionData.horizons.map((pred) => {
              const estimatedAqi = Math.round(pred.pm25_pred * 2.5);
              const predInfo = getAQIInfo(estimatedAqi);
              return (
                <div key={pred.horizon_h} className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold font-mono text-gray-700 uppercase">
                      คาดการณ์ {pred.horizon_h} ชั่วโมงข้างหน้า
                    </span>
                    <span className="text-[9px] font-mono text-[#0CA4A4] font-bold px-2 py-0.5 rounded bg-[#0CA4A4]/10">
                      Conf: {Math.round(pred.confidence * 100)}%
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 my-1">
                    <span className="text-4xl font-black font-mono text-gray-900">
                      {pred.pm25_pred.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-gray-400 font-sans">µg/m³ PM2.5</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block font-mono ${predInfo.bg}`}>
                      {predInfo.label}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">
                      ช่วง: {pred.pm25_lower.toFixed(1)} - {pred.pm25_upper.toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-gray-500 text-center py-6 font-mono">
            ระบบกำลังประมวลผลข้อมูลอนุกรมเวลาเพื่อทำนายล่วงหน้า
          </div>
        )}
      </div>

    </div>
  );
}
