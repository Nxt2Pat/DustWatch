import SchoolMap from '../components/SchoolMap';
import { MapPin, ShieldCheck, Info } from 'lucide-react';
import { useStore } from '../store';

export default function CampusMapPage() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  const activeNodesCount = Object.entries(latest).filter(([id]) => {
    const meta = nodesMeta[id];
    return !meta || meta.active !== 0;
  }).length;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-emerald-600 font-bold uppercase block mb-0.5">
            Interactive 3D Campus - โรงเรียนเทพศิรินทร์ สมุทรปราการ
          </span>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <MapPin size={22} className="text-emerald-600" />
            แผนที่ 3 มิติตรวจวัดคุณภาพอากาศรอบอาคารเรียน
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <ShieldCheck size={16} />
          <span>เซนเซอร์เปิดใช้งาน {activeNodesCount} จุด</span>
        </div>
      </div>

      {/* 3D Map Component Container */}
      <SchoolMap />

      {/* Campus Location Guide Card */}
      <div className="premium-card p-5 bg-white space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Info size={16} className="text-emerald-600" />
          คำแนะนำการใช้งานแผนที่ 3 มิติ (3D Campus Guide)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block mb-1">1. คลิกเลือกอาคาร</span>
            <span>หมุนหรือคลิกที่กล่องอาคารเรียนเพื่อดูรายละเอียดเซนเซอร์และค่าฝุ่นเรียลไทม์</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block mb-1">2. กรองตามชั้นเรียน</span>
            <span>ใช้ปุ่มกรอง "ชั้น 1, ชั้น 2, ชั้น 3" เพื่อดูคลื่นการกระจายฝุ่นแบบระเบิดชั้น (Exploded View)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800 block mb-1">3. สัญลักษณ์สีฝุ่น</span>
            <span>เขียว = อากาศดี, เหลือง = ปานกลาง, ส้ม = เริ่มมีผลกระทบ, แดง = มีผลต่อสุขภาพ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
