import { NavLink } from 'react-router-dom';
import { useStore } from '../../store';
import { DataSourceBadge } from '../DataSourceBadge';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/timeseries', label: 'Analyser' },
  { to: '/ml', label: 'ML Portal' },
  { to: '/map-builder', label: 'Map Builder' },
  { to: '/history', label: 'History' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/dev/logs', label: 'Dev Logs' },
];

export default function TopNavBar({ isConnected }: { isConnected: boolean }) {
  const masterStatus = useStore((s) => s.masterStatus);

  return (
    <nav className="sticky top-0 z-50 px-3 sm:px-6 pt-3 pb-2 transition-all">
      <div className="max-w-7xl mx-auto rounded-2xl border border-white/20 bg-white/[0.06] backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.45)] relative overflow-hidden">
        {/* Top Rim Specular Light */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo + Brand */}
            <div className="flex items-center gap-6">
              <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-[0_0_16px_rgba(56,189,248,0.4)] group-hover:scale-105 transition-transform">
                  DW
                </div>
                <span className="text-sm font-extrabold tracking-tight text-white hidden sm:block font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  DustWatch <span className="text-[10px] text-cyan-400 font-normal px-1.5 py-0.5 rounded-full border border-cyan-400/30 bg-cyan-400/10">v27</span>
                </span>
              </NavLink>

              {/* Navigation Links */}
              <div className="hidden md:flex items-center gap-1.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${isActive
                        ? 'text-cyan-200 bg-white/15 border border-white/25 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                        : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Right side status indicators */}
            <div className="flex items-center gap-2.5">
              <DataSourceBadge />

              <NavLink to="/status" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                {/* Master status */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-[10px] font-mono backdrop-blur-md">
                  <span className={`h-2 w-2 rounded-full ${masterStatus.status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-rose-500'}`}></span>
                  <span className="text-gray-300">MASTER: {masterStatus.status.toUpperCase()}</span>
                </div>

                {/* WebSocket status */}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-mono transition-all duration-300 backdrop-blur-md ${isConnected
                    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                    : 'text-amber-300 bg-amber-500/15 border-amber-400/30 animate-pulse'
                  }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-amber-400'}`}></span>
                  {isConnected ? 'LIVE' : 'RECONNECTING'}
                </div>
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

