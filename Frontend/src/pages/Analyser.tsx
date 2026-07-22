import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { request } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Check, Info, Loader2, BarChart2 } from 'lucide-react';

interface HistoryPoint {
  timestamp: string;
  pm2_5?: number;
  pm10?: number;
  temperature?: number;
  humidity?: number;
  [key: string]: any;
}

const timeRanges = [
  { label: '1 ชม.', value: '1h', start: '-1h', interval: '1m' },
  { label: '6 ชม.', value: '6h', start: '-6h', interval: '5m' },
  { label: '24 ชม.', value: '24h', start: '-24h', interval: '15m' },
  { label: '3 วัน', value: '3d', start: '-3d', interval: '30m' },
  { label: '7 วัน', value: '7d', start: '-7d', interval: '1h' },
];

const metrics = [
  { label: 'ฝุ่น PM2.5', value: 'pm2_5', color: '#0CA4A4', unit: 'µg/m³', axis: 'left' },
  { label: 'ฝุ่น PM10', value: 'pm10', color: '#059669', unit: 'µg/m³', axis: 'left' },
  { label: 'อุณหภูมิห้อง', value: 'temperature', color: '#F59E0B', unit: '°C', axis: 'right' },
  { label: 'ความชื้นสัมพัทธ์', value: 'humidity', color: '#0284C7', unit: '%', axis: 'right' },
];

