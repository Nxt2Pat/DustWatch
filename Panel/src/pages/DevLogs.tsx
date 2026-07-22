import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useSEO } from '../hooks/useSEO';

import { getApiBaseUrl } from '../api/sourceConfig';

const API_BASE = getApiBaseUrl();

interface DCSConfigs {
  roc_weight: number;
  rds_weight: number;
  scs_weight: number;
  ccs_weight: number;
  rds_threshold: number;
  scs_threshold: number;
  ccs_humidity: number;
}

interface DevDiagnostics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  process_memory_mb: number;
  active_ws_connections: number;
  timestamp: string;
}

interface ScenarioPreset {
  name: string;
  pm2_5: number;
  pm10: number;
  humidity: number;
  temperature: number;
}

const SCENARIO_PRESETS: Record<string, ScenarioPreset> = {
  clear: { name: 'Clear Air (Low dust, normal humidity)', pm2_5: 12.5, pm10: 18.2, humidity: 55.0, temperature: 29.5 },
  fog_spike: { name: 'Sensor Fog Spike (RH > 85%, mimics dust)', pm2_5: 88.0, pm10: 105.4, humidity: 95.5, temperature: 25.0 },
  pollution: { name: 'Sudden Influx (Spike, dry environment)', pm2_5: 155.0, pm10: 210.3, humidity: 40.0, temperature: 33.2 },
  purifier: { name: 'Clean Room (Air Purifier Active)', pm2_5: 2.3, pm10: 3.8, humidity: 50.0, temperature: 24.5 }
};

