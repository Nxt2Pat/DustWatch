import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { NodeMeta } from '../store';

import { getApiBaseUrl, getWsUrl } from '../api/sourceConfig';

const API_HTTP_URL = getApiBaseUrl();
const API_WS_URL = getWsUrl();

export function useWebSocket() {
  const pushMessage = useStore((state) => state.pushMessage);
  const setInitialNodes = useStore((state) => state.setInitialNodes);
  const setNodesMeta = useStore((state) => state.setNodesMeta);
  const setInitialAlerts = useStore((state) => state.setInitialAlerts);
  const setMasterStatus = useStore((state) => state.setMasterStatus);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);

  // Poll health diagnostics to update SQLite/InfluxDB/MQTT states dynamically
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_HTTP_URL}/api/v1/health`);
        const json = await res.json();
        if (json.ok && json.data) {
          const services = json.data.services;
          const mqttOnline = services?.mqtt === 'ok';
          setMasterStatus({
            status: mqttOnline ? 'online' : 'offline',
            uptime_s: json.data.uptime_seconds,
            free_heap: 125000
          });
        }
      } catch {
        setMasterStatus({ status: 'offline' });
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [setMasterStatus]);

  // 1. Fetch initial states on boot
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const readingsRes = await fetch(`${API_HTTP_URL}/api/v1/readings`);
        const readingsJson = await readingsRes.json();
        if (readingsJson.ok && readingsJson.data) {
          setInitialNodes(readingsJson.data);
        }

        const nodesRes = await fetch(`${API_HTTP_URL}/api/v1/nodes`);
        const nodesJson = await nodesRes.json();
        if (nodesJson.ok && nodesJson.data) {
          const metaRecord: Record<string, NodeMeta> = {};
          nodesJson.data.forEach((n: any) => {
            metaRecord[n.id] = n;
          });
          setNodesMeta(metaRecord);
        }

        const alertsRes = await fetch(`${API_HTTP_URL}/api/v1/alerts?limit=50`);
        const alertsJson = await alertsRes.json();
        if (alertsJson.ok && alertsJson.data) {
          const alertsArray = Array.isArray(alertsJson.data)
            ? alertsJson.data
            : (alertsJson.data.items || []);
          setInitialAlerts(alertsArray);
        }
      } catch (err) {
        console.error("Failed to fetch initial telemetry logs", err);
      }
    }
    
    fetchInitialData();
  }, [setInitialNodes, setNodesMeta, setInitialAlerts]);

  // 2. Manage real-time WebSocket connection
  const reconnectDelayRef = useRef(3000);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const sensorBufferRef = useRef<Record<string, any>>({});
  const flushTimeoutRef = useRef<number | null>(null);

  // Monitor heartbeat. Server broadcasts every 10s. If no frames for 25s, connection is dead.
  const resetHeartbeatTimeout = () => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = window.setTimeout(() => {
      console.warn('WebSocket heartbeat timeout (25s). Force closing dead socket...');
      if (wsRef.current) {
        wsRef.current.close();
      }
    }, 25000);
  };

  const flushBuffer = () => {
    flushTimeoutRef.current = null;
    const buffer = sensorBufferRef.current;
    sensorBufferRef.current = {};
    
    // Batched React state commit in single render pass
    Object.values(buffer).forEach((msg) => {
      pushMessage(msg);
    });
  };

  useEffect(() => {
    const connect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      console.log(`Connecting WebSocket to: ${API_WS_URL}`);
      const socket = new WebSocket(API_WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connection established");
        setIsConnected(true);
        reconnectDelayRef.current = 3000; // Reset Delay
        resetHeartbeatTimeout();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          resetHeartbeatTimeout();

          if (parsed.type === 'sensor_update' && parsed.node_id) {
            // Buffer sensor updates to avoid flooding state updates during bursts
            sensorBufferRef.current[parsed.node_id] = parsed;
            if (!flushTimeoutRef.current) {
              flushTimeoutRef.current = window.setTimeout(flushBuffer, 300);
            }
          } else {
            pushMessage(parsed);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message frame", err);
        }
      };

      socket.onclose = () => {
        console.warn(`WebSocket closed. Attempting reconnect in ${reconnectDelayRef.current / 1000}s...`);
        setIsConnected(false);
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          // Exponential backoff, limit to max 30 seconds
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 30000);
          connect();
        }, reconnectDelayRef.current);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error encountered", err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Unbind to prevent connection loop on unmount
        wsRef.current.close();
      }
    };
  }, [pushMessage]);

  return { isConnected };
}
