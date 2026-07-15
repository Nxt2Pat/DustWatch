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
  { label: '7 วัน', value: '7d', start: '-7d', interval: '1h' },
];

const metrics = [
  { label: 'ฝุ่น PM2.5', value: 'pm2_5', color: '#5E54E3', unit: 'µg/m³' },
  { label: 'ฝุ่น PM10', value: 'pm10', color: '#10B981', unit: 'µg/m³' },
  { label: 'อุณหภูมิห้อง', value: 'temperature', color: '#EF4444', unit: '°C' },
  { label: 'ความชื้นสัมพัทธ์', value: 'humidity', color: '#3B82F6', unit: '%' },
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
        // Keep track of the last known value for each node & metric for imputation (ขาด)
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
            const isSimulated = nodeId.toLowerCase().includes('test') || 
                                nodeId.toLowerCase().includes('sim') || 
                                nodeId.toLowerCase().includes('sandbox');

            const point = nodeDataMaps[nodeId]?.[time];

            selectedMetrics.forEach((metric) => {
              const key = `${nodeId}_${metric}`;
              const statusKey = `${key}_status`;

              if (point && point[metric] !== undefined && point[metric] !== null) {
                dataPoint[key] = point[metric];
                dataPoint[statusKey] = isSimulated ? 'เดา' : 'จริง';
                lastKnownValues[key] = point[metric];
              } else {
                // ขาด (Missing) - Use last known value or null if none
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

  return (
    <div className="space-y-4 relative z-10">
      {/* Target Room Selection horizontal list */}
      <div className="premium-card p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary font-sans mb-3">
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
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-brand-primary text-white border-brand-primary shadow-xs shadow-brand-primary/20'
                    : 'bg-[#EDEBF8] text-text-secondary border-transparent hover:bg-white/60 hover:border-brand-primary/20'
                }`}
              >
                {isSelected && <Check size={12} />}
                <span>{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Metric selection Toggles */}
      <div className="premium-card p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary font-sans mb-3">
          ประเภทข้อมูล (Parameters)
        </label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {metrics.map((m) => {
            const isSelected = selectedMetrics.includes(m.value);

            return (
              <button
                key={m.value}
                onClick={() => toggleMetricSelection(m.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border shrink-0 transition-all ${
                  isSelected
                    ? 'bg-brand-light text-brand-primary border-brand-primary/30 shadow-xs'
                    : 'bg-[#EDEBF8] text-text-secondary border-transparent hover:bg-white/60 hover:border-brand-primary/20'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span>{m.label} ({m.unit})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart range selector */}
      <div className="premium-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="text-brand-primary" size={18} />
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-sans">
              แนวโน้มข้อมูลสภาพแวดล้อม (Environmental Trend Chart)
            </span>
          </div>

          {/* Segmented Range Control */}
          <div className="flex bg-[#EDEBF8] p-1 rounded-xl">
            {timeRanges.map((range) => {
              const isSelected = selectedRange.value === range.value;
              return (
                <button
                  key={range.value}
                  onClick={() => setSelectedRange(range)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-white text-brand-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
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

            let dotColor = '#3B82F6'; // ฟ้าจริง
            if (statusVal === 'เดา') dotColor = '#10B981'; // เขียวเดา
            if (statusVal === 'ขาด') dotColor = '#EF4444'; // แดงขาด

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

            let dotColor = '#3B82F6'; // ฟ้าจริง
            if (statusVal === 'เดา') dotColor = '#10B981'; // เขียวเดา
            if (statusVal === 'ขาด') dotColor = '#EF4444'; // แดงขาด

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
                <div className="bg-white/95 border border-brand-primary/10 rounded-2xl p-4 shadow-xl text-xs space-y-2">
                  <div className="font-bold text-text-primary">
                    📅 วันที่: {dataPoint.formattedDate}
                  </div>
                  <div className="font-semibold text-text-secondary">
                    ⏰ เวลา: {dataPoint.timestamp} น.
                  </div>
                  <div className="border-t border-brand-primary/10 my-1 pt-1.5 space-y-1.5">
                    {payload.map((p: any) => {
                      const statusKey = `${p.dataKey}_status`;
                      const statusVal = dataPoint[statusKey] || 'จริง';

                      let statusColor = '#3B82F6'; // ฟ้าจริง
                      if (statusVal === 'เดา') statusColor = '#10B981'; // เขียวเดา
                      if (statusVal === 'ขาด') statusColor = '#EF4444'; // แดงขาด

                      const metricMeta = metrics.find((m) => p.dataKey.endsWith(m.value));
                      const unitStr = metricMeta?.unit || '';

                      return (
                        <div key={p.dataKey} className="flex flex-col gap-0.5">
                          <span className="font-bold text-brand-primary">
                            {p.name}: {p.value !== null ? `${p.value} ${unitStr}` : 'ไม่มีข้อมูล'}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: statusColor }}>
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
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-text-secondary mb-4 bg-[#F5F4FC] p-2.5 rounded-xl border border-brand-primary/5">
                <span className="text-text-primary uppercase tracking-wider text-[9px] mr-1">สัญลักษณ์สีจุดกราฟ:</span>
                <span className="flex items-center gap-1.5 text-[#3B82F6]"><span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] border border-white" /> ฟ้า = ข้อมูลจริง</span>
                <span className="flex items-center gap-1.5 text-[#10B981]"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-white" /> เขียว = เดา (ค่าจำลอง)</span>
                <span className="flex items-center gap-1.5 text-[#EF4444]"><span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white" /> แดง = ขาด (ไม่มีข้อมูล)</span>
              </div>

              {/* Orientation instruction Tip */}
              <div className="flex items-center gap-2 bg-brand-light border border-brand-primary/10 rounded-xl p-3 text-xs text-text-secondary mb-4 leading-relaxed">
                <Info size={16} className="text-brand-primary shrink-0" />
                <span>แนะนำ: หมุนจอโทรศัพท์ของคุณเป็นแนวนอน (Landscape Mode) เพื่อการเปิดดูโครงสร้างลายเส้นกราฟที่ใหญ่และชัดเจนยิ่งขึ้น</span>
              </div>

              {/* Graph Display Area */}
              <div className="relative h-[280px] md:h-[400px] w-full flex items-center justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-brand-primary" size={32} />
                    <span className="text-xs text-text-secondary font-mono">กำลังประมวลผลข้อมูลกราฟ...</span>
                  </div>
                ) : errorMsg ? (
                  <div className="text-xs text-[#DC2626] font-semibold">{errorMsg}</div>
                ) : chartData.length === 0 ? (
                  <div className="text-xs text-text-muted">กรุณาเลือกห้องเรียนและประเภทข้อมูลด้านบนเพื่อเริ่มแสดงแนวโน้ม</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(94, 84, 227, 0.05)" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        stroke="rgba(94, 84, 227, 0.12)"
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                        stroke="rgba(94, 84, 227, 0.12)"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />

                      {selectedNodes.map((nodeId) => {
                        const displayName = nodesMeta[nodeId]?.display_name || latest[nodeId]?.reading.location || nodeId;
                        
                        return selectedMetrics.map((metricVal) => {
                          const metricMeta = metrics.find((m) => m.value === metricVal);
                          const lineStroke = metricMeta?.color || '#5E54E3';

                          return (
                            <Line
                              key={`${nodeId}_${metricVal}`}
                              type="monotone"
                              dataKey={`${nodeId}_${metricVal}`}
                              name={`${displayName} - ${metricMeta?.label}`}
                              stroke={lineStroke}
                              strokeWidth={2}
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
