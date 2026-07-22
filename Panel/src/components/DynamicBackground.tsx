import { useState, useEffect } from 'react';

export interface BackgroundConfig {
  image_url: string;
  blur_px: number;
  opacity: number;
  overlay_mode: string;
  active: number;
}

const STORAGE_KEY = 'dustwatch_bg_config';

export function getLocalBackgroundConfig(): BackgroundConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse bg config', e);
  }
  return {
    image_url: '',
    blur_px: 4,
    opacity: 0.65,
    overlay_mode: 'dark',
    active: 1
  };
}

export function saveLocalBackgroundConfig(config: BackgroundConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  try {
    const channel = new BroadcastChannel('dustwatch_background');
    channel.postMessage(config);
    channel.close();
  } catch (e) {
    // Ignore BroadcastChannel errors on legacy browsers
  }
}

export default function DynamicBackground() {
  const [config, setConfig] = useState<BackgroundConfig>(getLocalBackgroundConfig);

  useEffect(() => {
    // 1. Fetch initial config from backend API
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/v1/system/background');
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) {
            setConfig(json.data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data));
          }
        }
      } catch (e) {}
    };

    fetchConfig();

    // 2. Listen to real-time BroadcastChannel updates from Admin Panel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('dustwatch_background');
      channel.onmessage = (event) => {
        if (event.data) {
          setConfig(event.data);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    // 3. Listen to storage events for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setConfig(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (!config.active || !config.image_url) {
    return null;
  }

  const bgUrl = config.image_url.startsWith('/') ? config.image_url : config.image_url;

  const getOverlayClass = () => {
    switch (config.overlay_mode) {
      case 'light':
        return 'bg-white/60 backdrop-blur-sm';
      case 'glass':
        return 'bg-slate-900/40 backdrop-blur-md';
      case 'cyan':
        return 'bg-gradient-to-br from-[#0ca4a4]/20 via-slate-900/60 to-slate-950/80';
      case 'none':
        return 'bg-transparent';
      case 'dark':
      default:
        return 'bg-slate-950/65 backdrop-blur-sm';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-all duration-700 select-none">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 transform scale-105"
        style={{
          backgroundImage: `url("${bgUrl}")`,
          filter: `blur(${config.blur_px}px)`,
          opacity: config.opacity,
        }}
      />
      <div className={`absolute inset-0 transition-all duration-500 ${getOverlayClass()}`} />
    </div>
  );
}
