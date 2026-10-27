'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CloudSun, ArrowRight, Newspaper, ShieldAlert } from 'lucide-react';
import StatusBadge from '@/components/command-center/StatusBadge';
import { getWeatherByDataCenter } from '@/services/weatherService';
import { getRisksByDataCenter } from '@/services/riskService';
import { getNewsByDataCenter } from '@/services/newsService';
import { buildFacilityAiSummary } from '../utils/portfolioAnalytics';
import { SkeletonBlock } from './Skeleton';

const RISK_TO_STATUS = { Low: 'healthy', Medium: 'warning', High: 'critical' };

function Stat({ label, value }) {
  return (
    <div className="bg-[#F0F2F5] rounded-xl p-3">
      <p className="text-[10px] text-[#9CA3AF] mb-1">{label}</p>
      <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
    </div>
  );
}

function useFacilityDetail(facility) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!facility) { setDetail(null); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getWeatherByDataCenter(facility.id),
      getRisksByDataCenter(facility.id),
      getNewsByDataCenter(facility.id),
    ]).then(([weather, risks, news]) => {
      if (cancelled) return;
      setDetail({ weather, risks, news: news.slice(0, 3) });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [facility?.id]);

  return { detail, loading };
}

export default function IntelligenceDrawer({ facility, onClose, onOpenFacility }) {
  const { detail, loading } = useFacilityDetail(facility);

  useEffect(() => {
    if (!facility) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [facility, onClose]);

  return (
    <AnimatePresence>
      {facility && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[1000]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label={`${facility.name} facility details`}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-[1001] shadow-2xl overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCE3] sticky top-0 bg-white z-10">
              <div>
                <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{facility.name}</p>
                <p className="text-[10px] text-[#9CA3AF]">{facility.city}, {facility.country} · {facility.region}</p>
              </div>
              <button onClick={onClose} aria-label="Close facility details" className="text-[#9CA3AF] hover:text-[#1A1F36] flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={facility.status === 'Active' ? 'healthy' : 'monitoring'} label={facility.status} showDot />
                <StatusBadge status={RISK_TO_STATUS[facility.riskFlag]} label={`${facility.riskFlag} Risk`} showDot />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Health Score" value={facility.healthScore} />
                <Stat label="Est. Capacity" value={`${facility.capacityMw} MW`} />
                <Stat label="Est. Servers" value={facility.servers.toLocaleString()} />
                <Stat label="PUE" value={facility.pue} />
                <Stat label="Renewable Energy" value={`${facility.renewablePct}%`} />
                <Stat label="Tier" value={facility.tier} />
              </div>

              {loading ? (
                <SkeletonBlock height="h-20" width="w-full" />
              ) : (
                <>
                  {detail?.weather && (
                    <div className="bg-[#F0F2F5] rounded-xl p-3 flex items-center gap-2.5">
                      <CloudSun size={16} className="text-[#005EB8] flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">Weather</p>
                        <p className="text-xs font-semibold text-[#1A1F36]">
                          {detail.weather.current.tempC}°C · {detail.weather.current.condition} · {detail.weather.current.humidityPct}% humidity
                        </p>
                      </div>
                    </div>
                  )}

                  {detail?.risks?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5 flex items-center gap-1">
                        <ShieldAlert size={11} /> Current Risks
                      </p>
                      <div className="space-y-1">
                        {detail.risks.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-xs">
                            <span className="text-[#6B7280]">{r.category}</span>
                            <StatusBadge status={RISK_TO_STATUS[r.level]} label={r.level} size="xs" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail?.news?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5 flex items-center gap-1">
                        <Newspaper size={11} /> Latest News
                      </p>
                      <div className="space-y-1.5">
                        {detail.news.map(n => (
                          <p key={n.id} className="text-[11px] text-[#1A1F36] leading-snug">{n.headline}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">AI Summary</p>
                <p className="text-xs text-[#6B7280] leading-relaxed bg-[#005EB8]/5 border border-[#005EB8]/15 rounded-xl p-3">
                  {buildFacilityAiSummary(facility)}
                </p>
              </div>

              <button
                onClick={() => onOpenFacility?.(facility)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00338D] hover:bg-[#002A73] text-white text-sm font-bold rounded-xl transition-colors"
              >
                Open Facility <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
