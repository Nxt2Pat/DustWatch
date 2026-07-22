export interface PMData {
  pm1_0: number | null;
  pm2_5: number | null;
  pm10: number | null;
}

export interface EnvData {
  temperature: number | null;
  humidity: number | null;
  iaq: number | null;
}

export interface SoundData {
  db_avg: number | null;
  db_peak: number | null;
}

export interface MetaData {
  rssi: number | null;
  uptime_s: number | null;
  sim: boolean;
}

export interface SensorReading {
  node_id: string;
  timestamp: string;
  location?: string;
  pm: PMData;
  env: EnvData;
  sound: SoundData;
  meta: MetaData;
}

export interface AQIResult {
  node_id?: string;
  timestamp?: string;
  aqi_score: number;
  /** snake_case level key matching backend values: good | moderate | unhealthy_sensitive | unhealthy | very_unhealthy | hazardous */
  aqi_level: 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous' | string;
  aqi_color: string;
  dominant: string;
  advice?: string;
  pm25_aqi?: number;
  pm10_aqi?: number;
  iaq_aqi?: number;
}

export interface NodeData {
  reading: SensorReading;
  aqi: AQIResult;
  status?: string;
  dcs?: number;
}

export interface EnvironmentSummary {
  averages: {
    pm2_5: number;
    pm10: number;
    temperature: number;
    humidity: number;
    iaq: number;
    aqi_score: number;
    dcs: number;
  };
  status: {
    total_active: number;
    online: number;
    offline: number;
  };
}

export interface CentralSummaryData {
  averages: EnvironmentSummary['averages'];
  status: EnvironmentSummary['status'] & { simulated?: number };
  indoor?: EnvironmentSummary;
  outdoor?: EnvironmentSummary;
  timestamp: string;
}

export interface NodeMeta {
  id: string;
  display_name: string;
  location: string;
  active: number;
  tag?: string;
  group_name?: string;
  description?: string;
  status?: string;
  confirmed?: number;
  pos_x?: number;
  pos_y?: number;
  floor?: number;
  env_type?: 'indoor' | 'outdoor';
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface AlertData {
  id?: string;
  node_id: string;
  timestamp: string;
  alert_type: string;
  value: number;
  threshold: number;
  message: string;
}

export type WSMessage =
  | {
      type: 'sensor_update';
      node_id: string;
      timestamp: string;
      status?: string;
      dcs?: number;
      data: {
        pm: PMData;
        env: EnvData;
        sound: SoundData;
        meta: MetaData;
      };
      aqi: AQIResult;
    }
  | {
      type: 'alert';
      node_id: string;
      timestamp: string;
      data: {
        alert_type: string;
        value: number;
        threshold: number;
        message: string;
      };
    }
  | {
      type: 'master_status_update';
      timestamp: string;
      data: {
        status: string;
        uptime_s: number;
        free_heap: number;
      };
    }
  | {
      type: 'weather_update';
      timestamp: string;
      data: Record<string, unknown>;
    }
  | {
      type: 'heartbeat';
      timestamp: number;
    };

export interface ExportParams {
  node_ids: string[];
  start_date: string;
  end_date: string;
  format: 'csv' | 'json';
}

export interface HealthData {
  status: string;
  uptime_seconds: number;
  system: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
}
