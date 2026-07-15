import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useSEO } from '../hooks/useSEO';

import { getApiBaseUrl } from '../api/sourceConfig';

const API_BASE = getApiBaseUrl();

interface MLModel {
  node_id: string;
  horizon_h: number;
  model_type: string;
  rmse: number;
  mae: number;
  trained_at: string;
  training_samples: number;
  feature_names?: string[];
  feature_importances?: number[];
  estimators?: number;
  learning_rate?: number;
  cv_folds?: number;
  training_days?: number;
  classification_metrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    confusion_matrix: number[][];
    class_labels: string[];
  };
  mape?: number;
  plot_data?: {
    actuals: number[];
    predictions: number[];
  };
  coverage_rate?: number;
  residuals_distribution?: {
    counts: number[];
    bin_edges: number[];
  };
}

interface PredictionHorizon {
  horizon_h: number;
  pm25_pred: number;
  pm25_lower: number;
  pm25_upper: number;
  confidence: number;
  model_type: string;
}

interface NodePrediction {
  node_id: string;
  generated_at: string;
  model_tier: string;
  horizons: PredictionHorizon[];
  live_features?: Record<string, number>;
}

const HOURLY_FACTORS: Record<number, number> = {
  0: 0.85, 1: 0.80, 2: 0.78, 3: 0.77, 4: 0.80, 5: 0.88,
  6: 1.00, 7: 1.10, 8: 1.18, 9: 1.15, 10: 1.08, 11: 1.02,
  12: 0.98, 13: 0.95, 14: 0.92, 15: 0.90, 16: 0.94, 17: 1.05,
  18: 1.12, 19: 1.10, 20: 1.05, 21: 0.98, 22: 0.92, 23: 0.88,
};

