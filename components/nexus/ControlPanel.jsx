'use client';
import { useRef, useState } from 'react';
import { Layers, ChevronLeft, ChevronRight, Zap, Target, Search, Sparkles, Unplug, Gauge, Thermometer } from 'lucide-react';
import { getHall } from '@/lib/nexus/data';

const VERDICT_STYLE = {
  feasible: ['#4ade80', 'Feasible'],
  feasible_with_upgrades: ['#fbbf24', 'Needs upgrades'],
  not_feasible: ['#f87171', 'Not feasible'],
};

export const DEMO_SCENES = [
  { id: 'scene1', n: 1, label: 'Stranded capacity', sub: 'Where is power trapped?' },
  { id: 'scene2', n: 2, label: 'Can we take 2MW at 60kW?', sub: 'Fit a new customer' },
  { id: 'scene3', n: 3, label: 'Row G → 60 kW', sub: 'Cascade impact' },
  { id: 'scene4', n: 4, label: 'Replay INC-2026-0318', sub: 'What the data knew' },
];

export function QueryBar({ onSubmit, busy, left, right }) {
  const [value, setValue] = useState('');
  const examples = ['Can we take 2MW at 60kW density?', 'Where can I put 30 racks at 40kW?', 'What if Row G goes to 60kW?', 'What happens if we lose utility feed A?'];
  const submit = () => { if (value.trim() && !busy) onSubmit(value.trim()); };
  return (
    <div className="absolute top-4 z-20 flex justify-center pointer-events-none px-4 transition-all duration-300" style={{ left, right }}>
      <div className="w-full max-w-xl pointer-events-auto">
        <div className="bg-[#0a1220]/92 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md p-1.5 flex items-center gap-2">
          <Search size={15} className="text-white/40 ml-2 flex-shrink-0" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Ask about capacity — e.g. can we take 2MW at 60kW density?"
            aria-label="Ask about capacity"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none min-w-0"
          />
          <button onClick={submit} disabled={busy || !value.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00338D] hover:bg-[#002A73] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors">
            <Sparkles size={13} />{busy ? 'Working…' : 'Ask'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
          {examples.map((q) => (
            <button key={q} onClick={() => setValue(q)} className="px-2.5 py-1 bg-[#0a1220]/80 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[10.5px] rounded-full transition-colors">{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

const HALL_ROWS = [['A', 'B', 'C', 'D', 'E', 'F'], ['G', 'H', 'I', 'J', 'K', 'L'], ['M', 'N', 'O', 'P', 'Q', 'R'], ['S', 'T', 'U', 'V', 'W', 'X']];

export default function ControlPanel({
  collapsed, onToggle, activeScene, onScene, activeView, onView,
  rowId, onRow, row, densityKw, onDensity, onDensityCommit, rackCount, maxRackCount, onRackCount,
  preview, onRun, onBreakingPoint, busy,
}) {
  // Pointer drags commit on release; keyboard nudges commit once the keys pause,
  // so arrowing 10 -> 60 runs one scenario, not fifty.
  const keyTimer = useRef(null);
  const onSliderKeyUp = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
    clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(onDensityCommit, 450);
  };

  if (collapsed) {
    // Stays usable: the four demo scenes and both views remain one click away.
    return (
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 bg-[#0a1220]/95 border border-white/10 rounded-xl p-1.5" data-testid="control-panel-collapsed">
        <button onClick={onToggle} aria-label="Expand controls" title="Expand controls" className="w-9 h-9 rounded-lg flex items-center justify-center text-[#60a5fa] hover:bg-white/10"><ChevronRight size={15} /></button>
        <div className="h-px bg-white/10" />
        {DEMO_SCENES.map((s) => (
          <button key={s.id} onClick={() => onScene(s.id)} disabled={busy} aria-label={s.label} title={`${s.n}. ${s.label}`}
            className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${activeScene === s.id ? 'bg-[#00338D] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>{s.n}</button>
        ))}
        <div className="h-px bg-white/10" />
        {[['stranded', 'Stranded', 'Stranded view', Unplug], ['density', 'Density', 'Density view', Gauge], ['thermal', 'Thermal', 'Thermal view', Thermometer]].map(([id, label, title, Icon]) => (
          <button key={id} onClick={() => onView(id)} aria-pressed={activeView === id} aria-label={label} title={title}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${activeView === id ? 'bg-[#00338D] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}><Icon size={15} /></button>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 bottom-4 z-20 w-[320px] overflow-y-auto bg-[#0a1220]/95 border border-white/10 rounded-2xl backdrop-blur-md p-4 space-y-4" data-testid="control-panel">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-[#60a5fa]" />
        <p className="text-xs font-bold text-white uppercase tracking-wide flex-1">Nexus Mumbai-1</p>
        <button onClick={onToggle} aria-label="Collapse controls" className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"><ChevronLeft size={14} /></button>
      </div>

      <div>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-1.5">Key scenarios</p>
        <div className="space-y-1.5">
          {DEMO_SCENES.map((s) => (
            <button key={s.id} onClick={() => onScene(s.id)} disabled={busy}
              className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg border transition-colors disabled:opacity-50 ${activeScene === s.id ? 'bg-[#00338D]/40 border-[#3b82f6]/50' : 'bg-white/[0.04] border-transparent hover:bg-white/[0.08]'}`}>
              <span className="w-5 h-5 rounded-md bg-white/10 text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0">{s.n}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-white truncate">{s.label}</span>
                <span className="block text-[10px] text-white/45">{s.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-1.5">Views</p>
        <div className="flex gap-1.5">
          {[['stranded', 'Stranded'], ['density', 'Density'], ['thermal', 'Thermal']].map(([id, label]) => (
            <button key={id} onClick={() => onView(id)} aria-pressed={activeView === id}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeView === id ? 'bg-[#00338D] text-white' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Scenario</p>
        <div className="space-y-1">
          {HALL_ROWS.map((rows, i) => (
            <div key={rows[0]} className="flex items-center gap-1">
              <span className="text-[9.5px] text-white/35 w-9">{getHall(`MUM-1-H${i + 1}`).name}</span>
              {rows.map((r) => (
                <button key={r} onClick={() => onRow(r)} aria-pressed={rowId === r}
                  className={`flex-1 py-1 rounded text-[11px] font-bold transition-colors ${rowId === r ? 'bg-[#00338D] text-white' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'}`}>{r}</button>
              ))}
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label htmlFor="density" className="text-[10px] text-white/45 uppercase tracking-wide">Density</label>
            <span className="text-xs font-mono text-white font-bold">{densityKw} kW/rack</span>
          </div>
          <input id="density" type="range" min={5} max={100} step={1} value={densityKw}
            onChange={(e) => onDensity(Number(e.target.value))}
            onPointerUp={onDensityCommit} onKeyUp={onSliderKeyUp}
            className="w-full accent-[#3b82f6] cursor-pointer" />
          <p className="text-[10px] text-white/35 mt-0.5">Row {rowId} is rated {row.max_density_kw} kW/rack · today averages {Math.round((row.used_kw / row.rack_count) * 10) / 10} kW</p>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-white/45 uppercase tracking-wide">Racks changed</span>
            <span className="text-xs font-mono text-white font-bold">{rackCount} of {maxRackCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onRackCount(Math.max(1, rackCount - 1))} aria-label="Fewer racks" className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold">−</button>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#3b82f6]" style={{ width: `${(rackCount / maxRackCount) * 100}%` }} /></div>
            <button onClick={() => onRackCount(Math.min(maxRackCount, rackCount + 1))} aria-label="More racks" className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold">+</button>
          </div>
        </div>
        {preview && (
          <div className="flex items-center justify-between bg-white/5 rounded-lg px-2.5 py-2" data-testid="scenario-preview">
            <span className="text-[10px] font-bold" style={{ color: VERDICT_STYLE[preview.verdict][0] }}>{VERDICT_STYLE[preview.verdict][1]}</span>
            <span className="text-[10px] text-white/55 font-mono">{preview.breakingPoints.length} break · {preview.redundancyLosses.length} N+1 lost</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onRun} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-[#00338D] hover:bg-[#002A73] disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl"><Zap size={13} /> Run</button>
          <button onClick={onBreakingPoint} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-xl"><Target size={13} /> Breaking point</button>
        </div>
      </div>
    </div>
  );
}
