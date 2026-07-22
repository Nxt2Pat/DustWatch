import { useState, useEffect } from 'react';
import { Sun, Droplets, Gauge, ShieldCheck, HeartPulse, CheckCircle2, AlertTriangle, Activity, Volume2, CloudSun, Building2, Trees } from 'lucide-react';
import type { NodeData, CentralSummaryData } from '../types/sensor';
import { request } from '../api/client';

interface SchoolAqiHeroCardProps {
  nodeData?: NodeData | null;
  schoolName?: string;
  totalNodes?: number;
  onlineNodes?: number;
  defaultEnvMode?: 'indoor' | 'outdoor';
}

export default function SchoolAqiHeroCard({ 
  nodeData, 
  schoolName = 'โรงเรียนเทพศิรินทร์ สมุทรปราการ',
  totalNodes = 0,
  onlineNodes = 0,
  defaultEnvMode = 'indoor'
}: SchoolAqiHeroCardProps) {
  const [summary, setSummary] = useState<CentralSummaryData | null>(null);
  const [envMode, setEnvMode] = useState<'indoor' | 'outdoor'>(defaultEnvMode);

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      try {
        const res = await request<CentralSummaryData>('/readings/summary');
        if (isMounted && res.ok && res.data) {
          setSummary(res.data);
        }
      } catch (e) {
        console.error('Failed to fetch summary in hero card', e);
      }
    };

    fetchSummary();
    const timer = setInterval(fetchSummary, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Determine active environment stats
  const activeEnvSummary = envMode === 'indoor' ? summary?.indoor : summary?.outdoor;

  const pm25Raw = nodeData?.reading?.pm?.pm2_5 ?? activeEnvSummary?.averages?.pm2_5 ?? summary?.averages?.pm2_5 ?? null;
  const pm10Raw = nodeData?.reading?.pm?.pm10 ?? activeEnvSummary?.averages?.pm10 ?? summary?.averages?.pm10 ?? null;
  const aqiScoreRaw = nodeData?.aqi?.aqi_score ?? activeEnvSummary?.averages?.aqi_score ?? summary?.averages?.aqi_score ?? 0;
  const tempRaw = nodeData?.reading?.env?.temperature ?? activeEnvSummary?.averages?.temperature ?? summary?.averages?.temperature ?? null;
  const humidRaw = nodeData?.reading?.env?.humidity ?? activeEnvSummary?.averages?.humidity ?? summary?.averages?.humidity ?? null;
  const iaqRaw = nodeData?.reading?.env?.iaq ?? activeEnvSummary?.averages?.iaq ?? summary?.averages?.iaq ?? null;
  const soundRaw = nodeData?.reading?.sound?.db_avg ?? null;

  // Format numbers cleanly
  const pm25Str = pm25Raw != null ? pm25Raw.toFixed(1) : '--';
  const pm10Str = pm10Raw != null ? pm10Raw.toFixed(1) : '--';
  const aqiScore = Math.round(aqiScoreRaw);
  const tempStr = tempRaw != null ? tempRaw.toFixed(1) : '--';
  const humidStr = humidRaw != null ? humidRaw.toFixed(1) : '--';
  const iaqStr = iaqRaw != null ? iaqRaw.toFixed(1) : '--';
  const soundStr = soundRaw != null ? soundRaw.toFixed(0) : '--';

  const envTotalNodes = activeEnvSummary?.status?.total_active ?? 0;
  const envOnlineNodes = activeEnvSummary?.status?.online ?? 0;

  const displayTotal = totalNodes > 0 ? totalNodes : envTotalNodes;
  const displayOnline = onlineNodes > 0 ? onlineNodes : envOnlineNodes;

  // Status text based on environment & real telemetry
  const getEnvStatusText = () => {
    if (tempRaw == null || humidRaw == null) return 'ข้อมูลสดจากสถานี';
    if (envMode === 'indoor') {
      if (tempRaw > 30.0) return 'ห้องเรียนอุณหภูมิสูง ควรเปิดแอร์/พัดลม';
      return 'สภาวะแวดล้อมห้องเรียนปกติ';
    } else {
      if (tempRaw > 34.0) return 'สภาพอากาศกลางแจ้งร้อนจัด';
      return 'สภาวะอากาศภายนอกอาคารปกติ';
    }
  };

  // Environment-specific AQI status mapping
  const getAQIStatus = (score: number, mode: 'indoor' | 'outdoor') => {
    if (score <= 50) return {
      level: 'ดีมาก (Good)',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      heroGlow: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      textAccent: 'text-emerald-600',
      circleBorder: 'border-emerald-500',
      circleBg: 'bg-emerald-500/10',
      advice: mode === 'indoor'
        ? 'คุณภาพอากาศภายในห้องเรียนดีมาก สามารถเปิดประตูระบายอากาศได้ปกติ'
        : 'คุณภาพอากาศภายนอกดีมาก เหมาะสำหรับการทำกิจกรรม outdoor และเรียนพละกลางแจ้ง',
      icon: CheckCircle2,
      adviceBg: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20'
    };
    if (score <= 100) return {
      level: 'ปานกลาง (Moderate)',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      heroGlow: 'from-amber-500/10 via-yellow-500/5 to-transparent',
      textAccent: 'text-amber-600',
      circleBorder: 'border-amber-500',
      circleBg: 'bg-amber-500/10',
      advice: mode === 'indoor'
        ? 'คุณภาพอากาศปานกลาง แนะนำเปิดระบบหมุนเวียนอากาศหรือเครื่องฟอกอากาศในห้อง'
        : 'คุณภาพอากาศปานกลาง นักเรียนกลุ่มเสี่ยงควรลดระยะเวลาทำกิจกรรมกลางแจ้งนานๆ',
      icon: ShieldCheck,
      adviceBg: 'bg-amber-500/10 text-amber-800 border-amber-500/20'
    };
    if (score <= 150) return {
      level: 'เริ่มมีผลกระทบ (Unhealthy for Sensitive)',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      heroGlow: 'from-orange-500/10 via-amber-500/5 to-transparent',
      textAccent: 'text-orange-600',
      circleBorder: 'border-orange-500',
      circleBg: 'bg-orange-500/10',
      advice: mode === 'indoor'
        ? 'ปิดประตูหน้าต่างห้องเรียน และเปิดเครื่องฟอกอากาศกรองฝุ่นละอองด่วน'
        : 'สวมหน้ากากอนามัย N95 เมื่อออกเดินนอกอาคารหรือกึ่งทางเดินเชื่อมอาคาร',
      icon: AlertTriangle,
      adviceBg: 'bg-orange-500/10 text-orange-800 border-orange-500/20'
    };
    return {
      level: 'เริ่มมีผลต่อสุขภาพ (Unhealthy)',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      heroGlow: 'from-rose-500/10 via-red-500/5 to-transparent',
      textAccent: 'text-rose-600',
      circleBorder: 'border-rose-500',
      circleBg: 'bg-rose-500/10',
      advice: mode === 'indoor'
        ? 'สวมหน้ากากอนามัยในห้องเรียน เปิดเครื่องฟอกอากาศระดับสูงสุด'
        : 'งดเว้นกิจกรรมกลางแจ้งทุกชนิด นักเรียนทุกคนควรอยู่ภายในห้องเรียนปรับอากาศ',
      icon: AlertTriangle,
      adviceBg: 'bg-rose-500/10 text-rose-800 border-rose-500/20'
    };
  };

  const status = getAQIStatus(aqiScore, envMode);
  const StatusIcon = status.icon;

  return (
    <div className="glass-card p-6 md:p-8 relative overflow-hidden fade-up">
      {/* Soft teal ambient background glow */}
      <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-[#0CA4A4]/10 blur-3xl pointer-events-none" />

      {/* Top Navigation & Environment Segmented Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/50 pb-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider bg-[#0CA4A4]/10 text-[#0CA4A4] border border-[#0CA4A4]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0CA4A4] animate-pulse" />
              SENSOR MATRIX
            </span>
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <CloudSun size={14} className="text-amber-500 shrink-0" />
              {getEnvStatusText()}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 font-sans tracking-tight">
            {schoolName}
          </h2>
        </div>

        {/* Environment Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-gray-100/80 p-1.5 rounded-full border border-gray-200/60 backdrop-blur-md shrink-0">
          <button
            onClick={() => setEnvMode('indoor')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
              envMode === 'indoor'
                ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Building2 size={15} />
            <span>🏫 ภายในอาคาร</span>
          </button>

          <button
            onClick={() => setEnvMode('outdoor')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
              envMode === 'outdoor'
                ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Trees size={15} />
            <span>🌳 ภายนอก/ทางเดิน</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout: AQI Gauge & Environment Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
        {/* Left Col: Prominent AQI Big Gauge */}
        <div className="md:col-span-6 flex flex-col sm:flex-row items-center gap-6">
          {/* Circular AQI Gauge */}
          <div className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 border-[#0CA4A4]/30 bg-white/70 backdrop-blur-md shadow-lg shadow-[#0CA4A4]/10 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 font-mono">
              {envMode === 'indoor' ? 'INDOOR AQI' : 'OUTDOOR AQI'}
            </span>
            <span className="text-5xl font-black font-mono text-gray-900 tracking-tighter my-0.5">
              {aqiScore}
            </span>
            <span className="text-xs font-bold text-[#0CA4A4] font-mono bg-[#0CA4A4]/10 px-2.5 py-0.5 rounded-full border border-[#0CA4A4]/20">
              {pm25Str} µg/m³
            </span>
          </div>

          {/* AQI Description & Environment Title */}
          <div className="space-y-2 text-center sm:text-left">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.badgeBg}`}>
              <StatusIcon size={14} />
              {status.level}
            </span>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight font-sans">
              {envMode === 'indoor' ? 'คุณภาพอากาศภายในอาคารเรียน' : 'คุณภาพอากาศภายนอก & ทางเดิน'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
              {envMode === 'indoor' 
                ? 'คำนวณแยกเฉพาะโหนดเซนเซอร์ประจำห้องเรียน ห้องปฏิบัติการ และห้องสมุด'
                : 'คำนวณแยกเฉพาะโหนดเซนเซอร์ลานกิจกรรม ทางเดินเชื่อม และลานกีฬา'}
            </p>
          </div>
        </div>

        {/* Right Col: Real Hardware Telemetry Parameters Matrix */}
        <div className="md:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Real Temp */}
          <div className="bg-white/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium mb-1">
              <Sun size={15} className="text-amber-500" />
              <span>{envMode === 'indoor' ? 'อุณหภูมิห้อง' : 'อุณหภูมิภายนอก'}</span>
            </div>
            <span className="text-xl font-bold text-gray-900 font-mono">
              {tempStr}°C
            </span>
            <span className="text-[10px] text-gray-400">{envMode === 'indoor' ? 'ในอาคารเรียน' : 'กลางแจ้ง/ทางเดิน'}</span>
          </div>

          {/* Real Humidity */}
          <div className="bg-white/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium mb-1">
              <Droplets size={15} className="text-sky-500" />
              <span>ความชื้น</span>
            </div>
            <span className="text-xl font-bold text-gray-900 font-mono">
              {humidStr}%
            </span>
            <span className="text-[10px] text-gray-400">ระดับความชื้นสัมพัทธ์</span>
          </div>

          {/* Real PM10 */}
          <div className="bg-white/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium mb-1">
              <Activity size={15} className="text-[#0CA4A4]" />
              <span>ค่าฝุ่น PM10</span>
            </div>
            <span className="text-xl font-bold text-gray-900 font-mono">
              {pm10Str} <span className="text-xs text-gray-400 font-normal font-sans">µg/m³</span>
            </span>
            <span className="text-[10px] text-gray-400">ฝุ่นละอองขนาดใหญ่</span>
          </div>

          {/* Real IAQ Index */}
          <div className="bg-white/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium mb-1">
              <Gauge size={15} className="text-purple-500" />
              <span>ดัชนี IAQ</span>
            </div>
            <span className="text-xl font-bold text-gray-900 font-mono">
              {iaqStr}
            </span>
            <span className="text-[10px] text-gray-400">มลพิษในอาคาร</span>
          </div>

          {/* Real Sound Level */}
          <div className="bg-white/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium mb-1">
              <Volume2 size={15} className="text-indigo-500" />
              <span>ระดับเสียง</span>
            </div>
            <span className="text-xl font-bold text-gray-900 font-mono">
              {soundStr} <span className="text-xs text-gray-400 font-normal font-sans">dB</span>
            </span>
            <span className="text-[10px] text-gray-400">ระดับเสียงแวดล้อม</span>
          </div>

          {/* Sensor Nodes Online Count (Dynamic Environment Count) */}
          <div className="bg-white/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/80 shadow-xs flex flex-col">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium mb-1">
              <HeartPulse size={15} className="text-[#0CA4A4]" />
              <span>สถานีโซนนี้</span>
            </div>
            <span className="text-xl font-bold text-[#0CA4A4] font-mono">
              {displayOnline}/{displayTotal} <span className="text-xs text-gray-400 font-normal font-sans">โหนด</span>
            </span>
            <span className="text-[10px] text-[#0CA4A4] font-medium font-mono">
              {displayOnline === displayTotal ? 'ONLINE' : `ONLINE ${displayOnline}`}
            </span>
          </div>
        </div>
      </div>

      {/* Student Activity & Health Advice Banner */}
      <div className={`mt-6 p-4 rounded-2xl border backdrop-blur-md flex items-start gap-3 relative z-10 ${status.adviceBg}`}>
        <ShieldCheck size={20} className="shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-bold block mb-0.5">
            ข้อแนะนำสำหรับโซน {envMode === 'indoor' ? 'ภายในอาคารเรียน' : 'ภายนอกอาคาร/กึ่งทางเดิน'}:
          </span>
          <span>{status.advice}</span>
        </div>
      </div>
    </div>
  );
}

