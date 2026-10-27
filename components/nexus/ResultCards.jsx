'use client';
// Right-hand result panels, one per scene. Every figure shown is an engine
// output passed through lib/nexus/format.js — nothing here computes a value.
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle, ShieldAlert, Flag, Siren, FileText } from 'lucide-react';
import { fmtKw, fmtLakh, fmtInr, fmtNumber, fmtUpTo, fmtDuration } from '@/lib/nexus/format';
import { getHall } from '@/lib/nexus/data';
import { embodiedCarbonOfStranded } from '@/lib/nexus/carbon-engine';
import Link from 'next/link';
import { legendColor } from './palette';
import TelemetryChart from './TelemetryChart';

const TONE = {
  good: { fg: '#4ade80', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.35)' },
  warn: { fg: '#fbbf24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)' },
  bad: { fg: '#f87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)' },
  info: { fg: '#7dd3fc', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' },
};

export function Badge({ tone = 'info', children }) {
  const t = TONE[tone];
  return <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide" style={{ color: t.fg, background: t.bg, border: `1px solid ${t.border}` }}>{children}</span>;
}

const Section = ({ title, tone, children }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: tone ? TONE[tone].fg : 'rgba(255,255,255,0.4)' }}>{title}</p>
    {children}
  </div>
);

const Stat = ({ label, value, sub }) => (
  <div className="bg-white/[0.04] rounded-lg px-2.5 py-2">
    <p className="text-[9.5px] text-white/45">{label}</p>
    <p className="text-sm font-semibold text-white">{value}</p>
    {sub && <p className="text-[9.5px] text-white/40">{sub}</p>}
  </div>
);

export function Narration({ text, narrating, source }) {
  return (
    <Section title="Advisory">
      {narrating && !text ? (
        <div className="space-y-2 animate-pulse" aria-label="Advisory loading">
          <div className="h-2.5 bg-white/10 rounded w-full" />
          <div className="h-2.5 bg-white/10 rounded w-5/6" />
          <div className="h-2.5 bg-white/10 rounded w-2/3" />
        </div>
      ) : (
        <p className="text-xs text-white/75 leading-relaxed">{text}{narrating && <span className="inline-block w-1.5 h-3 bg-white/50 ml-0.5 animate-pulse align-middle" />}</p>
      )}
      {!narrating && text && (
        <p className="text-[9.5px] text-white/30 mt-1.5">
          {source === 'llm' ? 'Analyst brief from computed figures; every number checked against the result.' : 'Brief generated from computed figures.'}
        </p>
      )}
    </Section>
  );
}

// One panel for every result: it animates in on open and out on close, and
// switching scenes swaps its content in place (scrolled back to the top).
export function ResultShell({ children, onClose, meta, scrollKey }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); }, [scrollKey]);
  return (
    <motion.aside
      ref={ref}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="absolute top-0 right-0 bottom-0 w-[420px] bg-[#0a1220]/96 border-l border-white/10 backdrop-blur-md z-30 overflow-y-auto"
      data-testid="result-panel"
    >
      <div className="p-4 space-y-4">
        <div className="flex justify-end -mb-2">
          <button onClick={onClose} aria-label="Close result" className="text-white/40 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        {children}
        {meta && <p className="text-[9.5px] text-white/25 font-mono">{meta}</p>}
      </div>
    </motion.aside>
  );
}

