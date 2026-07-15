import { useStore } from '../../store';

export default function AlertTicker() {
  const alerts = useStore((state) => state.alerts);

  if (alerts.length === 0) return null;

  // Duplicate items to ensure a seamless looping marquee effect
  const tickerItems = [...alerts.slice(0, 10), ...alerts.slice(0, 10)];

  return (
    <div className="relative flex items-center h-10 w-full overflow-hidden rounded-xl border border-red-500/10 bg-red-500/5 backdrop-blur-md">
      {/* Inline styles for keyframe animation to make it self-contained */}
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Static Label Badge */}
      <div className="z-10 flex items-center gap-1.5 h-full px-4 border-r border-red-500/15 bg-[#0a0d16] text-[10px] font-black uppercase tracking-wider text-red-400 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></span>
        Alert Ticker
      </div>

      {/* Marquee Wrapper */}
      <div className="w-full overflow-hidden flex items-center">
        <div className="animate-marquee gap-8">
          {tickerItems.map((alert, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs select-none">
              <span className="font-bold text-red-400 uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[9px]">
                {alert.alert_type}
              </span>
              <span className="font-mono text-gray-500">[{alert.node_id}]</span>
              <span className="text-gray-300 font-medium">{alert.message}</span>
              <span className="text-gray-500 font-mono text-[10px]">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-red-500/20 mx-4 font-bold">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
