import { NavLink } from 'react-router-dom';
import { Wind } from 'lucide-react';
import { DataSourceBadge } from '../DataSourceBadge';

interface TopNavBarProps {
  isConnected: boolean;
}

export default function TopNavBar({ isConnected }: TopNavBarProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-md border-b border-brand-primary/5 py-4 px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2">
        <div className="bg-brand-primary text-white p-2 rounded-xl shadow-md shadow-brand-primary/20">
          <Wind size={20} className="animate-pulse" />
        </div>
        <span className="text-xl font-bold font-sans tracking-tight text-text-primary">
          DustWatch
        </span>
      </div>
      
      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              isActive ? 'text-brand-primary font-bold' : 'text-text-secondary hover:text-brand-primary transition-colors'
            }
          >
            หน้าหลัก (Dashboard)
          </NavLink>
          <NavLink 
            to="/analyser" 
            className={({ isActive }) => 
              isActive ? 'text-brand-primary font-bold' : 'text-text-secondary hover:text-brand-primary transition-colors'
            }
          >
            แนวโน้ม (Analyser)
          </NavLink>
          <NavLink 
            to="/forecast" 
            className={({ isActive }) => 
              isActive ? 'text-brand-primary font-bold' : 'text-text-secondary hover:text-brand-primary transition-colors'
            }
          >
            พยากรณ์ฝุ่น (Forecast)
          </NavLink>
          <NavLink 
            to="/export" 
            className={({ isActive }) => 
              isActive ? 'text-brand-primary font-bold' : 'text-text-secondary hover:text-brand-primary transition-colors'
            }
          >
            ส่งออก (Export)
          </NavLink>
          <NavLink 
            to="/status" 
            className={({ isActive }) => 
              isActive ? 'text-brand-primary font-bold' : 'text-text-secondary hover:text-brand-primary transition-colors'
            }
          >
            สถานะโชว์ (Status)
          </NavLink>
        </nav>

        {/* Data Source Toggle */}
        <DataSourceBadge />

        {/* Live WS Pulse status badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-light border border-brand-primary/10 shadow-xs">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-text-secondary font-mono">
            {isConnected ? 'LIVE' : 'RECONNECTING'}
          </span>
        </div>
      </div>
    </header>
  );
}
