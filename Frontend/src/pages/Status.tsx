import { useStore } from '../store';
import { Wifi, HelpCircle, Server } from 'lucide-react';

export default function Status() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);
  const masterStatus = useStore((state) => state.masterStatus);

  // List of active node IDs
  const activeNodeIds = Object.keys(latest).filter(
    (id) => !nodesMeta[id] || nodesMeta[id].active !== 0
  );

  const getRSSIMeta = (rssi: number) => {
    if (rssi >= -60) return { color: 'bg-green-500', text: 'text-green-600', label: 'สัญญาณดีเยี่ยม (Excellent)', pct: 100 };
    if (rssi >= -75) return { color: 'bg-amber-500', text: 'text-amber-600', label: 'สัญญาณปานกลาง (Fair)', pct: 65 };
    return { color: 'bg-red-500', text: 'text-red-600', label: 'สัญญาณค่อนข้างอ่อน (Poor)', pct: 35 };
  };

  const isOnline = (timestamp: string, status?: string) => {
    if (status === 'offline') return false;
    const now = new Date().getTime();
    const ts = new Date(timestamp).getTime();
    return (now - ts) / 1000 < 600;
  };

  return (
    <div className="space-y-4 relative z-10 pb-12 font-sans">
      {/* 1. Network Status Overview card */}
      <div className="premium-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Server className="text-brand-primary" size={18} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            ความพร้อมของระบบเครือข่าย (Network Availability)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
          <div className="bg-brand-light/50 p-4 rounded-xl border border-brand-primary/5">
            <span className="text-[10px] text-text-secondary block font-bold mb-1">สถานะเซิร์ฟเวอร์หลัก (Central Server)</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                masterStatus.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className="font-bold text-text-primary uppercase text-sm">
                {masterStatus.status === 'online' ? 'เชื่อมต่อปกติ (Online)' : 'ขาดการติดต่อ (Offline)'}
              </span>
            </div>
          </div>

          <div className="bg-[#EDEBF8]/50 p-4 rounded-xl border border-black/5">
            <span className="text-[10px] text-text-secondary block font-bold mb-1">ระดับความพร้อมการใช้งาน</span>
            <span className="font-extrabold text-text-primary text-sm">
              {activeNodeIds.length > 0 ? 'พร้อมรับส่งข้อมูลเรียลไทม์' : 'กำลังค้นหาสัญญาณสถานี'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. User-friendly Network Infographics */}
      <div className="premium-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="text-brand-primary" size={18} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            ระบบรับส่งข้อมูลฝุ่นทำงานอย่างไร? (How it works)
          </h2>
        </div>

        {/* Descriptive flow for regular users */}
        <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between relative p-2 text-xs">
          
          <div className="flex-1 bg-white p-3 rounded-xl border border-brand-primary/5 text-center shadow-xs">
            <h4 className="font-bold text-brand-primary">1. บอร์ดวัดในห้องเรียน</h4>
            <p className="text-[10px] text-text-secondary mt-1">
              เครื่องเซนเซอร์วัดค่าฝุ่น PM2.5 อุณหภูมิ และความชื้นทุก ๆ 30 วินาที
            </p>
          </div>

          {/* Dotted Arrow down/right */}
          <div className="self-center flex items-center justify-center font-bold text-brand-primary opacity-60">
            <span className="md:hidden">▼</span>
            <span className="hidden md:inline mx-3">➔</span>
          </div>

          <div className="flex-1 bg-white p-3 rounded-xl border border-brand-primary/5 text-center shadow-xs">
            <h4 className="font-bold text-green-600">2. ส่งข้อมูลผ่านคลาวด์</h4>
            <p className="text-[10px] text-text-secondary mt-1">
              บอร์ดส่งสัญญาณข้อมูลผ่านอินเทอร์เน็ตความเร็วสูงแบบไร้รอยต่อ
            </p>
          </div>

          {/* Dotted Arrow down/right */}
          <div className="self-center flex items-center justify-center font-bold text-brand-primary opacity-60">
            <span className="md:hidden">▼</span>
            <span className="hidden md:inline mx-3">➔</span>
          </div>

          <div className="flex-1 bg-white p-3 rounded-xl border border-brand-primary/5 text-center shadow-xs">
            <h4 className="font-bold text-blue-600">3. อัปเดตสดบนมือถือ</h4>
            <p className="text-[10px] text-text-secondary mt-1">
              แสดงค่าฝุ่น PM2.5 ทันทีแบบเรียลไทม์บนหน้าจอมือถือของคุณโดยไม่ต้องรีเฟรช
            </p>
          </div>
        </div>
      </div>

      {/* 3. Signal Quality RSSI Monitor */}
      <div className="premium-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="text-brand-primary" size={18} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            คุณภาพสัญญาณ Wi-Fi รายห้องเรียน (Node Signal Strengths)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeNodeIds.map((id) => {
            const node = latest[id];
            const meta = nodesMeta[id];
            const displayName = meta?.display_name || node?.reading.location || id;
            
            const rssi = node?.reading.meta.rssi ?? -70;
            const signal = getRSSIMeta(rssi);
            const online = node ? isOnline(node.reading.timestamp, node.status) : false;

            return (
              <div key={id} className="bg-black/[0.02] border border-black/[0.03] p-4 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className="font-bold text-text-primary">{displayName}</span>
                  </div>
                  
                  <span className={`text-[10px] font-bold ${signal.text}`}>
                    {online ? signal.label : 'ออฟไลน์'}
                  </span>
                </div>

                {/* Progress bar visual indicator */}
                {online ? (
                  <div className="mt-1">
                    <div className="w-full bg-black/5 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${signal.color}`}
                        style={{ width: `${signal.pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-text-muted mt-1.5 font-mono">
                      <span>รหัสอุปกรณ์: {id}</span>
                      <span>{rssi} dBm</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-text-muted mt-1 font-mono">
                    ขาดการอัปเดตข้อมูลสัญญาณ Wi-Fi
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
