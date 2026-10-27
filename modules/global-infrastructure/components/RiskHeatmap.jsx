'use client';
import { RISK_CATEGORIES } from '../utils/portfolioAnalytics';

function scoreColor(score) {
  if (score == null) return '#F0F2F5';
  if (score >= 55) return '#C8102E';
  if (score >= 30) return '#E87722';
  return '#00B0A0';
}

export default function RiskHeatmap({ rows }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" aria-label="Risk heatmap by region and category">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider px-2 py-1.5">Region</th>
            {RISK_CATEGORIES.map(cat => (
              <th key={cat} className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider px-1.5 py-1.5 text-center">{cat}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.region}>
              <td className="text-xs font-semibold text-[#1A1F36] px-2 py-1">{row.region}</td>
              {row.cells.map(cell => (
                <td key={cell.category} className="px-1.5 py-1">
                  <div
                    className="h-8 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: scoreColor(cell.score) }}
                    title={`${row.region} — ${cell.category}: ${cell.score ?? 'n/a'}`}
                  >
                    {cell.score ?? '—'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
