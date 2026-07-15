import { NavLink } from 'react-router-dom';
import { Home, BarChart2, Sparkles, FolderDown, Activity } from 'lucide-react';

const tabs = [
  { to: '/', label: 'หน้าหลัก', icon: Home },
  { to: '/analyser', label: 'วิเคราะห์', icon: BarChart2 },
  { to: '/forecast', label: 'ทำนายฝุ่น', icon: Sparkles },
  { to: '/export', label: 'ดาวน์โหลด', icon: FolderDown },
  { to: '/status', label: 'สถานะ', icon: Activity },
];

export default function BottomTabBar() {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-lg z-45 md:hidden landscape-hide">
      <div className="premium-panel px-3 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-brand-primary text-white scale-105 shadow-md shadow-brand-primary/20 font-semibold'
                    : 'text-text-secondary hover:text-brand-primary'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[9px] tracking-wide font-medium">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
