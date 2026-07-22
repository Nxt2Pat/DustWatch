export interface PMData {
  pm1_0?: number | null;
  pm2_5?: number | null;
  pm10?: number | null;
}

export interface EnvData {
  temperature?: number | null;
  humidity?: number | null;
  iaq?: number | null;
}

export interface SoundData {
  db_avg?: number | null;
  db_peak?: number | null;
}

export interface NodeMeta {
  rssi?: number | null;
  uptime_s?: number | null;
  sim: boolean;
}

export interface SensorReading {
  node_id: string;
  timestamp: string;
  location: string;
  pm: PMData;
  env: EnvData;
  sound: SoundData;
  meta: NodeMeta;
}

export interface AQIResult {
  aqi_score: number;
  /** snake_case level key matching backend: good | moderate | unhealthy_sensitive | unhealthy | very_unhealthy | hazardous */
  aqi_level: string;
  aqi_color?: string;
  dominant?: string;
  advice?: string;
}

export type WSMessageType = 'sensor_update' | 'alert' | 'heartbeat' | 'master_status_update' | 'weather_update';

export interface WSMessage {
  type: WSMessageType;
  node_id?: string;
  timestamp?: string | number;
  status?: string;
  dcs?: number;
  data?: any; // SensorReading, alert details, weather, etc.
  aqi?: AQIResult;
}
