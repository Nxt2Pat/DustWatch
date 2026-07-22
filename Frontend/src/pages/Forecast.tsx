import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { request } from '../api/client';
import Plotly from 'plotly.js-dist-min';
import { Loader2, AlertTriangle, TrendingUp, Brain, Sparkles } from 'lucide-react';

interface HistoryPoint {
  timestamp: string;
  pm2_5?: number;
  [key: string]: any;
}

interface ForecastHorizon {
  horizon_h: number;
  pm25_pred: number;
  pm25_lower: number;
  pm25_upper: number;
  confidence: number;
  model_type: string;
}

interface PredictionData {
  node_id: string;
  generated_at: string;
  horizons: ForecastHorizon[];
}

export default function Forecast() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // List of active node IDs
  const activeNodeIds = Object.keys(latest).filter(
    (id) => !nodesMeta[id] || nodesMeta[id].active !== 0
  );

  // States
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingSuccessMsg, setTrainingSuccessMsg] = useState<string | null>(null);
  const [selectedHorizonFilter, setSelectedHorizonFilter] = useState<number | 'all'>('all');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);


  // Retrain ML XGBoost/LightGBM model for selected node
  const handleRetrainModel = async () => {
    if (!selectedNode) return;
    setIsTraining(true);
    setTrainingSuccessMsg(null);

    try {
      const res = await request<{ message: string }>(`/dev/ml/retrain?node_id=${selectedNode}`, {
        method: 'POST'
      });

      if (res.ok) {
        setTrainingSuccessMsg('ส่งคำสั่งเรียนรู้ข้อมูลย้อนหลัง (Retrain AI Model) สำเร็จ! ระบบกำลังอัปเดตโมเดลในเบื้องหลัง...');
        // Dismiss success message after 5 seconds
        setTimeout(() => setTrainingSuccessMsg(null), 6000);
      } else {
        alert(res.error || 'ไม่สามารถสั่งเทรนโมเดล AI ย้อนหลังได้');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
    } finally {
      setIsTraining(false);
    }
  };

  // Set default node selection
  useEffect(() => {
    if (activeNodeIds.length > 0 && !selectedNode) {
      setSelectedNode(activeNodeIds[0]);
    }
  }, [activeNodeIds, selectedNode]);

  // Fetch forecast prediction data and past history in parallel (using 15m interval for detailed history)
  useEffect(() => {
    const fetchForecastAndHistory = async () => {
      if (!selectedNode) return;
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const [predRes, histRes] = await Promise.all([
          request<PredictionData>(`/readings/${selectedNode}/prediction`),
          request<HistoryPoint[]>(`/readings/${selectedNode}/history?start=-24h&interval=15m`)
        ]);

        setIsLoading(false);

        if (predRes.ok && predRes.data) {
          setPrediction(predRes.data);
        } else {
          console.error('Failed to load forecast prediction:', predRes.error);
          setErrorMsg(predRes.error || 'ไม่สามารถดึงข้อมูลการพยากรณ์ฝุ่นละอองได้');
          setPrediction(null);
        }

        if (histRes.ok && histRes.data) {
          setHistoryData(histRes.data);
        } else {
          setHistoryData([]);
        }
      } catch (err) {
        setIsLoading(false);
        setErrorMsg('เกิดข้อผิดพลาดการเชื่อมต่อเครือข่าย');
        setPrediction(null);
        setHistoryData([]);
      }
    };

    fetchForecastAndHistory();
  }, [selectedNode]);

  // Render Plotly confidence interval chart with past actual & future forecast curves
  useEffect(() => {
    if (!prediction || !plotRef.current) return;

    const currentNodeData = latest[prediction.node_id];
    const currentVal = currentNodeData?.reading.pm.pm2_5 || 0;

    const horizons = prediction.horizons.sort((a, b) => a.horizon_h - b.horizon_h);

    // 1. Process Past Actual Telemetry Data relative to current timestamp
    const now = Date.now();
    const durationMs = 24 * 60 * 60 * 1000;
    const stepMs = 15 * 60 * 1000; // 15m interval
    const startTime = now - durationMs;
    const timeline: number[] = [];
    for (let t = startTime; t <= now; t += stepMs) {
      const aligned = Math.round(t / stepMs) * stepMs;
      timeline.push(aligned);
    }

    // Map historyData by timestamp
    const histDataMap: Record<number, HistoryPoint> = {};
    historyData.forEach((p) => {
      const timeMs = new Date(p.timestamp).getTime();
      const alignedTime = Math.round(timeMs / stepMs) * stepMs;
      histDataMap[alignedTime] = p;
    });

    const isSimulated = prediction.node_id.toLowerCase().includes('test') || 
                        prediction.node_id.toLowerCase().includes('sim') || 
                        prediction.node_id.toLowerCase().includes('sandbox');

    let lastKnownVal = currentVal;
    // Find the first available PM2.5 in history to bootstrap if needed, or use currentVal
    const firstValidPoint = historyData.find(p => p.pm2_5 !== undefined && p.pm2_5 !== null);
    if (firstValidPoint && firstValidPoint.pm2_5 !== undefined) {
      lastKnownVal = firstValidPoint.pm2_5;
    }

    // Hourly diurnal factors from cold_start.py
    const HOURLY_FACTORS: Record<number, number> = {
      0: 0.85,  1: 0.80,  2: 0.78,  3: 0.77,
      4: 0.80,  5: 0.88,  6: 1.00,  7: 1.10,
      8: 1.18,  9: 1.15, 10: 1.08, 11: 1.02,
      12: 0.98, 13: 0.95, 14: 0.92, 15: 0.90,
      16: 0.94, 17: 1.05, 18: 1.12, 19: 1.10,
      20: 1.05, 21: 0.98, 22: 0.92, 23: 0.88,
    };

    const pastXVals: number[] = [];
    const pastYVals: number[] = [];
    const pastYValsPred: number[] = [];
    const pastYValsDiff: number[] = [];
    const markerColors: string[] = [];
    const hoverTexts: string[] = [];

    timeline.forEach((time, idx) => {
      const diffMs = time - now;
      const xHour = diffMs / (60 * 60 * 1000);
      pastXVals.push(xHour);

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

      const point = histDataMap[time];
      let status = 'จริง';
      let val = lastKnownVal;

      if (point && point.pm2_5 !== undefined && point.pm2_5 !== null) {
        val = point.pm2_5;
        status = 'จริง';
        lastKnownVal = val;
      } else {
        status = 'ขาด';
        // Use last known value
        val = lastKnownVal;
      }

      pastYVals.push(val);

      // Baseline historical 1h-ahead forecast curve for backtesting evaluation
      const prevIdx = idx - 4; // 1h lookback is 4 steps of 15m
      let predVal = val;
      if (prevIdx >= 0) {
        const startVal = pastYVals[prevIdx];
        const targetHour = dateObj.getHours();
        const alpha = HOURLY_FACTORS[targetHour] || 1.0;
        predVal = startVal * 0.95 * alpha;
        predVal = Math.max(0, Number(predVal.toFixed(2)));
      }
      pastYValsPred.push(predVal);
      
      const absDiff = Math.abs(val - predVal);
      pastYValsDiff.push(Number(absDiff.toFixed(2)));

      let dotColor = '#3B82F6'; // ฟ้าจริง
      if (status === 'ขาด') dotColor = '#EF4444'; // แดงขาด (ไม่มีข้อมูล)
      markerColors.push(dotColor);

      const statusText = status === 'ขาด' ? 'ขาด (ช่วงเวลาที่ไม่มีข้อมูล)' : 'จริง (Telemetry Data)';
      hoverTexts.push(
        `📅 วันที่: ${formattedDate}<br>⏰ เวลา: ${formattedTime} น.<br>💨 PM2.5 จริง: ${val.toFixed(1)} µg/m³<br>🔮 ค่าคาดการณ์ประเมิน: ${predVal.toFixed(1)} µg/m³<br>สถานะ: ${statusText}`
      );
    });

    // Append Current (0) to the end of the history series to bridge the connection
    pastXVals.push(0);
    pastYVals.push(currentVal);
    pastYValsPred.push(currentVal);
    pastYValsDiff.push(0);
    markerColors.push(isSimulated ? '#10B981' : '#3B82F6');
    
    const nowObj = new Date(now);
    const nowFmtDate = nowObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const nowFmtTime = nowObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    hoverTexts.push(
      `📅 วันที่: ${nowFmtDate}<br>⏰ เวลา: ${nowFmtTime} น.<br>💨 PM2.5: ${currentVal.toFixed(1)} µg/m³<br>สถานะ: ${isSimulated ? 'เดา (ค่าจำลอง)' : 'จริง'}`
    );

    // 2. Process Future Forecast Horizons
    const futureXVals = [0, ...horizons.map((h) => h.horizon_h)];
    const futureYValsMean = [currentVal, ...horizons.map((h) => h.pm25_pred)];
    const futureYValsUpper = [currentVal, ...horizons.map((h) => h.pm25_upper)];
    const futureYValsLower = [currentVal, ...horizons.map((h) => h.pm25_lower)];

    // 3. Build Plotly Traces
    // Trace 1: Past Actual History Line (with color-coded status points)
    const tracePast = {
      x: pastXVals,
      y: pastYVals,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      line: { color: 'rgba(59, 130, 246, 0.40)', width: 2 }, // Slate blue line link
      marker: { 
        color: markerColors, 
        size: 5,
        line: { color: '#FFF', width: 0.5 }
      },
      text: hoverTexts,
      hoverinfo: 'text' as const,
      name: 'ประวัติข้อมูลย้อนหลัง (Actual)'
    };

    // Trace 1.5: Past Forecast Line (Teal Solid)
    const tracePastForecast = {
      x: pastXVals,
      y: pastYValsPred,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      line: { color: '#0CA4A4', width: 2 },
      marker: { color: '#0CA4A4', size: 5 },
      name: 'ค่าประมวลผลคำนวณย้อนหลัง (Predicted)',
      hoverinfo: 'none' as const
    };

    // Trace 1.8: Past Difference Line (Red Dot/Dash)
    const traceDiff = {
      x: pastXVals,
      y: pastYValsDiff,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: '#EF4444', width: 1.5, dash: 'dot' },
      name: 'ความต่าง (Absolute Diff)',
      hoverinfo: 'none' as const
    };

    // Trace 2: Future Forecast Upper Bound
    const traceUpper = {
      x: futureXVals,
      y: futureYValsUpper,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: 'transparent' },
      showlegend: false,
      hoverinfo: 'none' as const
    };

    // Trace 3: Future Forecast Lower Bound (filled area)
    const traceLower = {
      x: futureXVals,
      y: futureYValsLower,
      type: 'scatter' as const,
      mode: 'lines' as const,
      fill: 'tonexty' as const,
      fillcolor: 'rgba(12, 164, 164, 0.12)', // Teal tint for predictions
      line: { color: 'transparent' },
      name: 'ความคลาดเคลื่อนคาดการณ์',
      showlegend: false
    };

    // Trace 4: Future Forecast Mean Line (Teal Dashed)
    const traceForecast = {
      x: futureXVals,
      y: futureYValsMean,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      line: { color: '#0CA4A4', width: 3, dash: 'dash' },
      marker: { color: '#0CA4A4', size: 6 },
      name: 'ค่าฝุ่นพยากรณ์ (Forecast)'
    };

    const data: any[] = [];
    const hasHistory = timeline.length > 0;
    if (showOverlay && hasHistory) {
      data.push(tracePast, tracePastForecast, traceDiff);
    }
    data.push(traceUpper, traceLower, traceForecast);

    // 4. Generate Dynamic Timeline Tick Labels
    const minVal = hasHistory ? Math.min(...pastXVals) : -6;
    const tickvals: number[] = [];
    const ticktext: string[] = [];

    if (showOverlay && hasHistory) {
      const step = minVal < -12 ? 6 : (minVal < -6 ? 4 : 2);
      for (let v = Math.floor(minVal); v < 0; v += step) {
        if (v <= minVal - 0.5) continue;
        tickvals.push(v);
        ticktext.push(`${Math.abs(v)} ชม.ก่อน`);
      }
    } else {
      tickvals.push(-6, -4, -2);
      ticktext.push('6 ชม.ก่อน', '4 ชม.ก่อน', '2 ชม.ก่อน');
    }

    tickvals.push(0, 1, 3, 6);
    ticktext.push('ปัจจุบัน', '+1 ชม.', '+3 ชม.', '+6 ชม.');

    const layout = {
      autosize: true,
      height: 240,
      margin: { l: 30, r: 10, t: 10, b: 35 },
      showlegend: false,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: { text: 'เส้นแกนเวลาเปรียบเทียบ (อดีต -> อนาคต)' },
        tickvals: tickvals,
        ticktext: ticktext,
        tickfont: { size: 10, color: '#6B7280', fontFamily: 'JetBrains Mono' },
        gridcolor: 'rgba(226, 232, 240, 0.5)',
        linecolor: 'rgba(226, 232, 240, 0.8)',
        range: showOverlay && hasHistory ? [minVal - 0.2, 6.2] : [-6.2, 6.2]
      },
      yaxis: {
        title: { text: 'PM2.5 (µg/m³)' },
        tickfont: { size: 10, color: '#6B7280', fontFamily: 'JetBrains Mono' },
        gridcolor: 'rgba(226, 232, 240, 0.5)',
        linecolor: 'rgba(226, 232, 240, 0.8)'
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot(plotRef.current, data, layout, config);

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [prediction, historyData, showOverlay, latest]);

  const getConfidenceStyles = (conf: number) => {
    if (conf >= 0.85) return { border: 'border-l-4 border-l-[#0CA4A4]', text: 'text-[#0CA4A4]', bg: 'bg-[#0CA4A4]/5' };
    if (conf >= 0.60) return { border: 'border-l-4 border-l-amber-500', text: 'text-amber-600', bg: 'bg-amber-500/5' };
    return { border: 'border-l-4 border-l-rose-500', text: 'text-rose-600', bg: 'bg-rose-500/5' };
  };

  const getModelLabel = (model: string) => {
    if (model === 'cold_start_heuristic') return 'Heuristic Model';
    if (model === 'xgboost') return 'XGBoost Machine Learning';
    if (model === 'lightgbm') return 'LightGBM';
    return model;
  };

  return (
    <div className="space-y-5 relative z-10 max-w-6xl mx-auto pb-12 fade-up">
      {/* Node selection dropdown */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 font-sans">
            เลือกห้องเรียนเพื่อวิเคราะห์คาดการณ์ (Select Room)
          </label>

          <button
            onClick={handleRetrainModel}
            disabled={isTraining || !selectedNode}
            className="flex items-center gap-2 bg-[#0CA4A4] hover:bg-[#088383] disabled:bg-gray-300 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-md shadow-[#0CA4A4]/20 cursor-pointer active:scale-95"
          >
            {isTraining ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            <span>{isTraining ? 'กำลังเรียนรู้ใหม่...' : 'คำนวณเรียนรู้ AI ใหม่ (Retrain)'}</span>
          </button>
        </div>

        {trainingSuccessMsg && (
          <div className="mb-4 bg-[#0CA4A4]/10 text-[#0CA4A4] border border-[#0CA4A4]/25 text-xs p-3.5 rounded-2xl flex items-center gap-2">
            <Sparkles size={16} />
            <span>{trainingSuccessMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {activeNodeIds.map((id) => {
            const displayName = nodesMeta[id]?.display_name || latest[id]?.reading.location || id;
            const isSelected = selectedNode === id;

            return (
              <button
                key={id}
                onClick={() => setSelectedNode(id)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-[#0CA4A4] text-white border-[#0CA4A4] shadow-md shadow-[#0CA4A4]/25 font-bold'
                    : 'bg-white/60 text-gray-700 border-gray-200/80 hover:bg-white hover:border-[#0CA4A4]/40'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </div>


      {isLoading ? (

        <div className="glass-card py-16 flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#0CA4A4]" size={36} />
          <span className="text-xs text-gray-500 font-mono">กำลังประมวลผลโมเดลโครงข่ายประสาทพยากรณ์ฝุ่น...</span>
        </div>
      ) : errorMsg ? (
        <div className="glass-card py-16 text-center text-xs text-rose-600 font-semibold">
          {errorMsg}
        </div>
      ) : prediction ? (
        <div className="space-y-5 animate-fadeIn">
          {/* 24-Hour Ahead Risk Heatmap Timeline Bar */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-[#0CA4A4]" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 font-sans">
                แถบประเมินความเสี่ยงล่วงหน้า 24 ชั่วโมง (24-Hour Ahead Risk Timeline)
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
              {prediction.horizons.map((h) => {
                let riskBg = 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
                let riskLabel = 'อากาศดี';
                if (h.pm25_pred > 37.5) {
                  riskBg = 'bg-rose-500/15 text-rose-700 border-rose-500/30';
                  riskLabel = 'เริ่มมีผลกระทบ';
                } else if (h.pm25_pred > 25.0) {
                  riskBg = 'bg-amber-500/15 text-amber-700 border-amber-500/30';
                  riskLabel = 'ปานกลาง';
                }

                return (
                  <div key={h.horizon_h} className={`p-3 rounded-2xl border ${riskBg} flex flex-col items-center justify-between text-center backdrop-blur-md`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 font-sans">+ {h.horizon_h} ชม.</span>
                    <span className="text-lg font-black font-mono my-1">{h.pm25_pred.toFixed(1)}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/60 backdrop-blur-xs">{riskLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plotly forecast curve visualization */}
          <div className="glass-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-[#0CA4A4]" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 font-sans">
                  เส้นวิเคราะห์และแนวโน้มการกระจายตัวล่วงหน้า (PM2.5 Forecast Curve)
                </span>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600 hover:text-[#0CA4A4] transition-colors">
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="rounded border-gray-300 text-[#0CA4A4] focus:ring-[#0CA4A4] w-4 h-4 cursor-pointer"
                />
                <span>แสดงประวัติข้อมูลย้อนหลัง (Overlay History)</span>
              </label>
            </div>

            {/* Status color-coding Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-gray-600 mb-4 bg-gray-100/70 backdrop-blur-md p-3 rounded-2xl border border-gray-200/50">
              <span className="text-gray-900 uppercase tracking-wider text-[9px] mr-1 font-sans font-bold">สัญลักษณ์จุดประวัติย้อนหลัง:</span>
              <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white" /> ฟ้า = ข้อมูลจริง</span>
              <span className="flex items-center gap-1.5 text-[#0CA4A4]"><span className="w-2.5 h-2.5 rounded-full bg-[#0CA4A4] border border-white" /> เขียว = เดา (ค่าจำลอง)</span>
              <span className="flex items-center gap-1.5 text-rose-500"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" /> แดง = ขาด (ไม่มีข้อมูล)</span>
              {showOverlay && (
                <>
                  <span className="border-l border-gray-300 h-3 mx-1" />
                  <span className="flex items-center gap-1.5 text-[#0CA4A4]"><span className="w-3.5 h-0.5 bg-[#0CA4A4] block" /><span className="w-1.5 h-1.5 rounded-full bg-[#0CA4A4] block -ml-2" /> เส้นทึบเขียว = คาดเดาในอดีต</span>
                  <span className="flex items-center gap-1.5 text-rose-500"><span className="w-3.5 h-0.5 border-t border-dotted border-rose-500 block" /> เส้นจุดแดง = ส่วนต่างจริง-เดา</span>
                </>
              )}
              <span className="border-l border-gray-300 h-3 mx-1" />
              <span className="flex items-center gap-1.5 text-[#0CA4A4]"><span className="w-3.5 h-0.5 border-t border-dashed border-[#0CA4A4] block" /><span className="w-1.5 h-1.5 rounded-full bg-[#0CA4A4] block -ml-2" /> เส้นประสีเขียว = คาดการณ์ล่วงหน้า</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 bg-[#0CA4A4]/15 rounded block border border-[#0CA4A4]/30" /> พื้นที่แรเงา = ขอบเขตความคลาดเคลื่อน</span>
            </div>
            
            <div ref={plotRef} className="w-full" />
          </div>

          {/* Forecast Horizon Scrubber Pill Selector */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 font-sans">
                ผลคาดการณ์ล่วงหน้าจำแนกตามช่วงเวลา (Forecast Horizons)
              </span>

              {/* Scrubber Buttons */}
              <div className="flex items-center gap-1.5 bg-gray-100/80 p-1 rounded-full border border-gray-200/60">
                <button
                  onClick={() => setSelectedHorizonFilter('all')}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedHorizonFilter === 'all'
                      ? 'bg-[#0CA4A4] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ทั้งหมด
                </button>
                {prediction.horizons.map((h) => (
                  <button
                    key={h.horizon_h}
                    onClick={() => setSelectedHorizonFilter(h.horizon_h)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      selectedHorizonFilter === h.horizon_h
                        ? 'bg-[#0CA4A4] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    +{h.horizon_h}h
                  </button>
                ))}
              </div>
            </div>

            {prediction.horizons
              .filter((h) => selectedHorizonFilter === 'all' || selectedHorizonFilter === h.horizon_h)
              .map((horizon) => {
                const styles = getConfidenceStyles(horizon.confidence);
                const isHeuristic = horizon.model_type === 'cold_start_heuristic';

                return (
                  <div 
                    key={horizon.horizon_h}
                    className={`glass-card p-6 flex flex-col justify-between transition-all duration-300 ${styles.border}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-900 font-sans">
                          พยากรณ์ล่วงหน้าอีก +{horizon.horizon_h} ชั่วโมง
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-black font-mono text-gray-900">
                            PM2.5 ≈ {horizon.pm25_pred.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-500 font-medium font-sans">µg/m³</span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-sans">
                          ความแม่นยำคาดการณ์
                        </span>
                        <span className={`text-xl font-black font-mono ${styles.text}`}>
                          {Math.round(horizon.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 font-sans">
                      <span>ช่วงประเมินค่าฝุ่นที่เป็นไปได้: <strong className="font-mono text-gray-900">{horizon.pm25_lower.toFixed(1)} - {horizon.pm25_upper.toFixed(1)}</strong> µg/m³</span>
                      
                      <span className="font-mono text-[10px] bg-[#0CA4A4]/10 border border-[#0CA4A4]/20 px-2.5 py-0.5 rounded-full text-[#0CA4A4] font-bold">
                        {getModelLabel(horizon.model_type)}
                      </span>
                    </div>

                    {isHeuristic && (
                      <div className="mt-3.5 flex items-center gap-2 text-xs text-amber-800 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 leading-relaxed">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span>เนื่องจากประวัติฝุ่นในห้องนี้มีจำกัด ระบบจึงเลือกใช้สูตรคำนวณแบบสถิติประมาณการดั้งเดิม (Heuristic) แทน</span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

        </div>
      ) : (
        <div className="glass-card py-16 text-center text-xs text-gray-400">
          กรุณาเลือกห้องเรียนด้านบนเพื่อวิเคราะห์พยากรณ์
        </div>
      )}
    </div>
  );
}

