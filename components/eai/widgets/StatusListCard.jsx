'use client';

const STATUS_STYLE = {
  'On Track':    { color: '#00A36C', bg: 'rgba(0,163,108,0.15)',   border: 'rgba(0,163,108,0.30)'   },
  'Completed':   { color: '#0077C8', bg: 'rgba(0,119,200,0.15)',   border: 'rgba(0,119,200,0.30)'   },
  'In Progress': { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.30)'  },
  'Submitted':   { color: '#7C3AED', bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.30)'  },
  'Certified':   { color: '#06B6D4', bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.30)'   },
  'At Risk':     { color: '#EF4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.30)'   },
  'Pending':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.30)'  },
  'Proposed':    { color: '#7C3AED', bg: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.30)'  },
  'Finalized':   { color: '#0077C8', bg: 'rgba(0,119,200,0.15)',   border: 'rgba(0,119,200,0.30)'   },
  'In Force':    { color: '#00A36C', bg: 'rgba(0,163,108,0.15)',   border: 'rgba(0,163,108,0.30)'   },
};

export default function StatusListCard({ title, items = [], viewAllHref, onItemClick }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1F36' }}>{title}</span>
        {viewAllHref && (
          <a href={viewAllHref} style={{ fontSize: 9, color: '#6B7280', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1A1F36'}
            onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
          >View All</a>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => {
          const s = STATUS_STYLE[item.status] ?? STATUS_STYLE['In Progress'];
          const Tag = onItemClick ? 'button' : 'div';
          return (
            <Tag
              key={i}
              type={onItemClick ? 'button' : undefined}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              className={onItemClick ? 'eai-focusable' : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                cursor: onItemClick ? 'pointer' : 'default',
                padding: '3px 6px', margin: '-3px -6px', borderRadius: 6,
                transition: 'background 0.12s',
                border: 'none', background: 'transparent', font: 'inherit', textAlign: 'left', width: 'calc(100% + 12px)',
              }}
              onMouseEnter={e => { if (onItemClick) e.currentTarget.style.background = '#F8FAFC'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 10, color: '#1A1F36', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <span style={{
                flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                color: s.color, background: s.bg, border: `1px solid ${s.border}`, whiteSpace: 'nowrap',
              }}>
                {item.status}
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
