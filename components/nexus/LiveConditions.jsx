'use client';
// Live external conditions for one facility. Each category loads on its own
// so the panel fills in as sources answer and never blocks the page. Shown
// beside the site-risk scores, never inside them.
import { useEffect, useState } from 'react';
import { CloudSun, Activity, Megaphone, Landmark, Ship, Scale, Droplets, ExternalLink } from 'lucide-react';

const CATS = [
  ['weather', 'Weather, 7 days', CloudSun],
  ['seismic', 'Seismic', Activity],
  ['unrest', 'Unrest and outages', Megaphone],
  ['regulatory', 'Regulatory news', Landmark],
  ['supply', 'Supply chain', Ship],
  ['governance', 'Governance', Scale],
];
const STATUS = {
  live: ['#E6F6EF', '#00704A', 'Live'],
  cached: ['#EAF2FB', '#1D4E89', 'Cached'],
  stale: ['#FBF3DE', '#8A6508', 'Stale'],
  unavailable: ['#FDECEC', '#B42318', 'Unavailable'],
  paused: ['#EEF2F7', '#475569', 'Paused'],
  loading: ['#EEF2F7', '#94A3B8', 'Loading'],
};
const SEV = { high: '#B42318', medium: '#B54708', info: '#475569' };

function Category({ facilityId, id, label, Icon, offline }) {
  const [data, setData] = useState({ status: 'loading', signals: [] });
  useEffect(() => {
    let alive = true;
    setData({ status: 'loading', signals: [] });
    const q = offline ? `offline=1` : `category=${id}`;
    fetch(`/api/nexus/external-risk?facility=${facilityId}&${q}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setData(offline ? d.categories[id] : d); })
      .catch(() => { if (alive) setData({ status: 'unavailable', signals: [], summary: 'Request failed' }); });
    return () => { alive = false; };
  }, [facilityId, id, offline]);
  const [bg, fg, text] = STATUS[data.status] ?? STATUS.unavailable;
  return (
    <div className="rounded-lg border border-[#D8DCE3] p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1F36]"><Icon size={13} className="text-[#005EB8]" /> {label}</p>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color: fg }}>{text}{data.source ? ` · ${data.source}` : ''}</span>
      </div>
      {data.status === 'loading'
        ? <div className="h-3 bg-[#F1F5F9] rounded animate-pulse" />
        : <p className="text-[11px] text-[#64748B]">{data.summary}</p>}
      {data.signals?.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {data.signals.slice(0, 3).map((s, i) => (
            <li key={i} className="text-[11px] leading-snug">
              <span className="font-medium" style={{ color: SEV[s.severity] ?? SEV.info }}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.title} <ExternalLink size={9} className="inline" /></a> : s.title}</span>
              {s.detail && <span className="block text-[#94A3B8]">{s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {data.status === 'stale' && data.fetchedAt && <p className="text-[10px] text-[#8A6508] mt-1">Last good answer {data.fetchedAt.slice(0, 16).replace('T', ' ')} UTC</p>}
    </div>
  );
}

export default function LiveConditions({ facilities, offline = false }) {
  const [facilityId, setFacilityId] = useState(facilities[0]?.id);
  const [water, setWater] = useState(null);
  useEffect(() => {
    fetch(`/api/nexus/external-risk?facility=${facilityId}&offline=1`).then((r) => r.json()).then((d) => setWater(d.waterStress)).catch(() => setWater(null));
  }, [facilityId]);
  return (
    <section className="bg-white rounded-xl border border-[#D8DCE3] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Live external conditions</h2>
          <p className="text-[11px] text-[#94A3B8]">Two sources per category, cached; shown beside the scores, never inside them.</p>
        </div>
        <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} aria-label="Facility"
          className="text-xs text-[#334155] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5">
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {CATS.map(([id, label, Icon]) => <Category key={`${facilityId}-${id}`} facilityId={facilityId} id={id} label={label} Icon={Icon} offline={offline} />)}
        <div className="rounded-lg border border-[#D8DCE3] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1F36] mb-1"><Droplets size={13} className="text-[#005EB8]" /> Water stress</p>
          <p className="text-[11px] text-[#64748B]">{water ? `${water.label} (index ${water.index}) — from the operating record` : 'Not drawing water'}</p>
        </div>
      </div>
    </section>
  );
}
