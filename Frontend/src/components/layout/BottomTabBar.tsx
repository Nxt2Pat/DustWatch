import { NavLink } from 'react-router-dom';
import { Home, MapPin, BarChart2, Sparkles, FolderDown } from 'lucide-react';

const tabs = [
  { to: '/', label: 'หน้าหลัก', icon: Home },
  { to: '/map', label: 'แผนที่ 3D', icon: MapPin },
  { to: '/analyser', label: 'วิเคราะห์', icon: BarChart2 },
  { to: '/forecast', label: 'ทำนายฝุ่น', icon: Sparkles },
  { to: '/export', label: 'ส่งออก', icon: FolderDown },
];


export default function BottomTabBar() {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md z-45 md:hidden">
      <div className="glass-panel border border-white/80 shadow-2xl px-2 py-2 rounded-full flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-[#0CA4A4] text-white shadow-lg shadow-[#0CA4A4]/30 font-bold scale-105'
                    : 'text-gray-500 hover:text-[#0CA4A4]'
                }`
              }
            >
              <Icon size={18} />
              <span className="text-[10px] tracking-tight font-medium font-sans">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

