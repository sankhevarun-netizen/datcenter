'use client';
import DeploymentCard from './DeploymentCard';

export default function LoadingBayBoard({ deployments, columns, onStatusChange }) {
  return (
    <div className="h-full flex gap-0 overflow-x-auto">
      {columns.map((col, ci) => {
        const colDeployments = deployments.filter(d => d.status === col.id);
        return (
          <div
            key={col.id}
            className="flex-1 min-w-64 flex flex-col border-r border-[#D8DCE3] last:border-r-0"
            style={{ minWidth: 260 }}
          >
            {/* Column header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#D8DCE3] bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-xs font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                  {col.label}
                </span>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: col.color + '20', color: col.color }}
              >
                {colDeployments.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#F8FAFC]">
              {colDeployments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center" style={{ backgroundColor: col.color + '15' }}>
                    <div className="w-4 h-4 rounded border-2 border-dashed" style={{ borderColor: col.color }} />
                  </div>
                  <p className="text-[10px] text-[#9CA3AF]">No deployments here</p>
                </div>
              )}
              {colDeployments.map(dep => (
                <DeploymentCard
                  key={dep.id}
                  deployment={dep}
                  columns={columns}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
