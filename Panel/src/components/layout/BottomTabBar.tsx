import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/timeseries', label: 'Analyser', icon: '📈' },
  { to: '/ml', label: 'Forecast', icon: '🔮' },
  { to: '/history', label: 'Export', icon: '📋' },
];

export default function BottomTabBar() {
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md z-45 md:hidden">
      <div className="glass-panel px-4 py-2 flex items-center justify-around shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'bg-white/10 text-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
