'use client';
import { useState } from 'react';
import { RefreshCw, AlertTriangle, Newspaper, X } from 'lucide-react';
import { STATUS_COLORS } from '@/lib/assetPortfolioCalc';

function severityColor(sev) {
  if (sev >= 8) return STATUS_COLORS.red;
  if (sev >= 6) return STATUS_COLORS.amber;
  return STATUS_COLORS.green;
}

export default function IntelligenceFeedPanel({ feed, assetsById, onRefresh, refreshing }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Intelligence Feed"
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 20,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
      >
        <Newspaper size={15} color="#1A1F36" />
        {feed.length > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 8, height: 8, borderRadius: '50%',
            background: '#E87722', border: '1.5px solid #fff',
          }} />
        )}
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-20 w-80 bg-white/95 backdrop-blur-sm rounded-xl border border-grey-border shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-grey-border">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={13} className="text-amber" />
          <span className="text-xs font-bold text-text-primary">Intelligence Feed</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh Intelligence"
            className="p-1 rounded-md hover:bg-grey-bg text-text-secondary disabled:opacity-40"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            title="Close"
            className="p-1 rounded-md hover:bg-grey-bg text-text-secondary"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-grey-border">
        {feed.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-text-muted text-center">No intelligence detected yet.</div>
        )}
        {feed.map((item) => (
          <div key={item.id || `${item.asset_id}-${item.detected_at}`} className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: severityColor(item.severity) }} />
              <span className="text-[10px] font-semibold text-text-primary truncate">
                {assetsById[item.asset_id]?.asset_name || item.asset_id}
              </span>
              <span className="text-[9px] text-text-muted ml-auto flex-shrink-0">{item.category}</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-snug">{item.headline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
