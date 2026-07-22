import { create } from 'zustand';
import type { WSMessage, NodeData, NodeMeta, AlertData } from '../types/sensor';

interface StoreState {
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
  
  setInitialNodes: (nodes: Record<string, NodeData>) => void;
  setNodesMeta: (meta: Record<string, NodeMeta>) => void;
  setInitialAlerts: (alerts: AlertData[]) => void;
  updateNodeMeta: (nodeId: string, updates: Partial<NodeMeta>) => void;
  setMasterStatus: (status: 'online' | 'offline') => void;
  pushMessage: (msg: WSMessage) => void;
}

export const useStore = create<StoreState>((set) => ({
  latest: {},
  nodesMeta: {},
  alerts: [],
  stream: [],
  masterStatus: { status: 'offline' },

  setInitialNodes: (nodes) => set({ latest: nodes }),
  setNodesMeta: (meta) => set({ nodesMeta: meta }),
  setInitialAlerts: (alerts) => set({ alerts }),
  setMasterStatus: (status) => set((state) => ({ masterStatus: { ...state.masterStatus, status } })),
  
  updateNodeMeta: (nodeId, updates) => set((state) => {
    const node = state.nodesMeta[nodeId];
    if (!node) return {};
    return {
      nodesMeta: {
        ...state.nodesMeta,
        [nodeId]: { ...node, ...updates }
      }
    };
  }),
  
  pushMessage: (msg) => set((state) => {
    // 1. Cap raw log stream at 200 items as per rule.md §5.1 to prevent memory issues
    const newStream = [msg, ...state.stream].slice(0, 200);

    // 2. Process message by type
    if (msg.type === 'sensor_update') {
      const { node_id, data, aqi } = msg;
      
      const updatedLatest = {
        ...state.latest,
        [node_id]: {
          reading: {
            node_id,
            timestamp: msg.timestamp,
            pm: data.pm,
            env: data.env,
            sound: data.sound,
            meta: data.meta
          },
          aqi: aqi,
          status: msg.status || 'deployed',
          dcs: msg.dcs
        }
      };

      return {
        stream: newStream,
        latest: updatedLatest
      };
    } else if (msg.type === 'alert') {
      const { node_id, timestamp, data } = msg;
      const newAlert: AlertData = {
        node_id,
        timestamp,
        alert_type: data.alert_type,
        value: data.value,
        threshold: data.threshold,
        message: data.message
      };

      const updatedAlerts = [newAlert, ...state.alerts].slice(0, 100);

      return {
        stream: newStream,
        alerts: updatedAlerts
      };
    } else if (msg.type === 'master_status_update') {
      return {
        stream: newStream,
        masterStatus: {
          status: msg.data.status,
          uptime_s: msg.data.uptime_s,
          free_heap: msg.data.free_heap,
          timestamp: msg.timestamp
        }
      };
    }

    return { stream: newStream };
  })
}));
