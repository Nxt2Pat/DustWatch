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
    if (rssi >= -60) return { color: 'bg-[#0CA4A4]', text: 'text-[#0CA4A4]', label: 'ดีเยี่ยม (Excellent)', pct: 100 };
    if (rssi >= -75) return { color: 'bg-amber-500', text: 'text-amber-600', label: 'ปานกลาง (Fair)', pct: 65 };
    return { color: 'bg-rose-500', text: 'text-rose-600', label: 'ค่อนข้างอ่อน (Poor)', pct: 35 };
  };

  const isOnline = (timestamp: string, status?: string) => {
    if (status === 'offline') return false;
    const now = new Date().getTime();
    const ts = new Date(timestamp).getTime();
    return (now - ts) / 1000 < 600;
  };

  return (
    <div className="space-y-5 relative z-10 max-w-6xl mx-auto pb-12 font-sans fade-up">
      {/* 1. Network Status Overview card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="text-[#0CA4A4]" size={18} />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-sans">
            ความพร้อมของระบบเครือข่าย (Network Availability)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="bg-[#0CA4A4]/10 p-4 rounded-2xl border border-[#0CA4A4]/20">
            <span className="text-[10px] text-gray-500 block font-bold mb-1">สถานะเซิร์ฟเวอร์หลัก (Central Server)</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${
                masterStatus.status === 'online' ? 'bg-[#0CA4A4] shadow-[0_0_8px_rgba(12,164,164,0.6)] animate-pulse' : 'bg-rose-500'
              }`} />
              <span className="font-extrabold text-gray-900 uppercase text-sm font-mono">
                {masterStatus.status === 'online' ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="bg-gray-100/70 p-4 rounded-2xl border border-gray-200/50 backdrop-blur-md">
            <span className="text-[10px] text-gray-500 block font-bold mb-1">ระดับความพร้อมการใช้งาน</span>
            <span className="font-extrabold text-gray-900 text-sm font-sans">
              {activeNodeIds.length > 0 ? 'พร้อมรับส่งข้อมูลเรียลไทม์' : 'กำลังค้นหาสัญญาณสถานี'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. User-friendly Network Infographics */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="text-[#0CA4A4]" size={18} />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-sans">
            ระบบรับส่งข้อมูลฝุ่นทำงานอย่างไร? (How it works)
          </h2>
        </div>

        {/* Descriptive flow for regular users */}
        <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between relative p-1 text-xs">
          
          <div className="flex-1 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 text-center shadow-xs">
            <h4 className="font-bold text-[#0CA4A4] font-sans">1. บอร์ดวัดในห้องเรียน</h4>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              เครื่องเซนเซอร์วัดค่าฝุ่น PM2.5 อุณหภูมิ และความชื้นทุก ๆ 30 วินาที
            </p>
          </div>

          {/* Dotted Arrow down/right */}
          <div className="self-center flex items-center justify-center font-bold text-[#0CA4A4] opacity-60">
            <span className="md:hidden">▼</span>
            <span className="hidden md:inline mx-3">➔</span>
          </div>

          <div className="flex-1 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 text-center shadow-xs">
            <h4 className="font-bold text-[#0CA4A4] font-sans">2. ส่งข้อมูลผ่านคลาวด์</h4>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              บอร์ดส่งสัญญาณข้อมูลผ่านอินเทอร์เน็ตความเร็วสูงแบบไร้รอยต่อ
            </p>
          </div>

          {/* Dotted Arrow down/right */}
          <div className="self-center flex items-center justify-center font-bold text-[#0CA4A4] opacity-60">
            <span className="md:hidden">▼</span>
            <span className="hidden md:inline mx-3">➔</span>
          </div>

          <div className="flex-1 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-white/80 text-center shadow-xs">
            <h4 className="font-bold text-sky-600 font-sans">3. อัปเดตสดบนมือถือ</h4>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              แสดงค่าฝุ่น PM2.5 ทันทีแบบเรียลไทม์บนหน้าจอมือถือของคุณโดยไม่ต้องรีเฟรช
            </p>
          </div>
        </div>
      </div>

      {/* 3. Signal Quality RSSI Monitor */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wifi className="text-[#0CA4A4]" size={18} />
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-sans">
            คุณภาพสัญญาณ Wi-Fi รายห้องเรียน (Node Signal Strengths)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeNodeIds.map((id) => {
            const node = latest[id];
            const meta = nodesMeta[id];
            const displayName = meta?.display_name || node?.reading.location || id;
            
            const rssi = node?.reading.meta.rssi ?? -70;
            const signal = getRSSIMeta(rssi);
            const online = node ? isOnline(node.reading.timestamp, node.status) : false;

            return (
              <div key={id} className="bg-white/60 backdrop-blur-md border border-white/80 p-4 rounded-2xl flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${online ? 'bg-[#0CA4A4] shadow-[0_0_8px_rgba(12,164,164,0.6)] animate-pulse' : 'bg-rose-400'}`} />
                    <span className="font-bold text-gray-900 font-sans">{displayName}</span>
                  </div>
                  
                  <span className={`text-[10px] font-bold font-mono ${signal.text}`}>
                    {online ? signal.label : 'OFFLINE'}
                  </span>
                </div>

                {/* Progress bar visual indicator */}
                {online ? (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200/80 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${signal.color}`}
                        style={{ width: `${signal.pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1.5 font-mono">
                      <span>Device: {id}</span>
                      <span>{rssi} dBm</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 mt-1 font-mono">
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

