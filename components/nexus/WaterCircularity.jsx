'use client';
// Water circularity: treated share against a target the user sets, the
// policies that actually apply to the site, and the three standard reuse
// levers with volume, cost and payback. Figures from
// lib/nexus/water-circularity-engine.js over 14_water and 29_water_reuse_opportunities.
import { useMemo, useState } from 'react';
import { Recycle, CloudRain, Droplet, ShowerHead, Scale } from 'lucide-react';
import { circularityPosition, whatIfIncreasedTreatment } from '@/lib/nexus/water-circularity-engine';
import { getFacility } from '@/lib/nexus/data';
import { fmtNumber } from '@/lib/nexus/format';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const SITES = ['MUM-1', 'CHN-1'];
const ICON = { condensate: Droplet, greywater: ShowerHead, rainwater: CloudRain };
const ml = (litres) => `${fmtNumber(litres / 1e6, 1)} ML`;
const lakh = (v) => `₹${fmtNumber(v, v < 10 ? 1 : 0)} lakh`;

export default function WaterCircularity() {
  const [site, setSite] = useState('MUM-1');
  const [target, setTarget] = useState(40);
  const pos = useMemo(() => circularityPosition(site, { targetTreatedPct: target }), [site, target]);
  const what = useMemo(() => whatIfIncreasedTreatment(site, target), [site, target]);
  if (!pos) return null;

  return (
    <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B]"><Recycle size={14} className="text-[#00B0A0]" />Water circularity</h2>
          <p className="text-[11.5px] text-[#64748B]">What happens to water already used, and what more could be reused on site.</p>
        </div>
        <div className="flex p-1 rounded-lg bg-[#F0F2F5] gap-1" role="tablist" aria-label="Site">
          {SITES.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={site === id} onClick={() => setSite(id)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold ${site === id ? 'bg-white text-[#00338D] shadow-sm' : 'text-[#64748B]'}`}>{getFacility(id).name.replace('Nexus ', '')}</button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        {/* Treated share against target */}
        <div className="rounded-lg bg-[#F7FAFD] border border-[#D6E4F2] p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[12.5px] text-[#1A1F36] font-semibold">Treated share of water drawn</p>
            <p className="text-[11px] text-[#64748B]">{ml(pos.totalLitresPerYear)} a year · {pos.stress.label.toLowerCase()} stress</p>
          </div>
          <div className="relative h-4 rounded-full bg-[#D8DCE3] mt-3 overflow-visible" aria-label={`Treated ${pos.treatedSharePct}% against a target of ${target}%`}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#00B0A0]" style={{ width: `${pos.treatedSharePct}%` }} />
            {what.achievableTreatedPct > pos.treatedSharePct && (
              <div className="absolute inset-y-0 rounded-r-full" style={{ left: `${pos.treatedSharePct}%`, width: `${what.achievableTreatedPct - pos.treatedSharePct}%`, background: 'repeating-linear-gradient(45deg, #7FD8CF 0 4px, #B9ECE7 4px 8px)' }} />
            )}
            <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-[#00338D]" style={{ left: `${target}%` }} />
          </div>
          <div className="flex justify-between text-[11px] mt-1.5">
            <span className="text-[#00B0A0] font-semibold" style={MONO}>{pos.treatedSharePct}% today</span>
            <span className="text-[#00338D] font-semibold" style={MONO}>target {target}%</span>
          </div>
          <label className="flex items-center gap-3 mt-3 text-[12px] text-[#1A1F36]">
            Increase treated share to
            <input type="range" min={Math.ceil(pos.treatedSharePct)} max={90} step={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="flex-1 accent-[#00B0A0]" aria-label="Target treated share" />
            <b style={MONO}>{target}%</b>
          </label>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-md bg-white border border-[#D8DCE3] px-2.5 py-2"><p className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">Freshwater saved</p><p className="text-[14px] font-semibold text-[#00B0A0]" style={MONO}>{ml(what.litresSaved)}/yr</p></div>
            <div className="rounded-md bg-white border border-[#D8DCE3] px-2.5 py-2"><p className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">Capex · payback</p><p className="text-[14px] font-semibold text-[#1A1F36]" style={MONO}>{lakh(what.costInrLakh)} · {what.paybackYears != null ? `${what.paybackYears} y` : '—'}</p></div>
            <div className="rounded-md bg-white border border-[#D8DCE3] px-2.5 py-2"><p className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">Beyond on-site levers</p><p className="text-[14px] font-semibold" style={{ ...MONO, color: what.shortfallLitres ? '#E87722' : '#1A1F36' }}>{what.shortfallLitres ? ml(what.shortfallLitres) : 'None'}</p></div>
          </div>
          {what.shortfallLitres > 0 && <p className="text-[11px] text-[#64748B] mt-2">The levers below reach {what.achievableTreatedPct}%; the rest needs more treated recycle supply (municipal STP water).</p>}
        </div>

        {/* Policy that applies */}
        <div className="rounded-lg border border-[#D8DCE3] p-4">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1A1F36]"><Scale size={14} className="text-[#00338D]" />Policy that applies to {getFacility(site).name.replace('Nexus ', '')}</p>
          <ul className="mt-2 space-y-2">
            {pos.policies.map((p) => (
              <li key={p.policy} className="text-[12px] leading-snug">
                <span className="font-semibold text-[#00338D]">{p.jurisdiction} · {p.policy}</span>
                <span className="block text-[#64748B]">{p.detail}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#64748B] mt-3 pt-2 border-t border-[#D8DCE3]">
            {pos.incentiveLinked ? 'An incentive is linked to treated water use here.' : 'No treated-water incentive applies to this site; the target is set by the operator. Karnataka’s incentive applies to BLR-1.'}
          </p>
        </div>
      </div>

      {/* Reuse levers */}
      <div className="grid md:grid-cols-3 gap-3 mt-4">
        {pos.reuseOpportunities.map((l) => {
          const Icon = ICON[l.source] ?? Droplet;
          const used = what.leversUsed.find((u) => u.source === l.source);
          return (
            <div key={l.source} className={`rounded-lg border p-3.5 ${used ? 'border-[#00B0A0] bg-[#F2FBFA]' : 'border-[#D8DCE3]'}`}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#1A1F36] capitalize"><Icon size={15} className="text-[#005EB8]" />{l.source}</p>
                {used && <span className="text-[10.5px] font-semibold text-[#007A70]">In the plan</span>}
              </div>
              <p className="text-[11.5px] text-[#64748B] mt-1 leading-snug">{l.description}</p>
              <dl className="grid grid-cols-3 gap-1 mt-2.5 text-[11px]">
                <div><dt className="text-[#94A3B8]">Volume</dt><dd className="font-semibold text-[#1A1F36]" style={MONO}>{ml(l.volumeLitresPerYear)}/yr</dd></div>
                <div><dt className="text-[#94A3B8]">Capex</dt><dd className="font-semibold text-[#1A1F36]" style={MONO}>{lakh(l.costInrLakh)}</dd></div>
                <div><dt className="text-[#94A3B8]">Payback</dt><dd className="font-semibold" style={{ ...MONO, color: l.paybackYears != null ? '#1A1F36' : '#E87722' }}>{l.paybackYears != null ? `${l.paybackYears} y` : 'None'}</dd></div>
              </dl>
              <p className="text-[10.5px] text-[#94A3B8] mt-1.5">{l.treatmentNeeded}</p>
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] text-[#94A3B8] mt-2">Rainwater = roof catchment × annual rainfall (IMD normals) × 0.8 runoff. Payback = capex ÷ (water saved × site water cost − running cost).</p>
    </section>
  );
}
