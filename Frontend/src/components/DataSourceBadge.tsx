/**
 * DataSourceBadge — toggle button ที่แสดงและสลับแหล่งข้อมูล (Local ↔ Remote VPS ↔ Custom Server)
 * มีระบบป๊อปอัพหน้าต่างเพื่อป้อนข้อมูล IP/Domain ด้วยตัวเองเมื่อเลือกโหมด Custom
 */
import { useState, useCallback } from 'react';
import { 
  getActiveSource, 
  toggleSource, 
  getSourceLabel, 
  getCustomUrls, 
  setCustomUrls, 
  setActiveSource, 
  type DataSource 
} from '../api/sourceConfig';

interface Props {
  onSwitch?: (newSource: DataSource) => void;
}

export function DataSourceBadge({ onSwitch }: Props) {
  const [source, setSource] = useState<DataSource>(getActiveSource);
  const [showModal, setShowModal] = useState(false);
  const [inputApi, setInputApi] = useState(() => getCustomUrls().apiUrl);
  const [inputWs, setInputWs] = useState(() => getCustomUrls().wsUrl);

  const handleToggle = useCallback(() => {
    const next = toggleSource();
    setSource(next);
    
    if (next === 'custom') {
      // เปิดโมดอลแก้ไขข้อมูล ไม่เพิ่งรีโหลดหน้า
      setShowModal(true);
    } else {
      onSwitch?.(next);
      window.location.reload();
    }
  }, [onSwitch]);

  const handleSaveCustom = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputApi.trim()) return;
    
    // ตั้งค่า ws อัตโนมัติหากว่าง โดยอิงตาม API url
    let wsUrl = inputWs.trim();
    if (!wsUrl) {
      const cleanApi = inputApi.trim().replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
      const wsProtocol = cleanApi.startsWith('https') ? 'wss:' : 'ws:';
      if (cleanApi.startsWith('http')) {
        wsUrl = cleanApi.replace(/^http/, 'ws') + '/ws/realtime';
      } else {
        wsUrl = `${wsProtocol}//${cleanApi}/ws/realtime`;
      }
    }

    setCustomUrls(inputApi.trim(), wsUrl);
    setActiveSource('custom');
    setSource('custom');
    setShowModal(false);
    onSwitch?.('custom');
    window.location.reload();
  }, [inputApi, inputWs, onSwitch]);

  const handleCancelCustom = useCallback(() => {
    // ย้อนกลับเป็น local เมื่อยกเลิก
    setActiveSource('local');
    setSource('local');
    setShowModal(false);
  }, []);

  const label = getSourceLabel();
  
  // สีประจำแต่ละโหมด
  let badgeColor = '#68d391'; // green for local
  let badgeBorder = 'rgba(72,187,120,0.4)';
  let badgeBg = 'rgba(56,161,105,0.12)';
  
  if (source === 'remote') {
    badgeColor = '#63b3ed'; // blue for remote
    badgeBorder = 'rgba(99,179,237,0.4)';
    badgeBg = 'rgba(66,153,225,0.12)';
  } else if (source === 'custom') {
    badgeColor = '#ed64a6'; // pink for custom
    badgeBorder = 'rgba(237,100,166,0.4)';
    badgeBg = 'rgba(217,70,239,0.12)';
  }

  return (
    <>
      <button
        onClick={handleToggle}
        title={`แหล่งข้อมูล: ${label} — คลิกเพื่อสลับ`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          border: `1px solid ${badgeBorder}`,
          background: badgeBg,
          color: badgeColor,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(4px)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: badgeColor,
          boxShadow: `0 0 0 2px ${badgeBorder}`,
          flexShrink: 0,
          animation: 'pulseDot 2s ease-in-out infinite',
        }} />

        {source === 'local' && '💻 Local'}
        {source === 'remote' && '🌐 Remote VPS'}
        {source === 'custom' && '⚙️ Custom API'}

        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
          <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      </button>

      {/* โมดอลป๊อปอัพกรอกค่าไอพี / ลิงก์เชื่อมโยงแบบกำหนดเอง */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            background: '#1e1e2f',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '24px',
            borderRadius: '16px',
            width: '420px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            color: '#e4e4eb'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>
              ⚙️ ตั้งค่าเซิร์ฟเวอร์แบบกำหนดเอง (Custom Host)
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#8a8a9e', lineHeight: 1.4 }}>
              ระบุไอพีหรือลิงก์ API ปลายทางที่ต้องการดึงข้อมูลฝุ่นเรียลไทม์ (เช่น http://192.168.1.100:8000 หรือ Domain VPS ของคุณ)
            </p>
            
            <form onSubmit={handleSaveCustom}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8a8a9e', marginBottom: '6px' }}>
                  API URL:
                </label>
                <input
                  type="text"
                  value={inputApi}
                  onChange={(e) => setInputApi(e.target.value)}
                  placeholder="ตัวอย่าง http://192.168.1.50:8000/api/v1"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#14141e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8a8a9e', marginBottom: '6px' }}>
                  WebSocket URL (หากปล่อยว่างไว้ระบบจะสืบค้นแปลงโปรโตคอลให้เอง):
                </label>
                <input
                  type="text"
                  value={inputWs}
                  onChange={(e) => setInputWs(e.target.value)}
                  placeholder="ตัวอย่าง ws://192.168.1.50:8000/ws/realtime"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#14141e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCancelCustom}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#8a8a9e',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    background: '#ed64a6',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  บันทึก & บูตระบบใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </>
  );
}
