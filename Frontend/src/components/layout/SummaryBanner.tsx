import { useEffect, useState } from 'react';
import { request } from '../../api/client';

interface SummaryData {
  averages: {
    pm2_5: number;
    pm10: number;
    temperature: number;
    humidity: number;
    iaq: number;
    aqi_score: number;
    dcs: number;
  };
  status: {
    total_active: number;
    online: number;
    offline: number;
    simulated: number;
  };
  timestamp: string;
}

export default function SummaryBanner() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchSummary = async () => {
    try {
      const res = await request<SummaryData>('/readings/summary');
      if (res.ok && res.data) {
        setSummary(res.data);
        setLastUpdated(new Date().toLocaleTimeString('th-TH'));
      }
    } catch (err) {
      console.error("Failed to load central averages", err);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 5000); // 5s polling matches TTL cache
    return () => clearInterval(interval);
  }, []);

  const totalNodes = summary?.status.total_active ?? 0;
  const onlineNodes = summary?.status.online ?? 0;

  // Averages
  const avgAQI = summary?.averages.aqi_score ?? 0;
  const avgDCS = summary ? Math.round(summary.averages.dcs * 100) : null;
  const avgTemp = summary?.averages.temperature !== undefined ? summary.averages.temperature.toFixed(1) : '--';
  const avgHumid = summary?.averages.humidity !== undefined ? summary.averages.humidity.toFixed(0) : '--';

  // Dynamic values depending on average AQI
  const getHeroTheme = (aqi: number) => {
    if (totalNodes === 0 || onlineNodes === 0) {
      return {
        gradient: 'from-[#817CA5] to-[#4F4A70]',
        label: 'ขาดการติดต่อ',
        recommendation: 'ระบบไม่ได้รับข้อมูลล่าสุดจากสถานีบอร์ดวัดฝุ่น',
        graphic: 'lines'
      };
    }
    if (aqi <= 25) {
      return {
        gradient: 'from-[#7DD3FC] to-[#0284C7]', // Blue Partly Cloudy
        label: 'อากาศบริสุทธิ์มาก (Excellent)',
        recommendation: 'คุณภาพอากาศสะอาดบริสุทธิ์ เหมาะต่อการทำกิจกรรมนอกอาคารทุกประเภท',
        graphic: 'lines'
      };
    }
    if (aqi <= 50) {
      return {
        gradient: 'from-[#6EE7B7] to-[#059669]', // Forest Green Good
        label: 'อากาศสะอาดปกติ (Good)',
        recommendation: 'ปริมาณฝุ่นอยู่ในเกณฑ์ต่ำ สามารถเปิดประตูระบายอากาศในห้องเรียนได้ปกติ',
        graphic: 'dots'
      };
    }
    if (aqi <= 100) {
      return {
        gradient: 'from-[#FDE047] to-[#CA8A04]', // Gold Yellow Moderate
        label: 'อากาศปานกลาง (Moderate)',
        recommendation: 'เด็กเล็กหรือผู้มีโรคประจำตัวควรสวมใส่หน้ากากอนามัยหากทำกิจกรรมกลางแจ้ง',
        graphic: 'circles'
      };
    }
    if (aqi <= 200) {
      return {
        gradient: 'from-[#FDBA74] to-[#C2410C]', // Soft Orange Unhealthy
        label: 'เริ่มมีผลต่อสุขภาพ (Unhealthy)',
        recommendation: 'งดหรือลดเวลาทำกิจกรรมกลางแจ้งของนักเรียน และเปิดระบบกรองอากาศภายในห้องเรียน',
        graphic: 'waves'
      };
    }
    return {
      gradient: 'from-[#FCA5A5] to-[#B91C1C]', // Dangerous Crimson
      label: 'มีผลต่อสุขภาพรุนแรง (Hazardous)',
      recommendation: '⚠️ งดทำกิจกรรมนอกอาคารโดยเด็ดขาด ปิดประตูหน้าต่าง และประสานงานเปิดเครื่องฟอกอากาศด่วน',
      graphic: 'dense_circles'
    };
  };

  const heroTheme = getHeroTheme(avgAQI);
  const todayDateStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="premium-card overflow-hidden w-full max-w-2xl mx-auto font-sans shadow-xl">
      {/* Top Gradient Hero Block */}
      <div className={`bg-gradient-to-br ${heroTheme.gradient} text-white p-8 relative flex flex-col justify-between min-h-[220px] transition-all duration-700`}>
        
        {/* Location & Time info header */}
        <div className="flex items-center justify-between text-xs font-semibold opacity-90 tracking-wide">
          <span>สถาบันการศึกษา (School Campus)</span>
          <div className="flex flex-col items-end">
            <span className="font-mono">{todayDateStr}</span>
            {lastUpdated && (
              <span className="text-[10px] opacity-75 font-mono mt-0.5">อัปเดตล่าสุด: {lastUpdated} น.</span>
            )}
          </div>
        </div>

        {/* Abstract Particle/Weather Icon in the middle of gradient */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center opacity-85 pointer-events-none">
          {heroTheme.graphic === 'lines' && (
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="10" y1="20" x2="90" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
              <line x1="20" y1="35" x2="80" y2="35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8"/>
              <line x1="10" y1="50" x2="90" y2="50" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
              <line x1="30" y1="65" x2="70" y2="65" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8"/>
              <line x1="15" y1="80" x2="85" y2="80" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
            </svg>
          )}

          {heroTheme.graphic === 'dots' && (
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="4" fill="white" opacity="0.4"/>
              <circle cx="50" cy="20" r="4" fill="white" opacity="0.8"/>
              <circle cx="80" cy="20" r="4" fill="white" opacity="0.4"/>
              <circle cx="35" cy="40" r="4" fill="white" opacity="0.6"/>
              <circle cx="65" cy="40" r="4" fill="white" opacity="0.6"/>
              <circle cx="20" cy="60" r="4" fill="white" opacity="0.8"/>
              <circle cx="50" cy="60" r="4" fill="white" opacity="0.4"/>
              <circle cx="80" cy="60" r="4" fill="white" opacity="0.8"/>
              <circle cx="35" cy="80" r="4" fill="white" opacity="0.5"/>
              <circle cx="65" cy="80" r="4" fill="white" opacity="0.5"/>
            </svg>
          )}

          {heroTheme.graphic === 'circles' && (
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" strokeDasharray="4 4" opacity="0.4"/>
              <circle cx="50" cy="50" r="28" stroke="white" strokeWidth="2.5" opacity="0.7"/>
              <circle cx="50" cy="50" r="16" stroke="white" strokeWidth="3" opacity="0.9"/>
            </svg>
          )}

          {heroTheme.graphic === 'waves' && (
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 20 Q 30 10, 50 20 T 90 20" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
              <path d="M10 40 Q 30 30, 50 40 T 90 40" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8"/>
              <path d="M10 60 Q 30 50, 50 60 T 90 60" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6"/>
              <path d="M10 80 Q 30 70, 50 80 T 90 80" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8"/>
            </svg>
          )}

          {heroTheme.graphic === 'dense_circles' && (
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="42" stroke="white" strokeWidth="4" opacity="0.4"/>
              <circle cx="50" cy="50" r="32" stroke="white" strokeWidth="4" opacity="0.6"/>
              <circle cx="50" cy="50" r="22" stroke="white" strokeWidth="4" opacity="0.8"/>
              <circle cx="50" cy="50" r="12" stroke="white" strokeWidth="5" opacity="0.95"/>
            </svg>
          )}
        </div>

        {/* Large Score display block */}
        <div className="mt-8 relative z-10 flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-extrabold font-serif leading-none tracking-tight">
              {totalNodes > 0 && onlineNodes > 0 ? avgAQI : '--'}
            </span>
            <span className="text-xl font-bold font-sans tracking-wide">AQI</span>
          </div>
          <span className="text-sm font-bold tracking-wider uppercase mt-2 opacity-90">
            {heroTheme.label}
          </span>
        </div>
      </div>

      {/* Under-hero metrics split by dashed dividers */}
      <div className="p-6 bg-white divide-y divide-dashed divide-brand-primary/10">
        
        {/* Row 1: Air Quality details & advice */}
        <div className="pb-4 flex justify-between items-start gap-4">
          <div className="w-1/2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">คุณภาพอากาศเฉลี่ย</span>
            <span className="text-xs font-bold text-text-primary">
              PM2.5 เฉลี่ย: {totalNodes > 0 && onlineNodes > 0 ? `${Math.round(avgAQI * 0.75)} µg/m³` : '--'}
            </span>
          </div>
          <div className="w-1/2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">คำแนะนำกิจกรรม</span>
            <p className="text-[11px] font-semibold text-text-primary leading-relaxed">{heroTheme.recommendation}</p>
          </div>
        </div>

        {/* Row 2: Stations status & Data completeness */}
        <div className="py-4 flex justify-between items-center gap-4">
          <div className="w-1/2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">สถานีวัดออนไลน์</span>
            <span className="text-sm font-extrabold text-text-primary">
              {onlineNodes} <span className="text-text-secondary text-[11px] font-normal">จาก {totalNodes} บอร์ดห้องเรียน</span>
            </span>
          </div>
          <div className="w-1/2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">ความสมบูรณ์ข้อมูล (DCS)</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-extrabold text-text-primary font-mono">{avgDCS !== null ? `${avgDCS}%` : '--'}</span>
              {avgDCS !== null && (
                <div className="w-20 bg-black/5 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-brand-primary transition-all duration-700"
                    style={{ width: `${avgDCS}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Environment averages */}
        <div className="py-4 flex justify-between items-center gap-4">
          <div className="w-1/2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">อุณหภูมิเฉลี่ยสะสม</span>
            <span className="text-sm font-extrabold text-text-primary font-mono">{avgTemp} °C</span>
          </div>
          <div className="w-1/2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">ความชื้นสัมพัทธ์เฉลี่ย</span>
            <span className="text-sm font-extrabold text-text-primary font-mono">{avgHumid} %</span>
          </div>
        </div>

        {/* Row 4: Seasonal Context Indicator */}
        {(() => {
          const now = new Date();
          const month = now.getMonth() + 1;
          const date = now.getDate();
          const dayIndex = month * 100 + date;

          let name = '';
          let icon = '';
          let bg = '';
          let desc = '';
          let duration = '';

          if (dayIndex >= 1016 || dayIndex <= 215) {
            name = 'ฤดูหนาว & ฤดูหมอกควัน';
            icon = '🍂🔥';
            bg = 'bg-amber-500/10 text-amber-600 border-amber-500/25';
            desc = 'ลมอับนิ่ง ฝุ่นสะสมสูงสุดของปี';
            duration = '16 ต.ค. - 15 ก.พ.';
          } else if (dayIndex >= 216 && dayIndex <= 515) {
            name = 'ฤดูร้อน';
            icon = '☀️🌡️';
            bg = 'bg-orange-500/10 text-orange-600 border-orange-500/25';
            desc = 'อากาศแห้ง ฝุ่นระบายฟุ้งตามลมร้อน';
            duration = '16 ก.พ. - 15 พ.ค.';
          } else {
            name = 'ฤดูฝน';
            icon = '🌧️⛈️';
            bg = 'bg-sky-500/10 text-sky-600 border-sky-500/25';
            desc = 'น้ำฝนชะล้างฝุ่นละออง อากาศสะอาดสูงสุด';
            duration = '16 พ.ค. - 15 ต.ค.';
          }

          return (
            <div className="pt-4 flex justify-between items-center gap-4">
              <div className="w-full">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">สถานะฤดูกาลปัจจุบันตามปฏิทินไทย</span>
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${bg} transition-all`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{icon}</span>
                    <span className="text-xs font-bold">{name}</span>
                    <span className="text-[10px] font-bold opacity-75 bg-black/5 px-1.5 py-0.5 rounded">({duration})</span>
                  </div>
                  <span className="text-[10px] opacity-90 font-medium hidden md:inline">{desc}</span>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
