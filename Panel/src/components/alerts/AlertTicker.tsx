import { useStore } from '../../store';

export default function AlertTicker() {
  const alerts = useStore((state) => state.alerts);

  if (alerts.length === 0) return null;

  // Duplicate items to ensure a seamless looping marquee effect
  const tickerItems = [...alerts.slice(0, 10), ...alerts.slice(0, 10)];

  return (
    <div className="relative flex items-center h-10 w-full overflow-hidden rounded-2xl border border-rose-500/30 bg-rose-950/20 backdrop-blur-xl shadow-[0_4px_20px_rgba(244,63,94,0.15)]">
      {/* Inline styles for keyframe animation */}
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
      <div className="z-10 flex items-center gap-1.5 h-full px-4 border-r border-rose-500/30 bg-rose-950/60 text-[10px] font-mono font-black uppercase tracking-wider text-rose-300 shrink-0 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping"></span>
        Alert Ticker
      </div>

      {/* Marquee Wrapper */}
      <div className="w-full overflow-hidden flex items-center">
        <div className="animate-marquee gap-8">
          {tickerItems.map((alert, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs select-none">
              <span className="font-bold text-rose-300 uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-[9px] font-mono shadow-sm">
                {alert.alert_type}
              </span>
              <span className="font-mono text-cyan-300 text-[11px]">[{alert.node_id}]</span>
              <span className="text-gray-200 font-medium">{alert.message}</span>
              <span className="text-gray-400 font-mono text-[10px]">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-rose-500/40 mx-4 font-bold">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

