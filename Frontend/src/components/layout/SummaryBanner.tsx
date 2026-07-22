import { useEffect, useState } from 'react';
import { request } from '../../api/client';
import type { CentralSummaryData } from '../../types/sensor';
import { ShieldCheck, Activity, HeartHandshake, Wind, Radio, Sparkles, Megaphone } from 'lucide-react';

export interface HealthCustomSettings {
  announcement?: string;
  outdoor?: string;
  sensitive?: string;
  ventilation?: string;
}

export default function SummaryBanner() {
  const [summary, setSummary] = useState<CentralSummaryData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [customSettings, setCustomSettings] = useState<HealthCustomSettings>({});

  // Load custom settings from localStorage and BroadcastChannel
  const loadCustomSettings = () => {
    try {
      const saved = localStorage.getItem('dustwatch_health_custom_settings');
      if (saved) {
        setCustomSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse custom health settings", e);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await request<CentralSummaryData>('/readings/summary');
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
    loadCustomSettings();

    const interval = setInterval(fetchSummary, 5000);

    // Cross-tab BroadcastChannel listener for real-time edits from Admin Panel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('dustwatch_health_settings');
      channel.onmessage = (event) => {
        if (event.data) {
          setCustomSettings(event.data);
        }
      };
    } catch (e) {
      console.log('BroadcastChannel not supported', e);
    }

    // Window storage event fallback
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dustwatch_health_custom_settings') {
        loadCustomSettings();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const totalNodes = summary?.status.total_active ?? 0;
  const onlineNodes = summary?.status.online ?? 0;
  const avgAQI = summary?.averages.aqi_score ?? 0;
  const avgDCS = summary ? Math.round(summary.averages.dcs * 100) : null;

  const todayDateStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  // Health Guidance Generator based on AQI
  const getHealthGuidance = (aqi: number) => {
    if (totalNodes === 0 || onlineNodes === 0) {
      return {
        statusText: 'ขาดการติดต่อ',
        statusBg: 'bg-gray-100 text-gray-600 border-gray-200',
        outdoor: 'ระบบไม่ได้รับข้อมูลล่าสุดจากสถานีบอร์ดวัดฝุ่น',
        sensitive: 'โปรดตรวจสอบสถานะการเชื่อมต่อกล่องเซนเซอร์',
        ventilation: 'ระบายอากาศตามความเหมาะสม',
      };
    }
    if (aqi <= 25) {
      return {
        statusText: 'ปลอดภัยสูง (Air Safety: Excellent)',
        statusBg: 'bg-[#0CA4A4]/10 text-[#0CA4A4] border-[#0CA4A4]/30',
        outdoor: 'เข้าแถวเคารพธงชาติ เล่นกีฬา และทำกิจกรรมกลางแจ้งได้ตามปกติ 100%',
        sensitive: 'นักเรียนที่มีโรคหอบหืด/ภูมิแพ้ ทำกิจกรรมร่วมกับผู้อื่นได้ตามปกติโดยไม่มีข้อจำกัด',
        ventilation: 'แนะนำเปิดประตูหน้าต่างเพื่อระบายและถ่ายเทอากาศบริสุทธิ์เข้าสู่ห้องเรียน',
      };
    }
    if (aqi <= 50) {
      return {
        statusText: 'ปลอดภัยปกติ (Air Safety: Good)',
        statusBg: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
        outdoor: 'ทำกิจกรรมกลางแจ้งและออกกำลังกายได้ตามปกติ',
        sensitive: 'นักเรียนกลุ่มเสี่ยงสามารถทำกิจกรรมกลางแจ้งได้ ควรสังเกตอาการเบื้องต้น',
        ventilation: 'เปิดประตูและหน้าต่างระบายอากาศภายในห้องเรียนได้ตามปกติ',
      };
    }
    if (aqi <= 100) {
      return {
        statusText: 'ปานกลาง (Air Safety: Moderate)',
        statusBg: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
        outdoor: 'สามารถทำกิจกรรมกลางแจ้งได้ สวมใส่หน้ากากอนามัยเมื่ออยู่นอกอาคารเวลานาน',
        sensitive: 'นักเรียนที่เป็นโรคทางเดินหายใจ/ภูมิแพ้ ควรลดเวลาทำกิจกรรมกลางแจ้งที่ใช้แรงมาก',
        ventilation: 'แนะนำเปิดพัดลมหมุนเวียนอากาศ และเตรียมพร้อมใช้เครื่องฟอกอากาศ',
      };
    }
    return {
      statusText: 'เริ่มมีผลต่อสุขภาพ (Air Safety: Unhealthy)',
      statusBg: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
      outdoor: 'งดหรือลดเวลาทำกิจกรรมกลางแจ้ง ย้ายเข้าแถวเคารพธงชาติในโดม/ร่มอาคาร',
      sensitive: 'นักเรียนกลุ่มเสี่ยงงดทำกิจกรรมกลางแจ้งเด็ดขาด และสวมหน้ากากอนามัยชนิดป้องกันฝุ่น',
      ventilation: 'ปิดประตูหน้าต่างห้องเรียน และเปิดเครื่องฟอกอากาศเต็มกำลัง',
    };
  };

  const defaultGuidance = getHealthGuidance(avgAQI);

  // Apply overrides if customized in Admin Panel
  const outdoorText = customSettings.outdoor?.trim() || defaultGuidance.outdoor;
  const sensitiveText = customSettings.sensitive?.trim() || defaultGuidance.sensitive;
  const ventilationText = customSettings.ventilation?.trim() || defaultGuidance.ventilation;

  return (
    <div className="glass-card p-6 font-sans space-y-5 fade-up max-w-6xl mx-auto border border-white/80 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#0CA4A4]/15 text-[#0CA4A4] p-2 rounded-2xl border border-[#0CA4A4]/30">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 font-sans tracking-tight">
              ดัชนีความปลอดภัยทางสุขภาพและกิจกรรมโรงเรียน (School Health & Air Safety Index)
            </h3>
            <span className="text-[11px] text-gray-500 font-medium block">
              ประเมินข้อปฏิบัติตามมาตรฐานการแพทย์และกรมควบคุมโรค สำหรับนักเรียนและบุคลากร
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-400 font-bold">{todayDateStr} ({lastUpdated} น.)</span>
          <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${defaultGuidance.statusBg} shadow-xs font-sans`}>
            {defaultGuidance.statusText}
          </span>
        </div>
      </div>

      {/* Custom Announcement Urgent Notice Banner (if set by Admin) */}
      {customSettings.announcement && customSettings.announcement.trim() !== '' && (
        <div className="bg-[#0CA4A4]/10 border border-[#0CA4A4]/30 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <div className="bg-[#0CA4A4] text-white p-2 rounded-xl shrink-0 mt-0.5">
            <Megaphone size={16} className="animate-bounce" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#0CA4A4] font-sans block uppercase tracking-wider">
              📢 ประกาศพิเศษด่วนจากโรงเรียน (School Custom Notice)
            </span>
            <p className="text-xs font-semibold text-gray-800 leading-relaxed mt-0.5">
              {customSettings.announcement}
            </p>
          </div>
        </div>
      )}

      {/* 4 Health & Safety Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Outdoor Activity */}
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/90 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#0CA4A4]" />
              <span className="text-xs font-bold text-gray-900 font-sans">
                ⚽ กิจกรรมพลศึกษา & กลางแจ้ง
              </span>
            </div>
            {customSettings.outdoor?.trim() && (
              <span className="text-[9px] font-bold text-[#0CA4A4] bg-[#0CA4A4]/10 px-2 py-0.5 rounded-full">
                ✏️ ปรับแต่งโดยโรงเรียน
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed font-sans font-medium">
            {outdoorText}
          </p>
        </div>

        {/* Card 2: Sensitive Shield */}
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/90 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartHandshake size={16} className="text-rose-500" />
              <span className="text-xs font-bold text-gray-900 font-sans">
                🫁 กลุ่มเปราะบาง (หอบหืด/ภูมิแพ้)
              </span>
            </div>
            {customSettings.sensitive?.trim() && (
              <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                ✏️ ปรับแต่งโดยโรงเรียน
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed font-sans font-medium">
            {sensitiveText}
          </p>
        </div>

        {/* Card 3: Classroom Air Circulation */}
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/90 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind size={16} className="text-sky-600" />
              <span className="text-xs font-bold text-gray-900 font-sans">
                🪟 การหมุนเวียนอากาศห้องเรียน
              </span>
            </div>
            {customSettings.ventilation?.trim() && (
              <span className="text-[9px] font-bold text-sky-600 bg-sky-600/10 px-2 py-0.5 rounded-full">
                ✏️ ปรับแต่งโดยโรงเรียน
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed font-sans font-medium">
            {ventilationText}
          </p>
        </div>

        {/* Card 4: Network Health & Season Indicator */}
        <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/90 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-[#0CA4A4]" />
              <span className="text-xs font-bold text-gray-900 font-sans">
                📡 สถานะระบบ & สถิติเครือข่าย
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-400 font-bold">System Telemetry</span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0CA4A4] animate-pulse" />
              <span className="font-bold text-gray-800 font-sans">
                ออนไลน์ {onlineNodes}/{totalNodes} บอร์ด
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-gray-500">DCS:</span>
              <span className="font-bold text-[#0CA4A4]">{avgDCS !== null ? `${avgDCS}%` : '--'}</span>
            </div>
          </div>

          {/* Thai Seasonal Context Bar */}
          {(() => {
            const now = new Date();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const dayIndex = month * 100 + date;

            let name = '';
            let icon = '';
            let bg = '';

            if (dayIndex >= 1016 || dayIndex <= 215) {
              name = 'ฤดูหนาว & ฤดูหมอกควัน (16 ต.ค. - 15 ก.พ.)';
              icon = '🍂🔥';
              bg = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
            } else if (dayIndex >= 216 && dayIndex <= 515) {
              name = 'ฤดูร้อน (16 ก.พ. - 15 พ.ค.)';
              icon = '☀️🌡️';
              bg = 'bg-orange-500/10 text-orange-700 border-orange-500/20';
            } else {
              name = 'ฤดูฝน (16 พ.ค. - 15 ต.ค.)';
              icon = '🌧️⛈️';
              bg = 'bg-sky-500/10 text-sky-700 border-sky-500/20';
            }

            return (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${bg} font-sans mt-1`}>
                <Sparkles size={13} />
                <span>{icon} {name}</span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
