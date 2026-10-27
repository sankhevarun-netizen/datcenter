'use client';
import { motion } from 'framer-motion';
import { X, Radio, ExternalLink } from 'lucide-react';
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

function ConnectivityBar({ label, value, benchmark, color }) {
  const score = Math.min(100, Math.round((value / benchmark) * 100));
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-white/40 text-[10px]">{label}</span>
        <span className="font-mono text-[10px] font-bold" style={{ color }}>{score}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}60, ${color})` }}
        />
      </div>
    </div>
  );
}

export default function PeeringDetailPanel({ facility, detail, loading, onClose }) {
  const liveData = detail?.liveData ?? null;
  const summary = detail?.summary ?? null;
  const hasMetrics = !loading && liveData && (liveData.ix_count != null || liveData.net_count != null);

  const websiteHost = liveData?.website
    ? liveData.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    : null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 h-full w-96 bg-[#111827] border-l border-white/10 z-[900] flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #111827 100%)' }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/30 text-slate-300 border border-slate-500/30 font-semibold">
              PeeringDB
            </span>
            {!loading && liveData && <LiveBadge />}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-0.5">
            <X size={18} />
          </button>
        </div>
        <h2 className="text-white font-bold text-base leading-tight mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          {facility.name}
        </h2>
        <p className="text-white/55 text-sm">
          {facility.org_name ? `${facility.org_name} · ` : ''}{facility.city}, {facility.country}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Hero IX / Network numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center bg-[#005EB8]/10 rounded-xl p-3.5 border border-[#005EB8]/20">
            <div className="text-[#005EB8] font-mono font-bold text-3xl leading-none mb-1">
              {loading ? <LoadingDots color="#005EB8" size={6} /> : (liveData?.ix_count ?? '—')}
            </div>
            <div className="text-white/45 text-xs">Internet Exchanges</div>
            <div className="text-white/20 text-[9px] mt-0.5">at this facility</div>
          </div>
          <div className="text-center bg-[#00B0A0]/10 rounded-xl p-3.5 border border-[#00B0A0]/20">
            <div className="text-[#00B0A0] font-mono font-bold text-3xl leading-none mb-1">
              {loading ? <LoadingDots color="#00B0A0" size={6} /> : (liveData?.net_count ?? '—')}
            </div>
            <div className="text-white/45 text-xs">Networks Present</div>
            <div className="text-white/20 text-[9px] mt-0.5">registered carriers</div>
          </div>
        </div>

        {/* Connectivity score bars */}
        {hasMetrics && (
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06] space-y-2.5">
            <div className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Connectivity Score vs. Benchmark</div>
            {liveData.ix_count != null && (
              <ConnectivityBar
                label="Internet Exchange Density"
                value={liveData.ix_count}
                benchmark={IX_BENCHMARK}
                color="#005EB8"
              />
            )}
            {liveData.net_count != null && (
              <ConnectivityBar
                label="Network Density"
                value={liveData.net_count}
                benchmark={NET_BENCHMARK}
                color="#00B0A0"
              />
            )}
          </div>
        )}

        {/* Intelligence Briefing */}
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Radio size={13} className="text-[#005EB8]" />
              <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Intelligence Briefing</span>
            </div>
            {!loading && liveData && <LiveBadge />}
          </div>
          <div className="p-3">
            {loading && (
              <div className="flex items-center gap-2 py-4">
                <LoadingDots color="#005EB8" size={6} />
                <span className="text-white/40 text-xs">Fetching live intelligence...</span>
              </div>
            )}
            {!loading && summary && (
              <div className="space-y-1.5">
                {summary.split('\n').filter(Boolean).map((line, i) => {
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
            {!loading && !summary && (
              <p className="text-white/25 text-xs italic py-2">No intelligence available for this facility.</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        {!loading && liveData && (
          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] space-y-2">
            {liveData.org && (
              <div className="flex justify-between gap-3">
                <span className="text-white/35 text-xs flex-shrink-0">Organisation</span>
                <span className="text-white/70 text-xs font-medium text-right truncate max-w-[180px]">{liveData.org}</span>
              </div>
            )}
            {liveData.address && (
              <div className="flex justify-between gap-3">
                <span className="text-white/35 text-xs flex-shrink-0">Address</span>
                <span className="text-white/55 text-[10px] text-right leading-relaxed max-w-[180px]">{liveData.address}</span>
              </div>
            )}
            {liveData.region_continent && (
              <div className="flex justify-between gap-3">
                <span className="text-white/35 text-xs flex-shrink-0">Region</span>
                <span className="text-white/70 text-xs font-medium">{liveData.region_continent}</span>
              </div>
            )}
            {liveData.status && (
              <div className="flex justify-between gap-3">
                <span className="text-white/35 text-xs flex-shrink-0">Status</span>
                <span className={`text-xs font-semibold capitalize ${liveData.status === 'ok' ? 'text-[#00B0A0]' : 'text-[#E87722]'}`}>
                  {liveData.status === 'ok' ? 'Active' : liveData.status}
                </span>
              </div>
            )}
            {liveData.website && websiteHost && (
              <div className="flex justify-between gap-3 items-center">
                <span className="text-white/35 text-xs flex-shrink-0">Website</span>
                <a
                  href={liveData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#005EB8] text-xs hover:underline flex items-center gap-1 truncate max-w-[180px]"
                >
                  {websiteHost}
                  <ExternalLink size={10} className="flex-shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/[0.08] flex-shrink-0">
        <p className="text-white/20 text-[10px] text-center">
          AI-generated · Sourced from PeeringDB + web · Not verified by KPMG
        </p>
      </div>
    </motion.div>
  );
}