export default function DevPortal() {
  useSEO(
    'Developer Portal & Sandbox | DustWatch',
    'Simulate sensor telemetry, tune dynamic DCS parameters, and analyze server resources load.'
  );

  const stream = useStore((state) => state.stream);
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  const activeNodeIds = Object.keys(latest).filter(id => {
    const meta = nodesMeta[id];
    return !meta || meta.active !== 0;
  });

  const [activeTab, setActiveTab] = useState<'simulator' | 'config' | 'logs' | 'diagnostics' | 'data'>('logs');
  const [filterType, setFilterType] = useState<string>('all');

  // Raw Data Management States
  const [dataManageNodeId, setDataManageNodeId] = useState(activeNodeIds[0] || 'node_00');
  const [dataManageStart, setDataManageStart] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 2); // default 2 hours ago
    return d.toISOString().substring(0, 16);
  });
  const [dataManageEnd, setDataManageEnd] = useState(() => {
    return new Date().toISOString().substring(0, 16);
  });
  const [rawReadings, setRawReadings] = useState<any[]>([]);
  const [rawReadingsLoading, setRawReadingsLoading] = useState(false);
  const [rawReadingsError, setRawReadingsError] = useState<string | null>(null);
  const [dataActionStatus, setDataActionStatus] = useState<string | null>(null);

  // Edit Point States
  const [editingPoint, setEditingPoint] = useState<any | null>(null);
  const [editPM25, setEditPM25] = useState<string>('');
  const [editPM10, setEditPM10] = useState<string>('');
  const [editTemp, setEditTemp] = useState<string>('');
  const [editHumid, setEditHumid] = useState<string>('');
  const [editIAQ, setEditIAQ] = useState<string>('');

  useEffect(() => {
    if (activeNodeIds.length > 0 && !dataManageNodeId) {
      setDataManageNodeId(activeNodeIds[0]);
    }
  }, [activeNodeIds, dataManageNodeId]);
  
  // Dynamic Configs State
  const [configs, setConfigs] = useState<DCSConfigs>({
    roc_weight: 0.30,
    rds_weight: 0.25,
    scs_weight: 0.30,
    ccs_weight: 0.15,
    rds_threshold: 3.0,
    scs_threshold: 20.0,
    ccs_humidity: 85.0
  });
  const [configStatus, setConfigStatus] = useState<string | null>(null);
  
  // Simulator States
  const [simNodeId, setSimNodeId] = useState('NODE_TEST_01');
  const [simLocation, setSimLocation] = useState('Sandbox Laboratory');
  const [simPM25, setSimPM25] = useState(25.0);
  const [simPM10, setSimPM10] = useState(35.0);
  const [simHumidity, setSimHumidity] = useState(60.0);
  const [simTemperature, setSimTemperature] = useState(28.5);
  const [simStatus, setSimStatus] = useState<string | null>(null);

  // Diagnostics States
  const [diagnostics, setDiagnostics] = useState<DevDiagnostics | null>(null);
  const [mlStatus, setMlStatus] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [activeModalLog, setActiveModalLog] = useState<any | null>(null);

  // Real-time DCS preview calculator states
  const [previewRoC, setPreviewRoC] = useState(2.0);
  const [previewRDS, setPreviewRDS] = useState(1.5);
  const [previewSCS, setPreviewSCS] = useState(10.0);
  const [previewHum, setPreviewHum] = useState(75.0);

  const calcSimulatedDCS = () => {
    const rocPenalty = Math.min(1.0, previewRoC / 10.0);
    const rdsPenalty = previewRDS > configs.rds_threshold ? 1.0 : 0.0;
    const scsPenalty = previewSCS > configs.scs_threshold ? Math.min(1.0, (previewSCS - configs.scs_threshold) / 30.0) : 0.0;
    const ccsPenalty = previewHum > configs.ccs_humidity ? Math.min(1.0, (previewHum - configs.ccs_humidity) / (100.0 - configs.ccs_humidity)) : 0.0;

    const penaltyScore = (rocPenalty * configs.roc_weight) + 
                         (rdsPenalty * configs.rds_weight) + 
                         (scsPenalty * configs.scs_weight) + 
                         (ccsPenalty * configs.ccs_weight);
    return Math.max(0.0, 1.0 - penaltyScore);
  };

  const handleResetConfigs = () => {
    setConfigs({
      roc_weight: 0.30,
      rds_weight: 0.25,
      scs_weight: 0.30,
      ccs_weight: 0.15,
      rds_threshold: 3.0,
      scs_threshold: 20.0,
      ccs_humidity: 85.0
    });
  };

  // 1. Fetch parameters, models registry and diagnostics
  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/ml/models`);
      const json = await res.json();
      if (json.ok && json.data) {
        setModels(json.data);
      }
    } catch (err) {
      console.warn('Failed to load ML models registry', err);
    }
  };

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/dev/config`);
        const json = await res.json();
        if (json.ok && json.data) {
          setConfigs(json.data);
        }
      } catch (err) {
        console.error('Failed to load system configs', err);
      }
    };

    fetchConfigs();
    fetchModels();
  }, []);

  // Poll diagnostics every 3.5 seconds
  useEffect(() => {
    let active = true;
    const fetchDiagnostics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/dev/diagnostics`);
        const json = await res.json();
        if (active && json.ok && json.data) {
          setDiagnostics(json.data);
        }
      } catch (err) {
        console.warn('Failed to load server diagnostics', err);
      }
    };

    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Event Handlers
  const handleSaveConfigs = async () => {
    setConfigStatus(null);
    const sum = configs.roc_weight + configs.rds_weight + configs.scs_weight + configs.ccs_weight;
    if (Math.abs(sum - 1.0) > 1e-4) {
      setConfigStatus('❌ Error: The sum of DCS weights must be exactly 1.0 (100%). Currently it is ' + sum.toFixed(3));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });
      const json = await res.json();
      if (json.ok) {
        setConfigStatus('✅ Configurations updated and RAM cache reloaded successfully.');
      } else {
        setConfigStatus('❌ ' + (json.error || 'Update failed'));
      }
    } catch (err) {
      setConfigStatus('❌ Network error: Failed to reach server configurations endpoint');
    }
  };

  // ─── Data Management Handler Functions ───
  const fetchRawReadings = async () => {
    if (!dataManageNodeId) return;
    setRawReadingsLoading(true);
    setRawReadingsError(null);
    setDataActionStatus(null);
    try {
      const startISO = new Date(dataManageStart).toISOString();
      const endISO = new Date(dataManageEnd).toISOString();
      const res = await fetch(`${API_BASE}/api/v1/dev/readings/raw?node_id=${dataManageNodeId}&start=${startISO}&stop=${endISO}`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setRawReadings(json.data);
      } else {
        setRawReadingsError(json.error || 'Failed to fetch raw readings');
      }
    } catch (err) {
      setRawReadingsError('Network error connecting to backend dev API');
    } finally {
      setRawReadingsLoading(false);
    }
  };

  const handleDeleteRange = async () => {
    if (!dataManageNodeId) return;
    if (!window.confirm(`⚠️ Are you sure you want to DELETE ALL readings for ${dataManageNodeId} between ${dataManageStart} and ${dataManageEnd}? This action CANNOT be undone.`)) {
      return;
    }
    
    setDataActionStatus(null);
    try {
      const startISO = new Date(dataManageStart).toISOString();
      const endISO = new Date(dataManageEnd).toISOString();
      
      const res = await fetch(`${API_BASE}/api/v1/dev/readings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: dataManageNodeId,
          start: startISO,
          stop: endISO
        })
      });
      const json = await res.json();
      if (json.ok) {
        setDataActionStatus('✅ Selected data range deleted successfully.');
        fetchRawReadings();
      } else {
        setDataActionStatus(`❌ Delete failed: ${json.error || 'Unknown error'}`);
      }
    } catch (err) {
      setDataActionStatus('❌ Network error: Failed to reach delete API');
    }
  };

  const handleDeletePoint = async (timestamp: string) => {
    if (!dataManageNodeId) return;
    if (!window.confirm('Are you sure you want to delete this specific data point?')) {
      return;
    }

    setDataActionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/readings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: dataManageNodeId,
          start: timestamp,
          stop: timestamp
        })
      });
      const json = await res.json();
      if (json.ok) {
        setDataActionStatus('✅ Data point deleted successfully.');
        fetchRawReadings();
      } else {
        setDataActionStatus(`❌ Delete failed: ${json.error}`);
      }
    } catch (err) {
      setDataActionStatus('❌ Network error: Failed to reach delete API');
    }
  };

  const handleOpenEditModal = (point: any) => {
    setEditingPoint(point);
    setEditPM25(point.pm2_5 !== undefined ? String(point.pm2_5) : '');
    setEditPM10(point.pm10 !== undefined ? String(point.pm10) : '');
    setEditTemp(point.temperature !== undefined ? String(point.temperature) : '');
    setEditHumid(point.humidity !== undefined ? String(point.humidity) : '');
    setEditIAQ(point.iaq !== undefined ? String(point.iaq) : '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoint || !dataManageNodeId) return;

    setDataActionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/readings/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: dataManageNodeId,
          timestamp: editingPoint.timestamp,
          pm2_5: editPM25 !== '' ? parseFloat(editPM25) : null,
          pm10: editPM10 !== '' ? parseFloat(editPM10) : null,
          temperature: editTemp !== '' ? parseFloat(editTemp) : null,
          humidity: editHumid !== '' ? parseFloat(editHumid) : null,
          iaq: editIAQ !== '' ? parseFloat(editIAQ) : null,
        })
      });
      const json = await res.json();
      if (json.ok) {
        setDataActionStatus('✅ Data point updated successfully.');
        setEditingPoint(null);
        fetchRawReadings();
      } else {
        setDataActionStatus(`❌ Update failed: ${json.error}`);
      }
    } catch (err) {
      setDataActionStatus('❌ Network error: Failed to reach update API');
    }
  };

  const handleApplyPreset = (key: string) => {
    const preset = SCENARIO_PRESETS[key];
    if (preset) {
      setSimPM25(preset.pm2_5);
      setSimPM10(preset.pm10);
      setSimHumidity(preset.humidity);
      setSimTemperature(preset.temperature);
    }
  };

  const handleInjectTelemetry = async () => {
    setSimStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: simNodeId,
          location: simLocation,
          pm2_5: simPM25,
          pm10: simPM10,
          humidity: simHumidity,
          temperature: simTemperature
        })
      });
      const json = await res.json();
      if (json.ok) {
        setSimStatus(`✅ Live telemetry payload injected into MQTT for node "${simNodeId}".`);
      } else {
        setSimStatus('❌ ' + (json.error || 'Simulate request failed'));
      }
    } catch (err) {
      setSimStatus('❌ Network error: Telemetry simulator unreachable');
    }
  };

  const handleTriggerRetrain = async () => {
    setMlStatus('retraining');
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/ml/retrain`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setMlStatus('✅ ML daily retraining pipeline successfully triggered in background task.');
      } else {
        setMlStatus('❌ ' + (json.error || 'Retraining request failed'));
      }
    } catch (err) {
      setMlStatus('❌ Network error: MLOps endpoint unreachable');
    }
  };

  // 3. UI Helpers
  const filteredStream = stream.filter(msg => {
    if (filterType === 'all') return true;
    return msg.type === filterType;
  });

  const getLogSummary = (msg: any) => {
    const type = msg.type;
    const data = msg.data || {};
    if (type === 'sensor_update') {
      const pm25 = data.pm?.pm2_5 ?? '--';
      const pm10 = data.pm?.pm10 ?? '--';
      const temp = data.env?.temperature !== undefined ? `${data.env.temperature.toFixed(1)}°C` : '--';
      const hum = data.env?.humidity !== undefined ? `${Math.round(data.env.humidity)}%` : '--';
      return `PM2.5: ${pm25} µg/m³ • PM10: ${pm10} µg/m³ • Temp: ${temp} • Hum: ${hum}`;
    }
    if (type === 'alert') {
      return `${data.alert_type || 'Warning'} Alert: ${data.message || 'Limit exceeded'} (Val: ${data.value ?? '--'}, Thres: ${data.threshold ?? '--'})`;
    }
    if (type === 'master_status_update') {
      const status = data.status || 'offline';
      const uptime = data.uptime_s ? `${Math.round(data.uptime_s / 60)} mins` : '--';
      return `Status: ${status.toUpperCase()} • Uptime: ${uptime} • Heap: ${data.free_heap ? `${Math.round(data.free_heap / 1024)} KB` : '--'}`;
    }
    if (type === 'heartbeat') {
      return `Heartbeat checkin from node • Online Nodes: ${data.nodes_online?.join(', ') || 'none'}`;
    }
    return JSON.stringify(data).substring(0, 80) + '...';
  };

  const getLogBadgeColor = (type: string) => {
    switch (type) {
      case 'sensor_update': return 'text-green-400 bg-green-500/10 border-green-500/25';
      case 'alert': return 'text-red-400 bg-red-500/10 border-red-500/25';
      case 'heartbeat': return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
      case 'master_status_update': return 'text-purple-400 bg-purple-500/10 border-purple-500/25';
      case 'weather_update': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/25';
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Controls & Filters ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-gray-100 flex items-center gap-2">
            ⚙️ Developer Control Portal
          </h2>
          <p className="text-xs text-gray-400 mt-1">Configure parameters, run live telemetries simulation, and manage systems diagnostics</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap bg-white/5 border border-white/5 p-1 rounded-xl shrink-0 gap-1">
          {(['logs', 'config', 'simulator', 'diagnostics', 'data'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer ${activeTab === tab ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {tab === 'logs' ? '📋 Log Stream' : tab === 'config' ? '🎚️ DCS Config' : tab === 'simulator' ? '⚡ Simulator' : tab === 'diagnostics' ? '🖥️ Diagnostics' : '🗄️ Data Manager'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      
      {/* TAB 1: DCS Parameter Tuner */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">DCS Parameter Weights Adjuster</h3>
              <p className="text-xs text-gray-400 mt-1">Set the contribution ratio for each index. Weights sum must equal exactly 1.00 (100%)</p>
            </div>

            <div className="space-y-4">
              {/* Sliders */}
              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Rate of Change weight (RoC)</span>
                  <span className="text-blue-400 font-bold">{Math.round(configs.roc_weight * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={configs.roc_weight}
                  onChange={(e) => setConfigs({ ...configs, roc_weight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Rolling Standard Deviation weight (RDS)</span>
                  <span className="text-blue-400 font-bold">{Math.round(configs.rds_weight * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={configs.rds_weight}
                  onChange={(e) => setConfigs({ ...configs, rds_weight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Spatial Consistency weight (SCS)</span>
                  <span className="text-blue-400 font-bold">{Math.round(configs.scs_weight * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={configs.scs_weight}
                  onChange={(e) => setConfigs({ ...configs, scs_weight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Context Consistency weight (CCS)</span>
                  <span className="text-blue-400 font-bold">{Math.round(configs.ccs_weight * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={configs.ccs_weight}
                  onChange={(e) => setConfigs({ ...configs, ccs_weight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex items-center justify-between">
              <div className="text-xs font-mono">
                Total sum of weights:{' '}
                <span className={`font-bold ${Math.abs(configs.roc_weight + configs.rds_weight + configs.scs_weight + configs.ccs_weight - 1.0) < 1e-4 ? 'text-green-400' : 'text-red-400'}`}>
                  {Math.round((configs.roc_weight + configs.rds_weight + configs.scs_weight + configs.ccs_weight) * 100)}%
                </span>
              </div>
              <button
                onClick={handleResetConfigs}
                className="px-3 py-1 rounded-lg border text-[10px] font-mono text-gray-400 border-white/5 bg-white/5 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                🔄 Reset Defaults
              </button>
            </div>
          </div>

          {/* Threshold inputs side panel */}
          <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">Decay Parameters</h3>
              <p className="text-xs text-gray-400 mt-1">Configure penalty triggers boundaries</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">RDS Z-Score Threshold</label>
                <input
                  type="number" step="0.1" min="1" max="10"
                  value={configs.rds_threshold}
                  onChange={(e) => setConfigs({ ...configs, rds_threshold: parseFloat(e.target.value) || 3.0 })}
                  className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">SCS Spatial Threshold (ug/m³)</label>
                <input
                  type="number" step="1" min="5" max="100"
                  value={configs.scs_threshold}
                  onChange={(e) => setConfigs({ ...configs, scs_threshold: parseFloat(e.target.value) || 20.0 })}
                  className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">CCS Humidity Boundary (%)</label>
                <input
                  type="number" step="1" min="50" max="95"
                  value={configs.ccs_humidity}
                  onChange={(e) => setConfigs({ ...configs, ccs_humidity: parseFloat(e.target.value) || 85.0 })}
                  className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none"
                />
              </div>

              {configStatus && (
                <div className="p-3 rounded-xl border border-white/5 bg-white/[0.02] text-[10px] font-mono leading-relaxed text-gray-300">
                  {configStatus}
                </div>
              )}

              <button
                onClick={handleSaveConfigs}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                💾 Save System Configurations
              </button>
            </div>
          </div>

          {/* Live DCS score preview calculator */}
          <div className="lg:col-span-3 p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">⚡ Live DCS Score Preview Calculator</h3>
              <p className="text-xs text-gray-400 mt-1">Simulate input factors instantly to check how weights and thresholds affect the Data Confidence Score (DCS).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sliders for simulation */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                    <span>Simulated Rate of Change (RoC)</span>
                    <span className="text-blue-400 font-bold">{previewRoC.toFixed(1)} ug/m³/min</span>
                  </div>
                  <input
                    type="range" min="0" max="15" step="0.5"
                    value={previewRoC}
                    onChange={(e) => setPreviewRoC(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                    <span>Simulated Standard Deviation (RDS)</span>
                    <span className="text-blue-400 font-bold">{previewRDS.toFixed(2)} σ</span>
                  </div>
                  <input
                    type="range" min="0" max="6" step="0.1"
                    value={previewRDS}
                    onChange={(e) => setPreviewRDS(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Threshold: {configs.rds_threshold} σ (Penalty active: {previewRDS > configs.rds_threshold ? 'Yes' : 'No'})</div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                    <span>Simulated Spatial Diff (SCS)</span>
                    <span className="text-blue-400 font-bold">{previewSCS.toFixed(1)} ug/m³</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1.0"
                    value={previewSCS}
                    onChange={(e) => setPreviewSCS(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Threshold: {configs.scs_threshold} ug/m³ (Penalty active: {previewSCS > configs.scs_threshold ? 'Yes' : 'No'})</div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                    <span>Simulated Ambient Humidity (CCS)</span>
                    <span className="text-blue-400 font-bold">{Math.round(previewHum)}% RH</span>
                  </div>
                  <input
                    type="range" min="40" max="100" step="1"
                    value={previewHum}
                    onChange={(e) => setPreviewHum(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">Boundary: {configs.ccs_humidity}% RH (Penalty active: {previewHum > configs.ccs_humidity ? 'Yes' : 'No'})</div>
                </div>
              </div>

              {/* Score Display Card */}
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between items-center text-center">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono">Calculated Simulated DCS</span>
                  <div className={`text-6xl font-black font-mono tracking-tighter ${
                    calcSimulatedDCS() >= 0.85 
                      ? 'text-green-400' 
                      : calcSimulatedDCS() >= 0.60
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}>
                    {Math.round(calcSimulatedDCS() * 100)}%
                  </div>
                </div>

                <div className="w-full space-y-2 mt-4">
                  <div className="flex justify-between text-[11px] font-mono text-gray-400">
                    <span>RoC contribution penalty:</span>
                    <span>-{Math.round(Math.min(1.0, previewRoC / 10.0) * configs.roc_weight * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-gray-400">
                    <span>RDS contribution penalty:</span>
                    <span>-{Math.round((previewRDS > configs.rds_threshold ? 1.0 : 0.0) * configs.rds_weight * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-gray-400">
                    <span>SCS contribution penalty:</span>
                    <span>-{Math.round((previewSCS > configs.scs_threshold ? Math.min(1.0, (previewSCS - configs.scs_threshold) / 30.0) : 0.0) * configs.scs_weight * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-gray-400">
                    <span>CCS contribution penalty:</span>
                    <span>-{Math.round((previewHum > configs.ccs_humidity ? Math.min(1.0, (previewHum - configs.ccs_humidity) / (100.0 - configs.ccs_humidity)) : 0.0) * configs.ccs_weight * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Telemetry Simulator */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">MQTT Telemetry Ingestion Simulator</h3>
                <p className="text-xs text-gray-400 mt-1">Publish fake sensor broadcasts to verify calculations pipelines</p>
              </div>

              {/* Scenario Presets Select */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-mono">Presets:</span>
                <select
                  onChange={(e) => handleApplyPreset(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Preset Scenario --</option>
                  {Object.entries(SCENARIO_PRESETS).map(([key, item]) => (
                    <option key={key} value={key}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {/* Sliders */}
              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>PM2.5 concentration level</span>
                  <span className="text-blue-400 font-bold">{simPM25.toFixed(1)} ug/m³</span>
                </div>
                <input
                  type="range" min="0" max="350" step="0.5"
                  value={simPM25}
                  onChange={(e) => setSimPM25(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>PM10 concentration level</span>
                  <span className="text-blue-400 font-bold">{simPM10.toFixed(1)} ug/m³</span>
                </div>
                <input
                  type="range" min="0" max="450" step="0.5"
                  value={simPM10}
                  onChange={(e) => setSimPM10(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Relative Humidity (RH)</span>
                  <span className="text-blue-400 font-bold">{Math.round(simHumidity)}%</span>
                </div>
                <input
                  type="range" min="0" max="100" step="1"
                  value={simHumidity}
                  onChange={(e) => setSimHumidity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                  <span>Ambient Temperature</span>
                  <span className="text-blue-400 font-bold">{simTemperature.toFixed(1)} °C</span>
                </div>
                <input
                  type="range" min="-10" max="50" step="0.5"
                  value={simTemperature}
                  onChange={(e) => setSimTemperature(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Node identity settings */}
          <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">Simulation Node</h3>
              <p className="text-xs text-gray-400 mt-1">Specify target node credentials</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Node ID Code</label>
                <input
                  type="text"
                  value={simNodeId}
                  onChange={(e) => setSimNodeId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Simulation Location</label>
                <input
                  type="text"
                  value={simLocation}
                  onChange={(e) => setSimLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none"
                />
              </div>

              {simStatus && (
                <div className="p-3 rounded-xl border border-white/5 bg-white/[0.02] text-[10px] font-mono leading-relaxed text-gray-300">
                  {simStatus}
                </div>
              )}

              <button
                onClick={handleInjectTelemetry}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                ⚡ Inject Simulated Telemetry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Logs Stream */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Terminal log panel */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/30 border border-red-500/50"></span>
                <span className="h-3 w-3 rounded-full bg-yellow-500/30 border border-yellow-500/50"></span>
                <span className="h-3 w-3 rounded-full bg-green-500/30 border border-green-500/50"></span>
                <span className="text-xs font-mono text-gray-400 ml-2">telemetry-ingest-log.sh</span>
              </div>

              {/* Feed filters selection */}
              <div className="flex items-center gap-1.5">
                {['all', 'sensor_update', 'alert', 'heartbeat'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-2 py-0.5 rounded border text-[9px] font-mono transition-all cursor-pointer ${filterType === type ? 'text-blue-400 bg-blue-500/15 border-blue-500/30' : 'text-gray-500 border-white/5 bg-white/5 hover:text-gray-400'}`}
                  >
                    {type.toUpperCase().replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Console content list */}
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto font-mono text-xs pr-1 bg-black/10">
              {filteredStream.map((msg, index) => (
                <div
                  key={index}
                  onClick={() => setActiveModalLog(msg)}
                  className="p-3.5 hover:bg-white/[0.03] transition-all flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider shrink-0 ${getLogBadgeColor(msg.type)}`}>
                      {msg.type.replace('_', ' ')}
                    </span>
                    {msg.node_id && (
                      <span className="text-blue-400 font-bold shrink-0">[{msg.node_id}]</span>
                    )}
                    <span className="text-gray-300 truncate text-[11px]">
                      {getLogSummary(msg)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-500 text-[10px]">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                    </span>
                    <span className="text-blue-500 hover:text-blue-400 text-[10px] font-bold">
                      INSPECT →
                    </span>
                  </div>
                </div>
              ))}

              {filteredStream.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  No live events matching selection received yet...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Server Diagnostics & MLOps */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {/* Real-time Diagnostics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between">
              <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider font-mono">CPU Usage</span>
              <span className="font-mono text-2xl font-black text-white mt-1">
                {diagnostics ? `${Math.round(diagnostics.cpu_percent)}%` : '--'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between">
              <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider font-mono">RAM Utilization</span>
              <span className="font-mono text-2xl font-black text-white mt-1">
                {diagnostics ? `${Math.round(diagnostics.memory_percent)}%` : '--'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between">
              <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider font-mono">Active WS Handshakes</span>
              <span className="font-mono text-2xl font-black text-white mt-1">
                {diagnostics ? diagnostics.active_ws_connections : '--'}
              </span>
            </div>

            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between">
              <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider font-mono">Disk Storage Usage</span>
              <span className="font-mono text-2xl font-black text-white mt-1">
                {diagnostics ? `${Math.round(diagnostics.disk_percent)}%` : '--'}
              </span>
            </div>

            <div className="col-span-2 md:col-span-1 p-4 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col justify-between">
              <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider font-mono">App Memory RAM RSS</span>
              <span className="font-mono text-2xl font-black text-white mt-1">
                {diagnostics ? `${diagnostics.process_memory_mb} MB` : '--'}
              </span>
            </div>
          </div>

          {/* Core manual retraining controller */}
          <div className="p-5 rounded-2xl border border-white/5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">🔮 Manual ML Operations controller</h4>
              <p className="text-[11px] text-gray-400 mt-1">Manually start retraining all active models now. Fits parameter boundaries on the complete 90 days dataset.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {mlStatus && mlStatus !== 'retraining' && (
                <span className="text-[10px] font-mono text-gray-300 hidden md:inline">{mlStatus}</span>
              )}
              <button
                disabled={mlStatus === 'retraining'}
                onClick={handleTriggerRetrain}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-white/10 disabled:text-gray-500 transition-colors shadow-lg cursor-pointer font-mono"
              >
                {mlStatus === 'retraining' ? '⏳ Retraining...' : '⚙️ Trigger ML Retraining'}
              </button>
            </div>
          </div>

          {/* ML Models Registry Table */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono">🤖 Trained ML Model Registry</h4>
              <button
                onClick={fetchModels}
                className="px-2.5 py-1 rounded-lg border text-[10px] font-mono text-gray-400 border-white/5 bg-white/5 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                🔄 Refresh Models
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01] text-gray-500 text-[10px] uppercase font-bold">
                    <th className="p-4">Station Node ID</th>
                    <th className="p-4">Horizon</th>
                    <th className="p-4">Model Class</th>
                    <th className="p-4">RMSE Loss</th>
                    <th className="p-4">MAE Score</th>
                    <th className="p-4">Training Rows</th>
                    <th className="p-4 text-right">Trained At (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {models.map((m: any, index) => (
                    <tr key={index} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 font-bold text-blue-400 uppercase">{m.node_id}</td>
                      <td className="p-4 text-indigo-400">+{m.horizon_h}h</td>
                      <td className="p-4 uppercase">{m.model_type}</td>
                      <td className="p-4 text-green-400">{m.rmse ? m.rmse.toFixed(3) : '--'}</td>
                      <td className="p-4">{m.mae ? m.mae.toFixed(3) : '--'}</td>
                      <td className="p-4 text-gray-500">{m.training_samples ?? 'N/A'}</td>
                      <td className="p-4 text-right text-[10px] text-gray-400">
                        {m.trained_at ? new Date(m.trained_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                  {models.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No trained ML models registered in registry folder. Click 'Trigger ML Retraining' above to train.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Data Manager (Delete & Edit) */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-4">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">🗄️ Sensor Time-Series Data Manager</h3>
            <p className="text-xs text-gray-400">Select a specific classroom station and target time range to inspect, edit, or delete sensor records.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Select Station</label>
                <select
                  value={dataManageNodeId}
                  onChange={(e) => setDataManageNodeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
                >
                  <option value="" disabled>-- Select Station --</option>
                  {activeNodeIds.map(id => (
                    <option key={id} value={id}>{nodesMeta[id]?.display_name || id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Start Time</label>
                <input
                  type="datetime-local"
                  value={dataManageStart}
                  onChange={(e) => setDataManageStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">End Time</label>
                <input
                  type="datetime-local"
                  value={dataManageEnd}
                  onChange={(e) => setDataManageEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={fetchRawReadings}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer font-mono h-[36px]"
                >
                  🔍 Query Data
                </button>
                <button
                  onClick={handleDeleteRange}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 cursor-pointer font-mono h-[36px]"
                >
                  🗑️ Delete Range
                </button>
              </div>
            </div>

            {dataActionStatus && (
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02] text-xs font-mono leading-relaxed text-gray-300">
                {dataActionStatus}
              </div>
            )}
          </div>

          {/* Raw Readings Table */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono">
                📋 Raw Data Points ({rawReadings.length} records found)
              </h4>
            </div>

            {rawReadingsLoading ? (
              <div className="py-16 text-center text-xs text-gray-500 font-mono animate-pulse">
                Querying InfluxDB time-series bucket...
              </div>
            ) : rawReadingsError ? (
              <div className="py-16 text-center text-xs text-red-400 font-mono">
                {rawReadingsError}
              </div>
            ) : rawReadings.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-500 font-mono">
                No telemetry records found for the selected criteria. Adjust dates and query again.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01] text-gray-500 text-[10px] uppercase font-bold sticky top-0 bg-[#070a13] z-10">
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">PM2.5</th>
                      <th className="p-4">PM10</th>
                      <th className="p-4">Temp</th>
                      <th className="p-4">Humid</th>
                      <th className="p-4">IAQ</th>
                      <th className="p-4">DCS</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {rawReadings.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-[10px] text-gray-400">
                          {new Date(pt.timestamp).toLocaleString()}
                        </td>
                        <td className="p-4 font-bold text-white">{pt.pm2_5 ?? '--'}</td>
                        <td className="p-4">{pt.pm10 ?? '--'}</td>
                        <td className="p-4">{pt.temperature !== undefined ? `${pt.temperature.toFixed(1)}°C` : '--'}</td>
                        <td className="p-4">{pt.humidity !== undefined ? `${Math.round(pt.humidity)}%` : '--'}</td>
                        <td className="p-4">{pt.iaq ?? '--'}</td>
                        <td className="p-4 text-blue-400">{pt.dcs ? `${Math.round(pt.dcs * 100)}%` : '--'}</td>
                        <td className="p-4 text-right space-x-2 shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(pt)}
                            className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 transition-all font-bold text-[10px] cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeletePoint(pt.timestamp)}
                            className="px-2 py-1 rounded bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all font-bold text-[10px] cursor-pointer"
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT DATA POINT POPUP MODAL */}
      {editingPoint && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0d16] shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">✏️ Edit Time-Series Data Point</h3>
                <span className="text-[10px] text-gray-500 font-mono break-all">{editingPoint.timestamp}</span>
              </div>
              <button
                onClick={() => setEditingPoint(null)}
                className="text-gray-400 hover:text-white transition-colors font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">PM2.5 Value</label>
                  <input
                    type="number" step="0.1" min="0" max="500"
                    value={editPM25}
                    onChange={(e) => setEditPM25(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">PM10 Value</label>
                  <input
                    type="number" step="0.1" min="0" max="600"
                    value={editPM10}
                    onChange={(e) => setEditPM10(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Temperature (°C)</label>
                  <input
                    type="number" step="0.1" min="-20" max="70"
                    value={editTemp}
                    onChange={(e) => setEditTemp(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Humidity (%)</label>
                  <input
                    type="number" step="1" min="0" max="100"
                    value={editHumid}
                    onChange={(e) => setEditHumid(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">IAQ Index</label>
                  <input
                    type="number" step="1" min="0" max="500"
                    value={editIAQ}
                    onChange={(e) => setEditIAQ(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-xs text-gray-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setEditingPoint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 border border-white/5 cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer font-mono"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT PAYLOAD POPUP MODAL */}
      {activeModalLog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0a0d16] shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getLogBadgeColor(activeModalLog.type)}`}>
                  {activeModalLog.type}
                </span>
                {activeModalLog.node_id && (
                  <span className="text-blue-400 font-bold">[{activeModalLog.node_id}]</span>
                )}
              </div>
              <button
                onClick={() => setActiveModalLog(null)}
                className="text-gray-400 hover:text-white transition-colors font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <pre className="p-4 rounded-2xl border border-white/5 bg-black/40 text-gray-200 text-xs font-mono leading-relaxed overflow-x-auto">
                {JSON.stringify(activeModalLog.data || activeModalLog, null, 2)}
              </pre>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-white/5">
              <button
                onClick={() => setActiveModalLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 border border-white/5 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
