import { useStore } from '../../store';

export default function SummaryBanner() {
  const latest = useStore((state) => state.latest);
  const alerts = useStore((state) => state.alerts);
  const masterStatus = useStore((state) => state.masterStatus);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // 1. Combine all node IDs from nodesMeta and latest, then map to NodeData
  const allNodeIds = Array.from(new Set([...Object.keys(nodesMeta), ...Object.keys(latest)]));

  const activeNodes = allNodeIds
    .map((id) => {
      const meta = nodesMeta[id];
      const data = latest[id];
      
      if (data) return data;
      
      return {
        reading: {
          node_id: id,
          timestamp: meta?.created_at || new Date().toISOString(),
          location: meta?.location || 'Offline Station',
          pm: { pm1_0: null, pm2_5: null, pm10: null },
          env: { temperature: null, humidity: null, iaq: null },
          sound: { db_avg: null, db_peak: null },
          meta: { rssi: null, uptime_s: null, sim: false }
        },
        aqi: { aqi_score: 0, aqi_level: 'Offline' },
        status: meta?.status || 'unconfirmed',
        dcs: undefined
      };
    })
    .filter((n) => {
      const meta = nodesMeta[n.reading.node_id];
      return !meta || meta.active !== 0;
    });

  // 2. Filter out simulation nodes from calculations
  const calculationNodes = activeNodes.filter((n) => {
    const isSim = n.reading.meta.sim || 
                  n.reading.node_id.toUpperCase().startsWith("NODE_TEST") ||
                  n.reading.node_id.toLowerCase().includes("test") ||
                  n.reading.node_id.toLowerCase().includes("sim") ||
                  n.reading.node_id.toLowerCase().includes("sandbox");
    return !isSim;
  });

  const totalNodes = calculationNodes.length;

  const now = new Date().getTime();
  const onlineNodes = calculationNodes.filter((n) => {
    const ts = new Date(n.reading.timestamp).getTime();
    return (now - ts) / 1000 < 600;
  }).length;
  const offlineNodes = totalNodes - onlineNodes;

  const onlineNodesData = calculationNodes.filter((n) => {
    const ts = new Date(n.reading.timestamp).getTime();
    return (now - ts) / 1000 < 600;
  });

  const avgAQI = onlineNodesData.length > 0
    ? Math.round(onlineNodesData.reduce((acc, curr) => acc + curr.aqi.aqi_score, 0) / onlineNodesData.length)
    : 0;

  // Average DCS across nodes that have dcs value and are not simulated
  const nodesWithDCS = calculationNodes.filter((n) => n.dcs !== undefined);
  const avgDCS = nodesWithDCS.length > 0
    ? Math.round(nodesWithDCS.reduce((acc, curr) => acc + (curr.dcs ?? 0), 0) / nodesWithDCS.length * 100)
    : null;

  const getDCSColor = (dcs: number) => {
    if (dcs >= 85) return 'text-green-400';
    if (dcs >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAQIColorText = (aqi: number) => {
    if (aqi <= 25) return 'text-blue-400';
    if (aqi <= 50) return 'text-green-400';
    if (aqi <= 100) return 'text-yellow-400';
    if (aqi <= 200) return 'text-orange-400';
    return 'text-red-400';
  };

  const getAQIDesc = (aqi: number) => {
    if (totalNodes === 0) return 'No stations';
    if (onlineNodes === 0) return 'Stations Offline';
    if (aqi <= 25) return 'Very Good';
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 200) return 'Unhealthy';
    return 'Very Unhealthy';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Network Average AQI Card */}
      <div className="glass-card p-5 flex flex-col justify-between group">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-cyan-300/70 mb-1 font-mono">
            Network Avg AQI
          </span>
          <span className={`text-4xl font-black font-mono tracking-tight ${getAQIColorText(avgAQI)} drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]`}>
            {totalNodes > 0 && onlineNodes > 0 ? avgAQI : '--'}
          </span>
        </div>
        <div className="text-xs text-gray-300 mt-3 font-medium flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 font-mono">Status:</span>
          <span className={`font-bold font-mono px-2 py-0.5 rounded-full border text-[10px] ${getAQIColorText(avgAQI)} border-current/30 bg-white/5`}>
            {getAQIDesc(avgAQI)}
          </span>
        </div>
      </div>

      {/* Node Status Counter Card */}
      <div className="glass-card p-5 flex flex-col justify-between group">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-cyan-300/70 mb-1 font-mono">
            Monitored Stations
          </span>
          <span className="text-4xl font-black font-mono tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {onlineNodes}<span className="text-gray-500 text-xl font-normal">/{totalNodes}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-300 mt-3 font-mono">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"></span>
            {onlineNodes} Online
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-300 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            {offlineNodes} Offline
          </span>
        </div>
      </div>

      {/* Active Alerts Card */}
      <div className="glass-card p-5 flex flex-col justify-between group">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-cyan-300/70 mb-1 font-mono">
            Triggered Warnings
          </span>
          <span className={`text-4xl font-black font-mono tracking-tight ${alerts.length > 0 ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]' : 'text-gray-300'}`}>
            {alerts.length}
          </span>
        </div>
        <div className="text-xs text-gray-300 mt-3 font-medium">
          {alerts.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full border border-rose-400/40 bg-rose-500/20 text-rose-200 text-[10px] font-mono font-bold animate-pulse inline-block">
              ⚠️ Action required
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-mono font-bold inline-block">
              ✨ Environment safe
            </span>
          )}
        </div>
      </div>

      {/* Average DCS Confidence Score Card */}
      <div className="glass-card p-5 flex flex-col justify-between group">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-cyan-300/70 mb-1 font-mono">
            Avg Data Confidence
          </span>
          <span className={`text-4xl font-black font-mono tracking-tight ${avgDCS !== null ? getDCSColor(avgDCS) : 'text-gray-500'}`}>
            {avgDCS !== null ? `${avgDCS}%` : '--'}
          </span>
        </div>
        <div className="text-[10px] font-mono text-gray-400 mt-3 space-y-1.5">
          {avgDCS !== null ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 shadow-[0_0_8px_currentColor] ${avgDCS >= 85 ? 'bg-emerald-400' : avgDCS >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${avgDCS}%` }}
                />
              </div>
              <span className="text-gray-300 font-bold">{nodesWithDCS.length} nodes</span>
            </div>
          ) : (
            <div>Waiting for DCS telemetry</div>
          )}
          {masterStatus.uptime_s && (
            <div className="text-[9px] text-gray-500">Server uptime: {Math.round(masterStatus.uptime_s / 60)}m</div>
          )}
        </div>
      </div>
    </div>
  );
}

