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
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#070a13]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo + Brand */}
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2 shrink-0">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
                DW
              </div>
              <span className="text-sm font-extrabold tracking-tight text-gray-100 hidden sm:block">
                DustWatch
              </span>
            </NavLink>

            {/* Navigation Links (hidden on mobile, visible on desktop) */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive
                      ? 'text-white bg-white/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right side status indicators linked to status page */}
          <div className="flex items-center gap-2">
            {/* Data Source Toggle */}
            <DataSourceBadge />

            <NavLink to="/status" className="flex items-center gap-2 hover:opacity-90">
              {/* Master status */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-[10px] font-mono">
                <span className={`h-2 w-2 rounded-full ${masterStatus.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-gray-400">Master: {masterStatus.status.toUpperCase()}</span>
              </div>

              {/* WebSocket status */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-colors duration-300 ${isConnected
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 animate-pulse'
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                {isConnected ? 'LIVE' : 'RECONNECTING'}
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
