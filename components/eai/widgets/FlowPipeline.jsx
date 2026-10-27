'use client';
import { ShoppingCart, ClipboardCheck, Truck, Warehouse, PackageCheck } from 'lucide-react';

const STAGE_ICONS = {
  ordered:   ShoppingCart,
  confirmed: ClipboardCheck,
  intransit: Truck,
  warehouse: Warehouse,
  delivered: PackageCheck,
};

export default function FlowPipeline({ stages = [], onStageClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', height: '100%' }}>
      {stages.map((stage, i) => {
        const Icon = STAGE_ICONS[stage.key] ?? ShoppingCart;
        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>

            {/* Stage node */}
            <div
              onClick={onStageClick ? () => onStageClick(stage) : undefined}
              role={onStageClick ? 'button' : undefined}
              tabIndex={onStageClick ? 0 : undefined}
              onKeyDown={onStageClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick(stage); } }) : undefined}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, padding: '4px 6px',
                borderRadius: 10, cursor: onStageClick ? 'pointer' : 'default', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (onStageClick) e.currentTarget.style.background = '#F4F6F9'; }}
              onMouseLeave={e => { if (onStageClick) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Icon circle */}
              <div style={{
                width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                background: stage.color + '22',
                border: `2px solid ${stage.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 18px ${stage.color}30`,
              }}>
                <Icon size={20} style={{ color: stage.color }} />
              </div>

              {/* Label */}
              <p style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', textAlign: 'center' }}>
                {stage.label}
              </p>

              {/* Count */}
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1, textAlign: 'center' }}>
                {stage.count.toLocaleString()}
              </p>

              {/* Value */}
              <p style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', whiteSpace: 'nowrap' }}>
                ${stage.valueMM.toFixed(1)}M
              </p>

              {/* Delta chip */}
              <div style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'rgba(0,163,108,0.14)', border: '1px solid rgba(0,163,108,0.25)',
                borderRadius: 5, padding: '2px 6px',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#00A36C' }}>↑ {stage.deltaPct}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
