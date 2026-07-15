import { getAQIColors } from '../ui/AQIBadge';

interface AQIGaugeCardProps {
  score: number;
  level: string;
}

export default function AQIGaugeCard({ score, level }: AQIGaugeCardProps) {
  const roundedScore = Math.round(score);
  const colors = getAQIColors(level);
  
  // Circle coordinates & stroke settings for SVG
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  // Cap gauge fill at 300 score
  const maxScoreScale = 300;
  const fillPercentage = Math.min(score / maxScoreScale, 1);
  const strokeDashoffset = circumference - fillPercentage * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center p-4 bg-white/[0.01] rounded-2xl border border-white/5">
      <div className="relative h-32 w-32 flex items-center justify-center">
        {/* SVG Circle Gauge */}
        <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
          {/* Background Track */}
          <circle
            className="text-white/5"
            stroke="currentColor"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
          />
          {/* Active Colored Arc */}
          <circle
            className="transition-all duration-1000 ease-out"
            stroke={
              level.toLowerCase() === 'very good' ? '#60a5fa' :
              level.toLowerCase() === 'good' ? '#22c55e' :
              level.toLowerCase() === 'moderate' ? '#eab308' :
              level.toLowerCase() === 'unhealthy' ? '#f97316' :
              '#ef4444'
            }
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
          />
        </svg>

        {/* Center AQI value */}
        <div className="text-center z-10 space-y-0.5">
          <span className="block text-3xl font-black font-mono tracking-tighter text-white">
            {roundedScore}
          </span>
          <span className="block text-[9px] uppercase font-bold text-gray-500 tracking-wider">
            AQI
          </span>
        </div>
      </div>

      {/* Subtitle Badge Indicator */}
      <span className={`mt-2 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}>
        {level}
      </span>
    </div>
  );
}
