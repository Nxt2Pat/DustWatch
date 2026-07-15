export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#070a13]/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-400">DustWatch</span>
          <span>v1.0.0</span>
          <span className="text-gray-600">•</span>
          <span>Real-Time Air Quality Monitoring</span>
        </div>
        <div className="flex items-center gap-3">
          <span>PCD Thailand AQI Standard</span>
          <span className="text-gray-600">•</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
