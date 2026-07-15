import { useSEO } from '../hooks/useSEO';
import { Link } from 'react-router-dom';

export default function NSCDetails() {
  useSEO(
    'เกี่ยวกับโครงงาน DustWatch | NSC 2026',
    'รายละเอียดการพัฒนาโครงงาน DustWatch เครือข่ายตรวจวัดฝุ่นและพยากรณ์คุณภาพอากาศอัจฉริยะ การแข่งขัน NSC 2026'
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back Button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:text-white hover:bg-white/10 text-xs font-bold font-mono text-gray-400 transition-all cursor-pointer"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Hero Header */}
      <div className="p-8 rounded-3xl border border-white/5 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-white/[0.01] backdrop-blur-md space-y-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-widest font-mono">
            National Software Contest (NSC 2026)
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-2">
            🌬️ DustWatch
          </h1>
          <p className="text-sm font-bold text-gray-300 font-mono uppercase tracking-wider">
            เครือข่ายตรวจวัดฝุ่นและพยากรณ์คุณภาพอากาศอัจฉริยะในสถานศึกษา
          </p>
          <p className="text-xs text-gray-400 max-w-2xl leading-relaxed pt-2">
            โครงการในประเภทโปรแกรมเพื่อการประยุกต์ใช้งาน ที่บูรณาการเทคโนโลยี Iot และโมเดล ML เพื่อส่งเสริมความปลอดภัยและป้องกันอันตรายจากมลพิษทางอากาศภายในสถานศึกษาและห้องเรียนอย่างมีประสิทธิภาพ
          </p>
        </div>
      </div>

      {/* 2-Column Grid Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left Column: Project Overview & Features */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-white/5 pb-2">
              📌 รายละเอียดและที่มาของโครงงาน
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              มลพิษทางอากาศจากฝุ่นละอองขนาดเล็กในประเทศไทย มีแนวโน้มทวีความรุนแรงมากขึ้นในช่วงฤดูหนาวและฤดูหมอกควัน
              ซึ่งสถานศึกษาเป็นสถานที่ที่มีกลุ่มประชากรเปราะบาง เช่น เด็กนักเรียนและครู อยู่หนาแน่นและต้องเผชิญกับมลพิษเป็นเวลานานในแต่ละวัน
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">
              <strong>DustWatch</strong> จึงถูกพัฒนาขึ้นในฐานะโครงงานเพื่อสร้างระบบนิเวศน์ตรวจวัด ที่จะส่งค่าฝุ่น PM2.5, PM10, อุณหภูมิ, ความชื้น
              จากในแต่ละห้องเรียนส่งเข้าสู่เซิร์ฟเวอร์ส่วนกลางผ่านโปรโตคอล MQTT และทำการพยากรณ์ระดับฝุ่นล่วงหน้า 1, 3 และ 6 ชั่วโมงด้วยโมเดล ML เพื่อช่วยให้ผู้บริหารสถานศึกษาสามารถตัดสินใจในกิจกรรมกลางแจ้ง
            </p>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h2 className="text-base font-bold text-white border-b border-white/5 pb-2">
              🛠️ สถาปัตยกรรมระบบ (System Architecture)
            </h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="text-lg shrink-0 mt-0.5">📟</span>
                <div>
                  <h4 className="text-xs font-bold text-blue-400 font-mono">1. Hardware & IoT Edge Node</h4>
                  <p className="text-[11px] text-gray-400 mt-1">บอร์ดไมโครคอนโทรลเลอร์เชื่อมต่อกับเซ็นเซอร์วัดฝุ่นด้วยเลเซอร์ (Laser PM Sensor) และเซ็นเซอร์อุณหภูมิ/ความชื้น ส่งข้อมูลแบบไร้สายผ่านโปรโตคอล MQTT พร้อมระบบตรวจวัดคุณภาพข้อมูล (DCS - Data Completeness Score) เพื่อขจัดสัญญาณรบกวน</p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-white/5 pt-4">
                <span className="text-lg shrink-0 mt-0.5">🖥️</span>
                <div>
                  <h4 className="text-xs font-bold text-blue-400 font-mono">2. Backend Web Server (FastAPI)</h4>
                  <p className="text-[11px] text-gray-400 mt-1">สร้างด้วยภาษา Python (FastAPI) ทำการเชื่อมต่อรับสัญญาณ telemetry และประมวลผลข้อมูลลงฐานข้อมูลเวลา (Time-Series InfluxDB) และระบบฐานข้อมูลเมทาดาต้าสถานี (SQLite)</p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-white/5 pt-4">
                <span className="text-lg shrink-0 mt-0.5">🧠</span>
                <div>
                  <h4 className="text-xs font-bold text-blue-400 font-mono">3. ML Prediction Pipeline</h4>
                  <p className="text-[11px] text-gray-400 mt-1">โมเดล XGBoost และ LightGBM คาดการณ์ล่วงหน้า 1h, 3h, 6h โดยใช้ฟีเจอร์ Lags, Rolling averages และตัวแปรปฏิทินฤดูกาลของไทยเพื่อเพิ่มความแม่นยำในการทำนายสูงสุด</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Developers & Team */}
        <div className="space-y-6">

          {/* Creators Card */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-white/5 pb-2">
              👥 ผู้จัดทำโครงงาน
            </h2>
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl space-y-1.5">
                <span className="block text-[10px] text-blue-400 font-bold">คณะผู้จัดทำ</span>
                <div className="text-white font-bold">นายธีรัชชัย ผาสุขพันธ์</div>
                <div className="text-white font-bold">นายณัฐภัทร ปัดไธสง</div>
                <div className="text-white font-bold">นายณภัทร แสนสมบัติ</div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                <span className="block text-[10px] text-blue-400 font-bold">อาจารย์ที่ปรึกษาโครงงาน</span>
                <div className="text-white font-bold mt-1">นายธีรภัทร เสียมไหม</div>
              </div>
            </div>
          </div>

          {/* Season Awareness details */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-white/5 pb-2">
              🍂 Season-Aware AI
            </h2>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              โมเดลคาดการณ์ของระบบประกอบด้วยตัวแปรปฏิทินฤดูกาลของประเทศไทย เพื่อให้ระบบตระหนักรู้สภาวะอากาศที่มีฝุ่นหนาแน่นต่างกันในแต่ละรอบปี:
            </p>
            <div className="space-y-1.5 text-[10px] font-mono">
              <div className="flex justify-between text-amber-400">
                <span>🍂 ฤดูหนาว (Burning)</span>
                <span>16 ต.ค. - 15 ก.พ.</span>
              </div>
              <div className="flex justify-between text-orange-400">
                <span>☀️ ฤดูร้อน (Summer)</span>
                <span>16 ก.พ. - 15 พ.ค.</span>
              </div>
              <div className="flex justify-between text-sky-400">
                <span>🌧️ ฤดูฝน (Rainy)</span>
                <span>16 พ.ค. - 15 ต.ค.</span>
              </div>
            </div>
          </div>

          {/* NSC Specs */}
          <div className="glass-card p-6 space-y-3 font-mono text-[10px] text-gray-500">
            <div className="flex justify-between">
              <span>ประเภทการประกวด:</span>
              <span className="text-gray-300 font-bold">โปรแกรมเพื่อการประยุกต์ใช้งาน</span>
            </div>
            <div className="flex justify-between">
              <span>การแข่งขัน:</span>
              <span className="text-gray-300 font-bold">NSC 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
