
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../api/sourceConfig';

export interface BackgroundConfig {
  image_url: string;
  image_urls?: string[];
  mode?: string; // 'slideshow' | 'static' | 'random'
  slideshow_interval_sec?: number;
  blur_px: number;
  opacity: number;
  overlay_mode: string;
  active: number;
}

export interface NodeBackgroundItem {
  id: string;
  display_name: string;
  image_url?: string;
  image_urls?: string[];
}

interface BackgroundManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BackgroundConfig;
  onChangeConfig: (newConfig: BackgroundConfig) => void;
  onSave: () => void;
  onUploadFile: (files: FileList | File[]) => void;
  isUploading: boolean;
  saveMsg: string | null;
  // Per-Node Extension
  nodes?: NodeBackgroundItem[];
  onSaveNodeBackground?: (nodeId: string, imageUrl: string, imageUrls: string[]) => void;
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
  saveMsg,
  nodes = [],
  onSaveNodeBackground
}: BackgroundManagerModalProps) {
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);

  // Per-Node scope target
  const [selectedTargetNodeId, setSelectedTargetNodeId] = useState<string>('global');
  const [nodeConfigsMap, setNodeConfigsMap] = useState<Record<string, { image_url: string; image_urls: string[] }>>({});

  // Sync node configs from props
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const map: Record<string, { image_url: string; image_urls: string[] }> = {};
      nodes.forEach((n) => {
        const list = n.image_urls && n.image_urls.length > 0
          ? n.image_urls
          : (n.image_url ? [n.image_url] : []);
        map[n.id] = {
          image_url: n.image_url || list[0] || '',
          image_urls: list
        };
      });
      setNodeConfigsMap(map);
    }
  }, [nodes]);

  const isGlobal = selectedTargetNodeId === 'global';
  const currentNodeMeta = nodes.find((n) => n.id === selectedTargetNodeId);
  const currentNodeConfig = nodeConfigsMap[selectedTargetNodeId] || { image_url: '', image_urls: [] };

  const imagesList = isGlobal
    ? (config.image_urls && config.image_urls.length > 0 ? config.image_urls : (config.image_url ? [config.image_url] : []))
    : (currentNodeConfig.image_urls && currentNodeConfig.image_urls.length > 0 ? currentNodeConfig.image_urls : (currentNodeConfig.image_url ? [currentNodeConfig.image_url] : []));

  const primaryUrl = isGlobal
    ? config.image_url
    : currentNodeConfig.image_url;

  // Live preview cycle timer for modal
  useEffect(() => {
    if (!isOpen || imagesList.length <= 1 || (isGlobal && config.mode === 'static')) return;
    const interval = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % imagesList.length);
    }, Math.max(2, config.slideshow_interval_sec || 10) * 1000);
    return () => clearInterval(interval);
  }, [isOpen, imagesList.length, config.slideshow_interval_sec, config.mode, isGlobal]);

  if (!isOpen) return null;

  const currentPreviewUrl = imagesList[previewIndex % Math.max(1, imagesList.length)] || primaryUrl || '';

  const addImageUrl = (url: string) => {
    if (!url.trim()) return;
    const trimmed = url.trim();
    if (imagesList.includes(trimmed)) return;
    const nextList = [...imagesList, trimmed];

    if (isGlobal) {
      onChangeConfig({
        ...config,
        image_url: config.image_url || trimmed,
        image_urls: nextList
      });
    } else {
      setNodeConfigsMap((prev) => ({
        ...prev,
        [selectedTargetNodeId]: {
          image_url: prev[selectedTargetNodeId]?.image_url || trimmed,
          image_urls: nextList
        }
      }));
    }
  };

  const removeImage = (indexToRemove: number) => {
    const nextList = imagesList.filter((_, idx) => idx !== indexToRemove);
    const primary = nextList[0] || '';

    if (isGlobal) {
      onChangeConfig({
        ...config,
        image_url: primary,
        image_urls: nextList
      });
    } else {
      setNodeConfigsMap((prev) => ({
        ...prev,
        [selectedTargetNodeId]: {
          image_url: primary,
          image_urls: nextList
        }
      }));
    }
  };

  const formatUrl = (url: string) => {
    if (!url) return '';
    return url.startsWith('/') ? `${getApiBaseUrl()}${url}` : url;
  };

  const setPrimaryImage = (url: string) => {
    const nextList = [url, ...imagesList.filter((item) => item !== url)];
    if (isGlobal) {
      onChangeConfig({
        ...config,
        image_url: url,
        image_urls: nextList
      });
    } else {
      setNodeConfigsMap((prev) => ({
        ...prev,
        [selectedTargetNodeId]: {
          image_url: url,
          image_urls: nextList
        }
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fadeIn">
      <div className="glass-modal p-6 w-full max-w-4xl space-y-5 shadow-2xl max-h-[90vh] flex flex-col justify-between border border-emerald-400/30">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">🖼️</span>
            <div>
              <h3 className="text-sm font-extrabold text-white font-mono tracking-tight">
                จัดการแกลเลอรีรูปภาพและสไลด์โชว์พื้นหลัง (Dynamic Multi-Image Gallery Manager)
              </h3>
              <p className="text-[11px] text-gray-300">
                อัปโหลดหลายไฟล์พร้อมกัน ตั้งค่าสไลด์โชว์ ความเบลอ และซิงค์เปลี่ยนรูปสไลด์แบบ Real-time
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

        {/* Scope Selector: Global System Default vs Specific Node */}
        {nodes && nodes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/[0.04] border border-emerald-500/30">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400 font-bold text-xs">🎯 กำหนดเป้าหมายพื้นหลัง:</span>
              <select
                value={selectedTargetNodeId}
                onChange={(e) => {
                  setSelectedTargetNodeId(e.target.value);
                  setPreviewIndex(0);
                }}
                className="bg-[#0d101a] border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none cursor-pointer"
              >
                <option value="global">🌐 พื้นหลังรวมทั้งระบบ (Global System Default)</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    🏫 {n.display_name || n.id} (ID: {n.id})
                  </option>
                ))}
              </select>
            </div>
            {!isGlobal && (
              <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1">
                <span>📌</span>
                <span>กำลังตั้งค่าภาพพื้นหลังเฉพาะโหนด: <strong>{currentNodeMeta?.display_name || selectedTargetNodeId}</strong></span>
              </span>
            )}
          </div>
        )}

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
                {isGlobal ? 'เปิดใช้งานรูปพื้นหลังรวม (Enable Dynamic Background)' : `เปิดใช้งานรูปพื้นหลังเฉพาะโหนด (${currentNodeMeta?.display_name || selectedTargetNodeId})`}
              </span>
              <input
                type="checkbox"
                checked={config.active === 1}
                onChange={(e) => onChangeConfig({ ...config, active: e.target.checked ? 1 : 0 })}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-emerald-500 cursor-pointer"
              />
            </div>

            {/* Display Mode & Slideshow Interval Controls */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div>
                <label className="block font-bold text-emerald-400 font-mono mb-1">
                  โหมดแสดงผล (Display Mode)
                </label>
                <select
                  value={config.mode || 'slideshow'}
                  onChange={(e) => onChangeConfig({ ...config, mode: e.target.value })}
                  className="w-full bg-[#0d101a] border border-white/10 rounded-xl p-2 text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
                >
                  <option value="slideshow">🔄 สไลด์โชว์อัตโนมัติ (Auto Slideshow)</option>
                  <option value="static">📌 รูปภาพเดียวคงที่ (Single Fixed)</option>
                  <option value="random">🎲 สุ่มรูปภาพเมื่อรีเฟรช (Random on Refresh)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-emerald-400 font-mono mb-1">
                  เวลาเปลี่ยนสไลด์: {config.slideshow_interval_sec || 10} วินาที
                </label>
                <input
                  type="range"
                  min="3"
                  max="60"
                  step="1"
                  value={config.slideshow_interval_sec || 10}
                  onChange={(e) => onChangeConfig({ ...config, slideshow_interval_sec: parseInt(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer mt-2"
                />
              </div>
            </div>

            {/* Multi-file Upload Box */}
            <div>
              <label className="block font-bold text-emerald-400 font-mono mb-1.5">
                📤 {isGlobal ? 'อัปโหลดไฟล์ภาพเพิ่ม (เลือกได้หลายไฟล์พร้อมกัน - Multiple Upload)' : `อัปโหลดไฟล์ภาพเพิ่มสำหรับ ${currentNodeMeta?.display_name || selectedTargetNodeId}`}
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-4 cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-center">
                <span className="text-xl mb-1">{isUploading ? '⏳' : '📁'}</span>
                <span className="text-xs font-bold text-emerald-300 font-mono">
                  {isUploading ? 'กำลังอัปโหลดไฟล์ภาพ...' : 'คลิกเพื่อเลือกไฟล์รูปภาพ (กด Ctrl/Shift เลือกหลายไฟล์)'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onUploadFile(e.target.files);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Image Gallery Grid */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-bold text-gray-200 font-mono">
                  🖼️ แกลเลอรีรูปภาพ ({isGlobal ? 'ระบบส่วนกลาง' : currentNodeMeta?.display_name || selectedTargetNodeId}) ({imagesList.length} รูป)
                </label>
                <span className="text-[10px] text-gray-500">คลิกที่รูปเพื่อตั้งเป็นรูปหลัก (Primary)</span>
              </div>

              {imagesList.length > 0 ? (
                <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1 border border-white/5 rounded-2xl bg-black/20">
                  {imagesList.map((url, idx) => {
                    const isPrimary = primaryUrl === url || (idx === 0 && !primaryUrl);
                    return (
                      <div
                        key={url + idx}
                        className={`relative rounded-xl overflow-hidden border transition-all group aspect-video bg-slate-900 ${
                          isPrimary ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-white/10 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={formatUrl(url)} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        
                        {/* Primary Badge */}
                        {isPrimary && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-emerald-500 text-white uppercase">
                            Primary
                          </span>
                        )}

                        {/* Action buttons hover overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => setPrimaryImage(url)}
                              className="px-1.5 py-1 rounded bg-emerald-500/80 hover:bg-emerald-500 text-white text-[9px] font-mono font-bold cursor-pointer"
                            >
                              ตั้งรูปหลัก
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="px-1.5 py-1 rounded bg-rose-500/80 hover:bg-rose-500 text-white text-[9px] font-mono font-bold cursor-pointer"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] text-center text-gray-500 font-mono text-xs">
                  {isGlobal ? 'ยังไม่มีรูปภาพในแกลเลอรีระบบ' : 'ยังไม่มีรูปภาพเฉพาะโหนดนี้ (จะใช้รูปภาพรวมของระบบแทน)'}
                </div>
              )}
            </div>

            {/* Direct Image URL input */}
            <div>
              <label className="block font-bold text-gray-300 font-mono mb-1">
                🔗 หรือเพิ่ม URL รูปภาพเข้าแกลเลอรี (Direct Image URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://example.com/background.jpg"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    addImageUrl(customUrlInput);
                    setCustomUrlInput('');
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs hover:bg-emerald-500/30 cursor-pointer"
                >
                  + เพิ่มเข้าแกลเลอรี
                </button>
              </div>
            </div>

            {/* Preset Wallpapers */}
            <div>
              <label className="block font-bold text-gray-300 font-mono mb-1.5">
                🎨 เพิ่มรูปภาพสำเร็จรูปเข้าแกลเลอรี (Presets)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_WALLPAPERS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => addImageUrl(preset.url)}
                    className="p-2 rounded-xl border border-white/5 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white text-left transition-all cursor-pointer"
                  >
                    <span className="font-bold block truncate">{preset.name}</span>
                    <span className="text-[9px] opacity-70 block truncate">+ คลิกเพื่อเพิ่มเข้าแกลเลอรี</span>
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
            <div className="flex items-center justify-between mb-1.5 font-mono text-gray-400 font-bold">
              <span>👁️ ตัวอย่างสไลด์สด (Live Preview)</span>
              {imagesList.length > 1 && (
                <span className="text-[10px] text-emerald-400">
                  รูปที่ {previewIndex + 1}/{imagesList.length}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-[260px] rounded-2xl border border-white/10 relative overflow-hidden flex flex-col justify-between p-4 shadow-inner bg-slate-950">
              {currentPreviewUrl ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
                    style={{
                      backgroundImage: `url("${formatUrl(currentPreviewUrl)}")`,
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
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs font-mono text-center p-4">
                  {isGlobal ? 'ยังไม่ได้เลือกรูปภาพในแกลเลอรีระบบ' : `ยังไม่ได้เลือกรูปภาพเฉพาะโหนด (${currentNodeMeta?.display_name || selectedTargetNodeId})`}
                </div>
              )}

              {/* Sample Glass Card Content inside preview */}
              <div className="relative z-10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#0ca4A4]/20 text-[#0ca4a4] border border-[#0ca4a4]/30 uppercase">
                    {isGlobal ? 'SYSTEM PREVIEW' : `NODE: ${selectedTargetNodeId.toUpperCase()}`}
                  </span>
                  <span className="text-[9px] font-mono text-gray-300">
                    MODE: {(config.mode || 'slideshow').toUpperCase()}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white font-sans">
                  {isGlobal ? 'โรงเรียนเทพศิรินทร์ สมุทรปราการ' : (currentNodeMeta?.display_name || selectedTargetNodeId)}
                </h4>
                <p className="text-[10px] text-gray-300">
                  {isGlobal ? 'ตัวอย่างการสไลด์เปลี่ยนรูปภาพในแกลเลอรีรวมของระบบ' : `ภาพพื้นหลังประจำโหนด ${currentNodeMeta?.display_name || selectedTargetNodeId}`}
                </p>
              </div>

              <div className="relative z-10 flex justify-between items-center text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
                <span>INTERVAL: {config.slideshow_interval_sec || 10}s</span>
                <span>TOTAL: {imagesList.length} IMAGES</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (isGlobal) {
                onChangeConfig({
                  image_url: '',
                  image_urls: [],
                  mode: 'slideshow',
                  slideshow_interval_sec: 10,
                  blur_px: 4,
                  opacity: 0.65,
                  overlay_mode: 'dark',
                  active: 1
                });
              } else {
                setNodeConfigsMap((prev) => ({
                  ...prev,
                  [selectedTargetNodeId]: { image_url: '', image_urls: [] }
                }));
              }
            }}
            className="text-xs text-gray-400 hover:text-rose-400 transition-colors font-mono cursor-pointer"
          >
            🗑️ {isGlobal ? 'ล้างรูปทั้งหมด (Reset Global Gallery)' : 'ล้างรูปโหนดนี้ (Use Global Default)'}
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
              onClick={() => {
                if (isGlobal) {
                  onSave();
                } else if (onSaveNodeBackground) {
                  onSaveNodeBackground(selectedTargetNodeId, currentNodeConfig.image_url, currentNodeConfig.image_urls);
                }
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 cursor-pointer shadow-lg shadow-emerald-500/25 font-mono flex items-center gap-1.5"
            >
              <span>💾 {isGlobal ? 'บันทึกสไลด์โชว์และสตรีม (Save & Broadcast)' : `บันทึกรูปพื้นหลังโหนด ${selectedTargetNodeId}`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
