import { getApiUrl } from './sourceConfig';

const BASE_URL = getApiUrl();

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      try {
        const errJson = JSON.parse(errText);
        return { ok: false, data: null, error: errJson.error || response.statusText };
      } catch {
        return { ok: false, data: null, error: errText || response.statusText };
      }
    }

    const contentType = response.headers.get('content-type');
    if (contentType && (contentType.includes('text/csv') || contentType.includes('application/octet-stream') || contentType.includes('attachment'))) {
      const text = await response.text();
      return { ok: true, data: text as unknown as T, error: null };
    }

    const data: ApiResponse<T> = await response.json();
    return data;
  } catch (error: any) {
    return {
      ok: false,
      data: null,
      error: error.message || 'เครือข่ายขัดข้อง กรุณาลองใหม่อีกครั้ง'
    };
  }
}
