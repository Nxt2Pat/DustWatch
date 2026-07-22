import { getAQIColors } from '../ui/AQIBadge';

interface AQIGaugeCardProps {
  score: number;
  level: string;
}

export default function AQIGaugeCard({ score, level }: AQIGaugeCardProps) {
  const roundedScore = Math.round(score);
  const colors = getAQIColors(level);
  
  // Circle coordinates & stroke settings for SVG
  const strokeWidth = 8;
  const normalizedRadius = 40; // Radius to fit nicely within 128px
  const circumference = normalizedRadius * 2 * Math.PI;
  
  // Cap gauge fill at 300 score
  const maxScoreScale = 300;
  const fillPercentage = Math.min(score / maxScoreScale, 1);
  const strokeDashoffset = circumference - fillPercentage * circumference;

  const getStrokeColor = () => {
    switch (level.toLowerCase()) {
      case 'very good': return '#38bdf8';
      case 'good': return '#34d399';
      case 'moderate': return '#fbbf24';
      case 'unhealthy': return '#fb923c';
      default: return '#f43f5e';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-xl shadow-inner group">
      <div className="relative h-32 w-32 flex items-center justify-center">
        {/* SVG Circle Gauge */}
        <svg className="absolute inset-0 transform -rotate-90 w-full h-full filter drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
          {/* Background Track */}
          <circle
            className="text-white/10"
            stroke="currentColor"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={64}
            cy={64}
          />
          {/* Active Colored Arc */}
          <circle
            className="transition-all duration-1000 ease-out"
            stroke={getStrokeColor()}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ 
              strokeDashoffset,
              filter: `drop-shadow(0 0 6px ${getStrokeColor()})`
            }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={64}
            cy={64}
          />
        </svg>

        {/* Center AQI value */}
        <div className="text-center z-10 space-y-0.5">
          <span className="block text-3xl font-black font-mono tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            {roundedScore}
          </span>
          <span className="block text-[9px] uppercase font-bold text-cyan-300/80 tracking-wider font-mono">
            AQI INDEX
          </span>
        </div>
      </div>

      {/* Subtitle Badge Indicator */}
      <span className={`mt-2 px-3 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider font-mono shadow-sm backdrop-blur-md ${colors.text} ${colors.bg} ${colors.border}`}>
        {level}
      </span>
    </div>
  );
}

