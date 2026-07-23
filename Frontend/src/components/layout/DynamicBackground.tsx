import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { getApiBaseUrl } from '../../api/sourceConfig';

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
    image_urls: [],
    mode: 'slideshow',
    slideshow_interval_sec: 10,
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
  const location = useLocation();
  const nodesMeta = useStore((state) => state.nodesMeta);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [randomImageIndex, setRandomImageIndex] = useState(0);

  useEffect(() => {
    // 1. Fetch initial config from backend API
    const fetchConfig = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/v1/system/background`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) {
            setConfig(json.data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data));
          }
        }
      } catch (e) {
        // Fallback to local storage
      }
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

  // Determine active image list based on route (Per-node vs Global)
  let activeImageList: string[] = [];
  const match = location.pathname.match(/\/station(?:s|-detail)?\/([^/]+)/i);
  if (match && match[1]) {
    const stationId = match[1];
    const metaKey = Object.keys(nodesMeta).find((k) => k.toLowerCase() === stationId.toLowerCase()) || stationId;
    const meta = nodesMeta[metaKey];
    if (meta) {
      if (meta.image_urls && meta.image_urls.length > 0) {
        activeImageList = meta.image_urls;
      } else if (meta.image_url && meta.image_url.trim() !== '') {
        activeImageList = [meta.image_url];
      }
    }
  }

  // Fallback to global config gallery
  if (activeImageList.length === 0) {
    if (config.image_urls && config.image_urls.length > 0) {
      activeImageList = config.image_urls;
    } else if (config.image_url && config.image_url.trim() !== '') {
      activeImageList = [config.image_url];
    }
  }

  // Handle Random Mode initial assignment
  useEffect(() => {
    if (config.mode === 'random' && activeImageList.length > 0) {
      const rand = Math.floor(Math.random() * activeImageList.length);
      setRandomImageIndex(rand);
    }
  }, [config.mode, activeImageList.length, location.pathname]);

  // Slideshow auto-advance timer
  const mode = config.mode || 'slideshow';
  const intervalSec = Math.max(3, config.slideshow_interval_sec || 10);

  useEffect(() => {
    if (!config.active || activeImageList.length <= 1 || mode !== 'slideshow') return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeImageList.length);
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [config.active, activeImageList.length, mode, intervalSec]);

  if (!config.active || activeImageList.length === 0) {
    return null;
  }

  // Determine current display URL
  let activeUrl = activeImageList[0];
  if (mode === 'slideshow') {
    activeUrl = activeImageList[currentIndex % activeImageList.length];
  } else if (mode === 'random') {
    activeUrl = activeImageList[randomImageIndex % activeImageList.length];
  } else if (config.image_url && activeImageList.includes(config.image_url)) {
    activeUrl = config.image_url;
  }

  // Determine overlay style
  const getOverlayClass = () => {
    switch (config.overlay_mode) {
      case 'light':
        return 'bg-white/60 backdrop-blur-sm';
      case 'glass':
        return 'bg-slate-900/40 backdrop-blur-md';
      case 'cyan':
        return 'bg-gradient-to-br from-[#0CA4A4]/20 via-slate-900/60 to-slate-950/80';
      case 'none':
        return 'bg-transparent';
      case 'dark':
      default:
        return 'bg-slate-950/65 backdrop-blur-sm';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-all duration-1000 select-none">
      {/* Render all image layers with opacity transition for smooth cross-fade */}
      {activeImageList.map((url, idx) => {
        const isVisible = url === activeUrl;
        const bgUrl = url.startsWith('/') ? `${getApiBaseUrl()}${url}` : url;
        return (
          <div
            key={url + idx}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out transform scale-105"
            style={{
              backgroundImage: `url("${bgUrl}")`,
              filter: `blur(${config.blur_px}px)`,
              opacity: isVisible ? config.opacity : 0,
            }}
          />
        );
      })}

      {/* Dynamic Tint / Glass Overlay Layer */}
      <div className={`absolute inset-0 transition-all duration-500 ${getOverlayClass()}`} />
    </div>
  );
}
