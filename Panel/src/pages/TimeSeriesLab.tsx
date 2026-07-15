import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useSEO } from '../hooks/useSEO';
import { getApiBaseUrl } from '../api/sourceConfig';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface HistoryPoint {
  timestamp: string;
  pm2_5?: number;
  pm10?: number;
  humidity?: number;
  temperature?: number;
  [key: string]: any;
}

export default function TimeSeriesLab() {
  useSEO(
    'Time-Series Lab | DustWatch',
    'Explore historical environmental analytics, compare stations node sensors, and analyze anomalies.'
  );

  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedField, setSelectedField] = useState<'pm2_5' | 'pm10' | 'humidity' | 'temperature'>('pm2_5');
  const [timeRange, setTimeRange] = useState<string>('-24h');
  const [historyData, setHistoryData] = useState<Record<string, HistoryPoint[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot | null>(null);

  const activeNodeIds = Object.keys(latest).filter(id => {
    const meta = nodesMeta[id];
    return !meta || meta.active !== 0;
  });

  // Select first node by default on load if none selected
  useEffect(() => {
    if (selectedNodes.length === 0 && activeNodeIds.length > 0) {
      setSelectedNodes([activeNodeIds[0]]);
    }
  }, [activeNodeIds, selectedNodes]);

  const API_BASE = getApiBaseUrl();

  // Fetch helper
  const fetchHistory = async () => {
    if (selectedNodes.length === 0) {
      setHistoryData({});
      return;
    }

    setLoading(true);
    setError(null);

    // Map timeRange to interval window
    let interval = '5m';
    if (timeRange === '-1h') interval = '1m';
    if (timeRange === '-6h') interval = '2m';
    if (timeRange === '-24h') interval = '10m';
    if (timeRange === '-7d') interval = '1h';

    try {
      const results: Record<string, HistoryPoint[]> = {};
      await Promise.all(
        selectedNodes.map(async (nodeId) => {
          const res = await fetch(`${API_BASE}/api/v1/readings/${nodeId}/history?start=${timeRange}&interval=${interval}`);
          const json = await res.json();
          if (json.ok && Array.isArray(json.data)) {
            results[nodeId] = json.data;
          }
        })
      );
      setHistoryData(results);
    } catch (err) {
      console.error('Failed to fetch historical series', err);
      setError('Failed to load telemetry history from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedNodes, timeRange]);

  const toggleNode = (nodeId: string) => {
    if (selectedNodes.includes(nodeId)) {
      setSelectedNodes(selectedNodes.filter(id => id !== nodeId));
    } else {
      setSelectedNodes([...selectedNodes, nodeId]);
    }
  };

  // Helper color map for different nodes
  const nodeColors: Record<string, string> = {
    node_00: '#3b82f6', // blue
    node_01: '#8b5cf6', // purple
    node_02: '#ec4899', // pink
    node_03: '#10b981', // green
    NODE_TEST_01: '#f59e0b' // yellow
  };
  const getDefaultColor = (nodeId: string) => nodeColors[nodeId] || '#6366f1';

  // ─── Align Time-Series Data & Draw uPlot Chart ───────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Gather all historical points and extract values
    const allPoints = Object.values(historyData).flat();
    if (selectedNodes.length === 0 || allPoints.length === 0) {
      if (plotInstance.current) {
        plotInstance.current.destroy();
        plotInstance.current = null;
      }
      return;
    }

    // 2. Align timestamps from multiple sensors (handling missing points/offsets)
    const allTimestampsMap = new Map<number, Record<string, number | null>>();
    
    Object.entries(historyData).forEach(([nodeId, points]) => {
      points.forEach((p) => {
        const tsSeconds = Math.round(new Date(p.timestamp).getTime() / 1000);
        
        // Find closest timestamp (within 60s tolerance) to group points together
        let groupedTs = tsSeconds;
        for (const existingTs of allTimestampsMap.keys()) {
          if (Math.abs(existingTs - tsSeconds) <= 60) {
            groupedTs = existingTs;
            break;
          }
        }

        if (!allTimestampsMap.has(groupedTs)) {
          allTimestampsMap.set(groupedTs, {});
        }
        
        const val = p[selectedField];
        allTimestampsMap.get(groupedTs)![nodeId] = val !== undefined ? (val as number) : null;
      });
    });

    const sortedTimestamps = Array.from(allTimestampsMap.keys()).sort((a, b) => a - b);
    if (sortedTimestamps.length === 0) return;

    const seriesData = selectedNodes.map((nodeId) => {
      return sortedTimestamps.map((ts) => {
        const vals = allTimestampsMap.get(ts);
        return vals ? (vals[nodeId] ?? null) : null;
      });
    });

    const plotData = [sortedTimestamps, ...seriesData] as uPlot.AlignedData;

    // 3. Configure uPlot premium styles
    const opts: uPlot.Options = {
      title: '',
      width: chartContainerRef.current.clientWidth || 700,
      height: 380,
      cursor: {
        show: true,
        points: {
          show: true,
          fill: '#fff',
          stroke: '#3b82f6',
          size: 7,
        },
      },
      legend: {
        show: true,
        live: true,
      },
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: '#9ca3af',
          grid: {
            stroke: 'rgba(255, 255, 255, 0.04)',
            width: 1,
          },
          ticks: { stroke: 'rgba(255, 255, 255, 0.08)' },
          font: '10px monospace',
        },
        {
          stroke: '#9ca3af',
          grid: {
            stroke: 'rgba(255, 255, 255, 0.04)',
            width: 1,
          },
          ticks: { stroke: 'rgba(255, 255, 255, 0.08)' },
          font: '10px monospace',
          values: (_, splits) => splits.map(val => val.toFixed(1)),
        },
      ],
      series: [
        {}, // X-axis (time)
        ...selectedNodes.map((nodeId) => {
          const color = getDefaultColor(nodeId);
          const displayName = nodesMeta[nodeId]?.display_name || nodeId;
          return {
            label: displayName,
            stroke: color,
            width: 2.5,
            points: { show: false },
            spanGaps: true,
          };
        }),
      ],
    };

    // 4. Destroy previous chart instance
    if (plotInstance.current) {
      plotInstance.current.destroy();
    }

    // 5. Initialize the new uPlot instance
    try {
      plotInstance.current = new uPlot(opts, plotData, chartContainerRef.current);
    } catch (err) {
      console.error('Failed to create TimeSeries uPlot chart:', err);
    }

    // 6. Handle resizing
    const handleResize = () => {
      if (plotInstance.current && chartContainerRef.current) {
        plotInstance.current.setSize({
          width: chartContainerRef.current.clientWidth,
          height: 380,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (plotInstance.current) {
        plotInstance.current.destroy();
        plotInstance.current = null;
      }
    };
  }, [historyData, selectedNodes, selectedField]);

  // Extract stats for rendering bottom panel
  const allPoints = Object.values(historyData).flat();
  const values = allPoints.map(p => p[selectedField]).filter(v => v !== undefined) as number[];
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 glass-panel">
        <div>
          <h2 className="text-xl font-black text-gray-100 flex items-center gap-2">
            🔬 Time-Series Analysis Lab
          </h2>
          <p className="text-xs text-gray-400 mt-1">Cross-compare node sensors, extract custom timelines, and inspect data points</p>
        </div>

        {/* Time range selector - Segmented Control */}
        <div className="flex bg-white/5 border border-white/5 p-1 rounded-2xl shrink-0 overflow-x-auto max-w-full">
          {[
            { label: '1 Hour', val: '-1h' },
            { label: '6 Hours', val: '-6h' },
            { label: '24 Hours', val: '-24h' },
            { label: '7 Days', val: '-7d' }
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => setTimeRange(opt.val)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${timeRange === opt.val ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls Panel */}
        <div className="p-6 glass-card space-y-6 lg:col-span-1">
          {/* horizontal scroll metric field selector */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">1. Select Parameter</h3>
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 no-scrollbar">
              {[
                { field: 'pm2_5', label: 'PM2.5' },
                { field: 'pm10', label: 'PM10' },
                { field: 'humidity', label: 'Humidity' },
                { field: 'temperature', label: 'Temp' }
              ].map(opt => (
                <button
                  key={opt.field}
                  onClick={() => setSelectedField(opt.field as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-mono whitespace-nowrap h-[36px] flex items-center justify-center ${selectedField === opt.field ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-gray-400 border-white/5 bg-white/5 hover:bg-white/10'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">2. Compare Stations</h3>
            <div className="flex flex-col gap-2 mt-3 max-h-[300px] overflow-y-auto pr-1">
              {activeNodeIds.map(nodeId => {
                const meta = nodesMeta[nodeId];
                const displayName = meta?.display_name || `Station ${nodeId}`;
                const color = getDefaultColor(nodeId);
                const isSelected = selectedNodes.includes(nodeId);

                return (
                  <button
                    key={nodeId}
                    onClick={() => toggleNode(nodeId)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="text-xs font-bold text-gray-200">{displayName}</span>
                    </div>
                    <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-blue-500/50 bg-blue-500/20 text-blue-400' : 'border-white/10 bg-transparent'}`}>
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </div>
                  </button>
                );
              })}
              {activeNodeIds.length === 0 && (
                <div className="text-xs text-gray-500 text-center py-4 font-mono">No active stations configured</div>
              )}
            </div>
          </div>

          <button
            onClick={fetchHistory}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer font-mono h-[44px]"
          >
            🔄 Sync Data Points
          </button>
        </div>

        {/* Chart Window */}
        <div className="lg:col-span-3 p-6 glass-card flex flex-col justify-between min-h-[460px]">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest font-mono">
              Interactive Historical Chart ({selectedField.toUpperCase()})
            </h3>
            {loading && (
              <span className="text-[10px] font-mono text-blue-400 animate-pulse">⏳ Loading raw points...</span>
            )}
          </div>

          {error && (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-red-400 text-xs font-mono">
              {error}
            </div>
          )}

          {!error && selectedNodes.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-500 text-xs font-mono">
              Select one or more stations from the panel to begin comparisons.
            </div>
          )}

          {!error && selectedNodes.length > 0 && allPoints.length === 0 && !loading && (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-500 text-xs font-mono">
              No historical data cached in database for selection. Make sure stations are active.
            </div>
          )}

          {/* Interactive uPlot Chart Container */}
          {!error && selectedNodes.length > 0 && allPoints.length > 0 && (
            <div className="flex-1 mt-4 relative w-full overflow-hidden" ref={chartContainerRef} style={{ minHeight: '380px' }} />
          )}

          {/* Bottom legend descriptors */}
          <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-4 text-[10px] font-mono text-gray-500 gap-4 mt-4">
            <div className="flex gap-4">
              <span>Min Value: <span className="text-gray-300 font-bold">{minValue.toFixed(1)}</span></span>
              <span>Max Value: <span className="text-gray-300 font-bold">{maxValue.toFixed(1)}</span></span>
            </div>
            <div className="flex gap-3">
              {selectedNodes.map(nodeId => (
                <div key={nodeId} className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getDefaultColor(nodeId) }}></span>
                  <span className="text-gray-400 font-bold">{nodesMeta[nodeId]?.display_name || nodeId}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
