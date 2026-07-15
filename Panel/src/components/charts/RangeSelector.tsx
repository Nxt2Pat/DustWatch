export type TimeRange = '-1h' | '-6h' | '-24h' | '-7d' | '-30d';

interface RangeSelectorProps {
  active: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '-1h', label: '1 Hour' },
  { value: '-6h', label: '6 Hours' },
  { value: '-24h', label: '24 Hours' },
  { value: '-7d', label: '7 Days' },
  { value: '-30d', label: '30 Days' },
];

export default function RangeSelector({ active, onChange }: RangeSelectorProps) {
  return (
    <div className="flex p-0.5 rounded-xl border border-white/5 bg-white/5 backdrop-blur-md">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
            active === r.value
              ? 'text-white bg-white/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
