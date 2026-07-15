import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { WSMessage } from '../types/sensor';

import { getWsUrl } from '../api/sourceConfig';

const WS_URL = getWsUrl();

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const pushMessage = useStore((state) => state.pushMessage);
  const setMasterStatus = useStore((state) => state.setMasterStatus);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  
  const reconnectDelayRef = useRef(3000); // Start with 3s reconnect delay
  const sensorBufferRef = useRef<Record<string, WSMessage>>({});
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
    
    // React 18 auto-batches synchronous updates inside setTimeout, so this results in a single render pass
    Object.values(buffer).forEach((msg) => {
      pushMessage(msg);
    });
  };

  const connect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      console.log(`กำลังเชื่อมต่อ WebSocket: ${WS_URL}`);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('เชื่อมต่อ WebSocket สำเร็จ');
        setIsConnected(true);
        setMasterStatus('online'); // sync server status
        reconnectDelayRef.current = 3000; // Reset Delay
        resetHeartbeatTimeout();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          resetHeartbeatTimeout();

          if (message.type === 'sensor_update') {
            // Buffer sensor updates to avoid flooding state updates during bursts
            sensorBufferRef.current[message.node_id] = message;
            if (!flushTimeoutRef.current) {
              flushTimeoutRef.current = window.setTimeout(flushBuffer, 300);
            }
          } else {
            pushMessage(message);
          }
        } catch (err) {
          console.error('ไม่สามารถถอดรหัสข้อความ WebSocket:', err, event.data);
        }
      };

      ws.onclose = (event) => {
        console.log(`การเชื่อมต่อ WebSocket ถูกปิด (Code: ${event.code}) กำลังลองใหม่...`);
        setIsConnected(false);
        setMasterStatus('offline'); // sync server status
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('เกิดข้อผิดพลาด WebSocket:', error);
        ws.close();
      };
    } catch (err) {
      console.error('ไม่สามารถเปิดใช้งาน WebSocket:', err);
      setIsConnected(false);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) return;

    console.log(`จะทำการเชื่อมต่อใหม่ใน ${reconnectDelayRef.current / 1000} วินาที...`);
    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null;
      // Exponential backoff, limit to max 30 seconds
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 30000);
      connect();
    }, reconnectDelayRef.current);
  };

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Unbind to prevent loop during unmount
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  return { isConnected };
}
export default useWebSocket;
