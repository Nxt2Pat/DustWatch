import { NavLink } from 'react-router-dom';
import { Wind, MapPin } from 'lucide-react';
import { DataSourceBadge } from '../DataSourceBadge';

interface TopNavBarProps {
  isConnected: boolean;
}


export default function TopNavBar({ isConnected }: TopNavBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/60 py-3 px-4 sm:px-8 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="bg-[#0CA4A4] text-white p-2.5 rounded-2xl shadow-md shadow-[#0CA4A4]/20 flex items-center justify-center">
          <Wind size={20} className="animate-pulse" />
        </div>
        <div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900 flex items-center gap-2 font-sans">
            DustWatch
            <span className="bg-[#0CA4A4]/10 text-[#0CA4A4] text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border border-[#0CA4A4]/25">
              SCHOOL
            </span>
          </span>
          <span className="text-[11px] text-gray-500 font-medium block -mt-0.5 hidden sm:block">
            โรงเรียนเทพศิรินทร์ สมุทรปราการ (Debsirin Samutprakan School)
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-4 sm:gap-6">
        <nav className="hidden md:flex items-center gap-1.5 bg-gray-100/70 p-1.5 rounded-full border border-gray-200/60 backdrop-blur-md text-xs font-semibold">
          <NavLink 
            to="/" 
            end
            className={({ isActive }) => 
              `px-4 py-1.5 rounded-full transition-all duration-200 ${
                isActive 
                  ? 'bg-white text-[#0CA4A4] font-bold shadow-xs border border-white/80' 
                  : 'text-gray-600 hover:text-[#0CA4A4]'
              }`
            }
          >
            หน้าหลัก (Home)
          </NavLink>
          <NavLink 
            to="/map" 
            className={({ isActive }) => 
              `px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 ${
                isActive 
                  ? 'bg-white text-[#0CA4A4] font-bold shadow-xs border border-white/80' 
                  : 'text-gray-600 hover:text-[#0CA4A4]'
              }`
            }
          >
            <MapPin size={14} />
            แผนที่ 3D โรงเรียน
          </NavLink>
          <NavLink 
            to="/analyser" 
            className={({ isActive }) => 
              `px-4 py-1.5 rounded-full transition-all duration-200 ${
                isActive 
                  ? 'bg-white text-[#0CA4A4] font-bold shadow-xs border border-white/80' 
                  : 'text-gray-600 hover:text-[#0CA4A4]'
              }`
            }
          >
            แนวโน้ม (Analyser)
          </NavLink>
          <NavLink 
            to="/forecast" 
            className={({ isActive }) => 
              `px-4 py-1.5 rounded-full transition-all duration-200 ${
                isActive 
                  ? 'bg-white text-[#0CA4A4] font-bold shadow-xs border border-white/80' 
                  : 'text-gray-600 hover:text-[#0CA4A4]'
              }`
            }
          >
            พยากรณ์ฝุ่น (Forecast)
          </NavLink>
          <NavLink 
            to="/export" 
            className={({ isActive }) => 
              `px-4 py-1.5 rounded-full transition-all duration-200 ${
                isActive 
                  ? 'bg-white text-[#0CA4A4] font-bold shadow-xs border border-white/80' 
                  : 'text-gray-600 hover:text-[#0CA4A4]'
              }`
            }
          >
            ส่งออก (Export)
          </NavLink>
        </nav>

        {/* Data Source Toggle */}
        <DataSourceBadge />

        {/* Live WS Pulse status badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0CA4A4]/10 border border-[#0CA4A4]/20">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#0CA4A4] shadow-[0_0_10px_rgba(12,164,164,0.6)] animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-[#0CA4A4] font-mono font-bold tracking-wider text-[11px]">
            {isConnected ? 'LIVE' : 'RECONNECTING'}
          </span>
        </div>
      </div>
    </header>
  );
}


