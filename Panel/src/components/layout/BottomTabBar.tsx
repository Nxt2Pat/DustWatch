import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/timeseries', label: 'Analyser', icon: '📈' },
  { to: '/ml', label: 'Forecast', icon: '🔮' },
  { to: '/history', label: 'Export', icon: '📋' },
];

export default function BottomTabBar() {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md z-45 md:hidden">
      <div className="glass-dock px-4 py-2 flex items-center justify-around relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3.5 py-1.5 rounded-full transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-white scale-105 border border-cyan-400/40 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <span className="text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">{tab.icon}</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

