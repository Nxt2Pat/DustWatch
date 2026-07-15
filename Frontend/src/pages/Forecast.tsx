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
        status = isSimulated ? 'เดา' : 'จริง';
        lastKnownVal = val;
      } else {
        status = 'ขาด';
        // Use last known value
        val = lastKnownVal;
      }

      pastYVals.push(val);

      // Simulate 1h-ahead forecasting from history
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
      if (status === 'เดา') dotColor = '#10B981'; // เขียวเดา
      if (status === 'ขาด') dotColor = '#EF4444'; // แดงขาด
      markerColors.push(dotColor);

      const statusText = status === 'ขาด' ? 'ขาด (ไม่มีข้อมูล)' : status === 'เดา' ? 'เดา (ค่าจำลอง)' : 'จริง';
      hoverTexts.push(
        `📅 วันที่: ${formattedDate}<br>⏰ เวลา: ${formattedTime} น.<br>💨 PM2.5 จริง: ${val.toFixed(1)} µg/m³<br>🔮 ค่าคาดการณ์อดีต: ${predVal.toFixed(1)} µg/m³<br>สถานะ: ${statusText}`
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

    // Trace 1.5: Past Forecast Line (Green Solid)
    const tracePastForecast = {
      x: pastXVals,
      y: pastYValsPred,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      line: { color: '#10B981', width: 2 },
      marker: { color: '#10B981', size: 5 },
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
      fillcolor: 'rgba(16, 185, 129, 0.10)', // Green tint for predictions
      line: { color: 'transparent' },
      name: 'ความคลาดเคลื่อนคาดการณ์',
      showlegend: false
    };

    // Trace 4: Future Forecast Mean Line (Green Dashed)
    const traceForecast = {
      x: futureXVals,
      y: futureYValsMean,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      line: { color: '#10B981', width: 3, dash: 'dash' },
      marker: { color: '#10B981', size: 6 },
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
      // Add ticks for history dynamically (every 2h or 6h based on size)
      const step = minVal < -12 ? 6 : (minVal < -6 ? 4 : 2);
      for (let v = Math.floor(minVal); v < 0; v += step) {
        if (v <= minVal - 0.5) continue;
        tickvals.push(v);
        ticktext.push(`${Math.abs(v)} ชม.ก่อน`);
      }
    } else {
      // Show default 6h tick if history is hidden or empty
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
        tickfont: { size: 10, color: '#817CA5', fontFamily: 'Plus Jakarta Sans' },
        gridcolor: 'rgba(94, 84, 227, 0.06)',
        linecolor: 'rgba(94, 84, 227, 0.12)',
        range: showOverlay && hasHistory ? [minVal - 0.2, 6.2] : [-6.2, 6.2]
      },
      yaxis: {
        title: { text: 'PM2.5 (µg/m³)' },
        tickfont: { size: 10, color: '#817CA5', fontFamily: 'Plus Jakarta Sans' },
        gridcolor: 'rgba(94, 84, 227, 0.06)',
        linecolor: 'rgba(94, 84, 227, 0.12)'
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
    if (conf >= 0.85) return { border: 'border-l-4 border-l-green-500', text: 'text-green-600', bg: 'bg-green-50/50' };
    if (conf >= 0.60) return { border: 'border-l-4 border-l-amber-500', text: 'text-amber-600', bg: 'bg-amber-50/50' };
    return { border: 'border-l-4 border-l-red-500', text: 'text-red-600', bg: 'bg-red-50/50' };
  };

  const getModelLabel = (model: string) => {
    if (model === 'cold_start_heuristic') return 'Heuristic Model';
    if (model === 'xgboost') return 'XGBoost Machine Learning';
    if (model === 'lightgbm') return 'LightGBM';
    return model;
  };

  return (
    <div className="space-y-4 relative z-10">
      {/* Node selection dropdown */}
      <div className="premium-card p-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary font-sans mb-3">
          เลือกห้องเรียนเพื่อวิเคราะห์คาดการณ์ (Select Room)
        </label>
        <div className="flex flex-wrap gap-2">
          {activeNodeIds.map((id) => {
            const displayName = nodesMeta[id]?.display_name || latest[id]?.reading.location || id;
            const isSelected = selectedNode === id;

            return (
              <button
                key={id}
                onClick={() => setSelectedNode(id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-brand-primary text-white border-brand-primary shadow-xs shadow-brand-primary/20'
                    : 'bg-[#EDEBF8] text-text-secondary border-transparent hover:bg-white/60 hover:border-brand-primary/20'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>

        {/* Retrain AI Model Controls */}
        {selectedNode && (
          <div className="mt-4 pt-4 border-t border-brand-primary/5 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] text-text-secondary font-medium">
                * สำหรับครู IT/ผู้พัฒนา: ข้อมูลประวัติสะสมจริงจะใช้เรียนรู้แนวโน้มคาดเดาล่วงหน้าโดยไม่มีการดีเลย์
              </span>
              <button
                onClick={handleRetrainModel}
                disabled={isTraining}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                  isTraining
                    ? 'bg-brand-light text-brand-primary border-brand-primary/20 cursor-not-allowed'
                    : 'bg-white hover:bg-brand-light text-brand-primary border-brand-primary/25 hover:border-brand-primary/50 active:scale-[0.98]'
                }`}
              >
                {isTraining ? (
                  <>
                    <Loader2 className="animate-spin" size={12} />
                    <span>กำลังเทรนโมเดล AI...</span>
                  </>
                ) : (
                  <>
                    <Brain size={12} />
                    <span>⚡ สั่งเรียนรู้แนวโน้มย้อนหลัง (Retrain AI Model)</span>
                  </>
                )}
              </button>
            </div>
            
            {trainingSuccessMsg && (
              <div className="flex items-center gap-1.5 bg-[#ECFDF5] border border-[#10B981]/25 text-[#10B981] px-3 py-2 rounded-xl text-[10px] font-bold animate-fadeIn">
                <Sparkles size={12} />
                <span>{trainingSuccessMsg}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="premium-card py-16 flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-brand-primary" size={32} />
          <span className="text-xs text-text-secondary font-mono">กำลังประมวลผลโมเดลคาดการณ์ PM2.5...</span>
        </div>
      ) : errorMsg ? (
        <div className="premium-card py-16 text-center text-xs text-[#DC2626] font-semibold">
          {errorMsg}
        </div>
      ) : prediction ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Plotly forecast curve visualization */}
          <div className="premium-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary font-sans">
                  เส้นวิเคราะห์และแนวโน้มการกระจายตัวล่วงหน้า (PM2.5 Forecast Curve)
                </span>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-secondary hover:text-brand-primary transition-colors">
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="rounded border-brand-primary/20 text-brand-primary focus:ring-brand-primary w-4 h-4 cursor-pointer"
                />
                <span>แสดงประวัติข้อมูลย้อนหลัง (Overlay History)</span>
              </label>
            </div>

            {/* Status color-coding Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-text-secondary mb-4 bg-[#F5F4FC] p-2.5 rounded-xl border border-brand-primary/5">
              <span className="text-text-primary uppercase tracking-wider text-[9px] mr-1 font-sans">สัญลักษณ์จุดประวัติย้อนหลัง:</span>
              <span className="flex items-center gap-1.5 text-[#3B82F6]"><span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] border border-white" /> ฟ้า = ข้อมูลจริง</span>
              <span className="flex items-center gap-1.5 text-[#10B981]"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981] border border-white" /> เขียว = เดา (ค่าจำลอง)</span>
              <span className="flex items-center gap-1.5 text-[#EF4444]"><span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white" /> แดง = ขาด (ไม่มีข้อมูล)</span>
              {showOverlay && (
                <>
                  <span className="border-l border-brand-primary/10 h-3 mx-1" />
                  <span className="flex items-center gap-1.5 text-[#10B981]"><span className="w-3.5 h-0.5 bg-[#10B981] block" /><span className="w-1.5 h-1.5 rounded-full bg-[#10B981] block -ml-2" /> เส้นทึบเขียว = คาดเดาในอดีต (Predicted)</span>
                  <span className="flex items-center gap-1.5 text-[#EF4444]"><span className="w-3.5 h-0.5 border-t border-dotted border-[#EF4444] block" /> เส้นจุดแดง = ค่าส่วนต่างจริง-เดา (Difference)</span>
                </>
              )}
              <span className="border-l border-brand-primary/10 h-3 mx-1" />
              <span className="flex items-center gap-1.5 text-[#10B981]/80"><span className="w-3.5 h-0.5 border-t border-dashed border-[#10B981] block" /><span className="w-1.5 h-1.5 rounded-full bg-[#10B981] block -ml-2" /> เส้นประสีเขียว = เส้นคาดการณ์ล่วงหน้า (Forecast)</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-2.5 bg-[#10B981]/10 rounded block border border-[#10B981]/20" /> พื้นที่แรเงา = ขอบเขตความคลาดเคลื่อน</span>
            </div>
            
            <div ref={plotRef} className="w-full" />
          </div>

          {/* 3 Vertically stacked forecast blocks */}
          <div className="space-y-3">
            <span className="block text-xs font-bold uppercase tracking-wider text-text-secondary font-sans px-1">
              ผลคาดการณ์ล่วงหน้าจำแนกตามรายเวลา
            </span>

            {prediction.horizons.map((horizon) => {
              const styles = getConfidenceStyles(horizon.confidence);
              const isHeuristic = horizon.model_type === 'cold_start_heuristic';

              return (
                <div 
                  key={horizon.horizon_h}
                  className={`premium-card p-5 flex flex-col justify-between transition-all ${styles.border}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-bold text-text-primary font-sans">
                        พยากรณ์ล่วงหน้าอีก +{horizon.horizon_h} ชั่วโมง
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-3xl font-extrabold font-serif text-text-primary">
                          PM2.5 ≈ {horizon.pm25_pred.toFixed(1)}
                        </span>
                        <span className="text-xs text-text-secondary font-medium">µg/m³</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary font-sans">
                        ความแม่นยำคาดการณ์
                      </span>
                      <span className={`text-lg font-extrabold font-mono ${styles.text}`}>
                        {Math.round(horizon.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/[0.03] flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary font-sans">
                    <span>ช่วงประเมินค่าฝุ่นที่เป็นไปได้: <strong className="font-mono text-text-primary">{horizon.pm25_lower.toFixed(1)} - {horizon.pm25_upper.toFixed(1)}</strong> µg/m³</span>
                    
                    <span className="font-mono text-[9px] bg-brand-light border border-brand-primary/10 px-2 py-0.5 rounded text-brand-primary font-bold">
                      {getModelLabel(horizon.model_type)}
                    </span>
                  </div>

                  {isHeuristic && (
                    <div className="mt-3.5 flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50/50 border border-amber-200/50 rounded-xl p-3 leading-relaxed">
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
        <div className="premium-card py-16 text-center text-xs text-text-muted">
          กรุณาเลือกห้องเรียนด้านบนเพื่อวิเคราะห์พยากรณ์
        </div>
      )}
    </div>
  );
}
