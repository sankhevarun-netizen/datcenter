'use client';
// The facility twin with its three views — outer (site), inner (halls and
// racks) and heatmap (thermal or power) — a status strip from the dataset,
// a hall selector and full screen. Everything shown comes from data/nexus.
import { useMemo, useRef, useState } from 'react';
import { Building2, Server, Thermometer, Zap, Gauge, Leaf, AlertTriangle, Activity, Wind } from 'lucide-react';
import NexusTwin from './NexusTwin';
import { idleView, thermalView } from '@/lib/nexus/twin-model';
import { thermalMap, ASHRAE } from '@/lib/nexus/thermal-model';
import { thermalOverlay, powerOverlay, rampHex, overlayT } from '@/lib/nexus/twin-overlay';
import { hallSummaries, siteSummary, siteCallouts, rowCallouts, heatCallouts } from '@/lib/nexus/twin-site';
import { racksOf } from '@/lib/nexus/data';

const VIEWS = [
  { id: 'outer', label: 'Outer View', Icon: Building2 },
  { id: 'inner', label: 'Inner View', Icon: Server },
  { id: 'heat', label: 'Heatmap', Icon: Thermometer },
];
const GLASS = { background: 'rgba(10,22,40,0.82)', border: '1px solid rgba(63,169,245,0.28)', backdropFilter: 'blur(10px)', boxShadow: '0 6px 24px rgba(0,0,0,0.35)' };
const FAIL_CRAH = 'CRAH-K-01'; // the unit behind today's open cooling alert (ALM-4821)

