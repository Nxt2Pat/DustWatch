import React from 'react';

export default function PageWrapper({ children }: { children: React.ReactNode }) {

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 fade-up min-h-[calc(100vh-140px)]">
      {children}
    </div>
  );
}

