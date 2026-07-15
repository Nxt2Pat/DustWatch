interface ConstellationDividerProps {
  className?: string;
}

export default function ConstellationDivider({ className = '' }: ConstellationDividerProps) {
  return (
    <div className={`w-full py-4 flex items-center justify-center select-none ${className}`}>
      <svg 
        viewBox="0 0 600 30" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-full max-w-2xl opacity-80"
      >
        {/* Curved hand-drawn ink line */}
        <path 
          d="M 10 15 Q 150 5, 300 15 T 590 15" 
          stroke="var(--ink-line)" 
          strokeWidth="1.5" 
          strokeLinecap="round"
        />
        
        {/* Active Node 1 (left) */}
        <circle 
          cx="150" 
          cy="10" 
          r="8" 
          fill="var(--ink-node-glow)" 
          className="animate-pulse" 
        />
        <circle 
          cx="150" 
          cy="10" 
          r="3" 
          fill="var(--ink-node)" 
        />
        
        {/* Active Node 2 (center-right) */}
        <circle 
          cx="420" 
          cy="18" 
          r="8" 
          fill="var(--ink-node-glow)" 
          className="animate-pulse" 
        />
        <circle 
          cx="420" 
          cy="18" 
          r="3" 
          fill="var(--ink-node)" 
        />
      </svg>
    </div>
  );
}
