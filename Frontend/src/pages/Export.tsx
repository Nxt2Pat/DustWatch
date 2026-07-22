import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { request } from '../api/client';
import { Check, Download, Table, Loader2 } from 'lucide-react';

interface PreviewPoint {
  timestamp: string;
  pm2_5: number;
  pm10?: number;
  iaq?: number;
  co2_eq?: number;
  temperature?: number;
  humidity?: number;
  rssi?: number;
}

export default function Export() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // List of active node IDs
  const activeNodeIds = Object.keys(latest).filter(
    (id) => !nodesMeta[id] || nodesMeta[id].active !== 0
  );

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getPastDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  // States
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(getPastDateStr(7));
  const [endDate, setEndDate] = useState(getTodayStr());
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewPoint[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-select first node
  useEffect(() => {
    if (activeNodeIds.length > 0 && selectedNodes.length === 0) {
      setSelectedNodes([activeNodeIds[0]]);
    }
  }, [activeNodeIds, selectedNodes]);

  // Load preview data when inputs change
  useEffect(() => {
    const fetchPreview = async () => {
      if (selectedNodes.length === 0) {
        setPreviewData([]);
        return;
      }
      setIsPreviewLoading(true);
      setErrorMsg(null);

      const primaryNode = selectedNodes[0];
      const response = await request<PreviewPoint[]>(
        `/readings/${primaryNode}/history?start=${startDate}T00:00:00Z&stop=${endDate}T23:59:59Z&interval=1h`
      );

      setIsPreviewLoading(false);
      if (response.ok && response.data) {
        setPreviewData(response.data.slice(0, 30));
      } else {
        console.error('Failed to load export preview:', response.error);
        setPreviewData([]);
      }
    };

    fetchPreview();
  }, [selectedNodes, startDate, endDate]);

  const toggleNodeSelection = (nodeId: string) => {
    setSelectedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNodes.length === 0) {
      setErrorMsg('กรุณาเลือกอย่างน้อย 1 ห้องเรียนที่ต้องการดาวน์โหลดรายงาน');
      return;
    }

    setIsExporting(true);
    setErrorMsg(null);

    const payload = {
      node_ids: selectedNodes,
      start_date: startDate,
      end_date: endDate,
      format: exportFormat
    };

    const response = await request<string>('/export', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setIsExporting(false);

    if (response.ok && response.data) {
      const mimeType = exportFormat === 'csv' ? 'text/csv' : 'application/json';
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dustwatch_export_${startDate}_to_${endDate}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      setErrorMsg(response.error || 'ดาวน์โหลดไฟล์ล้มเหลว กรุณาลองตรวจสอบขอบเขตวันใหม่อีกครั้ง');
    }
  };

  return (
    <div className="space-y-6 relative z-10 max-w-6xl mx-auto pb-12 fade-up">
      {/* Form configuration container */}
      <form onSubmit={handleExportSubmit} className="glass-card p-6 md:p-8 space-y-5 font-sans">
        {/* Node selector multi-select */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 font-sans">
            เลือกห้องเรียนที่ต้องการบันทึกไฟล์ (Selected Rooms)
          </label>
          <div className="flex flex-wrap gap-2">
            {activeNodeIds.map((id) => {
              const displayName = nodesMeta[id]?.display_name || latest[id]?.reading.location || id;
              const isSelected = selectedNodes.includes(id);

              return (
                <button
                  type="button"
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

        {/* Date picking - OS native picker design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              ตั้งแต่วันที่ (From Date)
            </label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-full px-4 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#0CA4A4] focus:ring-2 focus:ring-[#0CA4A4]/20 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              ถึงวันที่ (To Date)
            </label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white/70 backdrop-blur-md border border-gray-200/80 rounded-full px-4 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:border-[#0CA4A4] focus:ring-2 focus:ring-[#0CA4A4]/20 transition-all"
              required
            />
          </div>
        </div>

        {/* Export format pill toggler */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-2">
            รูปแบบประเภทไฟล์ (File Format)
          </label>
          <div className="flex bg-gray-100/80 backdrop-blur-md p-1.5 rounded-full w-fit border border-gray-200/60">
            <button
              type="button"
              onClick={() => setExportFormat('csv')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                exportFormat === 'csv'
                  ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ตาราง CSV (Excel)
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('json')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                exportFormat === 'json'
                  ? 'bg-[#0CA4A4] text-white shadow-md shadow-[#0CA4A4]/25'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ข้อมูลดิบ JSON
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 text-rose-700 border border-rose-500/20 text-xs px-4 py-3 rounded-2xl">
            {errorMsg}
          </div>
        )}

        {/* Large Submit button optimized for thumb zones */}
        <button
          type="submit"
          disabled={isExporting}
          className="w-full bg-[#0CA4A4] hover:bg-[#088383] disabled:bg-gray-300 text-white font-bold rounded-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0CA4A4]/25 transition-all cursor-pointer font-sans active:scale-[0.99]"
        >
          {isExporting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>กำลังดึงข้อมูลรายงาน...</span>
            </>
          ) : (
            <>
              <Download size={16} />
              <span>ดึงข้อมูลและดาวน์โหลดรายงาน</span>
            </>
          )}
        </button>
      </form>

      {/* Preview Table */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4 font-sans">
          <Table size={18} className="text-[#0CA4A4]" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
            ตารางตัวอย่างข้อมูลล่าสุด (Preview - สูงสุด 30 บรรทัด)
          </span>
        </div>

        {isPreviewLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-[#0CA4A4]" size={28} />
          </div>
        ) : previewData.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            ไม่มีประวัติข้อมูลในช่วงเวลานี้
          </div>
        ) : (
          <div className="relative overflow-x-auto border border-gray-200/60 rounded-2xl max-h-[320px] overflow-y-auto no-scrollbar shadow-xs bg-white/60 backdrop-blur-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100/80 text-gray-600 font-sans sticky top-0 z-20 border-b border-gray-200/60">
                <tr>
                  <th className="sticky left-0 bg-gray-100 px-4 py-3 z-30 font-bold border-r border-gray-200/60 min-w-[120px]">
                    วัน-เวลาตรวจวัด
                  </th>
                  <th className="px-4 py-3 min-w-[70px]">PM2.5</th>
                  <th className="px-4 py-3 min-w-[70px]">PM10</th>
                  <th className="px-4 py-3 min-w-[70px]">คุณภาพอากาศ (IAQ)</th>
                  <th className="px-4 py-3 min-w-[70px]">อุณหภูมิ</th>
                  <th className="px-4 py-3 min-w-[70px]">ความชื้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900 font-mono">
                {previewData.map((point, index) => {
                  const localTime = new Date(point.timestamp).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const localDate = new Date(point.timestamp).toLocaleDateString('th-TH', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <tr key={index} className="hover:bg-[#0CA4A4]/5">
                      <td className="sticky left-0 bg-white px-4 py-2.5 z-10 font-medium border-r border-gray-100 text-gray-900">
                        {localDate} {localTime} น.
                      </td>
                      <td className="px-4 py-2.5 font-bold text-[#0CA4A4]">{point.pm2_5?.toFixed(1) || '--'}</td>
                      <td className="px-4 py-2.5">{point.pm10?.toFixed(1) || '--'}</td>
                      <td className="px-4 py-2.5">{point.iaq ? Math.round(point.iaq) : '--'}</td>
                      <td className="px-4 py-2.5">{point.temperature?.toFixed(1) || '--'}</td>
                      <td className="px-4 py-2.5">{point.humidity?.toFixed(1) || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