// ─── Scene 1 ───────────────────────────────────────────────────────────────
export function StrandedCard({ result, narration }) {
  const embodied = embodiedCarbonOfStranded(result.facilityId);
  const structural = result.byRow.filter((r) => r.classification === 'structural');
  const planned = result.byRow.filter((r) => r.classification === 'planned headroom').sort((a, b) => a.rowId.localeCompare(b.rowId));
  return (
    <>
      <div className="flex items-start justify-between"><Badge tone="warn">Structural stranding</Badge></div>
      <div>
        <p className="text-4xl font-semibold text-white">{fmtKw(result.structuralKw)}</p>
        <p className="text-xs text-white/55 mt-1">of installed power that cooling or space won't let you use</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Annual carrying cost" value={fmtInr(result.annualCarryingCostInr)} />
        <Stat label="Revenue it can't earn" value={fmtInr(result.revenueOpportunityInr)} sub="per year" />
        <Stat label="Capital tied up" value={fmtInr(result.capitalTiedUpInr)} />
      </div>
      <Section title="Where it is">
        <div className="space-y-1.5">
          {structural.map((r) => (
            <div key={r.rowId} className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: legendColor(r.limitedBy === 'space' ? 'stranded-space' : 'stranded-cooling') }} />
              <span className="font-mono text-white/85 w-12">Row {r.rowId}</span>
              <span className="font-mono text-white flex-1">{fmtKw(r.strandedKw)}</span>
              <span className="text-white/55">{r.limitedBy}-limited</span>
            </div>
          ))}
        </div>
      </Section>
      {result.plannedHeadroomKw > 0 && (
        <div className="rounded-lg border border-[#38bdf8]/30 bg-[#38bdf8]/[0.07] px-3 py-2.5">
          <p className="text-xs text-white/85"><span className="font-semibold">{fmtKw(result.plannedHeadroomKw)}</span> in {getHall(planned[0].hallId).name} is <span className="font-semibold">planned headroom</span> — deliberate provisioning, not waste.</p>
          <p className="text-[10px] text-white/45 mt-1 font-mono">Rows {planned.map((r) => r.rowId).join(', ')}</p>
        </div>
      )}
      {embodied.strandedKw > 0 && (
        <div className="rounded-lg border border-[#00B0A0]/35 bg-[#00B0A0]/[0.08] px-3 py-2.5">
          <p className="text-xs text-white/85"><span className="font-semibold">{fmtKw(embodied.strandedKw)}</span> of stranded capacity already carries an estimated <span className="font-semibold">{fmtNumber(embodied.estimatedEmbodiedTco2)} tCO2e</span> of embodied carbon. Recovering it avoids building that again.</p>
          <p className="text-[10px] text-white/45 mt-1">{embodied.intensityTco2PerKw} tCO2e per kW of facility infrastructure (Wadenstein &amp; Vanderbauwhede, 2025). <Link href="/command-center/clean-energy" className="text-[#7FD8CF] hover:underline">Clean energy and carbon →</Link></p>
        </div>
      )}
      <Narration {...narration} />
    </>
  );
}

// ─── Scene 2 ───────────────────────────────────────────────────────────────
function ConstraintBar({ label, racks, kw, requested, binding }) {
  const pct = Math.min(100, (racks / Math.max(requested, 1)) * 100);
  return (
    <div>
      <div className="flex justify-between mb-1 text-[11px]">
        <span className="text-white/65">{label}{binding && <span className="ml-1.5 text-[9.5px] font-bold text-[#f87171] uppercase">binds</span>}</span>
        <span className="font-mono text-white/85">{racks} racks{kw != null ? ` · ${fmtKw(kw)}` : ''}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: binding ? '#ef4444' : '#3987e5' }} />
      </div>
    </div>
  );
}