export default function Analyser() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // List of active node IDs
  const activeNodeIds = Object.keys(latest).filter(
    (id) => !nodesMeta[id] || nodesMeta[id].active !== 0
  );

  // States
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['pm2_5']);
  const [selectedRange, setSelectedRange] = useState(timeRanges[2]); // Default 24h
  const [chartData, setChartData] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-select first node
  useEffect(() => {
    if (activeNodeIds.length > 0 && selectedNodes.length === 0) {
      setSelectedNodes([activeNodeIds[0]]);
    }
  }, [activeNodeIds, selectedNodes]);

  // Fetch telemetry historical records from InfluxDB
  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedNodes.length === 0 || selectedMetrics.length === 0) {
        setChartData([]);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);

      try {
        const promises = selectedNodes.map(async (nodeId) => {
          const res = await request<HistoryPoint[]>(
            `/readings/${nodeId}/history?start=${selectedRange.start}&interval=${selectedRange.interval}`
          );
          return { nodeId, res };
        });

        const results = await Promise.all(promises);

        // 1. Generate a continuous timeline of aligned timestamps
        const now = Date.now();
        let durationMs = 0;
        let stepMs = 0;
        if (selectedRange.value === '1h') {
          durationMs = 60 * 60 * 1000;
          stepMs = 60 * 1000; // 1m
        } else if (selectedRange.value === '6h') {
          durationMs = 6 * 60 * 60 * 1000;
          stepMs = 5 * 60 * 1000; // 5m
        } else if (selectedRange.value === '24h') {
          durationMs = 24 * 60 * 60 * 1000;
          stepMs = 15 * 60 * 1000; // 15m
        } else if (selectedRange.value === '3d') {
          durationMs = 3 * 24 * 60 * 60 * 1000;
          stepMs = 30 * 60 * 1000; // 30m
        } else if (selectedRange.value === '7d') {
          durationMs = 7 * 24 * 60 * 60 * 1000;
          stepMs = 60 * 60 * 1000; // 1h
        }

        const startTime = now - durationMs;
        const timeline: number[] = [];
        for (let t = startTime; t <= now; t += stepMs) {
          const aligned = Math.round(t / stepMs) * stepMs;
          timeline.push(aligned);
        }

        // 2. Map results by aligned time for each node
        const nodeDataMaps: Record<string, Record<number, HistoryPoint>> = {};
        results.forEach(({ nodeId, res }) => {
          nodeDataMaps[nodeId] = {};
          if (res.ok && res.data) {
            res.data.forEach((point) => {
              const apiTime = new Date(point.timestamp).getTime();
              const alignedTime = Math.round(apiTime / stepMs) * stepMs;
              nodeDataMaps[nodeId][alignedTime] = point;
            });
          }
        });

        // 3. Build merged data points over the timeline
        const lastKnownValues: Record<string, number> = {};

        const sortedPoints = timeline.map((time) => {
          const dateObj = new Date(time);
          const formattedDate = dateObj.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const formattedTime = dateObj.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
          });

          const dataPoint: any = {
            time,
            timestamp: formattedTime,
            formattedDate,
          };

          selectedNodes.forEach((nodeId) => {
            const point = nodeDataMaps[nodeId]?.[time];

            selectedMetrics.forEach((metric) => {
              const key = `${nodeId}_${metric}`;
              const statusKey = `${key}_status`;

              if (point && point[metric] !== undefined && point[metric] !== null) {
                dataPoint[key] = point[metric];
                dataPoint[statusKey] = 'จริง';
                lastKnownValues[key] = point[metric];
              } else {
                dataPoint[key] = lastKnownValues[key] !== undefined ? lastKnownValues[key] : null;
                dataPoint[statusKey] = 'ขาด';
              }
            });
          });

          return dataPoint;
        });

        setChartData(sortedPoints);
      } catch (err) {
        console.error('Failed to merge historical series:', err);
        setErrorMsg('ไม่สามารถประมวลผลข้อมูลกราฟได้');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [selectedNodes, selectedMetrics, selectedRange]);

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const toggleMetricSelection = (metricVal: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metricVal)
        ? prev.filter((v) => v !== metricVal)
        : [...prev, metricVal]
    );
  };

  // Compute Summary KPI Stats (Peak, Avg, Min, Trend Delta)
  const computeKPIs = () => {
    if (chartData.length === 0 || selectedNodes.length === 0) return null;
    
    // Extract all PM2.5 or selected values
    const pmValues: number[] = [];
    chartData.forEach((dp) => {
      selectedNodes.forEach((nodeId) => {
        const val = dp[`${nodeId}_pm2_5`];
        if (val != null && !isNaN(val)) {
          pmValues.push(val);
        }
      });
    });

    if (pmValues.length === 0) return null;

    const max = Math.max(...pmValues);
    const min = Math.min(...pmValues);
    const avg = pmValues.reduce((a, b) => a + b, 0) / pmValues.length;

    // Split timeline into first half vs second half for trend
    const midIdx = Math.floor(chartData.length / 2);
    const firstHalf: number[] = [];
    const secondHalf: number[] = [];

    chartData.forEach((dp, idx) => {
      selectedNodes.forEach((nodeId) => {
        const val = dp[`${nodeId}_pm2_5`];
        if (val != null && !isNaN(val)) {
          if (idx < midIdx) firstHalf.push(val);
          else secondHalf.push(val);
        }
      });
    });

    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : avg;
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : avg;

    const deltaPct = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;

    return {
      peak: max.toFixed(1),
      avg: avg.toFixed(1),
      min: min.toFixed(1),
      deltaPct: deltaPct.toFixed(1)
    };
  };

  const kpis = computeKPIs();

  return (
    <div className="space-y-5 relative z-10 max-w-6xl mx-auto pb-12 fade-up">
      {/* Target Room Selection horizontal list */}
      <div className="glass-card p-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 font-sans mb-3">
          เลือกห้องเรียนเพื่อวิเคราะห์แนวโน้ม (Selected Rooms)
        </label>
        <div className="flex flex-wrap gap-2">
          {activeNodeIds.map((id) => {
            const displayName = nodesMeta[id]?.display_name || latest[id]?.reading.location || id;
            const isSelected = selectedNodes.includes(id);

            return (
              <button
                key={id}
                onClick={() => toggleNodeSelection(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-[#0CA4A4] text-white border-[#0CA4A4] shadow-md shadow-[#0CA4A4]/25 font-bold'
                    : 'bg-white/60 text-gray-700 border-gray-200/80 hover:bg-white hover:border-[#0CA4A4]/40'
                }`}
              >
                {isSelected && <Check size={14} />}
                <span>{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Metric selection Toggles */}
      <div className="glass-card p-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 font-sans mb-3">
          ประเภทข้อมูล (Parameters)
        </label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {metrics.map((m) => {
            const isSelected = selectedMetrics.includes(m.value);

            return (
              <button
                key={m.value}
                onClick={() => toggleMetricSelection(m.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border shrink-0 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-[#0CA4A4]/15 text-[#0CA4A4] border-[#0CA4A4]/40 shadow-xs font-bold'
                    : 'bg-white/60 text-gray-600 border-gray-200/80 hover:bg-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span>{m.label} ({m.unit})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Summary Stat Bar */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-sans">
              🔴 ค่าสูงสุด (Peak PM2.5)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black font-mono text-gray-900">{kpis.peak}</span>
              <span className="text-xs text-gray-400 font-sans">µg/m³</span>
            </div>
          </div>

          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-sans">
              📊 ค่าเฉลี่ยสถิติ (Avg PM2.5)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black font-mono text-[#0CA4A4]">{kpis.avg}</span>
              <span className="text-xs text-gray-400 font-sans">µg/m³</span>
            </div>
          </div>

          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-sans">
              🟢 ค่าต่ำสุด (Min PM2.5)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black font-mono text-emerald-600">{kpis.min}</span>
              <span className="text-xs text-gray-400 font-sans">µg/m³</span>
            </div>
          </div>

          <div className="glass-card p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-sans">
              📈 แนวโน้มการเปลี่ยน (Trend)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-2xl font-black font-mono ${Number(kpis.deltaPct) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {Number(kpis.deltaPct) > 0 ? `+${kpis.deltaPct}%` : `${kpis.deltaPct}%`}
              </span>
              <span className="text-[10px] text-gray-400 font-sans">เทียบครึ่งช่วงเวลา</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart range selector */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <BarChart2 className="text-[#0CA4A4]" size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 font-sans">
              แนวโน้มข้อมูลสภาพแวดล้อม (Environmental Trend Chart)
            </span>
          </div>

          {/* Segmented Range Control */}
          <div className="flex bg-gray-100/80 backdrop-blur-md p-1.5 rounded-full border border-gray-200/60">
            {timeRanges.map((range) => {
              const isSelected = selectedRange.value === range.value;
              return (
                <button
                  key={range.value}
                  onClick={() => setSelectedRange(range)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25 font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom dot and tooltip rendering helpers */}
        {(() => {
          const renderCustomDot = (props: any) => {
            const { cx, cy, payload, dataKey } = props;
            if (cx === undefined || cy === undefined) return null;

            const statusKey = `${dataKey}_status`;
            const statusVal = payload[statusKey] || 'จริง';

            let dotColor = '#3B82F6';
            if (statusVal === 'เดา') dotColor = '#0CA4A4';
            if (statusVal === 'ขาด') dotColor = '#EF4444';

            return (
              <circle
                cx={cx}
                cy={cy}
                r={2.5}
                fill={dotColor}
                stroke="#FFF"
                strokeWidth={0.5}
                key={`${dataKey}_dot_${payload.time}`}
              />
            );
          };

          const renderActiveDot = (props: any) => {
            const { cx, cy, payload, dataKey } = props;
            if (cx === undefined || cy === undefined) return null;

            const statusKey = `${dataKey}_status`;
            const statusVal = payload[statusKey] || 'จริง';

            let dotColor = '#3B82F6';
            if (statusVal === 'เดา') dotColor = '#0CA4A4';
            if (statusVal === 'ขาด') dotColor = '#EF4444';

            return (
              <circle
                cx={cx}
                cy={cy}
                r={5.5}
                fill={dotColor}
                stroke="#FFF"
                strokeWidth={1.5}
                key={`${dataKey}_activedot_${payload.time}`}
                style={{ filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.25))' }}
              />
            );
          };

          const CustomTooltip = ({ active, payload }: any) => {
            if (active && payload && payload.length) {
              const dataPoint = payload[0].payload;
              return (
                <div className="bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl p-4 shadow-xl text-xs space-y-2 font-sans">
                  <div className="font-bold text-gray-900">
                    📅 วันที่: {dataPoint.formattedDate}
                  </div>
                  <div className="font-semibold text-gray-500 font-mono">
                    ⏰ เวลา: {dataPoint.timestamp} น.
                  </div>
                  <div className="border-t border-gray-100 my-1 pt-2 space-y-1.5">
                    {payload.map((p: any) => {
                      const statusKey = `${p.dataKey}_status`;
                      const statusVal = dataPoint[statusKey] || 'จริง';

                      let statusColor = '#3B82F6';
                      if (statusVal === 'เดา') statusColor = '#0CA4A4';
                      if (statusVal === 'ขาด') statusColor = '#EF4444';

                      const metricMeta = metrics.find((m) => p.dataKey.endsWith(m.value));
                      const unitStr = metricMeta?.unit || '';

                      return (
                        <div key={p.dataKey} className="flex flex-col gap-0.5">
                          <span className="font-bold text-gray-900 font-mono">
                            {p.name}: {p.value !== null ? `${p.value} ${unitStr}` : 'ไม่มีข้อมูล'}
                          </span>
                          <span className="text-[10px] font-bold font-mono" style={{ color: statusColor }}>
                            ● สถานะ: {statusVal === 'ขาด' ? 'ขาด (ไม่มีข้อมูล)' : statusVal === 'เดา' ? 'เดา (ค่าจำลอง)' : 'จริง'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          };

          return (
            <>
              {/* Status color-coding Legend */}
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-gray-600 mb-4 bg-gray-100/70 backdrop-blur-md p-3 rounded-2xl border border-gray-200/50 font-mono">
                <span className="text-gray-900 uppercase tracking-wider text-[9px] mr-1 font-sans font-bold">สัญลักษณ์สีจุดกราฟ:</span>
                <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white" /> ฟ้า = ข้อมูลจริง</span>
                <span className="flex items-center gap-1.5 text-[#0CA4A4]"><span className="w-2.5 h-2.5 rounded-full bg-[#0CA4A4] border border-white" /> เขียว = เดา (ค่าจำลอง)</span>
                <span className="flex items-center gap-1.5 text-rose-500"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" /> แดง = ขาด (ไม่มีข้อมูล)</span>
              </div>

              {/* Orientation instruction Tip */}
              <div className="flex items-center gap-2.5 bg-[#0CA4A4]/10 border border-[#0CA4A4]/20 rounded-2xl p-3.5 text-xs text-gray-700 mb-5 leading-relaxed font-sans">
                <Info size={16} className="text-[#0CA4A4] shrink-0" />
                <span>แนะนำ: หมุนจอโทรศัพท์ของคุณเป็นแนวนอน (Landscape Mode) เพื่อการเปิดดูโครงสร้างลายเส้นกราฟที่ใหญ่และชัดเจนยิ่งขึ้น</span>
              </div>

              {/* Graph Display Area */}
              <div className="relative h-[280px] md:h-[400px] w-full flex items-center justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-[#0CA4A4]" size={32} />
                    <span className="text-xs text-gray-500 font-mono">กำลังประมวลผลข้อมูลกราฟ...</span>
                  </div>
                ) : errorMsg ? (
                  <div className="text-xs text-rose-600 font-semibold">{errorMsg}</div>
                ) : chartData.length === 0 ? (
                  <div className="text-xs text-gray-400">กรุณาเลือกห้องเรียนและประเภทข้อมูลด้านบนเพื่อเริ่มแสดงแนวโน้ม</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.6)" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 10, fill: '#6B7280', fontFamily: 'JetBrains Mono' }}
                        stroke="rgba(226, 232, 240, 0.8)"
                      />
                      <YAxis 
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 10, fill: '#0CA4A4', fontFamily: 'JetBrains Mono' }}
                        stroke="rgba(12, 164, 164, 0.3)"
                        label={{ value: 'µg/m³', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fill: '#0CA4A4' } }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10, fill: '#F59E0B', fontFamily: 'JetBrains Mono' }}
                        stroke="rgba(245, 158, 11, 0.3)"
                        label={{ value: '°C / %', angle: 90, position: 'insideRight', style: { fontSize: '10px', fill: '#F59E0B' } }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px', fontFamily: 'DM Sans' }} />

                      {selectedNodes.map((nodeId) => {
                        const displayName = nodesMeta[nodeId]?.display_name || latest[nodeId]?.reading.location || nodeId;
                        
                        return selectedMetrics.map((metricVal) => {
                          const metricMeta = metrics.find((m) => m.value === metricVal);
                          const lineStroke = metricMeta?.color || '#0CA4A4';
                          const yAxisId = metricMeta?.axis || 'left';

                          return (
                            <Line
                              key={`${nodeId}_${metricVal}`}
                              yAxisId={yAxisId}
                              type="monotone"
                              dataKey={`${nodeId}_${metricVal}`}
                              name={`${displayName} - ${metricMeta?.label}`}
                              stroke={lineStroke}
                              strokeWidth={2.5}
                              dot={renderCustomDot}
                              activeDot={renderActiveDot}
                              connectNulls
                            />
                          );
                        });
                      })}
                    </LineChart>
                  </ResponsiveContainer>

                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

