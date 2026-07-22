
interface BackgroundConfig {
  image_url: string;
  blur_px: number;
  opacity: number;
  overlay_mode: string;
  active: number;
}

interface BackgroundManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BackgroundConfig;
  onChangeConfig: (newConfig: BackgroundConfig) => void;
  onSave: () => void;
  onUploadFile: (file: File) => void;
  isUploading: boolean;
  saveMsg: string | null;
}

const PRESET_WALLPAPERS = [
  {
    name: '🏫 3D Campus Architectural White',
    url: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1920&q=80',
    desc: 'ภาพมุมสูงอาคารเรียน สไตล์ Clean Glass'
  },
  {
    name: '🌅 รุ่งอรุณเหนือโรงเรียน (Morning Sky)',
    url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=80',
    desc: 'บรรยากาศยามเช้า อากาศแจ่มใส'
  },
  {
    name: '🍃 ธรรมชาติและพื้นที่เขียวขจี (Green Nature)',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80',
    desc: 'ป่าไม้และสิ่งแวดล้อมสะอาด'
  },
  {
    name: '🌌 Dark Cyan Cyberpunk Glass',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
    desc: 'ธีมมืด นีอนเรืองแสง อนาคตสดใส'
  }
];

export default function BackgroundManagerModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onSave,
  onUploadFile,
  isUploading,
  saveMsg
}: BackgroundManagerModalProps) {
  if (!isOpen) return null;

  const bgUrl = config.image_url.startsWith('/') ? config.image_url : config.image_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0b0e17] border border-emerald-500/30 rounded-3xl p-6 w-full max-w-3xl space-y-5 shadow-2xl max-h-[90vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖼️</span>
            <div>
              <h3 className="text-sm font-extrabold text-white font-mono tracking-tight">
                จัดการรูปภาพพื้นหลังเว็บแบบไดนามิก (Dynamic Web Background Manager)
              </h3>
              <p className="text-[11px] text-gray-400">
                อัปโหลดไฟล์ภาพ ตั้งค่าความเบลอ ความโปร่งแสง และสตรีมเปลี่ยนรูปพื้นหลังไปยังเว็บหลักทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Save message notice */}
        {saveMsg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-2xl font-mono font-bold animate-fadeIn">
            ✨ {saveMsg}
          </div>
        )}

        {/* Main Body Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1 no-scrollbar text-xs">
          {/* Left Controls (col-span-7) */}
          <div className="md:col-span-7 space-y-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="font-bold text-gray-200 font-mono">
                เปิดใช้งานรูปพื้นหลัง (Enable Dynamic Background)
              </span>
              <input
                type="checkbox"
                checked={config.active === 1}
                onChange={(e) => onChangeConfig({ ...config, active: e.target.checked ? 1 : 0 })}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-emerald-500 cursor-pointer"
              />
            </div>

            {/* Upload File Box */}
            <div>
              <label className="block font-bold text-emerald-400 font-mono mb-1.5">
                📤 อัปโหลดไฟล์ภาพจากคอมพิวเตอร์ (Upload Image File)
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-4 cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-center">
                <span className="text-xl mb-1">{isUploading ? '⏳' : '📁'}</span>
                <span className="text-xs font-bold text-emerald-300 font-mono">
                  {isUploading ? 'กำลังอัปโหลดไฟล์ภาพ...' : 'คลิกเพื่อเลือกไฟล์รูปภาพ (JPG, PNG, WEBP, SVG)'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onUploadFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Direct Image URL input */}
            <div>
              <label className="block font-bold text-gray-300 font-mono mb-1.5">
                🔗 หรือระบุ URL รูปภาพ (Direct Image URL)
              </label>
              <input
                type="text"
                value={config.image_url}
                onChange={(e) => onChangeConfig({ ...config, image_url: e.target.value })}
                placeholder="https://example.com/background.jpg หรือ /static/uploads/..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-2.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Preset Wallpapers */}
            <div>
              <label className="block font-bold text-gray-300 font-mono mb-1.5">
                🖼️ หรือเลือกรูปภาพสำเร็จรูป (Curated Presets)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_WALLPAPERS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, image_url: preset.url })}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      config.image_url === preset.url
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block truncate">{preset.name}</span>
                    <span className="text-[9px] opacity-70 block truncate">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders & Overlay Settings */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div>
                <label className="block font-bold text-gray-400 font-mono mb-1">
                  ความเบลอ (Blur): {config.blur_px}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={config.blur_px}
                  onChange={(e) => onChangeConfig({ ...config, blur_px: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-400 font-mono mb-1">
                  ความโปร่งแสง (Opacity): {Math.round(config.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.opacity}
                  onChange={(e) => onChangeConfig({ ...config, opacity: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-400 font-mono mb-1">
                โทนฟิลเตอร์ซ้อนหลัง (Overlay Tint)
              </label>
              <select
                value={config.overlay_mode}
                onChange={(e) => onChangeConfig({ ...config, overlay_mode: e.target.value })}
                className="w-full bg-[#0d101a] border border-white/10 rounded-xl p-2 text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
              >
                <option value="dark">Dark Backdrop Blur (โทนมืดคลาสสิก)</option>
                <option value="light">Light Backdrop Blur (โทนสว่างมินิมอล)</option>
                <option value="glass">Deep Glassmorphic Blur (สไตล์กระจกใส)</option>
                <option value="cyan">Cyan Emerald Glow (สไตล์นีอนเขียวมิ้นต์)</option>
                <option value="none">Original Image (รูปภาพสดไม่มีฟิลเตอร์)</option>
              </select>
            </div>
          </div>

          {/* Right Live Preview Box (col-span-5) */}
          <div className="md:col-span-5 flex flex-col">
            <label className="block font-bold text-gray-400 font-mono mb-1.5">
              👁️ ตัวอย่างการแสดงผลสด (Live Preview)
            </label>
            <div className="flex-1 min-h-[220px] rounded-2xl border border-white/10 relative overflow-hidden flex flex-col justify-between p-4 shadow-inner bg-slate-950">
              {config.image_url ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-300"
                    style={{
                      backgroundImage: `url("${bgUrl}")`,
                      filter: `blur(${config.blur_px}px)`,
                      opacity: config.opacity,
                    }}
                  />
                  <div className={`absolute inset-0 transition-all duration-300 ${
                    config.overlay_mode === 'light' ? 'bg-white/60' :
                    config.overlay_mode === 'glass' ? 'bg-slate-900/40' :
                    config.overlay_mode === 'cyan' ? 'bg-gradient-to-br from-[#0ca4a4]/20 via-slate-900/60 to-slate-950/80' :
                    config.overlay_mode === 'none' ? 'bg-transparent' : 'bg-slate-950/65'
                  }`} />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs font-mono">
                  ยังไม่ได้เลือกรูปภาพ
                </div>
              )}

              {/* Sample Glass Card Content inside preview */}
              <div className="relative z-10 space-y-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#0ca4A4]/20 text-[#0ca4a4] border border-[#0ca4a4]/30 uppercase">
                  SAMPLE GLASS CARD
                </span>
                <h4 className="text-base font-bold text-white font-sans">
                  โรงเรียนเทพศิรินทร์ สมุทรปราการ
                </h4>
                <p className="text-[10px] text-gray-300">
                  ตัวอย่างการซ้อนทับการ์ดโปร่งแสงบนภาพพื้นหลังที่เลือก
                </p>
              </div>

              <div className="relative z-10 flex justify-between items-center text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
                <span>AQI: 24 (Good)</span>
                <span>STATUS: ACTIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => onChangeConfig({
              image_url: '',
              blur_px: 4,
              opacity: 0.65,
              overlay_mode: 'dark',
              active: 1
            })}
            className="text-xs text-gray-400 hover:text-rose-400 transition-colors font-mono cursor-pointer"
          >
            🗑️ ล้างรูปพื้นหลัง (Reset to Ambient)
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 border border-white/10 cursor-pointer font-mono"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onSave}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 cursor-pointer shadow-lg shadow-emerald-500/25 font-mono flex items-center gap-1.5"
            >
              <span>💾 บันทึกและแสดงผล (Save & Broadcast)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