export default function MLPortal() {
  useSEO('ML Forecasting Portal', 'Monitor XGBoost/LightGBM model metrics and trigger model retraining.');

  const [models, setModels] = useState<MLModel[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [prediction, setPrediction] = useState<NodePrediction | null>(null);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainMessage, setRetrainMessage] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingPreds, setIsLoadingPreds] = useState(false);
  const [selectedModelForFeatures, setSelectedModelForFeatures] = useState<MLModel | null>(null);
  const [activeTab, setActiveTab] = useState<'forecasting' | 'diagnostics' | 'features'>('forecasting');

  // Hyperparameter Calibration States
  const [trainDays, setTrainDays] = useState<number>(90);
  const [trainEstimators, setTrainEstimators] = useState<number>(150);
  const [trainLearningRate, setTrainLearningRate] = useState<number>(0.08);
  const [trainFolds, setTrainFolds] = useState<number>(3);
  const [retrainTargetNode, setRetrainTargetNode] = useState<string>('all');

  // Fetch nodes from meta or store
  const nodesMeta = useStore((state) => state.nodesMeta);
  const latest = useStore((state) => state.latest);
  const registeredNodeIds = Object.keys(nodesMeta);

  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ml/models`);
      const json = await res.json();
      if (json.ok && json.data) {
        setModels(json.data);
        if (json.data.length > 0) {
          setSelectedModelForFeatures((prev) => {
            if (prev) {
              const match = json.data.find(
                (m: MLModel) => m.node_id === prev.node_id && m.horizon_h === prev.horizon_h
              );
              if (match) return match;
            }
            return json.data[0];
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch ML models from registry', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const fetchPredictions = async (nodeId: string) => {
    if (!nodeId) return;
    setIsLoadingPreds(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/predictions/${nodeId}/prediction`);
      const json = await res.json();
      if (json.ok && json.data) {
        setPrediction(json.data);
      } else {
        setPrediction(null);
      }
    } catch (err) {
      console.error(`Failed to fetch predictions for node ${nodeId}`, err);
      setPrediction(null);
    } finally {
      setIsLoadingPreds(false);
    }
  };

  useEffect(() => {
    fetchModels();
    if (registeredNodeIds.length > 0) {
      setSelectedNode(registeredNodeIds[0]);
    }
  }, []);

  useEffect(() => {
    if (selectedNode) {
      fetchPredictions(selectedNode);
    }
  }, [selectedNode]);

  const handleRetrain = async () => {
    setIsRetraining(true);
    setRetrainMessage(null);
    try {
      const queryParams = `days=${trainDays}&estimators=${trainEstimators}&lr=${trainLearningRate}&folds=${trainFolds}`;
      const url = retrainTargetNode === 'all'
        ? `${API_BASE}/api/v1/dev/ml/retrain?${queryParams}`
        : `${API_BASE}/api/v1/dev/ml/retrain?node_id=${retrainTargetNode}&${queryParams}`;

      const res = await fetch(url, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) {
        setRetrainMessage(`✅ ML retraining triggered for ${retrainTargetNode === 'all' ? 'all nodes' : retrainTargetNode}!`);
        setTimeout(fetchModels, 3000);
      } else {
        setRetrainMessage(`❌ Retraining failed: ${json.error}`);
      }
    } catch (err) {
      setRetrainMessage('❌ Failed to connect to retraining API endpoint.');
    } finally {
      setIsRetraining(false);
    }
  };

  // Build Heuristic Hourly SVG Points
  const svgWidth = 480;
  const svgHeight = 150;
  const padding = 25;
  const graphWidth = svgWidth - padding * 2;
  const graphHeight = svgHeight - padding * 2;

  const hours = Object.keys(HOURLY_FACTORS).map(Number);
  const factors = Object.values(HOURLY_FACTORS);
  const minF = 0.70;
  const maxF = 1.25;
  const rangeF = maxF - minF;

  const points = hours.map((hour) => {
    const factor = HOURLY_FACTORS[hour];
    const x = padding + (hour / 23) * graphWidth;
    const y = svgHeight - padding - ((factor - minF) / rangeF) * graphHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-white/5 pb-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            🧠 Machine Learning Forecast Lab
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono uppercase tracking-wider">
            XGBoost & LightGBM Model Tracking & Live Forecast Inspector
          </p>
        </div>
        <button
          onClick={fetchModels}
          className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold font-mono text-gray-300 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          🔄 Refresh Registry
        </button>
      </div>

      {/* 🔮 ML Pipeline Calibration Card */}
      <div className="p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest font-mono">🔮 MLOps Parameter Calibration & Model Retraining</h3>
            <p className="text-xs text-gray-400 mt-0.5">Customize estimators count, validation folds, and training window size to tune XGBoost & LightGBM regressors.</p>
          </div>
          {retrainMessage && (
            <span className="text-xs font-mono bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl text-gray-300 animate-pulse">
              {retrainMessage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Target Station</label>
            <select
              value={retrainTargetNode}
              onChange={(e) => setRetrainTargetNode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
            >
              <option value="all">All Active Stations</option>
              {registeredNodeIds.map((id) => (
                <option key={id} value={id}>
                  {nodesMeta[id]?.display_name || id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Training Window</label>
            <select
              value={trainDays}
              onChange={(e) => setTrainDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
            >
              <option value={7}>7 Days (Debug / Fast)</option>
              <option value={14}>14 Days (Short)</option>
              <option value={30}>30 Days (Standard)</option>
              <option value={90}>90 Days (Deep History)</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Estimators (Trees)</label>
            <select
              value={trainEstimators}
              onChange={(e) => setTrainEstimators(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
            >
              <option value={50}>50 Trees</option>
              <option value={100}>100 Trees</option>
              <option value={150}>150 Trees (Default)</option>
              <option value={200}>200 Trees</option>
              <option value={300}>300 Trees (Dense)</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Learning Rate (eta)</label>
            <select
              value={trainLearningRate}
              onChange={(e) => setTrainLearningRate(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
            >
              <option value={0.01}>0.01 (Conservative)</option>
              <option value={0.05}>0.05 (Standard)</option>
              <option value={0.08}>0.08 (Default)</option>
              <option value={0.10}>0.10 (Balanced)</option>
              <option value={0.15}>0.15 (Aggressive)</option>
              <option value={0.20}>0.20 (Fast)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">CV splits</label>
              <select
                value={trainFolds}
                onChange={(e) => setTrainFolds(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-white/5 bg-[#0e121f] text-xs text-gray-200 focus:outline-none cursor-pointer font-mono"
              >
                <option value={2}>2-Fold CV</option>
                <option value={3}>3-Fold CV (Default)</option>
                <option value={5}>5-Fold CV (Thorough)</option>
              </select>
            </div>

            <button
              onClick={handleRetrain}
              disabled={isRetraining}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide cursor-pointer transition-all h-[36px] min-w-[110px] ${isRetraining
                  ? 'bg-blue-600/50 text-white/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20'
                }`}
            >
              {isRetraining ? '⏳ Retraining...' : '🔄 Run Retrain'}
            </button>
          </div>
        </div>
      </div>

      {/* 📑 Tab Switcher Navigation */}
      <div className="flex border-b border-white/5 gap-2 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('forecasting')}
          className={`px-4 py-2.5 text-xs font-bold font-mono tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'forecasting'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.01]'
          }`}
        >
          🔮 Live Forecasting & Debugger (พยากรณ์สด)
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-2.5 text-xs font-bold font-mono tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'diagnostics'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.01]'
          }`}
        >
          📈 Performance & Diagnostics (ความแม่นยำโมเดล)
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`px-4 py-2.5 text-xs font-bold font-mono tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'features'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.01]'
          }`}
        >
          📊 Feature Attribution & Configs (ข้อมูลฟีเจอร์)
        </button>
      </div>

      {/* Tab 1: Live Forecasting & Input Debugger */}
      {activeTab === 'forecasting' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                🔮 Live Forecasting Inspector
              </h2>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Inspect Station:</span>
                <select
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  className="bg-[#070a13] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- Select Station --</option>
                  {registeredNodeIds.map((id) => (
                    <option key={id} value={id}>
                      {nodesMeta[id]?.display_name || id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoadingPreds ? (
              <div className="py-12 text-center text-xs text-gray-500 font-mono animate-pulse">
                Fetching predictions for {selectedNode}...
              </div>
            ) : !prediction ? (
              <div className="py-12 text-center text-xs text-gray-500 font-mono">
                No forecasting predictions available for this station. Ensure it is active.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                  <span className="text-gray-500">MODEL TIER:</span>
                  <span className="text-blue-400 font-bold uppercase">{prediction.model_tier}</span>
                  <span className="text-white/10">|</span>
                  <span className="text-gray-500">GENERATED AT:</span>
                  <span className="text-gray-300">{new Date(prediction.generated_at).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {prediction.horizons.map((horizon) => {
                    const confidenceColor = horizon.confidence >= 0.85
                      ? 'border-green-500/25 bg-green-500/[0.01] hover:border-green-500/40 shadow-green-500/2'
                      : horizon.confidence >= 0.60
                        ? 'border-yellow-500/25 bg-yellow-500/[0.01] hover:border-yellow-500/40 shadow-yellow-500/2'
                        : 'border-red-500/25 bg-red-500/[0.01] hover:border-red-500/40 shadow-red-500/2';

                    const isHeuristic = horizon.model_type === 'cold_start_heuristic';

                    return (
                      <div
                        key={horizon.horizon_h}
                        className={`border rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all duration-300 shadow-md ${confidenceColor}`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono font-bold text-indigo-400 whitespace-nowrap">
                            {horizon.horizon_h}h Forecast
                          </span>

                          {isHeuristic ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 whitespace-nowrap" title="Heuristic fallback due to lack of historical records">
                              ⚠ Heuristic Fallback
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase whitespace-nowrap">
                              {horizon.model_type.replace('_', ' ')}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-4xl font-black font-mono tracking-tighter text-white">
                            {horizon.pm25_pred}
                          </span>
                          <span className="text-[11px] font-bold text-gray-400 ml-1.5">µg/m³ PM2.5</span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-white/5 font-mono text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-gray-500">90% Range:</span>
                            <span className="text-gray-300">{horizon.pm25_lower} - {horizon.pm25_upper}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Confidence:</span>
                            <span className={`font-bold ${horizon.confidence >= 0.85 ? 'text-green-400' : horizon.confidence >= 0.60 ? 'text-yellow-400' : 'text-red-400'
                              }`}>{Math.round(horizon.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
                      📈 Live Forecast Trend (กราฟพยากรณ์ล่วงหน้า)
                    </h3>
                    <div className="flex gap-3 text-[9px] font-mono">
                      <div className="flex items-center gap-1 text-indigo-400">
                        <span className="w-2.5 h-0.5 bg-indigo-500 inline-block"></span>
                        <span>Forecast Trend</span>
                      </div>
                      <div className="flex items-center gap-1 text-indigo-500/30">
                        <span className="w-2.5 h-2 bg-indigo-500/10 border border-indigo-500/20 inline-block"></span>
                        <span>90% CI Range</span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const currentPm25 = latest[selectedNode]?.reading?.pm?.pm2_5 ?? 15;
                    const f1h = prediction.horizons.find((h) => h.horizon_h === 1);
                    const f3h = prediction.horizons.find((h) => h.horizon_h === 3);
                    const f6h = prediction.horizons.find((h) => h.horizon_h === 6);

                    const pts = [
                      { h: 0, val: currentPm25, low: currentPm25, up: currentPm25 },
                      ...(f1h ? [{ h: 1, val: f1h.pm25_pred, low: f1h.pm25_lower, up: f1h.pm25_upper }] : []),
                      ...(f3h ? [{ h: 3, val: f3h.pm25_pred, low: f3h.pm25_lower, up: f3h.pm25_upper }] : []),
                      ...(f6h ? [{ h: 6, val: f6h.pm25_pred, low: f6h.pm25_lower, up: f6h.pm25_upper }] : [])
                    ];

                    const maxVal = Math.max(...pts.map((p) => p.up), 30);
                    const minVal = Math.min(...pts.map((p) => p.low), 0);
                    const range = (maxVal - minVal) || 1;

                    const chartW = 480;
                    const chartH = 140;
                    const padX = 40;
                    const padY = 15;
                    const plotW = chartW - padX * 2;
                    const plotH = chartH - padY * 2;

                    const getCoords = (h: number, val: number) => {
                      const x = padX + (h / 6) * plotW;
                      const y = chartH - padY - ((val - minVal) / range) * plotH;
                      return { x, y };
                    };

                    const coordPoints = pts.map((p) => getCoords(p.h, p.val));
                    const polylineStr = coordPoints.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

                    const upperPoints = pts.map((p) => getCoords(p.h, p.up));
                    const lowerPoints = [...pts].reverse().map((p) => getCoords(p.h, p.low));
                    const polygonStr = [...upperPoints, ...lowerPoints]
                      .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
                      .join(' ');

                    return (
                      <div className="relative border border-white/5 rounded-2xl p-3 bg-white/[0.01]">
                        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto text-indigo-500">
                          <defs>
                            <linearGradient id="trend-grad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#818cf8" />
                              <stop offset="100%" stopColor="#4f46e5" />
                            </linearGradient>
                          </defs>

                          {Array.from({ length: 4 }).map((_, i) => {
                            const val = minVal + (range / 3) * i;
                            const y = chartH - padY - (i / 3) * plotH;
                            return (
                              <g key={i}>
                                <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                                <text x={padX - 8} y={y + 3} className="fill-gray-500 font-mono text-[8px]" textAnchor="end">
                                  {val.toFixed(0)}
                                </text>
                              </g>
                            );
                          })}

                          {polygonStr && (
                            <polygon
                              points={polygonStr}
                              fill="rgba(99, 102, 241, 0.08)"
                              stroke="rgba(99, 102, 241, 0.15)"
                              strokeWidth="0.5"
                              strokeDasharray="2 2"
                            />
                          )}

                          {polylineStr && (
                            <polyline
                              fill="none"
                              stroke="url(#trend-grad)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={polylineStr}
                            />
                          )}

                          {coordPoints.map((pt, i) => (
                            <g key={i}>
                              <circle cx={pt.x} cy={pt.y} r="3.5" className="fill-indigo-400 stroke-[#070a13]" strokeWidth="1.5" />
                              <text x={pt.x} y={pt.y - 7} className="fill-white font-mono text-[8px] font-bold" textAnchor="middle">
                                {pts[i].val.toFixed(1)}
                              </text>
                            </g>
                          ))}

                          <line x1={padX} y1={padY} x2={padX} y2={chartH - padY} stroke="rgba(255,255,255,0.05)" />
                          <line x1={padX} y1={chartH - padY} x2={chartW - padX} y2={chartH - padY} stroke="rgba(255,255,255,0.05)" />

                          {pts.map((p) => {
                            const c = getCoords(p.h, p.val);
                            return (
                              <text key={p.h} x={c.x} y={chartH - 4} className="fill-gray-500 font-mono text-[8px]" textAnchor="middle">
                                {p.h === 0 ? 'Now (0h)' : `+${p.h}h`}
                              </text>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
                    🛠 Live Model Feature Inputs Debugger (คีย์นำเข้าทำนายจริง)
                  </h3>

                  {prediction.live_features ? (() => {
                    const feats = prediction.live_features;

                    const lagKeys = ["pm25_lag_5m", "pm25_lag_15m", "pm25_lag_30m", "pm25_lag_1h", "pm25_lag_2h", "pm25_lag_6h"];
                    const statKeys = ["pm25_mean_1h", "pm25_mean_3h", "pm25_std_1h", "pm25_trend_1h"];
                    const envKeys = ["temperature", "humidity", "temp_mean_1h", "hum_mean_1h", "iaq"];
                    const timeKeys = ["hour_sin", "hour_cos", "dow_sin", "dow_cos", "is_burning_season", "is_summer", "is_rainy_season"];

                    const renderGroup = (title: string, keys: string[], colorClass: string) => {
                      return (
                        <div className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2">
                          <span className={`block text-[9px] font-mono font-bold ${colorClass} uppercase tracking-wider`}>{title}</span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono">
                            {keys.map((k) => {
                              const v = feats[k];
                              return (
                                <div key={k} className="flex justify-between border-b border-white/[0.02] pb-0.5">
                                  <span className="text-gray-500 truncate max-w-[65%]" title={k}>{k.replace("pm25_", "")}</span>
                                  <span className="text-gray-300 font-bold">{v !== undefined ? v.toFixed(3) : "N/A"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderGroup("Lag Features (ฝุ่นย้อนหลัง)", lagKeys, "text-blue-400")}
                        {renderGroup("Rolling Stats (สถิติย้อนหลัง)", statKeys, "text-indigo-400")}
                        {renderGroup("Weather & Env (สภาพแวดล้อม)", envKeys, "text-emerald-400")}
                        {renderGroup("Time & Season (เวลาและฤดูกาล)", timeKeys, "text-amber-400")}
                      </div>
                    );
                  })() : (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] font-mono text-gray-500 text-center">
                      ℹ Live features debugger is only active when ML model inference is active. Heuristic cold-start doesn't require features.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Performance Diagnostics & Accuracy Metrics */}
      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono mb-4">
                📋 Model Registry (SQLite & joblib PKL)
              </h2>

              {isLoadingModels ? (
                <div className="py-12 text-center text-xs text-gray-500 font-mono animate-pulse">
                  Loading saved ML models from registry...
                </div>
              ) : models.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
                  <span className="block text-2xl mb-2">📦</span>
                  <span className="text-xs font-mono text-gray-500">
                    No trained models registered. Falling back to Cold-Start Heuristics.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/5 text-left font-mono text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Station</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Horizon</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Model Type</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">RMSE</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">MAE</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">MAPE</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Samples</th>
                        <th className="py-3 px-4 font-bold uppercase tracking-wider">Trained At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {models.map((model, idx) => {
                        const isSelected = selectedModelForFeatures?.node_id === model.node_id &&
                          selectedModelForFeatures?.horizon_h === model.horizon_h;
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedModelForFeatures(model)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'hover:bg-white/[0.01]'
                              }`}
                          >
                            <td className="py-3 px-4 text-white font-bold">{model.node_id}</td>
                            <td className="py-3 px-4">
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-bold">
                                {model.horizon_h}h
                              </span>
                            </td>
                            <td className="py-3 px-4 capitalize">{model.model_type}</td>
                            <td className="py-3 px-4 text-emerald-400">{model.rmse}</td>
                            <td className="py-3 px-4">{model.mae}</td>
                            <td className="py-3 px-4 text-blue-400">{model.mape !== undefined ? `${(model.mape * 100).toFixed(1)}%` : 'N/A'}</td>
                            <td className="py-3 px-4 text-gray-400">{model.training_samples}</td>
                            <td className="py-3 px-4 text-gray-500 text-[10px]">
                              {new Date(model.trained_at).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                📈 Actual vs Predicted Time-Series
              </h2>
              {selectedModelForFeatures ? (
                <div className="space-y-4">
                  {selectedModelForFeatures.plot_data ? (() => {
                    const data = selectedModelForFeatures.plot_data;
                    const actuals = data.actuals;
                    const preds = data.predictions;

                    const maxVal = Math.max(...actuals, ...preds, 10);
                    const minVal = Math.min(...actuals, ...preds, 0);
                    const range = (maxVal - minVal) || 1;

                    const chartW = 480;
                    const chartH = 180;
                    const chartPadX = 35;
                    const chartPadY = 15;
                    const plotW = chartW - chartPadX * 2;
                    const plotH = chartH - chartPadY * 2;

                    const getPoints = (arr: number[]) => {
                      const stepX = plotW / (arr.length - 1);
                      return arr.map((val, idx) => {
                        const x = chartPadX + idx * stepX;
                        const y = chartH - chartPadY - ((val - minVal) / range) * plotH;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ');
                    };

                    const actualPoints = getPoints(actuals);
                    const predPoints = getPoints(preds);

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2.5 text-center text-[10px] font-mono">
                          <div className="bg-white/[0.02] border border-white/5 py-2 rounded-xl">
                            <span className="block text-gray-500">RMSE</span>
                            <span className="font-bold text-emerald-400">{selectedModelForFeatures.rmse}</span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 py-2 rounded-xl">
                            <span className="block text-gray-500">MAE</span>
                            <span className="font-bold text-gray-200">{selectedModelForFeatures.mae}</span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 py-2 rounded-xl">
                            <span className="block text-gray-500">MAPE</span>
                            <span className="font-bold text-blue-400">
                              {selectedModelForFeatures.mape !== undefined ? `${(selectedModelForFeatures.mape * 100).toFixed(1)}%` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-center gap-4 text-[9px] font-mono">
                          <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                            <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
                            <span>Actual (ค่าจริง)</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                            <span className="w-3 h-0.5 bg-orange-500 inline-block"></span>
                            <span>Predicted (คาดการณ์)</span>
                          </div>
                        </div>

                        <div className="relative border border-white/5 rounded-2xl p-2 bg-white/[0.01]">
                          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
                            {Array.from({ length: 4 }).map((_, i) => {
                              const val = minVal + (range / 3) * i;
                              const y = chartH - chartPadY - (i / 3) * plotH;
                              return (
                                <g key={i}>
                                  <line x1={chartPadX} y1={y} x2={chartW - chartPadX} y2={y} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                                  <text x={chartPadX - 5} y={y + 3} className="fill-gray-500 font-mono text-[8px]" textAnchor="end">{val.toFixed(0)}</text>
                                </g>
                              );
                            })}

                            {actualPoints && (
                              <polyline
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={actualPoints}
                                className="opacity-75"
                              />
                            )}

                            {predPoints && (
                              <polyline
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={predPoints}
                                className="opacity-90"
                              />
                            )}

                            <line x1={chartPadX} y1={chartPadY} x2={chartPadX} y2={chartH - chartPadY} stroke="rgba(255,255,255,0.05)" />
                            <line x1={chartPadX} y1={chartH - chartPadY} x2={chartW - chartPadX} y2={chartH - padding} stroke="rgba(255,255,255,0.05)" />
                            <text x={chartPadX} y={chartH - 4} className="fill-gray-500 font-mono text-[8px]" textAnchor="start">Earlier Samples</text>
                            <text x={chartW - chartPadX} y={chartH - 4} className="fill-gray-500 font-mono text-[8px]" textAnchor="end">Latest (120 pts)</text>
                          </svg>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 space-y-2 text-xs">
                      <div className="font-bold text-yellow-400 flex items-center gap-1.5">
                        ⚠ Retrain Required
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        โมเดลเก่ารุ่นนี้ยังไม่มีการบันทึกชุดข้อมูลสถิติประวัติสำหรับพลอตกราฟ กรุณาคลิก Retrain ด้านบนเพื่อสร้างข้อมูลพลอตกราฟเปรียบเทียบในแบบเรียลไทม์
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-gray-500">
                  Select a model from the registry table to view Actual vs Predicted curve.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                🎯 Classification Evaluation Metrics
              </h2>
              {selectedModelForFeatures ? (
                <div className="space-y-4">
                  {selectedModelForFeatures.classification_metrics ? (() => {
                    const metrics = selectedModelForFeatures.classification_metrics;
                    const confMat = metrics.confusion_matrix;

                    const getCellBg = (val: number, isDiagonal: boolean) => {
                      if (val === 0) return 'bg-white/[0.01] text-gray-600';
                      if (isDiagonal) {
                        if (val > 100) return 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/20';
                        if (val > 20) return 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/10';
                        return 'bg-emerald-500/10 text-emerald-400';
                      } else {
                        if (val > 50) return 'bg-red-500/25 text-red-300 border border-red-500/20';
                        if (val > 10) return 'bg-red-500/15 text-red-400 border border-red-500/10';
                        return 'bg-red-500/5 text-red-400';
                      }
                    };

                    return (
                      <div className="space-y-4">
                        <p className="text-[11px] text-gray-400">
                          ประสิทธิภาพในการแบ่งช่วงระดับคุณภาพอากาศเพื่อแจ้งเตือนภัย (Good / Moderate / Unhealthy):
                        </p>

                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                            <span className="block text-[8px] font-mono font-bold text-gray-500 uppercase">Accuracy</span>
                            <span className="text-lg font-black font-mono text-white">{(metrics.accuracy * 100).toFixed(1)}%</span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                            <span className="block text-[8px] font-mono font-bold text-gray-500 uppercase">F1-Score</span>
                            <span className="text-lg font-black font-mono text-blue-400">{(metrics.f1 * 100).toFixed(1)}%</span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                            <span className="block text-[8px] font-mono font-bold text-gray-500 uppercase">Precision</span>
                            <span className="text-sm font-bold font-mono text-gray-300">{(metrics.precision * 100).toFixed(1)}%</span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                            <span className="block text-[8px] font-mono font-bold text-gray-500 uppercase">Recall</span>
                            <span className="text-sm font-bold font-mono text-gray-300">{(metrics.recall * 100).toFixed(1)}%</span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2">
                          <div className="text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wide">
                            📊 Confusion Matrix (True vs Pred)
                          </div>
                          <div className="relative p-2.5 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col items-center">
                            <div className="text-[8px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-1.5 text-center">
                              Predicted Level (ผลทำนาย)
                            </div>

                            <div className="grid grid-cols-4 gap-1.5 w-full text-center text-[9px] font-mono">
                              <div></div>
                              <div className="text-[8px] text-gray-500 font-bold truncate">Good</div>
                              <div className="text-[8px] text-gray-500 font-bold truncate">Mod</div>
                              <div className="text-[8px] text-gray-500 font-bold truncate">Unhealth</div>

                              <div className="text-[8px] text-gray-500 font-bold text-right flex items-center justify-end pr-1">Good</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[0][0], true)}`}>{confMat[0][0]}</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[0][1], false)}`}>{confMat[0][1]}</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[0][2], false)}`}>{confMat[0][2]}</div>

                              <div className="text-[8px] text-gray-500 font-bold text-right flex items-center justify-end pr-1">Mod</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[1][0], false)}`}>{confMat[1][0]}</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[1][1], true)}`}>{confMat[1][1]}</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[1][2], false)}`}>{confMat[1][2]}</div>

                              <div className="text-[8px] text-gray-500 font-bold text-right flex items-center justify-end pr-1">Unhealth</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[2][0], false)}`}>{confMat[2][0]}</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[2][1], false)}`}>{confMat[2][1]}</div>
                              <div className={`p-2 rounded-lg ${getCellBg(confMat[2][2], true)}`}>{confMat[2][2]}</div>
                            </div>

                            <div className="text-[8px] font-mono font-bold text-gray-500 uppercase tracking-widest mt-2">
                              True Level (ค่าจริง)
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-white/5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wide">
                            <span>🎯 90% Confidence Calibration</span>
                            <span className="text-blue-400 font-mono">
                              {selectedModelForFeatures.coverage_rate !== undefined ? `${(selectedModelForFeatures.coverage_rate * 100).toFixed(1)}%` : "N/A"}
                            </span>
                          </div>
                          <p className="text-[9px] text-gray-500 font-mono leading-relaxed">
                            Coverage Probability: อัตราที่ฝุ่นจริงตกอยู่ในกรอบพยากรณ์ 90% Confidence Interval (เป้าหมาย 90.0%)
                          </p>
                          {selectedModelForFeatures.coverage_rate !== undefined && (
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  selectedModelForFeatures.coverage_rate >= 0.88 ? "bg-emerald-500" : selectedModelForFeatures.coverage_rate >= 0.80 ? "bg-yellow-500" : "bg-red-500"
                                }`}
                                style={{ width: `${selectedModelForFeatures.coverage_rate * 100}%` }}
                              ></div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 pt-4 border-t border-white/5">
                          <div className="text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wide">
                            📊 Error Residuals Distribution (การกระจายของความผิดพลาด)
                          </div>
                          {selectedModelForFeatures.residuals_distribution ? (() => {
                            const dist = selectedModelForFeatures.residuals_distribution;
                            const maxCount = Math.max(...dist.counts, 1);

                            return (
                              <div className="space-y-3">
                                <div className="relative border border-white/5 rounded-2xl p-2.5 bg-white/[0.01]">
                                  <svg viewBox="0 0 240 70" className="w-full h-auto">
                                    <line x1="120" y1="5" x2="120" y2="55" stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2" />
                                    <text x="120" y="65" className="fill-gray-500 font-mono text-[7px]" textAnchor="middle">0 (ตรงเป้า)</text>
                                    <text x="15" y="65" className="fill-red-400 font-mono text-[6px]" textAnchor="start">← Under-predict</text>
                                    <text x="225" y="65" className="fill-blue-400 font-mono text-[6px]" textAnchor="end">Over-predict →</text>

                                    {dist.counts.map((count, i) => {
                                      const barW = 16;
                                      const barSpace = 2;
                                      const barH = (count / maxCount) * 45;
                                      const x = 15 + i * (barW + barSpace);
                                      const y = 50 - barH;

                                      let fill = "fill-emerald-500/50 stroke-emerald-500/30";
                                      if (i < 3) fill = "fill-red-500/40 stroke-red-500/20";
                                      if (i > 6) fill = "fill-blue-500/40 stroke-blue-500/20";

                                      return (
                                        <rect
                                          key={i}
                                          x={x}
                                          y={y}
                                          width={barW}
                                          height={barH}
                                          className={`${fill} transition-all duration-300`}
                                          strokeWidth="0.5"
                                        >
                                          <title>{`Count: ${count}`}</title>
                                        </rect>
                                      );
                                    })}
                                  </svg>
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="text-[10px] text-gray-500 font-mono text-center">
                              No residuals data available.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 space-y-2 text-xs">
                      <div className="font-bold text-yellow-400 flex items-center gap-1.5">
                        ⚠ Retrain Required
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        โมเดลนี้ได้รับการเทรนด้วยระบบเวอร์ชันก่อนหน้า จึงยังไม่มีการเก็บสถิติเตือนภัย กรุณาคลิก Retrain ด้านบนเพื่อคำนวณ Accuracy และสร้าง Confusion Matrix ใหม่
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-gray-500">
                  Select a model from the registry table to view classification performance.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Feature Attribution & Configurations */}
      {activeTab === 'features' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left 2 Columns */}
          <div className="xl:col-span-2 space-y-6">
            {/* Feature Importance Analysis Card */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                📊 Feature Importance Attribution
              </h2>
              {selectedModelForFeatures ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                    <div>
                      <span className="block text-[10px] font-mono font-bold text-blue-400">ACTIVE MODEL</span>
                      <span className="text-xs font-mono font-bold text-white uppercase">
                        {selectedModelForFeatures.node_id} ({selectedModelForFeatures.horizon_h}h)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase">
                      {selectedModelForFeatures.model_type}
                    </span>
                  </div>

                  {selectedModelForFeatures.feature_names && selectedModelForFeatures.feature_importances && selectedModelForFeatures.feature_names.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      <p className="text-[11px] text-gray-400">
                        อัตราส่วนความสำคัญของฟีเจอร์ต่าง ๆ (Information Gain) ที่โมดูล XGBoost/LightGBM ใช้ประกอบการทำนายระดับฝุ่น PM2.5:
                      </p>

                      <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                        {(() => {
                          const mapped = selectedModelForFeatures.feature_names.map((name, i) => ({
                            name,
                            importance: selectedModelForFeatures.feature_importances?.[i] ?? 0
                          })).sort((a, b) => b.importance - a.importance);

                          const maxVal = Math.max(...mapped.map(m => m.importance), 0.0001);

                          return mapped.map(item => (
                            <div key={item.name} className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-gray-300 truncate max-w-[70%]">{item.name}</span>
                                <span className="text-blue-400 font-bold">{(item.importance * 100).toFixed(2)}%</span>
                              </div>
                              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${(item.importance / maxVal) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Model Training Hyperparameters Details */}
                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wide">🔧 Calibration Config</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono text-gray-400">
                          <div className="flex justify-between border-b border-white/[0.03] pb-1">
                            <span className="text-gray-500">Estimators:</span>
                            <span className="text-gray-200 font-bold">{selectedModelForFeatures.estimators ?? 150} trees</span>
                          </div>
                          <div className="flex justify-between border-b border-white/[0.03] pb-1">
                            <span className="text-gray-500">Learning Rate:</span>
                            <span className="text-gray-200 font-bold">{selectedModelForFeatures.learning_rate ?? 0.08}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">CV Splits:</span>
                            <span className="text-gray-200 font-bold">{selectedModelForFeatures.cv_folds ?? 3} folds</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Train Period:</span>
                            <span className="text-gray-200 font-bold">{selectedModelForFeatures.training_days ?? 90} Days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                      <span className="block text-xs font-mono text-gray-500">
                        No importance data loaded. Click 'Run Retrain' to train a new model containing detailed feature contributions.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-gray-500">
                  Select a model from the registry table to view feature contributions.
                </div>
              )}
            </div>

            {/* Heuristic Hourly Multiplier */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                📈 Diurnal Seasonal Factors (Tier 1 Heuristic)
              </h2>
              <p className="text-[11px] text-gray-400">
                ค่าตัวคูณทางสถิติตามชั่วโมงในแต่ละวัน (Hourly Seasonal Multiplier) ที่ใช้ในการคาดการณ์ในกรณีที่ข้อมูลประวัติไม่เพียงพอ (Cold-Start)
              </p>

              <div className="relative border border-white/5 rounded-2xl p-2 bg-white/[0.01]">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto text-blue-500">
                  <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                  <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="rgba(255,255,255,0.05)" />
                  <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="rgba(255,255,255,0.05)" />

                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    points={points}
                    className="text-blue-500"
                  />

                  {hours.map((hour, index) => {
                    const factor = factors[index];
                    const x = padding + (hour / 23) * graphWidth;
                    const y = svgHeight - padding - ((factor - minF) / rangeF) * graphHeight;
                    return (
                      <circle
                        key={hour}
                        cx={x}
                        cy={y}
                        r="2.5"
                        className="fill-indigo-400 stroke-[#070a13]"
                        strokeWidth="1"
                      />
                    );
                  })}

                  <text x={padding} y={svgHeight - 8} className="fill-gray-500 font-mono text-[9px]" textAnchor="middle">00h</text>
                  <text x={padding + graphWidth / 2} y={svgHeight - 8} className="fill-gray-500 font-mono text-[9px]" textAnchor="middle">12h</text>
                  <text x={svgWidth - padding} y={svgHeight - 8} className="fill-gray-500 font-mono text-[9px]" textAnchor="middle">23h</text>

                  <text x={svgWidth - 6} y={padding + 3} className="fill-emerald-400 font-mono text-[8px] text-right" textAnchor="end">Max: 1.18</text>
                  <text x={svgWidth - 6} y={svgHeight - padding} className="fill-red-400 font-mono text-[8px] text-right" textAnchor="end">Min: 0.77</text>
                </svg>
              </div>

              <div className="font-mono text-[10px] text-gray-500 space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between">
                  <span>Morning Traffic peak (08:00):</span>
                  <span className="text-gray-300 font-bold">1.18x multiplier</span>
                </div>
                <div className="flex justify-between">
                  <span>Evening Traffic peak (18:00):</span>
                  <span className="text-gray-300 font-bold">1.12x multiplier</span>
                </div>
                <div className="flex justify-between">
                  <span>Night atmospheric dip (03:00):</span>
                  <span className="text-gray-300 font-bold">0.77x multiplier</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 1 Column */}
          <div className="space-y-6">
            {/* ML Ingestion Specs */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                ⚙️ Pipeline Specifications
              </h2>
              <div className="space-y-3 text-xs text-gray-300">
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl space-y-1">
                  <span className="block text-[10px] font-mono font-bold text-blue-400">INPUT CHANNELS</span>
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    Lags 5m, 15m, 30m, 1h, 2h, 6h ของ PM2.5, ค่าความเบี่ยงเบนสะสม Rolling Mean/Std, อุณหภูมิ, ความชื้น, IAQ, CO₂eq และ Cyclical time encode (sine/cosine)
                  </p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl space-y-1">
                  <span className="block text-[10px] font-mono font-bold text-blue-400">VALIDATION CRITERIA</span>
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    แบ่งข้อมูลอนุกรมเวลาด้วย TimeSeriesSplit 3-fold cross validation ปรับลดเป้าการรันใน debug เหลือ 100 จุดประวัติ
                  </p>
                </div>
              </div>
            </div>

            {/* Thai Seasons Calendar Information Card */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">
                📅 Thai Seasons Calendar & ML Ingress
              </h2>
              <p className="text-[11px] text-gray-400">
                สถานะฤดูกาลปัจจุบันตามปฏิทินไทยปี 2026 ซึ่งมีผลโดยตรงต่อการวิเคราะห์และถ่วงน้ำหนักการพยากรณ์มลพิษฝุ่น PM2.5:
              </p>

              {(() => {
                const now = new Date();
                const month = now.getMonth() + 1;
                const date = now.getDate();

                let seasonName = '';
                let seasonIcon = '';
                let seasonDesc = '';
                let isWinter = false;
                let isSummer = false;
                let isRainy = false;

                const dayIndex = month * 100 + date;

                if (dayIndex >= 1016 || dayIndex <= 215) {
                  seasonName = 'ฤดูหนาว & ฤดูหมอกควัน (Winter/Burning Season)';
                  seasonIcon = '🍂 🔥';
                  seasonDesc = 'ช่วงอับอากาศ (Air Stagnation) และการเผาชีวมวลในที่โล่ง เป็นช่วงวิกฤตที่มีการสะสมของฝุ่น PM2.5 สูงสุดของปี โมเดล ML จะใช้ฟีเจอร์ is_burning_season เป็นเกณฑ์สำคัญ';
                  isWinter = true;
                } else if (dayIndex >= 216 && dayIndex <= 515) {
                  seasonName = 'ฤดูร้อน (Summer Season)';
                  seasonIcon = '☀️ 🌡️';
                  seasonDesc = 'อากาศร้อนและแห้ง มีอัตราการฟุ้งกระจายของฝุ่นขึ้นสู่ชั้นบรรยากาศค่อนข้างสูงตามการเคลื่อนย้ายของกระแสลมร้อน แต่ระดับความรุนแรงปานกลาง';
                  isSummer = true;
                } else {
                  seasonName = 'ฤดูฝน (Rainy Season)';
                  seasonIcon = '🌧️ ⛈️';
                  seasonDesc = 'ฝนตกช่วยล้างมลพิษฝุ่น PM2.5 (Precipitation Washout) ทำให้ปริมาณฝุ่นเฉลี่ยในแต่ละวันอยู่ในเกณฑ์ต่ำมาก';
                  isRainy = true;
                }

                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.02] space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{seasonIcon}</span>
                        <span className="text-xs font-mono font-bold text-white uppercase">ฤดูกาลปัจจุบัน:</span>
                      </div>
                      <div className="text-sm font-bold text-blue-400">{seasonName}</div>
                      <p className="text-[11px] leading-relaxed text-gray-300">{seasonDesc}</p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-white/5 text-[10px] font-mono">
                      <div className={`flex justify-between items-center p-2 rounded-xl border ${isWinter ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' : 'border-white/5 bg-white/[0.01] text-gray-500'}`}>
                        <span>🍂 ฤดูหนาว / ลมสงบ & เผาชีวมวล</span>
                        <span className="font-bold">16 ต.ค. - 15 ก.พ.</span>
                      </div>
                      <div className={`flex justify-between items-center p-2 rounded-xl border ${isSummer ? 'border-orange-500/20 bg-orange-500/5 text-orange-400' : 'border-white/5 bg-white/[0.01] text-gray-500'}`}>
                        <span>☀️ ฤดูร้อน / ลมกระโชก & แห้งแล้ง</span>
                        <span className="font-bold">16 ก.พ. - 15 พ.ค.</span>
                      </div>
                      <div className={`flex justify-between items-center p-2 rounded-xl border ${isRainy ? 'border-sky-500/20 bg-sky-500/5 text-sky-400' : 'border-white/5 bg-white/[0.01] text-gray-500'}`}>
                        <span>🌧️ ฤดูฝน / ล้างมลพิษชะล้างน้ำฝน</span>
                        <span className="font-bold">16 พ.ค. - 15 ต.ค.</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
