import { useState, useEffect } from 'react';
import { Sun, CloudSun, Cloud, CloudRain, Clock, Loader2, AlertCircle, TrendingUp, LayoutGrid, Eye } from 'lucide-react';
import { request } from '../api/client';

interface HourlySchoolForecastProps {
  nodeId?: string;
}

interface RawHistoryPoint {
  _time?: string;
  timestamp?: string;
  pm2_5?: number;
  pm25?: number;
  temperature?: number;
  humidity?: number;
  env_temperature?: number;
  env_humidity?: number;
  [key: string]: any;
}

interface ProcessedHourlyPoint {
  time: string;
  temp: number;
  pm25: number;
  aqi: number;
  weather: 'sunny' | 'partly' | 'cloudy' | 'rain';
}

// US EPA AQI formula calculation for PM2.5
function calculateAqiScore(pm25: number): number {
  if (pm25 == null || isNaN(pm25)) return 0;
  const p = Math.min(Math.max(0, pm25), 500);
  if (p <= 12.0) return Math.round((50 / 12.0) * p);
  if (p <= 35.4) return Math.round(((100 - 51) / (35.4 - 12.1)) * (p - 12.1) + 51);
  if (p <= 55.4) return Math.round(((150 - 101) / (55.4 - 35.5)) * (p - 35.5) + 101);
  if (p <= 150.4) return Math.round(((200 - 151) / (150.4 - 55.5)) * (p - 55.5) + 151);
  if (p <= 250.4) return Math.round(((300 - 201) / (250.4 - 150.5)) * (p - 150.5) + 201);
  return Math.round(((500 - 301) / (500.0 - 250.5)) * (p - 250.5) + 301);
}

