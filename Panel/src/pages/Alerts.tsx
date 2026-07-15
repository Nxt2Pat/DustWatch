import { useEffect, useState } from 'react';
import { api } from '../api/client';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useSEO } from '../hooks/useSEO';

interface AlertData {
  node_id: string;
  timestamp: string;
  alert_type: string;
  value: number;
  threshold: number;
  message: string;
}

interface AlertsAPIResponse {
  items: AlertData[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface NodeInfo {
  node_id: string;
  location: string;
}

const alertTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'pm25_warn', label: 'PM2.5 Warning' },
  { value: 'pm25_danger', label: 'PM2.5 Danger' },
  { value: 'iaq_warn', label: 'IAQ Warning' },
  { value: 'iaq_danger', label: 'IAQ Danger' },
  { value: 'node_offline', label: 'Node Offline' },
];

export default function Alerts() {
  useSEO(
    'System Warnings Log | DustWatch',
    'Historical threshold breach events, sensor warning incidents, and offline timeouts log list.'
  );

  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load available node filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const nodesData = await api.get<NodeInfo[]>('/api/v1/nodes');
        setNodes(nodesData.map((n) => n.node_id));
      } catch (err) {
        console.error('Failed to load filter node options', err);
      }
    };
    loadFilters();
  }, []);

  // Fetch paginated & filtered alerts from backend
  useEffect(() => {
    let active = true;

    const fetchAlertsList = async () => {
      setIsLoading(true);
      const nodeFilter = selectedNode !== 'all' ? `&node_id=${selectedNode}` : '';
      const typeFilter = selectedType !== 'all' ? `&alert_type=${selectedType}` : '';
      
      try {
        const data = await api.get<AlertsAPIResponse>(
          `/api/v1/alerts?page=${page}&limit=20${nodeFilter}${typeFilter}`
        );
        if (!active) return;

        setAlerts(data.items);
        setTotalPages(data.pages);
        setTotalAlerts(data.total);
      } catch (err) {
        console.error('Failed to fetch paginated alerts list', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchAlertsList();

    return () => {
      active = false;
    };
  }, [page, selectedNode, selectedType]);

  // Reset page when filters change
  const handleNodeChange = (val: string) => {
    setSelectedNode(val);
    setPage(1);
  };

  const handleTypeChange = (val: string) => {
    setSelectedType(val);
    setPage(1);
  };

  const getAlertBadgeColor = (type: string) => {
    const key = type.toLowerCase();
    if (key.includes('danger')) return 'text-red-400 bg-red-500/10 border-red-500/25';
    if (key.includes('warn')) return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
    return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25'; // offline
  };

  return (
    <div className="space-y-6">
      {/* ─── Control Filter Bar ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Alert History</h2>
          <p className="text-xs text-gray-400 mt-1">
            Found {totalAlerts} matching log records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Station dropdown */}
          <select
            value={selectedNode}
            onChange={(e) => handleNodeChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-white/5 bg-[#0a0d16] text-xs font-bold text-gray-300 focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="all">All Stations</option>
            {nodes.map((id) => (
              <option key={id} value={id}>
                Station {id}
              </option>
            ))}
          </select>

          {/* Alert Type dropdown */}
          <select
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-white/5 bg-[#0a0d16] text-xs font-bold text-gray-300 focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            {alertTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Alerts Log Table ─── */}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-md overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <LoadingSkeleton lines={8} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-left text-gray-400">
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Time Logged</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Station</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Breach Level</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Trigger Value</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Threshold</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider hidden md:table-cell">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {alerts.map((alert, i) => (
                  <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {new Date(alert.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-400 font-bold font-mono">[{alert.node_id}]</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getAlertBadgeColor(alert.alert_type)}`}>
                        {alert.alert_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-200">
                      {typeof alert.value === 'number' ? alert.value.toFixed(1) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {typeof alert.threshold === 'number' ? alert.threshold.toFixed(1) : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 hidden md:table-cell max-w-sm truncate">
                      {alert.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {alerts.length === 0 && (
              <div className="p-16 text-center text-gray-500 text-xs font-mono">
                No alerts found matching filter options.
              </div>
            )}
          </div>
        )}

        {/* ─── Paginator Footer bar ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/5 text-xs text-gray-400">
          <div>
            Showing Page <span className="font-bold text-gray-200">{page}</span> of{' '}
            <span className="font-bold text-gray-200">{totalPages}</span> ({totalAlerts} entries)
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 font-bold hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              ◀ Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || totalPages === 0 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 font-bold hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
