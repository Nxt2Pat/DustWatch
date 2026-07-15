interface LoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export default function LoadingSkeleton({ lines = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg bg-white/5"
          style={{ width: `${85 - i * 12}%` }}
        ></div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 animate-pulse space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-white/5"></div>
          <div className="h-5 w-32 rounded bg-white/5"></div>
        </div>
        <div className="h-6 w-24 rounded-full bg-white/5"></div>
      </div>
      <div className="h-12 w-28 rounded bg-white/5"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="space-y-1 text-center">
            <div className="h-2 w-10 mx-auto rounded bg-white/5"></div>
            <div className="h-4 w-12 mx-auto rounded bg-white/5"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
