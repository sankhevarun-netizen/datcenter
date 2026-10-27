'use client';
import { useState, useMemo } from 'react';
import { mockThermalData, generateCampusThermal } from '@/data/mock/thermal';
import { Thermometer, Wind, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = [1, 2, 3, 4];

function tempToColor(tempC) {
  if (tempC <= 20) return { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' };
  if (tempC <= 24) return { bg: '#bbf7d0', border: '#4ade80', text: '#166534' };
  if (tempC <= 28) return { bg: '#fef9c3', border: '#fde047', text: '#854d0e' };
  if (tempC <= 33) return { bg: '#fed7aa', border: '#fb923c', text: '#9a3412' };
  if (tempC <= 37) return { bg: '#fecaca', border: '#f87171', text: '#991b1b' };
  return { bg: '#fca5a5', border: '#ef4444', text: '#7f1d1d' };
}

function tempToGradient(tempC) {
  if (tempC <= 20) return '#1d4ed8';
  if (tempC <= 24) return '#16a34a';
  if (tempC <= 28) return '#ca8a04';
  if (tempC <= 33) return '#ea580c';
  if (tempC <= 37) return '#C8102E';
  return '#7f1d1d';
}

export default function ThermalHeatmapView({ dc }) {
  const [hoveredTile, setHoveredTile] = useState(null);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [removedCrah, setRemovedCrah] = useState(null);

  // Use stored thermal data if available, otherwise generate from DC attributes
  const thermalData = useMemo(() => {
    if (!dc) return null;
    if (mockThermalData[dc.id]) return { ...mockThermalData[dc.id], isGenerated: false };
    // Fabricate from DC fields — fall back to safe defaults for any missing field
    const synth = generateCampusThermal({
      id: dc.id ?? 'UPL-0',
      pue: dc.pue ?? 1.5,
      utilization_pct: dc.utilization_pct ?? 60,
      capacity_mw: dc.capacity_mw ?? 50,
      alarm_critical: dc.alarm_critical ?? 0,
      alarm_high: dc.alarm_high ?? 0,
      risk_flag: dc.risk_flag ?? 'Low',
      tier: dc.tier ?? 'III',
      market: dc.market ?? dc.city ?? dc.name ?? 'Facility',
    });
    return { ...synth, isGenerated: true };
  }, [dc?.id]);

  const tiles = useMemo(() => {
    if (!thermalData) return [];
    if (!whatIfMode || !removedCrah) return thermalData.tiles;
    // Simulate removing a CRAH — raise temperatures in that column
    return thermalData.tiles.map(tile => {
      const dist = Math.abs(COLS.indexOf(tile.col) - COLS.indexOf(removedCrah));
      const extra = dist === 0 ? 8 : dist === 1 ? 5 : dist === 2 ? 3 : 1;
      return { ...tile, tempC: Math.min(45, tile.tempC + extra), isHotSpot: tile.isHotSpot || dist <= 1 };
    });
  }, [thermalData, whatIfMode, removedCrah]);

  if (!thermalData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-[#9CA3AF]">No facility data available.</p>
      </div>
    );
  }

  const avgTemp = Math.round(tiles.reduce((s, t) => s + t.tempC, 0) / tiles.length);
  const maxTemp = Math.max(...tiles.map(t => t.tempC));
  const hotCount = tiles.filter(t => t.tempC > 33).length;

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#D8DCE3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Thermometer size={16} className="text-[#ef4444]" />
          <span className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            Thermal Heatmap — Floor Plan
          </span>
          {thermalData.isGenerated && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#EFF6FF] text-[#005EB8] border border-[#005EB8]/25">
              ✦ AI-Synthesised
            </span>
          )}
          {whatIfMode && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#E87722] border border-[#E87722]/30">
              WHAT-IF MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setWhatIfMode(!whatIfMode); setRemovedCrah(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              whatIfMode
                ? 'bg-[#FFFBEB] text-[#E87722] border-[#E87722]/40'
                : 'text-[#6B7280] border-[#D8DCE3] hover:bg-[#F8FAFC]'
            }`}
          >
            <RefreshCw size={11} />
            {whatIfMode ? 'Exit What-If' : 'Run What-If'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-[#F8FAFC] border-b border-[#D8DCE3]">
        {[
          { label: 'Avg Temp', value: `${avgTemp}°C`, color: tempToGradient(avgTemp) },
          { label: 'Max Temp', value: `${maxTemp}°C`, color: tempToGradient(maxTemp) },
          { label: 'Hot Tiles', value: hotCount, color: hotCount > 0 ? '#C8102E' : '#00B0A0' },
          { label: 'CRAH Online', value: `${thermalData.crahOnline}/${thermalData.crahUnits}`, color: thermalData.crahOnline < thermalData.crahUnits ? '#C8102E' : '#00B0A0' },
          { label: 'Target', value: `${thermalData.targetTempC}°C`, color: '#6B7280' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{s.label}</div>
            <div className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
        <div className="ml-auto text-[10px] text-[#9CA3AF] flex items-center gap-1">
          <Wind size={10} />
          Airflow: {thermalData.airflowDirection === 'front-to-back' ? 'Front → Rear' : 'Side-to-side'}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-auto">

        {/* What-if controls */}
        {whatIfMode && (
          <div className="w-full max-w-xl bg-[#FFFBEB] border border-[#E87722]/30 rounded-xl p-3">
            <p className="text-xs font-bold text-[#E87722] mb-2">Simulate: Remove a CRAH unit</p>
            <div className="flex flex-wrap gap-2">
              {COLS.slice(0, thermalData.crahUnits).map(col => (
                <button
                  key={col}
                  onClick={() => setRemovedCrah(removedCrah === col ? null : col)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    removedCrah === col
                      ? 'bg-[#C8102E] text-white border-[#C8102E]'
                      : 'bg-white text-[#374151] border-[#D8DCE3] hover:border-[#E87722]'
                  }`}
                >
                  CRAH-{col}
                </button>
              ))}
              {removedCrah && (
                <span className="text-[10px] text-[#C8102E] font-medium self-center ml-2">
                  ↑ Showing thermal impact of losing CRAH-{removedCrah}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Floor plan grid */}
        <div className="w-full max-w-2xl">
          {/* Rear wall label */}
          <div className="text-center mb-1">
            <span className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-widest">← REAR / CRAH UNITS →</span>
          </div>

          {/* Column headers */}
          <div className="flex mb-1 ml-12">
            {COLS.map(col => (
              <div key={col} className="flex-1 text-center text-[10px] font-mono font-bold text-[#6B7280]">{col}</div>
            ))}
          </div>

          {/* Grid rows (row 4 = rear/CRAH side, row 1 = front) */}
          {[4, 3, 2, 1].map(rowNum => {
            const isHot = rowNum === 4 || rowNum === 2;
            const rowLabel = rowNum === 4 ? 'Hot aisle' : rowNum === 3 ? 'Cold aisle' : rowNum === 2 ? 'Hot aisle' : 'Cold aisle';
            return (
              <div key={rowNum} className="flex items-center mb-1 gap-1">
                <div className="w-11 flex-shrink-0 text-right pr-1">
                  <span className="text-[9px] font-mono text-[#9CA3AF]">{rowLabel}</span>
                </div>
                {COLS.map(col => {
                  const tile = tiles.find(t => t.col === col && t.row === rowNum);
                  if (!tile) return <div key={col} className="flex-1 h-10" />;
                  const colors = tempToColor(tile.tempC);
                  const isHovered = hoveredTile?.col === col && hoveredTile?.row === rowNum;
                  return (
                    <div
                      key={col}
                      className="flex-1 h-10 rounded-md flex flex-col items-center justify-center cursor-pointer transition-all relative border"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: isHovered ? colors.text : colors.border,
                        transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                        boxShadow: tile.isHotSpot ? `0 0 8px ${colors.border}` : 'none',
                        zIndex: isHovered ? 10 : 1,
                      }}
                      onMouseEnter={() => setHoveredTile({ col, row: rowNum })}
                      onMouseLeave={() => setHoveredTile(null)}
                    >
                      {tile.isCrah && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#3b82f6] border-2 border-white" title="CRAH unit" />
                      )}
                      <span className="text-[9px] font-bold font-mono" style={{ color: colors.text }}>
                        {tile.tempC}°C
                      </span>
                      {tile.isHotSpot && (
                        <AlertTriangle size={7} style={{ color: colors.text }} className="mt-0.5" />
                      )}
                    </div>
                  );
                })}
                <div className="w-6 flex-shrink-0 flex items-center justify-center">
                  {isHot
                    ? <span className="text-[8px] text-[#ef4444]">→</span>
                    : <span className="text-[8px] text-[#3b82f6]">←</span>
                  }
                </div>
              </div>
            );
          })}

          {/* Front wall label */}
          <div className="text-center mt-1">
            <span className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-widest">← FRONT / ENTRANCE →</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {[
            { label: '≤20°C — Cold', color: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
            { label: '21–24°C — Nominal', color: '#bbf7d0', border: '#4ade80', text: '#166534' },
            { label: '25–28°C — Warm', color: '#fef9c3', border: '#fde047', text: '#854d0e' },
            { label: '29–33°C — Elevated', color: '#fed7aa', border: '#fb923c', text: '#9a3412' },
            { label: '34–37°C — Hot', color: '#fecaca', border: '#f87171', text: '#991b1b' },
            { label: '>37°C — Critical', color: '#fca5a5', border: '#ef4444', text: '#7f1d1d' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: s.color, borderColor: s.border }} />
              <span className="text-[10px] text-[#6B7280]">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6] border-2 border-white shadow" />
            <span className="text-[10px] text-[#6B7280]">CRAH unit</span>
          </div>
        </div>

        {/* Hotspot alerts */}
        {thermalData.hotspotAlerts.length > 0 && (
          <div className="w-full max-w-2xl space-y-2">
            {thermalData.hotspotAlerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#FEF2F2] border border-[#C8102E30] rounded-xl px-3 py-2">
                <AlertTriangle size={12} className="text-[#C8102E] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#C8102E] font-medium">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
        {thermalData.hotspotAlerts.length === 0 && !whatIfMode && (
          <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#00B0A0]/20 rounded-xl px-3 py-2">
            <CheckCircle size={12} className="text-[#00B0A0]" />
            <p className="text-[10px] text-[#00B0A0] font-medium">No thermal hotspots detected — cooling operating normally.</p>
          </div>
        )}
      </div>
    </div>
  );
}
