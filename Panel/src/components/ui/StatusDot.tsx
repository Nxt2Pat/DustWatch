interface StatusDotProps {
  online: boolean;
  label?: string;
  pulse?: boolean;
}

export default function StatusDot({ online, label, pulse = true }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        {online && pulse && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online ? 'bg-green-400' : 'bg-red-500'}`}></span>
      </span>
      {label && (
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${online ? 'text-green-400' : 'text-red-400'}`}>
          {label}
        </span>
      )}
    </span>
  );
}
