/**
 * DustWatch — Data Source Configuration
 *
 * จัดการการสลับแหล่งข้อมูลระหว่าง Local และ Remote VPS
 * ใช้ localStorage เพื่อให้สลับได้ runtime โดยไม่ต้อง rebuild
 */

const LS_KEY = 'dustwatch_source';

export type DataSource = 'local' | 'remote' | 'custom';

// Get dynamic fallback protocol and host to avoid hardcoding URLs in the codebase
const getDynamicHost = (port?: string) => {
  const { protocol, hostname, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    api: port ? `${protocol}//${hostname}:${port}` : `${protocol}//${host}`,
    ws: port ? `${wsProto}//${hostname}:${port}` : `${wsProto}//${host}`
  };
};

const localFallback = getDynamicHost('8000');
const remoteFallback = getDynamicHost();

// Helper to get custom settings from localStorage
export function getCustomUrls() {
  return {
    apiUrl: localStorage.getItem('dustwatch_custom_api') || '',
    wsUrl: localStorage.getItem('dustwatch_custom_ws') || ''
  };
}

export function setCustomUrls(apiUrl: string, wsUrl: string) {
  localStorage.setItem('dustwatch_custom_api', apiUrl);
  localStorage.setItem('dustwatch_custom_ws', wsUrl);
}

const isPlaceholder = (url?: string): boolean => {
  if (!url) return true;
  return url.includes('yourdomain.com') || url.includes('example.com');
};

// ─── Active Source Resolver ───────────────────────────────
export function getActiveSource(): DataSource {
  const stored = localStorage.getItem(LS_KEY) as DataSource | null;
  if (stored === 'local' || stored === 'remote' || stored === 'custom') return stored;
  const defaultSrc = (import.meta.env.VITE_DEFAULT_SOURCE || 'local') as DataSource;
  return defaultSrc;
}

export function setActiveSource(source: DataSource): void {
  localStorage.setItem(LS_KEY, source);
}

export function toggleSource(): DataSource {
  const current = getActiveSource();
  let next: DataSource = 'local';
  if (current === 'local') next = 'remote';
  else if (current === 'remote') next = 'custom';
  setActiveSource(next);
  return next;
}

export function getApiUrl(): string {
  const src = getActiveSource();
  let raw = '';
  const envApiUrl = import.meta.env.VITE_API_URL;
  const envRemoteApiUrl = import.meta.env.VITE_REMOTE_API_URL;

  if (src === 'local') {
    raw = !isPlaceholder(envApiUrl) ? envApiUrl : `${localFallback.api}/api/v1`;
  } else if (src === 'remote') {
    raw = !isPlaceholder(envRemoteApiUrl) ? envRemoteApiUrl : `${remoteFallback.api}/api/v1`;
  } else {
    raw = getCustomUrls().apiUrl || `${remoteFallback.api}/api/v1`;
  }

  // Prepend protocol if raw value is a pure host/IP (e.g. "192.168.1.50:8000")
  if (raw && !raw.startsWith('http://') && !raw.startsWith('https://')) {
    const proto = window.location.protocol;
    raw = `${proto}//${raw}`;
  }
  
  const clean = raw.replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

export function getApiBaseUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/v1\/?$/i, '');
}

export function getWsUrl(): string {
  const src = getActiveSource();
  const envWsUrl = import.meta.env.VITE_WS_URL;
  const envRemoteWsUrl = import.meta.env.VITE_REMOTE_WS_URL;

  if (src === 'local') {
    return !isPlaceholder(envWsUrl) ? envWsUrl : `${localFallback.ws}/ws/realtime`;
  } else if (src === 'remote') {
    return !isPlaceholder(envRemoteWsUrl) ? envRemoteWsUrl : `${remoteFallback.ws}/ws/realtime`;
  } else {
    const custom = getCustomUrls();
    if (custom.wsUrl) {
      return custom.wsUrl;
    }
    // Auto-derive WebSocket URL from custom API URL if WebSocket is empty
    if (custom.apiUrl) {
      let apiLink = custom.apiUrl;
      if (!apiLink.startsWith('http://') && !apiLink.startsWith('https://')) {
        const proto = window.location.protocol;
        apiLink = `${proto}//${apiLink}`;
      }
      const wsLink = apiLink
        .replace(/^http:/i, 'ws:')
        .replace(/^https:/i, 'wss:')
        .replace(/\/api\/v1\/?$/i, '')
        .replace(/\/+$/, '');
      return `${wsLink}/ws/realtime`;
    }
    return `${remoteFallback.ws}/ws/realtime`;
  }
}

export function getSourceLabel(): string {
  const src = getActiveSource();
  if (src === 'local') return 'Local';
  if (src === 'remote') return 'Remote VPS';
  return 'Custom Server';
}

