'use client';

export function SkeletonBlock({ className = '', height = 'h-4', width = 'w-full' }) {
  return <div className={`${height} ${width} rounded-lg bg-[#D8DCE3] animate-pulse ${className}`} />;
}

export function SkeletonCard({ className = '', padding = 'p-5' }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#D8DCE3] shadow-sm ${padding} ${className}`}>
      <SkeletonBlock height="h-3" width="w-24" className="mb-3" />
      <SkeletonBlock height="h-7" width="w-32" className="mb-2" />
      <SkeletonBlock height="h-3" width="w-20" />
    </div>
  );
}
