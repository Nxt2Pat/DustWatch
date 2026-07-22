import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../api/client';
import AQIGaugeCard from '../components/cards/AQIGaugeCard';
import MetricTile from '../components/cards/MetricTile';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';
import RangeSelector from '../components/charts/RangeSelector';
import type { TimeRange } from '../components/charts/RangeSelector';
import { useSEO } from '../hooks/useSEO';
import StatusDot from '../components/ui/StatusDot';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

interface HistoryPoint {
  timestamp: string;
  pm1_0?: number;
  pm2_5?: number;
  pm10?: number;
  temperature?: number;
  humidity?: number;
  iaq?: number;
  db_avg?: number;
  db_peak?: number;
  rssi?: number;
  [key: string]: unknown;
}

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const nodesMeta = useStore((state) => state.nodesMeta);
  const meta = nodesMeta[id ?? ''];
  const latestNode = useStore((state) => state.latest[id ?? '']);
  const displayName = meta?.display_name || latestNode?.reading.location || id;
  const isConnected = latestNode !== undefined && (() => {
    const now = new Date().getTime();
    const ts = new Date(latestNode.reading.timestamp).getTime();
    return (now - ts) / 1000 < 600;
  })();

  useSEO(
    latestNode ? `${latestNode.reading.location} | Station ${id} Detail — DustWatch` : 'Station Detail — DustWatch',
    `Historical data metrics, sensor reading trends, and environment statistics for classroom telemetry node ${id}.`
  );

  const [timeRange, setTimeRange] = useState<TimeRange>('-1h');
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Predictions states
  const [predictions, setPredictions] = useState<any>(null);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const fetchPredictions = async () => {
      setIsLoadingPredictions(true);
      try {
        const data = await api.get<any>(`/api/v1/readings/${id}/prediction`);
        if (active && data) {
          setPredictions(data);
        }
      } catch (err) {
        console.warn('Failed to fetch predictions', err);
      } finally {
        if (active) setIsLoadingPredictions(false);
      }
    };

    fetchPredictions();

    return () => {
      active = false;
    };
  }, [id, latestNode]);

  // Map ranges to aggregation windows for InfluxDB query optimization
  const getInterval = (range: TimeRange): string => {
    switch (range) {
      case '-1h': return '1m';
      case '-6h': return '5m';
      case '-24h': return '15m';
      case '-7d': return '1h';
      case '-30d': return '6h';
      default: return '5m';
    }
  };

  useEffect(() => {
    if (!id) return;
    let active = true;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      const interval = getInterval(timeRange);
      try {
        const data = await api.get<HistoryPoint[]>(`/api/v1/readings/${id}/history?start=${timeRange}&interval=${interval}`);
        if (!active) return;

        if (Array.isArray(data)) {
          setHistory(data);
        } else {
          setHistory([]);
        }
      } catch (err) {
        console.warn('InfluxDB query failed', err);
        if (active) {
          setHistory([]);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchHistory();

    return () => {
      active = false;
    };
  }, [id, timeRange, latestNode]);

  if (!latestNode) {
    return (
      <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-12 text-center">
        <h3 className="text-gray-400 font-bold">Station {id} not found</h3>
        <p className="text-xs text-gray-500 mt-2">Waiting for first telemetry broadcast to register node.</p>
        <Link to="/" className="inline-block mt-4 text-xs text-blue-400 font-bold hover:text-blue-300">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const { reading, aqi } = latestNode;

  // Compute metric health descriptors
  const getIAQStatus = (val?: number) => {
    if (!val) return { label: 'N/A', color: 'text-gray-400' };
    if (val <= 50) return { label: 'Excellent', color: 'text-blue-400' };
    if (val <= 100) return { label: 'Good', color: 'text-green-400' };
    if (val <= 150) return { label: 'Moderate', color: 'text-yellow-400' };
    if (val <= 200) return { label: 'Poor', color: 'text-orange-400' };
    return { label: 'Unhealthy', color: 'text-red-400' };
  };

  const iaqStat = getIAQStatus(reading.env.iaq);

  return (
    <div className="space-y-6">
      {/* ─── Header bar ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link to="/" className="h-8 w-8 rounded-lg border border-white/5 bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            ←
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold font-mono tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md uppercase">
                ID / Codename: {id}
              </span>
              <StatusDot online={isConnected} label={isConnected ? 'Online' : 'Offline'} />
              {latestNode.dcs !== undefined && (
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                  latestNode.dcs >= 0.85 
                    ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                    : latestNode.dcs >= 0.60
                    ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                    : 'bg-red-500/10 border-red-500/25 text-red-400'
                }`}>
                  DCS: {Math.round(latestNode.dcs * 100)}%
                </span>
              )}
              {latestNode.status && (
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 uppercase">
                  {latestNode.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mt-1">{displayName}</h1>
          </div>
        </div>

        {/* Date Selector */}
        <RangeSelector active={timeRange} onChange={setTimeRange} />
      </div>

      {/* ─── Live Metrics Summary Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Main AQI gauge */}
        <div className="md:col-span-1 p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md flex flex-col items-center justify-center">
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-4 font-mono">
            Air Quality Gauge
          </h4>
          <AQIGaugeCard score={aqi.aqi_score} level={aqi.aqi_level} />
        </div>

        {/* Secondary Metrics sub-grid */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricTile
            label="Temperature"
            value={reading.env.temperature !== undefined && reading.env.temperature !== null ? reading.env.temperature.toFixed(5) : '--'}
            unit="°C"
            status={reading.env.temperature && reading.env.temperature > 30 ? 'Warm' : 'Cool'}
            statusColor={reading.env.temperature && reading.env.temperature > 30 ? 'text-yellow-400' : 'text-green-400'}
            icon="🌡️"
          />
          <MetricTile
            label="Humidity"
            value={reading.env.humidity !== undefined && reading.env.humidity !== null ? reading.env.humidity.toFixed(5) : '--'}
            unit="%"
            status={reading.env.humidity && reading.env.humidity > 70 ? 'Humid' : 'Dry'}
            statusColor="text-blue-400"
            icon="💧"
          />
          <MetricTile
            label="IAQ Index"
            value={reading.env.iaq !== undefined && reading.env.iaq !== null ? reading.env.iaq.toFixed(5) : '--'}
            status={iaqStat.label}
            statusColor={iaqStat.color}
            icon="🍃"
          />
          <MetricTile
            label="Sound Avg"
            value={reading.sound.db_avg !== undefined && reading.sound.db_avg !== null ? reading.sound.db_avg.toFixed(5) : '--'}
            unit="dB"
            status={reading.sound.db_avg && reading.sound.db_avg > 70 ? 'Noisy' : 'Quiet'}
            statusColor={reading.sound.db_avg && reading.sound.db_avg > 70 ? 'text-orange-400' : 'text-green-400'}
            icon="🔊"
          />
          <MetricTile
            label="Sound Peak"
            value={reading.sound.db_peak ?? '--'}
            unit="dB"
            status="Max Level"
            statusColor="text-gray-500"
            icon="📈"
          />
          <MetricTile
            label="RSSI"
            value={reading.meta.rssi ?? '--'}
            unit="dBm"
            status="Signal Strength"
            statusColor="text-gray-500"
            icon="📡"
          />
          <MetricTile
            label="Uptime"
            value={reading.meta.uptime_s ? Math.round(reading.meta.uptime_s / 60) : '--'}
            unit="min"
            status={reading.meta.sim ? 'Simulation Mode' : 'Hardware Node'}
            statusColor={reading.meta.sim ? 'text-yellow-500' : 'text-green-500'}
            icon="⏱️"
          />
        </div>
      </div>

      {/* ─── PM2.5 Forecast Predictions Card ─── */}
      <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md">
        <div className="border-b border-white/5 pb-2 mb-4 flex justify-between items-center">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
            🔮 PM2.5 Predictive Forecast (1h, 3h, 6h)
          </h3>
          {predictions && (
            <span className="text-[9px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full uppercase">
              Engine: {predictions.model_tier}
            </span>
          )}
        </div>
        
        {isLoadingPredictions ? (
          <div className="py-4"><LoadingSkeleton lines={2} /></div>
        ) : predictions && predictions.horizons ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {predictions.horizons.map((h: any) => (
              <div key={h.horizon_h} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-blue-400 font-bold font-mono">+{h.horizon_h} Hour{h.horizon_h > 1 ? 's' : ''} Forecast</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black text-white font-mono">{h.pm25_pred}</span>
                  <span className="text-xs text-gray-400">µg/m³</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-2 font-mono">
                  Confidence Range: <span className="text-gray-300">{h.pm25_lower} - {h.pm25_upper}</span>
                </div>
                <div className="text-[10px] text-blue-500 font-mono mt-1">
                  Confidence: {Math.round(h.confidence * 100)}%
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 text-center py-4 font-mono">
            Calculating prediction horizons for station {id}...
          </div>
        )}
      </div>

      {/* ─── Historical uPlot Charts Grid ─── */}
      <div className="space-y-6">
        <div className="border-b border-white/5 pb-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
            Historical Data Trends
          </h2>
        </div>

        {isLoading ? (
          <div className="p-12 rounded-3xl border border-white/5 bg-white/[0.01]">
            <LoadingSkeleton lines={6} />
          </div>
        ) : error ? (
          <div className="p-12 rounded-3xl border border-white/5 bg-white/[0.01] text-center text-red-400 text-xs">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart 1: PM concentration */}
            <TimeSeriesChart
              title="Particulate Matter Concentration (µg/m³)"
              data={history}
              series={[
                { label: 'PM2.5', key: 'pm2_5', stroke: '#60a5fa', width: 2 },
                { label: 'PM10', key: 'pm10', stroke: '#34d399', width: 1.5 },
              ]}
            />

            {/* Chart 2: Climate variables */}
            <TimeSeriesChart
              title="Climate Conditions (Temp & Humidity)"
              data={history}
              series={[
                { label: 'Temp (°C)', key: 'temperature', stroke: '#fb923c', width: 2 },
                { label: 'Humidity (%)', key: 'humidity', stroke: '#38bdf8', width: 1.5 },
              ]}
            />

            {/* Chart 3: Indoor Air Quality indices */}
            <TimeSeriesChart
              title="Air Purity & IAQ Index"
              data={history}
              series={[
                { label: 'IAQ Index', key: 'iaq', stroke: '#a78bfa', width: 2 },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
