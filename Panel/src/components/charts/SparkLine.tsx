import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface SparkLineProps {
  nodeId: string;
  currentVal: number;
}

interface HistoryPoint {
  timestamp: string;
  pm2_5?: number;
  [key: string]: unknown;
}

export default function SparkLine({ nodeId, currentVal }: SparkLineProps) {
  const [history, setHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchHistory = async () => {
      try {
        const data = await api.get<HistoryPoint[]>(`/api/v1/readings/${nodeId}/history?start=-1h&interval=5m`);
        if (!active) return;

        // Extract pm2_5 values
        const points = data
          .map((d) => d.pm2_5 ?? d.pm25 ?? 0)
          .filter((v) => typeof v === 'number');

        if (Array.isArray(points)) {
          setHistory(points);
        } else {
          setHistory([]);
        }
      } catch (err) {
        console.warn(`Failed to fetch history for sparkline of node ${nodeId}`, err);
        if (active) {
          setHistory([]);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchHistory();

    // Poll history updates every 60 seconds
    const intervalId = setInterval(fetchHistory, 60000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [nodeId, currentVal]);

  // Convert numerical array values to SVG coordinate points string
  const getSVGPoints = (vals: number[], width: number, height: number) => {
    if (vals.length === 0) return '';
    const max = Math.max(...vals, 5); // default min scale
    const min = Math.min(...vals, 0);
    const range = max - min || 1;

    const xStep = width / (vals.length - 1);
    return vals.map((val, index) => {
      const x = index * xStep;
      const y = height - ((val - min) / range) * (height - 4) - 2; // pad 2px top/bottom
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const svgWidth = 140;
  const svgHeight = 42;
  const pointsStr = getSVGPoints(history, svgWidth, svgHeight);

  // Close the SVG path shape down to the bottom coordinates for gradient background fill
  const getGradientPath = () => {
    if (!pointsStr) return '';
    return `M 0,${svgHeight} L ${pointsStr} L ${svgWidth},${svgHeight} Z`;
  };

  if (isLoading) {
    return (
      <div className="h-[42px] w-[140px] flex items-center justify-center text-[10px] text-gray-500 font-mono">
        Loading...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="h-[42px] w-[140px] flex items-center justify-center text-[10px] text-gray-500 font-mono">
        No History
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-end">
      <svg className="w-[140px] h-[42px] overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <defs>
          <linearGradient id={`gradient-${nodeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gradient fill underneath path */}
        <path
          d={getGradientPath()}
          fill={`url(#gradient-${nodeId})`}
        />

        {/* Line Stroke */}
        <polyline
          fill="none"
          stroke="#60a5fa"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />

        {/* End pulse dot */}
        {history.length > 0 && (
          <circle
            cx={svgWidth}
            cy={svgHeight - ((history[history.length - 1] - Math.min(...history, 0)) / (Math.max(...history, 5) - Math.min(...history, 0) || 1)) * (svgHeight - 4) - 2}
            r="2"
            fill="#60a5fa"
            className="animate-pulse"
          />
        )}
      </svg>
    </div>
  );
}
