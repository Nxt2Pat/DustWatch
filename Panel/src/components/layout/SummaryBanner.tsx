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
      <div className="p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md flex flex-col justify-between">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">
            Network Avg AQI
          </span>
          <span className={`text-3xl font-black font-mono tracking-tight ${getAQIColorText(avgAQI)}`}>
            {totalNodes > 0 && onlineNodes > 0 ? avgAQI : '--'}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-2 font-medium">
          Status: <span className={getAQIColorText(avgAQI)}>{getAQIDesc(avgAQI)}</span>
        </div>
      </div>

      {/* Node Status Counter Card */}
      <div className="p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md flex flex-col justify-between">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">
            Monitored Stations
          </span>
          <span className="text-3xl font-black font-mono tracking-tight text-white">
            {onlineNodes}<span className="text-gray-600 text-lg">/{totalNodes}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 font-mono">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
            {onlineNodes} Online
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            {offlineNodes} Offline
          </span>
        </div>
      </div>

      {/* Active Alerts Card */}
      <div className="p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md flex flex-col justify-between">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">
            Triggered Warnings
          </span>
          <span className={`text-3xl font-black font-mono tracking-tight ${alerts.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {alerts.length}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-2 font-medium">
          {alerts.length > 0 ? (
            <span className="text-red-400/80 animate-pulse">Action required</span>
          ) : (
            <span className="text-green-400">Environment safe</span>
          )}
        </div>
      </div>

      {/* Average DCS Confidence Score Card */}
      <div className="p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md flex flex-col justify-between">
        <div>
          <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">
            Avg Data Confidence
          </span>
          <span className={`text-3xl font-black font-mono tracking-tight ${avgDCS !== null ? getDCSColor(avgDCS) : 'text-gray-600'}`}>
            {avgDCS !== null ? `${avgDCS}%` : '--'}
          </span>
        </div>
        <div className="text-[10px] font-mono text-gray-500 mt-2 space-y-1">
          {avgDCS !== null ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${avgDCS >= 85 ? 'bg-green-400' : avgDCS >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${avgDCS}%` }}
                />
              </div>
              <span>{nodesWithDCS.length} nodes</span>
            </div>
          ) : (
            <div>Waiting for DCS telemetry</div>
          )}
          {masterStatus.uptime_s && (
            <div>Server uptime: {Math.round(masterStatus.uptime_s / 60)}m</div>
          )}
        </div>
      </div>
    </div>
  );
}
