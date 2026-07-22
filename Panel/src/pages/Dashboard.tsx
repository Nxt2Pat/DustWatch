import { useState, useEffect } from 'react';
import { useStore } from '../store';
import type { NodeMeta } from '../store';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import AQIGaugeCard from '../components/cards/AQIGaugeCard';
import SummaryBanner from '../components/layout/SummaryBanner';
import AlertTicker from '../components/alerts/AlertTicker';
import EmptyState from '../components/ui/EmptyState';
import MapPositionEditor from '../components/MapPositionEditor';
import BackgroundManagerModal, { type BackgroundConfig } from '../components/BackgroundManagerModal';

import { getApiBaseUrl } from '../api/sourceConfig';

const API_BASE = getApiBaseUrl();

interface SystemHealth {
  status: string;
  services?: { sqlite?: string; influxdb?: string; mqtt?: string };
  uptime_seconds?: number;
}

interface NodeConfigItem {
  active: number;
  display_name: string;
  tag: string;
  status: string;
  confirmed: number;
  pos_x: number;
  pos_y: number;
  floor: number;
  image_url: string;
  image_urls: string[];
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
  const [tempConfigs, setTempConfigs] = useState<Record<string, NodeConfigItem>>({});
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
  }, []);

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
    const configs: Record<string, NodeConfigItem> = {};
    let firstActiveId: string | null = null;
    allNodeIds.forEach((id) => {
      const meta = nodesMeta[id];
      const nodeData = latest[id];
      const active = meta ? meta.active : 1;
      const primaryImg = meta ? (meta.image_url ?? '') : '';
      const listImgs = meta?.image_urls && Array.isArray(meta.image_urls) 
        ? meta.image_urls 
        : (primaryImg ? [primaryImg] : []);

      configs[id] = {
        active,
        display_name: meta ? meta.display_name : (nodeData?.reading.location || id),
        tag: meta ? (meta.tag ?? '') : '',
        status: meta ? (meta.status ?? 'unconfirmed') : 'unconfirmed',
        confirmed: meta ? (meta.confirmed ?? 0) : 0,
        pos_x: meta ? (meta.pos_x ?? 0.0) : 0.0,
        pos_y: meta ? (meta.pos_y ?? 0.0) : 0.0,
        floor: meta ? (meta.floor ?? 1) : 1,
        image_url: primaryImg,
        image_urls: listImgs
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
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>({
    image_url: '',
    image_urls: [],
    mode: 'slideshow',
    slideshow_interval_sec: 10,
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

  const handleUploadBgFile = async (files: FileList | File[]) => {
    setIsUploadingBg(true);
    try {
      const formData = new FormData();
      const fileArray = Array.from(files);
      fileArray.forEach((f) => {
        formData.append('files', f);
      });

      const res = await fetch(`${API_BASE}/api/v1/system/background/upload`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.ok && json.data) {
        const uploadedUrls: string[] = json.data.image_urls || (json.data.image_url ? [json.data.image_url] : []);
        setBgConfig(prev => {
          const existing = prev.image_urls || (prev.image_url ? [prev.image_url] : []);
          const merged = Array.from(new Set([...existing, ...uploadedUrls]));
          return {
            ...prev,
            image_url: merged[0] || prev.image_url,
            image_urls: merged
          };
        });
        setBgSaveMsg(`อัปโหลดไฟล์ภาพเรียบร้อยแล้ว (${uploadedUrls.length} รูป)`);
        setTimeout(() => setBgSaveMsg(null), 3000);
      } else {
        const errTxt = json.error || json.detail || json.message || 'Failed to upload image files';
        alert(errTxt);
      }
    } catch (e) {
      console.error('Failed to upload image', e);
      alert('Upload failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleSaveBgManager = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/system/background`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bgConfig)
      });
      await res.json();
      
      // Save to localStorage & broadcast via BroadcastChannel
      localStorage.setItem('dustwatch_bg_config', JSON.stringify(bgConfig));
      try {
        const channel = new BroadcastChannel('dustwatch_background');
        channel.postMessage(bgConfig);
        channel.close();
      } catch (e) {}

      setBgSaveMsg('บันทึกรูปภาพสไลด์โชว์และส่งสัญญาณอัปเดตเรียบร้อยแล้ว!');
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

  const handleUploadNodePhoto = async (nodeId: string, files: FileList | File[]) => {
    setIsUploadingNodePhoto(true);
    try {
      const formData = new FormData();
      const fileArray = Array.from(files);
      fileArray.forEach((f) => {
        formData.append('files', f);
      });

      const res = await fetch(`${API_BASE}/api/v1/nodes/${nodeId}/upload-image`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.ok && json.data) {
        const uploadedUrls: string[] = json.data.image_urls || (json.data.image_url ? [json.data.image_url] : []);
        setTempConfigs((prev) => {
          const current = prev[nodeId];
          const existingList = current?.image_urls || (current?.image_url ? [current.image_url] : []);
          const mergedList = Array.from(new Set([...existingList, ...uploadedUrls]));
          return {
            ...prev,
            [nodeId]: {
              ...current,
              image_url: mergedList[0] || current?.image_url || '',
              image_urls: mergedList
            }
          };
        });
      } else {
        const errTxt = json.error || json.detail || json.message || 'อัปโหลดไม่สำเร็จ';
        alert(errTxt);
      }
    } catch (e) {
      console.error('Failed to upload node photo', e);
      alert('อัปโหลดไม่สำเร็จ');
    } finally {
      setIsUploadingNodePhoto(false);
    }
  };

  const handleSaveNodeBackground = async (nodeId: string, imageUrl: string, imageUrls: string[]) => {
    try {
      const current = tempConfigs[nodeId] || nodesMeta[nodeId] || {
        active: 1,
        tag: '',
        display_name: nodeId,
        status: 'online',
        confirmed: 1,
        pos_x: 0,
        pos_y: 0,
        floor: 1
      };
      const payload = {
        active: current.active ?? 1,
        tag: current.tag ?? '',
        display_name: current.display_name || nodeId,
        status: current.status ?? 'online',
        confirmed: current.confirmed ?? 1,
        pos_x: current.pos_x ?? 0,
        pos_y: current.pos_y ?? 0,
        floor: current.floor ?? 1,
        image_url: imageUrl,
        image_urls: imageUrls
      };

      const res = await fetch(`${API_BASE}/api/v1/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        setTempConfigs((prev) => ({
          ...prev,
          [nodeId]: { ...prev[nodeId], image_url: imageUrl, image_urls: imageUrls }
        }));
        setNodesMeta({
          ...nodesMeta,
          [nodeId]: { ...nodesMeta[nodeId], image_url: imageUrl, image_urls: imageUrls }
        });
        setBgSaveMsg(`บันทึกภาพพื้นหลังประจำโหนด ${nodeId} เรียบร้อยแล้ว!`);
        setTimeout(() => setBgSaveMsg(null), 3000);
      } else {
        alert(json.error || json.detail || 'Failed to update node background');
      }
    } catch (e) {
      console.error('Failed to save node background', e);
      alert('Failed to save node background');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── System Health Bar ─── */}
      <div className="glass-panel flex flex-wrap items-center gap-3 px-5 py-2.5 text-[11px] font-mono shadow-sm">
        <span className="text-cyan-300 uppercase font-black tracking-wider text-[10px]">Backend Services</span>
        <span className="text-white/20">|</span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <span className={`h-1.5 w-1.5 rounded-full ${systemHealth?.services?.sqlite === 'ok' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`}></span>
          <span className={systemHealth?.services?.sqlite === 'ok' ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>SQLite</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <span className={`h-1.5 w-1.5 rounded-full ${systemHealth?.services?.influxdb === 'ok' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`}></span>
          <span className={systemHealth?.services?.influxdb === 'ok' ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>InfluxDB</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <span className={`h-1.5 w-1.5 rounded-full ${systemHealth?.services?.mqtt === 'ok' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`}></span>
          <span className={systemHealth?.services?.mqtt === 'ok' ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>MQTT</span>
        </span>
        {systemHealth?.uptime_seconds && (
          <span className="ml-auto text-gray-400">
            Uptime: <span className="text-cyan-300 font-bold">{Math.round(systemHealth.uptime_seconds / 60)}m</span>
          </span>
        )}
        {!systemHealth && (
          <span className="text-amber-300 animate-pulse font-bold">Connecting to backend...</span>
        )}
      </div>

      {/* ─── Summary Statistics Banner ─── */}
      <SummaryBanner />

      {/* ─── Scrolling Alert Ticker ─── */}
      <AlertTicker />

      {/* ─── Project Overview Card (DustWatch & Creators) ─── */}
      <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative group overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 via-indigo-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🌬️</span>
            <h3 className="text-base font-bold text-white font-mono tracking-wide">
              โครงงาน DustWatch — เครือข่ายตรวจวัดฝุ่นและพยากรณ์คุณภาพอากาศในโรงเรียน
            </h3>
          </div>
          <p className="text-xs text-gray-300 max-w-3xl leading-relaxed font-sans">
            ระบบ IoT ตรวจวัดคุณภาพอากาศภายในอาคารและห้องเรียนแบบ Real-time พร้อมผสานเอนจินปัญญาประดิษฐ์ (XGBoost/LightGBM) คาดการณ์ฝุ่น PM2.5 ล่วงหน้า และระบบจัดการโมเดล (MLOps Portal) เพื่อการวิเคราะห์และทำนายคุณภาพอากาศอย่างอัจฉริยะ
          </p>
          <div className="text-[10px] text-gray-400 font-mono flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            <span className="text-cyan-300/90 font-medium">ผู้จัดทำ: นายธีรัชชัย ผาสุขพันธ์, นายณัฐภัทร ปัดไธสง, นายณภัทร แสนสมบัติ</span>
            <span>•</span>
            <span className="text-indigo-300 font-medium">การแข่งขันพัฒนาโปรแกรมคอมพิวเตอร์แห่งประเทศไทย (NSC)</span>
          </div>
        </div>
        
        <Link
          to="/nsc"
          className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white glass-button-primary transition-all text-center whitespace-nowrap cursor-pointer font-mono z-10 shrink-0"
        >
          อ่านรายละเอียดเพิ่มเติม →
        </Link>
      </div>

      {/* Header Label with settings button */}
      <div className="border-b border-white/10 pb-3 flex justify-between items-center">
        <h2 className="text-xs font-bold text-cyan-300 uppercase tracking-widest font-mono flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
          Air Quality Stations
        </h2>
        
        <div className="flex items-center gap-2.5">
          {/* Dynamic Background Manager Trigger */}
          <button
            onClick={handleOpenBgManager}
            className="text-emerald-300 hover:text-white transition-colors text-xs font-bold font-mono px-3.5 py-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 hover:bg-emerald-500/25 shadow-sm backdrop-blur-md cursor-pointer flex items-center gap-1.5"
          >
            🖼️ รูปพื้นหลัง
          </button>

          {/* Health Customizer Trigger */}
          <button
            onClick={handleOpenHealthCustomizer}
            className="text-cyan-300 hover:text-white transition-colors text-xs font-bold font-mono px-3.5 py-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/15 hover:bg-cyan-500/25 shadow-sm backdrop-blur-md cursor-pointer flex items-center gap-1.5"
          >
            📢 ประกาศ & คำแนะนำสุขภาพ
          </button>

          {/* Settings trigger */}
          <button
            onClick={handleOpenSettings}
            className="glass-button text-xs font-bold font-mono px-3.5 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5"
          >
            ⚙️ Manage Nodes
          </button>
        </div>
      </div>

      {/* ─── Active Stations Grid ─── */}
      {visibleNodeEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleNodeEntries.map(([id, data]) => {
            const meta = nodesMeta[id];
            const displayName = meta ? meta.display_name : data.reading.location;
            const status = meta ? meta.status : data.status;
            return (
              <div key={id} className="relative group">
                <Link to={`/station/${id}`} className="block p-5 glass-card hover:border-cyan-400/40">
                  <div className="flex justify-between items-start mb-3 font-mono">
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">ID: {id}</span>
                      <h4 className="text-base font-bold text-white font-sans truncate">{displayName}</h4>
                    </div>
                    <span className="text-[9px] px-2.5 py-0.5 rounded-full border border-white/20 bg-white/5 text-cyan-200 font-bold uppercase backdrop-blur-md font-mono shadow-sm">
                      {status}
                    </span>
                  </div>

                  <AQIGaugeCard
                    score={data.aqi.aqi_score}
                    level={data.aqi.aqi_level}
                  />

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-[10px] font-mono text-center">
                    <div className="p-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="block text-gray-400 text-[9px]">PM2.5</span>
                      <span className="font-extrabold text-cyan-300 text-xs">{data.reading.pm.pm2_5 ?? '-'} µg</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="block text-gray-400 text-[9px]">TEMP</span>
                      <span className="font-extrabold text-gray-200 text-xs">{data.reading.env.temperature ?? '-'}°C</span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="block text-gray-400 text-[9px]">IAQ</span>
                      <span className="font-extrabold text-emerald-400 text-xs">{data.reading.env.iaq ?? '-'}</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="ไม่พบข้อมูลเครื่องวัดฝุ่นที่เปิดใช้งานในระบบ" />
      )}


      {/* ─── Settings Modal for Managing Nodes ─── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fadeIn">
          <div className="glass-modal p-6 w-full max-w-4xl space-y-4 shadow-2xl max-h-[90vh] flex flex-col justify-between border border-cyan-500/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white font-mono tracking-tight flex items-center gap-2">
                  <span>⚙️</span> ระบบตั้งค่าสถานีตรวจวัดฝุ่น (Station Deployment Settings)
                </h3>
                <p className="text-[11px] text-gray-300">
                  เปิด/ปิดโหนด เปลี่ยนชื่อเรียก อัปโหลดแกลเลอรีรูปภาพประจำจุด และกำหนดพิกัด 3D บนแผนที่
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-y-auto pr-1 no-scrollbar text-xs">
              {/* Left node list column */}
              <div className="md:col-span-5 border-r border-white/10 pr-4 space-y-2">
                <label className="block text-[9px] uppercase font-bold text-cyan-300 mb-1 font-mono">
                  เลือกโหนดที่ต้องการแก้ไข (Select Node)
                </label>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                  {allNodeIds.map((id) => {
                    const conf = tempConfigs[id];
                    if (!conf) return null;
                    const isSelected = selectedNodeIdForEdit === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedNodeIdForEdit(id)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-cyan-500/20 border border-cyan-400/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]' 
                            : 'hover:bg-white/[0.05] border border-transparent'
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
                            className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 cursor-pointer"
                          />
                          <div className="text-left font-mono">
                            <span className="text-xs font-bold text-gray-200">
                              {conf.display_name || id}
                            </span>
                            <span className="block text-[9px] text-gray-400">
                              ID: {id} {conf.tag ? `• ${conf.tag}` : ''}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full ${
                          conf.active === 1 
                            ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-400/30' 
                            : 'text-gray-400 bg-gray-500/10 border border-gray-500/20'
                        }`}>
                          {conf.active === 1 ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right node editor details column */}
              {selectedNodeIdForEdit && tempConfigs[selectedNodeIdForEdit] && (() => {
                const id = selectedNodeIdForEdit;
                const conf = tempConfigs[id];
                const nodeGallery = conf.image_urls && conf.image_urls.length > 0
                  ? conf.image_urls
                  : (conf.image_url ? [conf.image_url] : []);

                return (
                  <div className="md:col-span-7 space-y-4">
                    {/* Display Name input */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-cyan-300 mb-1 font-mono">
                        Display Name (ชื่อแสดงประจำจุด)
                      </label>
                      <input
                        type="text"
                        value={conf.display_name}
                        onChange={(e) => setTempConfigs({
                          ...tempConfigs,
                          [id]: { ...conf, display_name: e.target.value }
                        })}
                        className="glass-input w-full px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    {/* Tag Environment */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-cyan-300 mb-1 font-mono">
                        Tag Environment (แท็กตำแหน่ง)
                      </label>
                      <input
                        type="text"
                        value={conf.tag}
                        onChange={(e) => setTempConfigs({
                          ...tempConfigs,
                          [id]: { ...conf, tag: e.target.value }
                        })}
                        placeholder="เช่น indoor, outdoor, classroom-4-1"
                        className="glass-input w-full px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    {/* Node Photos Multi-Image Gallery */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-cyan-300 mb-1.5 font-mono">
                        📷 รูปภาพประจำโหนด / ห้องเรียน (Node Location Photos Gallery)
                      </label>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <label className="glass-button text-cyan-300 hover:text-white px-3 py-1.5 text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1.5">
                          <span>📤 {isUploadingNodePhoto ? 'กำลังอัปโหลด...' : 'อัปโหลดภาพ (หลายไฟล์)'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isUploadingNodePhoto}
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleUploadNodePhoto(id, e.target.files);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Photo Gallery Grid */}
                      {nodeGallery.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 p-2 border border-white/15 rounded-2xl bg-black/30 max-h-36 overflow-y-auto">
                          {nodeGallery.map((url, imgIdx) => {
                            const isPrimary = conf.image_url === url || (imgIdx === 0 && !conf.image_url);
                            return (
                              <div key={url + imgIdx} className="relative rounded-xl overflow-hidden border border-white/20 aspect-video bg-slate-900 group">
                                <img src={url.startsWith('/') ? `${API_BASE}${url}` : url} alt={`Node img ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                {isPrimary && (
                                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-cyan-500 text-white uppercase shadow-sm">
                                    Main
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextList = [url, ...nodeGallery.filter((item) => item !== url)];
                                        setTempConfigs({
                                          ...tempConfigs,
                                          [id]: { ...conf, image_url: url, image_urls: nextList }
                                        });
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-cyan-500 hover:bg-cyan-600 text-white text-[8px] font-mono cursor-pointer"
                                    >
                                      ตั้งหลัก
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextList = nodeGallery.filter((_, idx) => idx !== imgIdx);
                                      setTempConfigs({
                                        ...tempConfigs,
                                        [id]: {
                                          ...conf,
                                          image_url: nextList[0] || '',
                                          image_urls: nextList
                                        }
                                      });
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-[8px] font-mono cursor-pointer"
                                  >
                                    ลบ
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] text-center text-gray-400 font-mono text-[10px]">
                          ยังไม่มีรูปภาพประจำโหนดนี้ (จะใช้ภาพพื้นหลังรวมของระบบ)
                        </div>
                      )}
                    </div>

                    {/* 3D Map Position Editor */}
                    <div className="pt-2 border-t border-white/10">
                      <label className="block text-[9px] uppercase font-bold text-cyan-300 mb-1 font-mono">
                        🗺️ พิกัดตำแหน่งบนแผนที่ 3D (3D Map Position & Floor)
                      </label>
                      <MapPositionEditor
                        selectedNodeId={id}
                        tempConfigs={tempConfigs}
                        onPositionChange={handlePositionChange}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="glass-button px-4 py-2 text-xs font-mono"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveSettings}
                className="glass-button-primary px-5 py-2 text-xs font-mono"
              >
                💾 บันทึกตั้งค่าโหนดทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Health Customizer Modal Overlay ─── */}
      {isHealthCustomizerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fadeIn">
          <div className="glass-modal p-6 w-full max-w-2xl space-y-4 shadow-2xl max-h-[90vh] flex flex-col justify-between border border-cyan-400/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">📢</span>
                <div>
                  <h3 className="text-sm font-extrabold text-white font-mono tracking-tight">
                    จัดการข้อความประกาศ & คำแนะนำสุขภาพ (Health & Activity Broadcast Manager)
                  </h3>
                  <p className="text-[11px] text-gray-300">
                    แก้ไขข้อความประกาศและคำแนะนำสำหรับกิจกรรมนักเรียน ระบบจะส่งสัญญาณ Real-time ไปยังหน้าเว็บหลักทันที
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHealthCustomizerOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {healthSaveMsg && (
              <div className="bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs px-4 py-2.5 rounded-2xl font-mono font-bold animate-fadeIn shadow-[0_0_15px_rgba(56,189,248,0.25)]">
                ✨ {healthSaveMsg}
              </div>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
              <div>
                <label className="block text-xs font-bold text-cyan-300 font-mono mb-1.5">
                  📣 ข้อความประกาศสำคัญประจำวัน (Daily Announcement Banner)
                </label>
                <input
                  type="text"
                  value={healthAnnouncement}
                  onChange={(e) => setHealthAnnouncement(e.target.value)}
                  placeholder="เช่น: ประกาศวันนี้มีค่าฝุ่นสะสมสูง นักเรียนทุกคนควรสวมหน้ากากอนามัยชนิด N95"
                  className="glass-input w-full p-3 text-xs text-white placeholder:text-gray-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 font-mono mb-1.5">
                  🏃‍♂️ คำแนะนำกิจกรรมกลางแจ้ง (Outdoor Activity Advice)
                </label>
                <input
                  type="text"
                  value={healthOutdoor}
                  onChange={(e) => setHealthOutdoor(e.target.value)}
                  placeholder="เช่น: งดการเข้าแถวกลางแจ้งและการเรียนวิชาพลศึกษาชั่วคราว ให้ย้ายไปทำกิจกรรมในอาคาร"
                  className="glass-input w-full p-3 text-xs text-white placeholder:text-gray-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 font-mono mb-1.5">
                  🛡️ คำแนะนำกลุ่มเสี่ยง/เด็กเล็ก (Sensitive Group Protection)
                </label>
                <input
                  type="text"
                  value={healthSensitive}
                  onChange={(e) => setHealthSensitive(e.target.value)}
                  placeholder="เช่น: นักเรียนที่มีโรคประจำตัว (หอบหืด/ภูมิแพ้) ควรหลีกเลี่ยงฝุ่นละออง"
                  className="glass-input w-full p-3 text-xs text-white placeholder:text-gray-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 font-mono mb-1.5">
                  🪟 คำแนะนำการถ่ายเทอากาศห้องเรียน (Ventilation Advice)
                </label>
                <input
                  type="text"
                  value={healthVentilation}
                  onChange={(e) => setHealthVentilation(e.target.value)}
                  placeholder="เช่น: ให้ปิดประตูหน้าต่างห้องเรียน และเปิดระบบกรองอากาศด่วน"
                  className="glass-input w-full p-3 text-xs text-white placeholder:text-gray-500 font-sans"
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
                  className="glass-button px-4 py-2 text-xs font-mono"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveHealthCustomizer}
                  className="glass-button-primary px-5 py-2 text-xs font-mono"
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
        nodes={Object.values(nodesMeta)}
        onSaveNodeBackground={handleSaveNodeBackground}
      />
    </div>
  );
}