export default function HourlySchoolForecast({ nodeId }: HourlySchoolForecastProps) {
  const [hourlyList, setHourlyList] = useState<ProcessedHourlyPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'cards' | 'chart'>('both');
  const [hoveredPoint, setHoveredPoint] = useState<ProcessedHourlyPoint | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRealHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        let targetNodeId = nodeId;

        if (!targetNodeId) {
          const nodesRes = await request<Array<{ id: string; active: number }>>('/nodes');
          if (nodesRes.ok && nodesRes.data && nodesRes.data.length > 0) {
            const activeNode = nodesRes.data.find(n => n.active !== 0) || nodesRes.data[0];
            targetNodeId = activeNode.id;
          }
        }

        if (!targetNodeId) {
          if (isMounted) {
            setHourlyList([]);
            setLoading(false);
          }
          return;
        }

        // Query real InfluxDB telemetry history for past 24h aggregated hourly
        const res = await request<RawHistoryPoint[]>(`/readings/${targetNodeId}/history?start=-24h&interval=1h`);

        if (!isMounted) return;

        if (res.ok && res.data && res.data.length > 0) {
          const processed: ProcessedHourlyPoint[] = res.data.map((item) => {
            const rawTime = item._time || item.timestamp || new Date().toISOString();
            const timeDate = new Date(rawTime);
            const timeStr = timeDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            const pm25Val = item.pm2_5 ?? item.pm25 ?? 0;
            const tempVal = item.temperature ?? item.env_temperature ?? 27.0;
            const humidVal = item.humidity ?? item.env_humidity ?? 50;

            let weather: 'sunny' | 'partly' | 'cloudy' | 'rain' = 'partly';
            if (humidVal > 80) weather = 'rain';
            else if (tempVal > 30) weather = 'sunny';
            else if (humidVal > 65) weather = 'cloudy';

            return {
              time: timeStr,
              temp: Math.round(tempVal * 10) / 10,
              pm25: Math.round(pm25Val * 10) / 10,
              aqi: calculateAqiScore(pm25Val),
              weather
            };
          });

          setHourlyList(processed);
        } else {
          setHourlyList([]);
          if (res.error) {
            setError(res.error);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError('ไม่สามารถเชื่อมต่อดึงข้อมูลประวัติการวัดฝุ่นรายชั่วโมงได้');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRealHistory();

    return () => {
      isMounted = false;
    };
  }, [nodeId]);

  const getWeatherIcon = (type: string) => {
    switch (type) {
      case 'sunny':
        return <Sun size={20} className="text-amber-500" />;
      case 'partly':
        return <CloudSun size={20} className="text-amber-500" />;
      case 'cloudy':
        return <Cloud size={20} className="text-slate-400" />;
      case 'rain':
        return <CloudRain size={20} className="text-blue-500" />;
      default:
        return <CloudSun size={20} className="text-amber-500" />;
    }
  };

  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return 'bg-[#0CA4A4]';
    if (aqi <= 100) return 'bg-amber-400';
    if (aqi <= 150) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  // Generate SVG Sparkline coordinates for PM2.5 and Temp
  const renderTrendChart = () => {
    if (hourlyList.length < 2) return null;

    const width = 800;
    const height = 130;
    const padding = 20;

    const pmValues = hourlyList.map((d) => d.pm25);
    const maxPm = Math.max(...pmValues, 25);
    const minPm = Math.min(...pmValues, 0);

    const stepX = (width - padding * 2) / (hourlyList.length - 1);

    // Compute Points
    const points = hourlyList.map((d, i) => {
      const x = padding + i * stepX;
      // Normalizing PM2.5 to height
      const y = height - padding - ((d.pm25 - minPm) / (maxPm - minPm || 1)) * (height - padding * 2);
      return { x, y, data: d };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return (
      <div className="relative w-full bg-white/40 backdrop-blur-md rounded-2xl p-4 border border-white/60 mb-4 overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold font-sans text-gray-700 mb-2">
          <span className="flex items-center gap-1.5 text-[#0CA4A4]">
            <span className="w-2.5 h-0.5 bg-[#0CA4A4] rounded-full inline-block" />
            เส้นโค้งแนวโน้มฝุ่น PM2.5 (µg/m³) รายชั่วโมง
          </span>
          {hoveredPoint && (
            <span className="text-[11px] font-mono bg-[#0CA4A4] text-white px-2.5 py-0.5 rounded-full shadow-xs">
              ⏰ {hoveredPoint.time} | PM2.5: {hoveredPoint.pm25} µg/m³ | {hoveredPoint.temp}°C
            </span>
          )}
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
          <defs>
            <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0CA4A4" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0CA4A4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#tealGrad)" />

          {/* Line Path */}
          <path d={pathD} fill="none" stroke="#0CA4A4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i} className="cursor-pointer group" onMouseEnter={() => setHoveredPoint(p.data)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                className="fill-[#0CA4A4] stroke-white stroke-2 group-hover:r-6 transition-all duration-200"
              />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                className="text-[9px] font-mono font-bold fill-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {p.data.pm25}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="glass-card p-5 md:p-6 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 font-sans">
          <Clock size={16} className="text-[#0CA4A4]" />
          พยากรณ์ฝุ่นละอองและอุณหภูมิรายชั่วโมง (Hourly Forecast)
        </h3>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex bg-gray-100/80 p-1 rounded-full border border-gray-200/60 text-xs font-bold">
            <button
              onClick={() => setViewMode('both')}
              className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'both' ? 'bg-[#0CA4A4] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Eye size={13} />
              <span>แสดงคู่</span>
            </button>

            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'chart' ? 'bg-[#0CA4A4] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <TrendingUp size={13} />
              <span>กราฟ</span>
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-[#0CA4A4] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <LayoutGrid size={13} />
              <span>การ์ด</span>
            </button>
          </div>

          <span className="text-[11px] font-mono font-medium text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full hidden sm:inline">
            {nodeId ? `โหนด ${nodeId} (24h)` : '24h History'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2 text-xs">
          <Loader2 size={24} className="animate-spin text-[#0CA4A4]" />
          <span>กำลังโหลดข้อมูลประวัติฝุ่นและสภาพอากาศจริงจากฐานข้อมูล...</span>
        </div>
      ) : error ? (
        <div className="py-6 px-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-800 text-xs">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      ) : hourlyList.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-xs bg-white/40 rounded-2xl border border-white/60">
          ยังไม่มีข้อมูลย้อนหลังรายชั่วโมงในฐานข้อมูล InfluxDB สำหรับสถานีนี้
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reference Trend SVG Chart */}
          {(viewMode === 'chart' || viewMode === 'both') && renderTrendChart()}

          {/* Mini Cards Carousel */}
          {(viewMode === 'cards' || viewMode === 'both') && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
              {hourlyList.map((item, index) => (
                <div
                  key={index}
                  className="shrink-0 w-22 p-3.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-xs flex flex-col items-center gap-2 hover:border-[#0CA4A4]/40 hover:bg-white/90 hover:-translate-y-1 transition-all duration-300"
                >
                  <span className="text-xs font-semibold text-gray-500 font-mono">{item.time}</span>
                  <div className="my-1">{getWeatherIcon(item.weather)}</div>
                  <span className="text-sm font-bold text-gray-900 font-mono">{item.temp}°C</span>

                  {/* PM2.5 Mini Bar Indicator */}
                  <div className="w-full flex flex-col items-center gap-1.5 mt-1">
                    <div className="w-full h-1.5 rounded-full bg-gray-200/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getAqiColor(item.aqi)}`}
                        style={{ width: `${Math.min(100, (item.aqi / 150) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-gray-700">
                      {item.pm25} <span className="text-[9px] text-gray-400 font-sans font-normal">µg</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
