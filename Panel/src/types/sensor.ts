export interface PMData {
  pm1_0?: number;
  pm2_5?: number;
  pm10?: number;
}

export interface EnvData {
  temperature?: number;
  humidity?: number;
  iaq?: number;
}

export interface SoundData {
  db_avg?: number;
  db_peak?: number;
}

export interface NodeMeta {
  rssi?: number;
  uptime_s?: number;
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
  aqi_level: string;
}

export type WSMessageType = 'sensor_update' | 'alert' | 'heartbeat' | 'master_status_update' | 'weather_update';

export interface WSMessage {
  type: WSMessageType;
  node_id?: string;
  timestamp?: string;
  data?: any; // SensorReading, alert details, etc.
  aqi?: AQIResult;
}
