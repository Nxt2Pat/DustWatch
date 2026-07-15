interface EmptyStateProps {
  title?: string;
  message?: string;
}

export default function EmptyState({
  title = 'No data available',
  message = 'Waiting for sensor data to arrive...',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Pulsing radar icon */}
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-white/10 animate-pulse"></div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-full border border-white/5 animate-ping opacity-20"></div>
      </div>

      <h3 className="text-sm font-bold text-gray-400 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 max-w-xs">{message}</p>
    </div>
  );
}
