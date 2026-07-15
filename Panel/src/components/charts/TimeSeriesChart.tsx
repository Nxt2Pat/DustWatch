import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface ChartSeries {
  label: string;
  key: string;
  stroke: string;
  fill?: string;
  width?: number;
}

interface TimeSeriesChartProps {
  title: string;
  data: Record<string, unknown>[]; // Raw objects array from API history
  series: ChartSeries[];
}

export default function TimeSeriesChart({ title, data, series }: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotInstance = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // 1. Prepare uPlot structured data matrix
    // Format: [ Timestamps[], Series1[], Series2[], ... ]
    const timestamps = data.map((d) => {
      const ts = d.timestamp ? new Date(d.timestamp as string).getTime() : Date.now();
      return Math.round(ts / 1000); // uPlot expects unix seconds
    });

    const seriesData = series.map((s) => {
      return data.map((d) => (d[s.key] !== undefined ? (d[s.key] as number) : null));
    });

    const plotData = [timestamps, ...seriesData] as uPlot.AlignedData;

    // 2. Define custom layout and styles for dark theme
    const opts: uPlot.Options = {
      title: '',
      width: containerRef.current.clientWidth || 600,
      height: 220,
      cursor: {
        show: true,
        points: {
          show: true,
        },
      },
      legend: {
        show: true,
        live: true,
      },
      scales: {
        x: {
          time: true,
        },
      },
      axes: [
        {
          stroke: '#9ca3af',
          grid: {
            stroke: 'rgba(255, 255, 255, 0.05)',
            width: 1,
          },
          ticks: {
            stroke: 'rgba(255, 255, 255, 0.1)',
          },
          font: '10px monospace',
        },
        {
          stroke: '#9ca3af',
          grid: {
            stroke: 'rgba(255, 255, 255, 0.05)',
            width: 1,
          },
          ticks: {
            stroke: 'rgba(255, 255, 255, 0.1)',
          },
          font: '10px monospace',
        },
      ],
      series: [
        {}, // X-axis series (Time)
        ...series.map((s) => ({
          label: s.label,
          stroke: s.stroke,
          width: s.width ?? 2,
          fill: s.fill ?? 'transparent',
          points: {
            show: false,
          },
        })),
      ],
    };

    // 3. Destroy old instance if exists
    if (plotInstance.current) {
      plotInstance.current.destroy();
    }

    // 4. Create new plot
    try {
      plotInstance.current = new uPlot(opts, plotData, containerRef.current);
    } catch (err) {
      console.error('Failed to initialize uPlot chart', err);
    }

    // 5. Setup resize listener
    const handleResize = () => {
      if (plotInstance.current && containerRef.current) {
        plotInstance.current.setSize({
          width: containerRef.current.clientWidth,
          height: 220,
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
  }, [data, series]);

  return (
    <div className="p-5 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-3">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
        {title}
      </h4>
      <div className="w-full overflow-hidden min-h-[220px]" ref={containerRef}>
        {data.length === 0 && (
          <div className="h-[220px] flex items-center justify-center text-xs text-gray-500 font-mono">
            No historical records matching this range
          </div>
        )}
      </div>
    </div>
  );
}
