import { create } from 'zustand';
import type { WSMessage, SensorReading, AQIResult } from '../types/sensor';

interface NodeData {
  reading: SensorReading;
  aqi: AQIResult;
  status?: string;
  dcs?: number;
}

interface AlertData {
  node_id: string;
  timestamp: string;
  alert_type: string;
  value: number;
  threshold: number;
  message: string;
}

export interface NodeMeta {
  id: string;
  display_name: string;
  location: string;
  active: number;
  tag?: string;
  status?: string;
  confirmed?: number;
  pos_x?: number;
  pos_y?: number;
  floor?: number;
  image_url?: string;
  created_at: string;
}

interface Store {
  latest: Record<string, NodeData>;
  nodesMeta: Record<string, NodeMeta>;
  alerts: AlertData[];
  stream: WSMessage[];
  masterStatus: {
    status: string;
    uptime_s?: number;
    free_heap?: number;
    timestamp?: string;
  };
  pushMessage: (msg: WSMessage) => void;
  setInitialNodes: (nodes: Record<string, NodeData>) => void;
  setNodesMeta: (meta: Record<string, NodeMeta>) => void;
  setInitialAlerts: (alerts: AlertData[]) => void;
  setMasterStatus: (status: { status: string; uptime_s?: number; free_heap?: number }) => void;
}

export const useStore = create<Store>((set) => ({
  latest: {},
  nodesMeta: {},
  alerts: [],
  stream: [],
  masterStatus: { status: "offline" },

  setInitialNodes: (nodes) => set({ latest: nodes }),
  setNodesMeta: (meta) => set({ nodesMeta: meta }),
  setMasterStatus: (status) => set({ masterStatus: status }),
  
  setInitialAlerts: (alerts) => set((state) => {
    const now = new Date().getTime();
    const cleanedAlerts = alerts.filter((alert) => {
      if (alert.alert_type !== 'node_offline') return true;
      const latestNode = state.latest[alert.node_id];
      if (!latestNode) return true;
      const ts = new Date(latestNode.reading.timestamp).getTime();
      return (now - ts) / 1000 >= 600;
    });
    return { alerts: cleanedAlerts };
  }),

  pushMessage: (msg) => set((state) => {
    const updatedStream = [msg, ...state.stream].slice(0, 200);

    if (msg.type === 'sensor_update' && msg.node_id && msg.data && msg.aqi) {
      const cleanedAlerts = state.alerts.filter(
        (alert) => !(alert.node_id === msg.node_id && alert.alert_type === 'node_offline')
      );

      return {
        latest: {
          ...state.latest,
          [msg.node_id]: { 
            reading: msg.data, 
            aqi: msg.aqi,
            status: msg.status,
            dcs: msg.dcs
          }
        },
        alerts: cleanedAlerts,
        stream: updatedStream
      };
    }

    if (msg.type === 'alert' && msg.node_id && msg.data) {
      const newAlert: AlertData = {
        node_id: msg.node_id,
        timestamp: msg.timestamp || new Date().toISOString(),
        alert_type: msg.data.alert_type,
        value: msg.data.value,
        threshold: msg.data.threshold,
        message: msg.data.message
      };
      return {
        alerts: [newAlert, ...state.alerts].slice(0, 100),
        stream: updatedStream
      };
    }

    if (msg.type === 'master_status_update' && msg.data) {
      return {
        masterStatus: {
          status: msg.data.status || "online",
          uptime_s: msg.data.uptime_s,
          free_heap: msg.data.free_heap,
          timestamp: msg.timestamp
        },
        stream: updatedStream
      };
    }

    return {
      stream: updatedStream
    };
  }),
}));
