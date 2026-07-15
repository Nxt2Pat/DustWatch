export interface PMData {
  pm1_0: number;
  pm2_5: number;
  pm10: number;
}

export interface EnvData {
  temperature: number;
  humidity: number;
  iaq: number;
}

export interface SoundData {
  db_avg: number;
  db_peak: number;
}

export interface MetaData {
  rssi: number;
  uptime_s: number;
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
  aqi_level: 'very_good' | 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'hazardous';
  aqi_color: string;
  pm25_aqi?: number;
  pm10_aqi?: number;
  iaq_aqi?: number;
  dominant: string;
  advice?: string;
}

export interface NodeData {
  reading: SensorReading;
  aqi: AQIResult;
  status?: 'online' | 'offline';
  dcs?: number;
}

export interface NodeMeta {
  id: string;
  display_name: string;
  location: string;
  active: number;
  tag?: string;
  pos_x?: number;
  pos_y?: number;
  floor?: number;
  created_at: string;
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
