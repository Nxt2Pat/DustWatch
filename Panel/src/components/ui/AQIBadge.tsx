const AQI_LEVELS: Record<string, { text: string; bg: string; border: string }> = {
  'very good': {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  'good': {
    text: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  'moderate': {
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
  },
  'unhealthy': {
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  'very unhealthy': {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
};

interface AQIBadgeProps {
  level: string;
  score?: number;
  size?: 'sm' | 'md';
}

export default function AQIBadge({ level, score, size = 'sm' }: AQIBadgeProps) {
  const key = level?.toLowerCase() ?? '';
  const style = AQI_LEVELS[key] ?? {
    text: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  };

  const sizeClass = size === 'md'
    ? 'px-3 py-1.5 text-xs'
    : 'px-2 py-0.5 text-[10px]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wide ${style.text} ${style.bg} ${style.border} ${sizeClass}`}>
      {score !== undefined && <span>{Math.round(score)}</span>}
      <span className="uppercase">{level}</span>
    </span>
  );
}

/** Helper to get AQI tailwind color classes from level string */
export function getAQIColors(level: string) {
  const key = level?.toLowerCase() ?? '';
  return AQI_LEVELS[key] ?? {
    text: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  };
}
