'use client';
export function LoadingDots({ color = '#005EB8', size = 8 }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`typing-dot rounded-full`}
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 bg-[#00338D] flex items-center justify-center z-50">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#005EB8]/30 border-t-[#005EB8] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm font-medium">Loading K-Nexus...</p>
      </div>
    </div>
  );
}

export function AIThinkingLoader() {
  return (
    <div className="flex items-center gap-3 p-4 bg-[#00338D]/5 rounded-xl border border-[#00338D]/10">
      <div className="w-8 h-8 rounded-lg bg-[#00338D] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div>
        <p className="text-xs text-[#6B7280] mb-1.5">Generating analysis...</p>
        <LoadingDots />
      </div>
    </div>
  );
}
