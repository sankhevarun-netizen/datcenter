'use client';

const ROW_LABELS = ['Very High', 'High', 'Medium', 'Low', 'Very Low'];
const COL_LABELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

// Risk level 1-25 based on (5-rowIdx) × (colIdx+1)
function riskBg(rowIdx, colIdx) {
  const level = (5 - rowIdx) * (colIdx + 1);
  if (level >= 16) return '#EF4444';
  if (level >= 10) return '#F59E0B';
  if (level >= 5)  return 'rgba(251,191,36,0.85)'; // yellow
  return '#22C55E';
}
function riskText(rowIdx, colIdx) {
  return (5 - rowIdx) * (colIdx + 1) >= 5 ? '#fff' : '#1a1a1a';
}

export default function RiskHeatmapGrid({
  rows = [], viewAllHref,
  colLabels, likelihoodLabel = 'Likelihood', impactLabel = 'Impact',
  getCellStyle, footerLabel = 'View Risk Dashboard →', onCellClick,
}) {
  const heatRows = rows.length > 0 ? rows : ROW_LABELS.map(() => ({ cells: [0, 0, 0, 0, 0] }));
  const cols = colLabels ?? COL_LABELS;

  function cellStyle(ri, ci, val) {
    if (getCellStyle) return getCellStyle(ri, ci, val);
    return { bg: riskBg(ri, ci), text: riskText(ri, ci) };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Grid area with axis labels */}
      <div style={{ display: 'flex', gap: 4 }}>
        {/* Y-axis label + row labels */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {/* Vertical "Likelihood" label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14 }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {likelihoodLabel}
            </span>
          </div>
          {/* Row labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(rows.length > 0 ? rows.map(r => r.label) : ROW_LABELS).map(l => (
              <div key={l} style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 7, color: '#6B7280', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 44 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The 5×5 grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          {heatRows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 3 }}>
              {row.cells.map((val, ci) => {
                const { bg, text } = cellStyle(ri, ci, val);
                return (
                  <div key={ci}
                    onClick={onCellClick ? () => onCellClick(ri, ci, val) : undefined}
                    style={{
                      flex: 1, height: 28, borderRadius: 4,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: text,
                      fontFamily: 'ui-monospace,monospace',
                      cursor: onCellClick ? 'pointer' : 'default',
                    }}>
                    {val}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Column labels */}
          <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
            {cols.map(l => (
              <div key={l} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 7, color: '#6B7280', textAlign: 'center' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Impact axis label */}
      <div style={{ display: 'flex', justifyContent: 'center', marginLeft: 62 }}>
        <span style={{ fontSize: 7, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {impactLabel}
        </span>
      </div>

      {/* View All link */}
      {viewAllHref && (
        <a href={viewAllHref} style={{ fontSize: 9, color: '#0077C8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {footerLabel}
        </a>
      )}
    </div>
  );
}