export function CapacityCard({ result, narration }) {
  const verdict = result.feasible ? ['good', 'Yes'] : result.deployableRackCount > 0 ? ['warn', 'Partially'] : ['bad', 'No'];
  const eligibleRows = result.rowBreakdown.filter((r) => r.eligible);
  return (
    <>
      <Badge tone={verdict[0]}>{verdict[1]}</Badge>
      <div>
        <p className="text-4xl font-semibold text-white">{fmtKw(result.deployableKw)}</p>
        <p className="text-xs text-white/55 mt-1">deployable today — {result.deployableRackCount} of {result.requestedRacks} racks at {result.densityKw} kW{result.eligibleHalls.length ? ` in ${result.eligibleHalls.map((h) => getHall(h).name).join(', ')}` : ''}</p>
      </div>
      <Section title={`Each constraint on its own (of ${result.requestedRacks} racks requested)`}>
        <div className="space-y-2.5">
          <ConstraintBar label="Space" racks={result.maxBySpace} requested={result.requestedRacks} binding={result.bindingConstraint === 'space'} />
          <ConstraintBar label="Power" racks={result.maxByPower} kw={result.maxByPower * result.densityKw} requested={result.requestedRacks} binding={result.bindingConstraint === 'power'} />
          <ConstraintBar label="Cooling" racks={result.maxByCooling} kw={result.maxByCooling * result.densityKw} requested={result.requestedRacks} binding={result.bindingConstraint === 'cooling'} />
        </div>
      </Section>
      {eligibleRows.length > 0 && (
        <Section title={`Rows rated for ${result.densityKw} kW`}>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-[11px] tabular-nums">
              <thead><tr className="bg-white/5 text-white/45 text-[10px]"><th className="text-left px-2 py-1.5">Row</th><th className="text-right px-2">Free</th><th className="text-right px-2">Power hdrm</th><th className="text-right px-2">Cooling hdrm</th><th className="text-right px-2">Deploy</th></tr></thead>
              <tbody>
                {eligibleRows.map((r) => (
                  <tr key={r.rowId} className="border-t border-white/5 text-white/80 font-mono">
                    <td className="px-2 py-1">{r.rowId}</td><td className="text-right px-2">{r.freePositions}</td><td className="text-right px-2">{fmtKw(r.powerHeadroomKw)}</td><td className="text-right px-2">{fmtKw(r.coolingHeadroomKw)}</td><td className="text-right px-2 text-[#4ade80]">{r.allocatedRacks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-white/35 mt-1">Headroom is pooled across the hall's shared busway and cooling plant.</p>
        </Section>
      )}
      {result.requiredUpgrades.length > 0 && (
        <Section title="To take the whole request" tone="bad">
          <ul className="space-y-1">{result.requiredUpgrades.map((u) => <li key={u.resource} className="text-xs text-white/70">• {u.description}</li>)}</ul>
        </Section>
      )}
      <Narration {...narration} />
      <button className="w-full flex items-center justify-center gap-2 bg-[#00338D] hover:bg-[#002A73] text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
        <FileText size={13} /> Quote {fmtKw(result.deployableKw)} now
      </button>
    </>
  );
}

// ─── Density ───────────────────────────────────────────────────────────────
export function DensityCard({ result, narration }) {
  const ready = result.filter((r) => r.aiReady);
  const halls = [...new Set(result.map((r) => r.hallId))];
  return (
    <>
      <Badge tone="info">Density readiness</Badge>
      <div>
        <p className="text-4xl font-semibold text-white">{ready.length} of {result.length} rows</p>
        <p className="text-xs text-white/55 mt-1">rated 50 kW per rack or more (AI-ready)</p>
      </div>
      <Section title="By hall">
        <div className="space-y-1.5">
          {halls.map((h) => {
            const rows = result.filter((r) => r.hallId === h);
            const r0 = rows[0];
            return (
              <div key={h} className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: legendColor(`band-${r0.band}`) }} />
                <span className="text-white/85 w-14">{getHall(h).name}</span>
                <span className="font-mono text-white/60 flex-1">Rows {rows.map((r) => r.rowId).join('')}</span>
                <span className="font-mono text-white">{r0.maxDensityKw} kW/rack</span>
              </div>
            );
          })}
        </div>
      </Section>
      <Narration {...narration} />
    </>
  );
}

// ─── Scene 3 / failure ─────────────────────────────────────────────────────
const VERDICT = { feasible: ['good', 'Feasible'], feasible_with_upgrades: ['warn', 'Feasible with upgrades'], not_feasible: ['bad', 'Not feasible'] };

function UtilRow({ i }) {
  const width = (v) => `${Math.min(100, v / 2)}%`; // bar spans 0–200%
  const color = i.status === 'exceeded' ? '#ef4444' : i.status === 'redundancy_lost' ? '#a855f7' : '#f59e0b';
  return (
    <div className="bg-white/[0.04] rounded-lg px-2.5 py-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="font-mono text-white/85">{i.componentId}</span>
        <span className="font-mono text-white/70">{i.oldUtilisationPct}% → <span className="text-white">{i.newUtilisationPct}%</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 relative overflow-hidden">
        <div className="absolute h-full bg-white/25" style={{ width: width(i.oldUtilisationPct) }} />
        <div className="absolute h-full rounded-full" style={{ width: width(i.newUtilisationPct), background: color, opacity: 0.85 }} />
        <div className="absolute h-full w-px bg-white/60" style={{ left: '50%' }} title="100%" />
      </div>
    </div>
  );
}

const SecondaryRow = ({ label, v, unit, dp = 0, scale = 1, worseWhenUp = true }) => {
  if (!v) return null;
  const changed = v.after !== v.before;
  const worse = worseWhenUp ? v.after > v.before : v.after < v.before;
  const delta = v.delta / scale;
  return (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-0 gap-2">
      <span className="text-white/55">{label}</span>
      <span className="font-mono text-white/80 tabular-nums text-right">
        {fmtUpTo(v.before / scale, dp)}{unit} → <span style={{ color: changed ? (worse ? '#f87171' : '#4ade80') : undefined }}>{fmtUpTo(v.after / scale, dp)}{unit}</span>
        {changed && <span className="text-white/45"> ({delta > 0 ? '+' : '−'}{fmtUpTo(Math.abs(delta), dp)})</span>}
      </span>
    </div>
  );
};

export function ImpactReport({ result, narration }) {
  const [tone, label] = VERDICT[result.verdict];
  const se = result.secondaryEffects;
  const tight = result.impacts.filter((i) => i.status === 'tight');
  const failed = result.impacts.filter((i) => i.status === 'failed');
  return (
    <>
      <Badge tone={tone}>{label}</Badge>
      <Section title="The change">
        {result.rowChanges.map((c) => (
          <p key={c.rowId} className="text-sm text-white/90">Row {c.rowId}: {c.rackCount} racks from {c.oldDensityKw} kW to {c.newDensityKw} kW. {fmtKw(c.oldKw)} → {fmtKw(c.newKw)}</p>
        ))}
        {failed.map((f) => <p key={f.componentId} className="text-sm text-white/90">{f.label} ({f.componentId}) fails{f.outage ? ' — no redundant peer' : ''}.</p>)}
        {result.breakingPoint?.firstConstraint && (
          <p className="text-xs text-white/60 mt-1">Holds up to {result.breakingPoint.maxDensityKw} kW/rack; at {result.breakingPoint.breaksAtDensityKw} kW {result.breakingPoint.firstConstraint} is the first to exceed its limit.</p>
        )}
      </Section>
      {result.breakingPoints.length > 0 && (
        <Section title={`Breaks immediately (${result.breakingPoints.length})`} tone="bad">
          <div className="space-y-1.5">{result.breakingPoints.map((i) => <UtilRow key={i.componentId} i={i} />)}</div>
        </Section>
      )}
      {result.redundancyLosses.length > 0 && (
        <Section title="Redundancy lost" tone={undefined}>
          <div className="rounded-lg border border-[#a855f7]/35 bg-[#a855f7]/10 px-3 py-2.5 space-y-1">
            <p className="text-xs text-white/85 flex items-center gap-1.5"><ShieldAlert size={13} className="text-[#c084fc]" /> {result.redundancyLosses.map((i) => i.componentId).join(' / ')} can no longer cover a failure</p>
            {result.redundancyLosses.slice(0, 1).map((i) => (
              <p key={i.componentId} className="text-[11px] text-white/60 font-mono">Pair load {fmtUpTo(i.newLoad, 1)} {i.unit} against {fmtUpTo(i.deratedCapacity, 1)} {i.unit} per unit</p>
            ))}
          </div>
        </Section>
      )}
      {tight.length > 0 && (
        <Section title={`Tight (${tight.length})`} tone="warn">
          <div className="space-y-1.5">{tight.map((i) => <UtilRow key={i.componentId} i={i} />)}</div>
        </Section>
      )}
      <Section title="Secondary effects">
        <div className="bg-white/[0.04] rounded-lg px-2.5">
          <SecondaryRow label="Chilled water flow" v={se.chwFlowLpm} unit=" LPM" />
          <SecondaryRow label="Annual energy" v={se.annualEnergyGwh} unit=" GWh" dp={2} />
          <SecondaryRow label="Annual water" v={se.annualWaterLitres} unit=" M L" dp={2} scale={1e6} />
          <SecondaryRow label="PUE" v={se.pue} unit="" dp={2} />
          <SecondaryRow label="Generator runtime" v={se.generatorRuntimeHours} unit=" h" dp={1} worseWhenUp={false} />
        </div>
      </Section>
      {result.requiredUpgrades.length > 0 && (
        <Section title="Required upgrades">
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-[11px] tabular-nums">
              <thead><tr className="bg-white/5 text-white/45 text-[10px]"><th className="text-left px-2 py-1.5">Component</th><th className="text-left px-2">Fix</th><th className="text-right px-2">₹ lakh</th><th className="text-right px-2">Weeks</th></tr></thead>
              <tbody>
                {result.requiredUpgrades.map((u) => (
                  <tr key={u.componentId} className="border-t border-white/5 text-white/80">
                    <td className="px-2 py-1 font-mono">{u.componentId}</td><td className="px-2 py-1 text-white/65">{u.description}</td><td className="text-right px-2 font-mono">{u.costInrLakh}</td><td className="text-right px-2 font-mono">{u.leadTimeWeeks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-white/55">Total <span className="text-white font-semibold">{fmtLakh(result.totalUpgradeCostInrLakh)}</span></span>
            <span className="text-white/55">Critical path <span className="text-white font-semibold">{result.criticalPathWeeks} weeks</span></span>
          </div>
        </Section>
      )}
      {result.unresolvedComponents.length > 0 && (
        <p className="text-[11px] text-[#f87171]">No upgrade option in the dataset for: {result.unresolvedComponents.join(', ')}</p>
      )}
      <Narration {...narration} />
    </>
  );
}

// ─── Scene 4 ───────────────────────────────────────────────────────────────
const longDate = (ts) => {
  const [d, t] = ts.split(' ');
  const [, m, day] = d.split('-');
  return `${t} on ${Number(day)} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]}`;
};

export function ReplayPanel({ result, narration }) {
  return (
    <>
      <div className="flex items-center gap-2"><Badge tone="bad">{result.incident.severity}</Badge><span className="text-[11px] font-mono text-white/50">{result.incident.incident_id} · {result.incident.component_id}</span></div>
      <div>
        <p className="text-4xl font-semibold text-white">{fmtDuration(result.leadMinutes)}</p>
        <p className="text-xs text-white/55 mt-1">earlier than the operator detected it. {result.incident.description}.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.04] rounded-lg px-2.5 py-2">
          <p className="text-[9.5px] text-white/45 flex items-center gap-1"><Flag size={10} className="text-[#fab219]" /> Agent flagged</p>
          <p className="text-sm font-semibold text-white">{longDate(result.flaggedAt)}</p>
        </div>
        <div className="bg-white/[0.04] rounded-lg px-2.5 py-2">
          <p className="text-[9.5px] text-white/45 flex items-center gap-1"><Siren size={10} className="text-[#d03b3b]" /> Operator detected</p>
          <p className="text-sm font-semibold text-white">{longDate(result.detectedAt)}</p>
        </div>
      </div>
      <TelemetryChart readings={result.readings} flaggedAt={result.flaggedAt} detectedAt={result.detectedAt} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Scheduled swap (acting on the flag)" value={result.scheduledCostInrLakh != null ? fmtLakh(result.scheduledCostInrLakh) : '—'} />
        <Stat label="Emergency response (what happened)" value={fmtLakh(result.emergencyCostInrLakh)} />
      </div>
      {result.patternIncidents.length > 0 && (
        <Section title="Same failure pattern before">
          <ul className="space-y-1">
            {result.patternIncidents.map((p) => (
              <li key={p.incidentId} className="text-[11px] text-white/65 flex items-center gap-1.5"><AlertTriangle size={11} className="text-[#fbbf24]" /><span className="font-mono">{p.incidentId}</span> {p.componentId} · {p.description} · {fmtLakh(p.costInrLakh)}</li>
            ))}
          </ul>
        </Section>
      )}
      <Narration {...narration} />
    </>
  );
}

export function Legend({ items, left }) {
  if (!items?.length) return null;
  return (
    <div className="absolute bottom-4 z-20 flex flex-col gap-1 pointer-events-none bg-[#070d18]/85 border border-white/10 rounded-lg px-3 py-2 max-w-[260px]" style={{ left }} data-testid="legend">
      {items.map((l) => (
        <div key={l.label} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: legendColor(l.state), outline: ['redundancy_lost', 'failed', 'alert'].includes(l.state) ? '1.5px solid #c084fc' : 'none' }} />
          <span className="text-[10px] text-white/70">{l.label}</span>
        </div>
      ))}
    </div>
  );
}


// ─── Thermal ───────────────────────────────────────────────────────────────
export function ThermalCard({ result, narration, onFail }) {
  const { map, summary, crahs } = result;
  const f = map.failure;
  const hottest = [...map.rows].sort((a, b) => b.maxInletC - a.maxInletC)[0];
  return (
    <>
      <div className="flex items-start justify-between">
        <Badge tone={f ? (f.holds ? 'warn' : 'bad') : 'info'}>{f ? `${f.crahId} failure · estimate` : 'Inlet temperature · estimate'}</Badge>
      </div>
      {f ? (
        <div>
          <p className="text-4xl font-semibold text-white">{hottest.maxInletC} °C</p>
          <p className="text-xs text-white/55 mt-1">hottest estimated inlet in Row {f.rowId} — {f.holds ? 'within' : 'beyond'} the surviving unit's rating</p>
        </div>
      ) : (
        <div>
          <p className="text-4xl font-semibold text-white">{summary.tightestRows[0].marginC} °C</p>
          <p className="text-xs text-white/55 mt-1">smallest margin to the 27 °C recommended inlet limit (Row {summary.tightestRows[0].rowId})</p>
        </div>
      )}
      {f && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Survivor loading" value={`${f.utilisationAfterPct}%`} sub={`${f.survivors.join(', ')}, was ${f.utilisationBeforePct}%`} />
          <Stat label="Row heat load" value={`${f.loadKw} kW`} sub={`rating ${f.survivorCapacityKw} kW`} />
          <Stat label="Inlet rise" value={`+${f.riseC} °C`} sub="steady-state estimate" />
        </div>
      )}
      <Section title="Rows that cannot lose a CRAH">
        <p className="text-xs text-white/75 mb-1.5">{summary.exposedRows.length} of {map.rows.length} rows: the surviving unit would run past its rating.</p>
        <div className="flex flex-wrap gap-1">
          {summary.exposedRows.map((r) => (
            <button key={r} onClick={() => onFail?.(`CRAH-${r}-01`)} className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-white/80 hover:bg-white/[0.12]">Row {r}</button>
          ))}
        </div>
      </Section>
      <Section title="Simulate a CRAH failure">
        <div className="flex gap-2">
          <select value={f?.crahId ?? ''} onChange={(e) => onFail?.(e.target.value || null)} aria-label="CRAH to fail"
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="">None — current state</option>
            {crahs.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
      </Section>
      <Narration {...narration} />
      <p className="text-[9.5px] text-white/35">Estimated from each row's cold-aisle sensors and CRAH loading; failure rise is a modelled steady state.</p>
    </>
  );
}
