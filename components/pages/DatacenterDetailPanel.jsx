'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Radio, Award, Users, Wifi, Server, Bot, Leaf, Network, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { getCountryColor, getPUEColor, getTierColor } from '@/utils/helpers';
import { formatDatacenterForAI } from '@/lib/datacenter-data';
import { StatusBadge } from '@/components/shared/Badge';
import { LoadingDots } from '@/components/shared/LoadingDots';

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#00B0A0]/15 text-[#00B0A0] border border-[#00B0A0]/25 font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00B0A0] animate-pulse inline-block" />LIVE
    </span>
  );
}

const IX_BENCHMARK = 8;
const NET_BENCHMARK = 150;

export default function DatacenterDetailPanel({ dc, onClose, onAskAI, extraMetrics = [] }) {
  const [liveData, setLiveData] = useState(null);
  const [liveSummary, setLiveSummary] = useState('');
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    if (!dc) return;
    setLiveData(null); setLiveSummary(''); setLiveLoading(true);
    fetch('/api/facility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: dc.name, city: dc.city, country: dc.country, existingData: formatDatacenterForAI(dc) }),
    })
      .then(r => r.json())
      .then(d => { setLiveData(d.liveData || null); setLiveSummary(d.summary || ''); })
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  }, [dc?.id]);

  const hasSustainability = dc.sustainability?.solar_onsite_kw || dc.sustainability?.carbon_neutral_target_year || dc.sustainability?.water_recycling != null;

  const benchmarkData = liveData
    ? [
        { name: 'IX Points', value: liveData.ix_count ?? 0, benchmark: IX_BENCHMARK },
        { name: 'Networks', value: liveData.net_count ?? 0, benchmark: NET_BENCHMARK },
      ]
    : null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 h-full w-96 bg-[#111827] border-l border-white/10 z-[900] flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-5 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${getCountryColor(dc.country)}cc 0%, #111827 100%)` }}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={dc.status} />
            {!liveLoading && liveData && <LiveBadge />}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-0.5">
            <X size={18} />
          </button>
        </div>
        <h2 className="text-white font-bold text-base leading-tight mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          {dc.name}
        </h2>
        <p className="text-white/60 text-sm">{dc.operator} · {dc.city}, {dc.country}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Expanded metrics grid — 8 cells */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Capacity',     value: `${dc.capacity_mw} MW`,                                        color: '#005EB8' },
            { label: 'Tier Rating',  value: dc.tier_rating,                                                color: getTierColor(dc.tier_rating) },
            { label: 'PUE',          value: (dc.pue ?? 0).toFixed(2),                                     color: getPUEColor(dc.pue ?? 0) },
            { label: 'Renewable',    value: `${dc.renewable_energy_pct ?? 0}%`,                            color: '#00B0A0' },
            { label: 'Rack Count',   value: dc.rack_count ? dc.rack_count.toLocaleString() : '—',          color: '#005EB8' },
            { label: 'Area (sqft)',  value: dc.total_area_sqft ? `${Math.round(dc.total_area_sqft / 1000)}k` : '—', color: '#6B7280' },
            { label: 'Commissioned', value: dc.year_commissioned ?? '—',                                   color: '#E87722' },
            { label: 'Cooling',      value: dc.cooling_type ? dc.cooling_type.split(' ')[0] : '—',         color: '#005EB8' },
            ...extraMetrics,
          ].map((m, i) => (
            <div key={i} className="bg-white/[0.05] rounded-xl p-3 border border-white/[0.06]">
              <div className="text-[10px] text-white/35 mb-1 uppercase tracking-wide">{m.label}</div>
              <div className="font-bold text-sm leading-tight" style={{ color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Sustainability */}
        {hasSustainability && (
          <div className="bg-[#00B0A0]/5 rounded-xl border border-[#00B0A0]/15 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Leaf size={13} className="text-[#00B0A0]" />
              <span className="text-white/55 text-[10px] font-bold uppercase tracking-wider">Sustainability</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {dc.sustainability?.solar_onsite_kw > 0 && (
                <div>
                  <div className="text-[#00B0A0] font-mono font-bold text-sm">
                    {(dc.sustainability.solar_onsite_kw / 1000).toFixed(1)}MW
                  </div>
                  <div className="text-white/35 text-[9px] mt-0.5">Solar Onsite</div>
                </div>
              )}
              <div>
                <div className={`font-mono font-bold text-sm ${dc.sustainability?.water_recycling ? 'text-[#00B0A0]' : 'text-white/20'}`}>
                  {dc.sustainability?.water_recycling ? '✓' : '✗'}
                </div>
                <div className="text-white/35 text-[9px] mt-0.5">Water Recycling</div>
              </div>
              {dc.sustainability?.carbon_neutral_target_year && (
                <div>
                  <div className="text-[#00B0A0] font-mono font-bold text-sm">
                    {dc.sustainability.carbon_neutral_target_year}
                  </div>
                  <div className="text-white/35 text-[9px] mt-0.5">Carbon Neutral</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connectivity */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Network size={13} className="text-[#005EB8]" />
            <span className="text-white/55 text-[10px] font-bold uppercase tracking-wider">Connectivity</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="bg-white/[0.05] rounded-lg p-2.5 border border-white/[0.06]">
              <div className="text-[#005EB8] font-mono font-bold text-sm">{dc.connectivity?.network_carriers ?? '—'}</div>
              <div className="text-white/35 text-[9px] mt-0.5">Carriers</div>
            </div>
            <div className="bg-white/[0.05] rounded-lg p-2.5 border border-white/[0.06]">
              <div className="text-[#005EB8] font-mono font-bold text-sm">
                {liveLoading ? <LoadingDots color="#005EB8" size={4} /> : (liveData?.ix_count ?? '—')}
              </div>
              <div className="text-white/35 text-[9px] mt-0.5">IX Points</div>
            </div>
            <div className="bg-white/[0.05] rounded-lg p-2.5 border border-white/[0.06]">
              <div className="text-[#00B0A0] font-mono font-bold text-sm">
                {liveLoading ? <LoadingDots color="#00B0A0" size={4} /> : (liveData?.net_count ?? '—')}
              </div>
              <div className="text-white/35 text-[9px] mt-0.5">Networks</div>
            </div>
          </div>

          {/* Benchmark chart */}
          {benchmarkData && (
            <div>
              <div className="text-white/25 text-[9px] uppercase tracking-wider mb-1.5">vs. Industry Benchmark</div>
              <ResponsiveContainer width="100%" height={52}>
                <BarChart data={benchmarkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
                  <Bar dataKey="benchmark" fill="rgba(255,255,255,0.07)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="value" fill="#005EB8" radius={[2, 2, 0, 0]} />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ background: '#0A1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                    itemStyle={{ color: '#005EB8' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Submarine cables */}
          {dc.connectivity?.submarine_cables?.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wifi size={11} className="text-[#00B0A0]" />
                <span className="text-white/40 text-[9px] uppercase tracking-wider font-semibold">Submarine Cables</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dc.connectivity.submarine_cables.map((c, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#00B0A0]/10 text-[#00B0A0] rounded border border-[#00B0A0]/20">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Cloud on-ramps */}
          {dc.connectivity?.cloud_on_ramps?.length > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Server size={11} className="text-[#005EB8]" />
                <span className="text-white/40 text-[9px] uppercase tracking-wider font-semibold">Cloud On-Ramps</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dc.connectivity.cloud_on_ramps.map((c, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#005EB8]/10 text-[#005EB8] rounded border border-[#005EB8]/20">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Intelligence Briefing */}
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Radio size={13} className="text-[#005EB8]" />
              <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Intelligence Briefing</span>
            </div>
            {!liveLoading && liveData && <LiveBadge />}
          </div>
          <div className="p-3">
            {liveLoading && (
              <div className="flex items-center gap-2 py-2">
                <LoadingDots color="#005EB8" size={6} />
                <span className="text-white/40 text-xs">Fetching live intelligence...</span>
              </div>
            )}
            {!liveLoading && liveSummary && (
              <div className="space-y-1.5">
                {liveSummary.split('\n').filter(Boolean).map((line, i) => {
                  const clean = line.replace(/#{1,3}\s*/g, '').replace(/\*\*/g, '').trim();
                  const isBullet = clean.startsWith('-') || clean.startsWith('•');
                  const isHeader = clean.length < 50 && !clean.endsWith('.') && i > 0;
                  return isHeader
                    ? <p key={i} className="text-white/45 text-[10px] font-bold uppercase tracking-wider mt-2">{clean}</p>
                    : <p key={i} className={`text-white/65 text-xs leading-relaxed ${isBullet ? 'pl-2' : ''}`}>
                        {isBullet ? '· ' + clean.replace(/^[-•]\s*/, '') : clean}
                      </p>;
                })}
              </div>
            )}
            {!liveLoading && !liveSummary && (
              <p className="text-white/25 text-xs italic">No live intelligence available.</p>
            )}
          </div>
        </div>

        {/* Certifications */}
        {dc.certifications?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award size={13} className="text-[#E87722]" />
              <span className="text-white/55 text-[10px] font-bold uppercase tracking-wider">Certifications</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dc.certifications.map((c, i) => (
                <span key={i} className="text-[10px] px-2 py-1 bg-[#E87722]/10 text-[#E87722] rounded-md border border-[#E87722]/20 font-medium">{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Key Tenants */}
        {dc.key_tenants?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={13} className="text-[#005EB8]" />
              <span className="text-white/55 text-[10px] font-bold uppercase tracking-wider">Key Tenants</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dc.key_tenants.map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-1 bg-white/[0.05] text-white/65 rounded-md border border-white/10">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notable Facts */}
        {dc.notable_facts?.length > 0 && (
          <div>
            <div className="text-white/55 text-[10px] font-bold uppercase tracking-wider mb-2">Notable Facts</div>
            <ul className="space-y-1.5">
              {dc.notable_facts.map((fact, i) => (
                <li key={i} className="flex gap-2 text-xs text-white/55 leading-relaxed">
                  <span className="text-[#005EB8] mt-0.5 flex-shrink-0">▸</span>{fact}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/[0.08] flex-shrink-0">
        <button
          onClick={onAskAI}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#00338D] hover:bg-[#002A73] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Bot size={16} />AI Facility Analysis
        </button>
      </div>
    </motion.div>
  );
}