function Kpi({ Icon, label, value, sub, bar, tone = '#3FA9F5' }) {
  return (
    <div className="rounded-xl px-4 py-3 min-w-[170px]" style={GLASS}>
      <div className="flex items-center gap-2" style={{ color: '#9FB4CF', fontSize: 12 }}>
        <Icon size={15} style={{ color: tone }} />{label}
      </div>
      <p style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>{value}</p>
      {bar != null && (
        <div className="h-1 rounded-full mt-1.5" style={{ background: 'rgba(143,168,200,0.22)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, bar)}%`, background: tone }} />
        </div>
      )}
      {sub && <p style={{ color: '#8FA8C8', fontSize: 11, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function RampLegend({ overlay }) {
  const stops = Array.from({ length: 11 }, (_, i) => rampHex(i / 10));
  const pos = (v) => `${Math.min(100, Math.max(0, overlayT(overlay, v) * 100))}%`;
  return (
    <div className="rounded-xl px-4 py-3 w-[340px]" style={GLASS}>
      <p style={{ color: '#E8EEF6', fontSize: 12.5, fontWeight: 600 }}>{overlay.title}</p>
      <div className="relative mt-3 h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }}>
        {/* observed range on the scale */}
        <span className="absolute -top-1.5 h-6 rounded-sm" style={{ left: pos(overlay.observed.min), width: `calc(${pos(overlay.observed.max)} - ${pos(overlay.observed.min)})`, border: '1.5px solid #FFFFFF', minWidth: 3 }} />
        {overlay.marks.map((m) => <span key={m.label} className="absolute -top-1 h-5 w-px" style={{ left: pos(m.value), background: '#FFFFFF', opacity: 0.7 }} />)}
      </div>
      <div className="flex justify-between mt-1.5" style={{ color: '#9FB4CF', fontSize: 11 }}>
        <span>{overlay.min}{overlay.unit}</span>
        {overlay.marks.map((m) => <span key={m.label}>{m.value}{overlay.unit} {m.label}</span>)}
        {!overlay.marks.some((m) => m.value === overlay.max) && <span>{overlay.max}{overlay.unit}</span>}
      </div>
      <p style={{ color: '#8FA8C8', fontSize: 11, marginTop: 6 }}>
        Racks now: {overlay.observed.min}–{overlay.observed.max}{overlay.unit}
        {overlay.kind === 'power' && overlay.observed.max > 100 ? ' · some racks draw above their rating' : ''}
      </p>
    </div>
  );
}

const STATUS_DOT = [['Normal', '#22D3A7'], ['Warning', '#F5A623'], ['Critical', '#FF4D4D']];

export default function TwinStudio({ facilityId }) {
  const rootRef = useRef(null);
  const [mode, setMode] = useState('outer');
  // Inner view is always one hall (Hall 2 carries today's alerts); the heatmap starts site-wide.
  const [innerHall, setInnerHall] = useState('MUM-1-H2');
  const [heatHall, setHeatHall] = useState('all');
  const hallId = mode === 'inner' ? innerHall : mode === 'heat' ? heatHall : 'all';
  const setHallId = mode === 'inner' ? setInnerHall : setHeatHall;
  const [heatKind, setHeatKind] = useState('thermal');
  const [failure, setFailure] = useState(false);

  const site = useMemo(() => siteSummary(facilityId), [facilityId]);
  const halls = useMemo(() => hallSummaries(facilityId), [facilityId]);
  const hall = halls.find((h) => h.hallId === hallId) ?? null;

  const overlay = useMemo(() => {
    if (mode !== 'heat') return null;
    return heatKind === 'power' ? powerOverlay(facilityId) : thermalOverlay(facilityId, { failedCrah: failure ? FAIL_CRAH : null });
  }, [mode, heatKind, failure, facilityId]);
  const view = useMemo(() => {
    if (mode === 'heat' && heatKind === 'thermal') {
      const v = thermalView(facilityId, thermalMap(facilityId, { failedCrah: failure ? FAIL_CRAH : null }));
      // Frame the whole hall around the failed unit, not just the unit.
      const failedHall = failure ? halls.find((h) => h.alerts.some((a) => a.component_id === FAIL_CRAH)) : null;
      const b = failedHall?.bounds;
      return { ...v, focusPoints: b ? [{ x: b.x0, y: 0, z: b.z0 }, { x: b.x1, y: 2, z: b.z1 }] : null };
    }
    return idleView(facilityId);
  }, [mode, heatKind, failure, facilityId, halls]);

  const focus = useMemo(() => {
    if (!hall || mode === 'outer') return { key: `${mode}:all`, points: null };
    const b = hall.bounds;
    return { key: `${mode}:${hall.hallId}`, points: [{ x: b.x0, y: 0, z: b.z0 }, { x: b.x1, y: 2, z: b.z1 }] };
  }, [hall, mode]);
  const isolate = mode !== 'outer' && hall ? hall.hallId : null;
  const callouts = useMemo(() => {
    if (mode === 'outer') return siteCallouts(facilityId);
    if (mode === 'inner') return hall ? rowCallouts(facilityId, hall.hallId) : [];
    return overlay ? heatCallouts(facilityId, overlay, hall?.hallId ?? null) : [];
  }, [mode, hall, overlay, facilityId]);

  const racks = useMemo(() => racksOf(facilityId), [facilityId]);
  const scope = hall ?? {
    usedKw: halls.reduce((s, h) => s + h.usedKw, 0), circuitKw: halls.reduce((s, h) => s + h.circuitKw, 0),
    racks: racks.length, occupied: racks.filter((r) => r.status === 'occupied').length,
    meanInletC: Math.round((halls.reduce((s, h) => s + h.meanInletC * h.racks, 0) / racks.length) * 10) / 10,
    maxInletC: Math.max(...halls.map((h) => h.maxInletC)), maxDensityKw: Math.max(...halls.map((h) => h.maxDensityKw)),
  };
  const scopeRacks = hall ? racks.filter((r) => r.hall_id === hall.hallId) : racks;
  const occupiedKw = scopeRacks.filter((r) => r.status === 'occupied');
  const avgKw = occupiedKw.length ? Math.round((occupiedKw.reduce((s, r) => s + r.used_kw, 0) / occupiedKw.length) * 10) / 10 : 0;
  const maxKw = Math.max(...scopeRacks.map((r) => r.used_kw));
  // Under the thermal heatmap the inlet figures follow the scenario shown (e.g. a failed CRAH).
  const inletVals = overlay?.kind === 'thermal' ? scopeRacks.map((r) => overlay.values[r.rack_id]).filter((v) => v != null) : null;
  const inletMean = inletVals ? Math.round((inletVals.reduce((a, b) => a + b, 0) / inletVals.length) * 10) / 10 : scope.meanInletC;
  const inletMax = inletVals ? Math.max(...inletVals) : scope.maxInletC;
  const mix = site.alertMix;
  const mixText = [mix.critical && `${mix.critical} critical`, mix.high && `${mix.high} high`, mix.medium && `${mix.medium} medium`, mix.low && `${mix.low} low`].filter(Boolean).join(' · ');

  return (
    <div ref={rootRef} className="relative w-full h-full overflow-hidden" style={{ background: '#050B17', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <NexusTwin
        facilityId={facilityId}
        variant={mode === 'outer' ? 'site' : 'interior'}
        view={view}
        runKey={mode === 'heat' ? `${heatKind}:${failure}` : mode}
        overlay={overlay}
        focus={focus}
        isolate={isolate}
        callouts={callouts}
        fullscreenTarget={rootRef}
      />

      {/* View tabs and hall selector */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3 pointer-events-none">
        <div data-twin-reserved className="flex p-1 rounded-xl gap-1 pointer-events-auto" style={GLASS} role="tablist" aria-label="Twin view">
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition"
              style={mode === id ? { background: '#1D52A6', color: '#FFFFFF', fontSize: 13.5, fontWeight: 600, boxShadow: '0 0 18px rgba(63,169,245,0.35)' } : { color: '#9FB4CF', fontSize: 13.5 }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
        <div data-twin-reserved className="flex items-center gap-2 pointer-events-auto">
          {mode === 'heat' && (
            <div className="flex p-1 rounded-xl gap-1" style={GLASS} role="tablist" aria-label="Heatmap">
              {[['thermal', 'Thermal', Thermometer], ['power', 'Power', Zap]].map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={heatKind === id} onClick={() => setHeatKind(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={heatKind === id ? { background: '#1D52A6', color: '#FFFFFF', fontSize: 13, fontWeight: 600 } : { color: '#9FB4CF', fontSize: 13 }}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          )}
          {mode === 'heat' && heatKind === 'thermal' && (
            <button type="button" onClick={() => { setFailure((f) => !f); if (!failure) setHeatHall('MUM-1-H2'); }} aria-pressed={failure}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
              style={{ ...GLASS, color: failure ? '#FFFFFF' : '#E8EEF6', fontSize: 13, fontWeight: 600, background: failure ? 'rgba(230,57,70,0.85)' : GLASS.background, border: failure ? '1px solid #FF4D4D' : GLASS.border }}>
              <Wind size={15} />{failure ? `${FAIL_CRAH} failed · restore` : `Simulate ${FAIL_CRAH} failure`}
            </button>
          )}
          {mode !== 'outer' && (
            <select value={hallId} onChange={(e) => setHallId(e.target.value)} aria-label="Hall"
              className="rounded-xl px-3.5 py-2 outline-none cursor-pointer" style={{ ...GLASS, color: '#E8EEF6', fontSize: 13.5 }}>
              {mode === 'heat' && <option value="all" style={{ background: '#0A1628' }}>All halls</option>}
              {halls.map((h) => <option key={h.hallId} value={h.hallId} style={{ background: '#0A1628' }}>{h.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Status strip */}
      <div data-twin-reserved className="absolute top-[76px] left-4 flex gap-3 pointer-events-none flex-wrap max-w-[75%]">
        {mode === 'outer' ? (
          <>
            <Kpi Icon={Building2} label="Design IT capacity" value={`${site.designMw} MW`} bar={site.utilPct} sub={`${site.usedMw} MW (${site.utilPct}%) in use`} />
            <Kpi Icon={Activity} label="IT load" value={`${site.usedMw} MW`} sub={`${site.racks} racks · ${site.halls} halls`} tone="#22D3A7" />
            <Kpi Icon={Leaf} label={`PUE · ${site.pueMonth}`} value={site.pue.toFixed(2)} sub="Facility energy / IT energy" tone="#22D3A7" />
            <Kpi Icon={AlertTriangle} label="Open alerts" value={site.alerts} sub={mixText} tone="#F5A623" />
          </>
        ) : (
          <>
            <Kpi Icon={Gauge} label={hall ? `${hall.name} IT load` : 'IT load, all halls'} value={`${(scope.usedKw / 1000).toFixed(2)} MW`} bar={(scope.usedKw / scope.circuitKw) * 100} sub={`of ${(scope.circuitKw / 1000).toFixed(2)} MW power circuit`} />
            <Kpi Icon={Server} label="Racks" value={`${scope.occupied} / ${scope.racks}`} bar={(scope.occupied / scope.racks) * 100} sub={`${scope.racks - scope.occupied} free or blocked`} tone="#22D3A7" />
            <Kpi Icon={Zap} label="Power per occupied rack" value={`${avgKw} kW`} sub={`Max ${maxKw} kW · limit ${scope.maxDensityKw} kW`} tone="#F5A623" />
            <Kpi Icon={Thermometer} label={failure && overlay?.kind === 'thermal' ? 'Inlet temperature (est., failure)' : 'Inlet temperature (est.)'} value={`${inletMean} °C`} sub={`Max ${inletMax} °C · recommended ≤ ${ASHRAE.recommendedMaxC} °C`} tone={inletMax >= ASHRAE.recommendedMaxC ? '#FF4D4D' : '#22C9D6'} />
          </>
        )}
      </div>

      {/* Legend */}
      <div data-twin-reserved className="absolute bottom-4 left-4 pointer-events-none">
        {mode === 'heat' && overlay ? <RampLegend overlay={overlay} /> : (
          <div className="rounded-xl px-4 py-3" style={GLASS}>
            <p style={{ color: '#E8EEF6', fontSize: 12.5, fontWeight: 600 }}>{mode === 'outer' ? 'Status' : 'Rack fronts'}</p>
            <div className="mt-2 space-y-1.5">
              {(mode === 'outer' ? STATUS_DOT : [['Occupied', '#3FA9F5'], ['Free', '#2A3545'], ['Blocked', '#5B6472']]).map(([l, c]) => (
                <p key={l} className="flex items-center gap-2" style={{ color: '#9FB4CF', fontSize: 12 }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}`, border: c === '#2A3545' ? '1px solid #5B6472' : 'none' }} />{l}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{ color: 'rgba(159,180,207,0.7)', fontSize: 12 }}>
        Click any rack, unit or hall for details · Drag to rotate · Scroll to zoom
      </p>
    </div>
  );
}
