import { useState, useEffect } from 'react';
import { useSEO } from '../hooks/useSEO';

import { getApiBaseUrl } from '../api/sourceConfig';


interface SqliteStatus {
  status: string;
  file_size_kb: number;
  write_permission: boolean;
  db_path: string;
}

interface InfluxStatus {
  status: string;
  url: string;
  bucket: string;
  org: string;
  ping_ms: number | null;
}

interface MqttStatus {
  status: string;
  host: string;
  port: number;
  is_connected: boolean;
}

interface NodeConnection {
  node_id: string;
  display_name: string;
  status: string;
  active: number;
  is_online: boolean;
  last_heard_seconds: number | null;
  rssi: number | null;
  uptime_m: number | null;
  topic: string;
}

interface ConnectionsData {
  sqlite: SqliteStatus;
  influxdb: InfluxStatus;
  mqtt: MqttStatus;
  nodes: NodeConnection[];
}

export default function ConnectionStatus() {
  useSEO('System Connectivity Portal', 'Check detailed latencies, database connections, and signal strengths.');

  const [data, setData] = useState<ConnectionsData | null>(null);
  const [rtt, setRtt] = useState<number>(0);
  const [rttHistory, setRttHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    const start = performance.now();
    try {
    const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/v1/dev/system/connections`);
      const json = await res.json();
      const end = performance.now();
      
      const pingVal = Math.round(end - start);
      setRtt(pingVal);
      setRttHistory((h) => [...h.slice(-19), pingVal]);

      if (json.ok && json.data) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || 'Failed to decode connection metrics.');
      }
    } catch (err) {
      setError('Connection to backend lost.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    const interval = setInterval(fetchConnections, 3000);
    return () => clearInterval(interval);
  }, []);

  const getSignalStrengthLabel = (rssi: number | null) => {
    if (rssi === null) return { text: 'No Signal', color: 'text-gray-500' };
    if (rssi >= -67) return { text: 'Excellent', color: 'text-green-400' };
    if (rssi >= -70) return { text: 'Good', color: 'text-emerald-400' };
    if (rssi >= -80) return { text: 'Fair', color: 'text-yellow-400' };
    return { text: 'Poor', color: 'text-red-400' };
  };

  const activeNodesCount = data?.nodes.filter((n) => n.is_online).length ?? 0;
  const totalNodesCount = data?.nodes.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-white/5 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
          📡 System Connection Hub
        </h1>
        <p className="text-xs text-gray-400 mt-1 font-mono uppercase tracking-wider">
          Real-Time Network Topology, Service Adapters & Radio Signal Diagnostics
        </p>
      </div>

      {/* Interactive Topology Graph */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono mb-6">
          🕸️ Live Network Topology Map
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center justify-center py-6 relative">
          {/* Node 1: Stations */}
          <div className="flex flex-col items-center p-4 rounded-2xl border border-white/5 bg-white/[0.01] text-center z-10">
            <span className="text-2xl mb-1">📡</span>
            <span className="font-bold text-sm text-white">Sensors / Nodes</span>
            <span className="text-[10px] font-mono text-gray-500 mt-1 uppercase">
              {activeNodesCount} / {totalNodesCount} Online
            </span>
          </div>

          {/* Connection Line 1 - Horizontal Desktop */}
          <div className="hidden md:flex flex-col items-center justify-center font-mono text-[9px] text-gray-600">
            <span className="mb-1 text-indigo-500 animate-pulse">MQTT</span>
            <div className={`h-1 w-full bg-gradient-to-r ${activeNodesCount > 0 ? 'from-green-500 to-green-400 shadow-[0_0_8px_#4ade80]' : 'from-gray-700 to-gray-600'} rounded-full`}></div>
          </div>

          {/* Connection Line 1 - Vertical Mobile */}
          <div className="md:hidden flex flex-col items-center justify-center font-mono text-[9px] text-gray-600 my-1">
            <span className="mb-1 text-indigo-500 animate-pulse">MQTT</span>
            <div className={`w-1 h-8 bg-gradient-to-b ${activeNodesCount > 0 ? 'from-green-500 to-green-400 shadow-[0_0_8px_#4ade80]' : 'from-gray-700 to-gray-600'} rounded-full`}></div>
          </div>

          {/* Node 2: MQTT Broker */}
          <div className="flex flex-col items-center p-4 rounded-2xl border border-white/5 bg-white/[0.01] text-center z-10">
            <span className="text-2xl mb-1">🎛️</span>
            <span className="font-bold text-sm text-white">MQTT Broker</span>
            <span className={`text-[10px] font-mono mt-1 uppercase font-bold ${data?.mqtt.is_connected ? 'text-green-400' : 'text-red-500 animate-pulse'}`}>
              {data?.mqtt.is_connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Connection Line 2 - Horizontal Desktop */}
          <div className="hidden md:flex flex-col items-center justify-center font-mono text-[9px] text-gray-600">
            <span className="mb-1 text-indigo-500 animate-pulse">TCP/IP</span>
            <div className={`h-1 w-full bg-gradient-to-r ${data?.mqtt.is_connected ? 'from-green-500 to-green-400 shadow-[0_0_8px_#4ade80]' : 'from-gray-700 to-gray-600'} rounded-full`}></div>
          </div>

          {/* Connection Line 2 - Vertical Mobile */}
          <div className="md:hidden flex flex-col items-center justify-center font-mono text-[9px] text-gray-600 my-1">
            <span className="mb-1 text-indigo-500 animate-pulse">TCP/IP</span>
            <div className={`w-1 h-8 bg-gradient-to-b ${data?.mqtt.is_connected ? 'from-green-500 to-green-400 shadow-[0_0_8px_#4ade80]' : 'from-gray-700 to-gray-600'} rounded-full`}></div>
          </div>

          {/* Node 3: Backend API */}
          <div className="flex flex-col items-center p-4 rounded-2xl border border-white/5 bg-white/[0.01] text-center z-10">
            <span className="text-2xl mb-1">🖥️</span>
            <span className="font-bold text-sm text-white">Backend Server</span>
            <span className={`text-[10px] font-mono mt-1 uppercase font-bold ${error ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
              {error ? 'Offline' : 'Online'}
            </span>
          </div>
        </div>

        {/* Second Level Connections: Databases & Frontend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/5">
          {/* Databases link */}
          <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3">
            <span className="text-xs font-bold font-mono text-gray-400 uppercase block">💾 Data Storage Tier</span>
            <div className="space-y-2 font-mono text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">SQLite Status:</span>
                <span className={`font-bold ${data?.sqlite.status === 'healthy' ? 'text-green-400' : 'text-red-500'}`}>
                  {data?.sqlite.status.toUpperCase() ?? 'OFFLINE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">InfluxDB Status:</span>
                <span className={`font-bold ${data?.influxdb.status === 'connected' ? 'text-green-400' : 'text-red-500'}`}>
                  {data?.influxdb.status.toUpperCase() ?? 'DISCONNECTED'}
                </span>
              </div>
            </div>
          </div>

          {/* Frontend <-> Backend Ping */}
          <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold font-mono text-gray-400 uppercase">📶 Web Latency (RTT)</span>
              <span className="text-xs font-mono font-bold text-blue-400">{rtt} ms</span>
            </div>
            {/* SVG Mini Area Ping History Sparkline */}
            <div className="h-10 w-full relative bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden flex items-end">
              <svg className="w-full h-full text-blue-500/30">
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  points={rttHistory.map((val, idx) => {
                    const x = (idx / 19) * 200;
                    const maxVal = Math.max(...rttHistory, 50);
                    const y = 40 - (val / maxVal) * 35;
                    return `${x},${y}`;
                  }).join(' ')}
                />
              </svg>
            </div>
          </div>

          {/* Broker Host Specs */}
          <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3">
            <span className="text-xs font-bold font-mono text-gray-400 uppercase block">🌐 Network Broker Specs</span>
            <div className="space-y-2 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Broker:</span>
                <span className="text-gray-300">{data?.mqtt.host ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Port:</span>
                <span className="text-gray-300">{data?.mqtt.port ?? 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: SQLite & InfluxDB Detail cards */}
        <div className="space-y-6">
          {/* SQLite Card */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                💾 SQLite database
              </h3>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                data?.sqlite.status === 'healthy' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {data?.sqlite.status ?? 'Offline'}
              </span>
            </div>

            <div className="font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Database Size:</span>
                <span className="text-gray-300">{data?.sqlite.file_size_kb ?? 0} KB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Write Permission:</span>
                <span className={data?.sqlite.write_permission ? 'text-green-400' : 'text-red-400'}>
                  {data?.sqlite.write_permission ? 'Granted' : 'Denied'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500 block">Database Path:</span>
                <span className="text-gray-400 text-[10px] break-all bg-white/[0.02] p-1.5 rounded border border-white/5 block font-mono">
                  {data?.sqlite.db_path ?? 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* InfluxDB Card */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                📊 InfluxDB Client
              </h3>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                data?.influxdb.status === 'connected' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {data?.influxdb.status ?? 'Offline'}
              </span>
            </div>

            <div className="font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Bucket:</span>
                <span className="text-gray-300">{data?.influxdb.bucket ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Org:</span>
                <span className="text-gray-300">{data?.influxdb.org ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ping latency:</span>
                <span className="text-emerald-400 font-bold">
                  {data?.influxdb.ping_ms ? `${data.influxdb.ping_ms} ms` : 'N/A'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500 block">Service URL:</span>
                <span className="text-gray-400 text-[10px] break-all bg-white/[0.02] p-1.5 rounded border border-white/5 block font-mono">
                  {data?.influxdb.url ?? 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Individual Nodes Network signal register table */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
              📶 Node Signal Strength Registry
            </h2>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-gray-500 font-mono animate-pulse">
                Fetching nodes latency packets...
              </div>
            ) : !data || data.nodes.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 font-mono">
                No active or registered nodes in SQLite database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/5 text-left font-mono text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Node ID</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Name</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">RSSI</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Last Packet</th>
                      <th className="py-3 px-4 font-bold uppercase tracking-wider">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {data.nodes.map((node) => {
                      const sig = getSignalStrengthLabel(node.rssi);
                      return (
                        <tr key={node.node_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${node.is_online ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-red-500 animate-pulse'}`}></span>
                            {node.node_id}
                          </td>
                          <td className="py-3 px-4 text-gray-400">{node.display_name}</td>
                          <td className="py-3 px-4 capitalize">{node.status}</td>
                          <td className="py-3 px-4">
                            {node.rssi !== null ? (
                              <span className={`font-bold ${sig.color}`}>
                                {node.rssi} dBm ({sig.text})
                              </span>
                            ) : (
                              <span className="text-gray-600">N/A</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {node.last_heard_seconds !== null ? (
                              <span>{node.last_heard_seconds}s ago</span>
                            ) : (
                              <span className="text-gray-600">Never</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-400">
                            {node.uptime_m !== null ? `${node.uptime_m}m` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
