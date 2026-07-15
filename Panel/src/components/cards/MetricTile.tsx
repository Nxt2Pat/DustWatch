interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: string;
  statusColor?: string;
  icon: string;
}

export default function MetricTile({
  label,
  value,
  unit = '',
  status = '',
  statusColor = 'text-gray-400',
  icon,
}: MetricTileProps) {
  return (
    <div className="p-4 rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-md flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
          {label}
        </span>
        <span className="text-lg leading-none" role="img" aria-label={label}>
          {icon}
        </span>
      </div>

      <div className="my-3 flex items-baseline gap-1">
        <span className="text-2xl font-black font-mono tracking-tight text-white">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-gray-400 font-mono">
            {unit}
          </span>
        )}
      </div>

      {status && (
        <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
          {status}
        </span>
      )}
    </div>
  );
}
