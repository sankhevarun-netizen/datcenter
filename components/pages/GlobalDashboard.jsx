'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Globe, Zap, Leaf, Activity, Server, X, ArrowLeft, Search,
  Bot, Building2, Network
} from 'lucide-react';
import { Country } from 'country-state-city';
import { loadDatacenters, calculateGlobalStats, formatDatacenterForAI, filterPeeringFacilities } from '@/lib/datacenter-data';
import { getCountryColor } from '@/utils/helpers';
import { LoadingDots } from '@/components/shared/LoadingDots';
import AIChatPanel from '@/components/ai-chat/AIChatPanel';
import DatacenterDetailPanel from '@/components/pages/DatacenterDetailPanel';
import PeeringDetailPanel from '@/components/pages/PeeringDetailPanel';
import useAppStore from '@/store/appStore';

const GlobeViewer = dynamic(() => import('@/components/globe/GlobeViewer'), { ssr: false });

// Flag emoji lookup
const FLAG_MAP = {
  'India': '🇮🇳', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
  'Singapore': '🇸🇬', 'Germany': '🇩🇪', 'Australia': '🇦🇺',
  'Japan': '🇯🇵', 'France': '🇫🇷', 'Netherlands': '🇳🇱',
  'Canada': '🇨🇦', 'Brazil': '🇧🇷', 'UAE': '🇦🇪', 'United Arab Emirates': '🇦🇪',
  'South Korea': '🇰🇷', 'Hong Kong': '🇭🇰', 'China': '🇨🇳',
  'Ireland': '🇮🇪', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
  'Saudi Arabia': '🇸🇦', 'South Africa': '🇿🇦', 'Kenya': '🇰🇪',
  'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Denmark': '🇩🇰',
  'Norway': '🇳🇴', 'Finland': '🇫🇮', 'Poland': '🇵🇱',
  'Thailand': '🇹🇭', 'Vietnam': '🇻🇳', 'Malaysia': '🇲🇾',
  'Indonesia': '🇮🇩', 'Philippines': '🇵🇭', 'Taiwan': '🇹🇼',
  'New Zealand': '🇳🇿', 'Mexico': '🇲🇽', 'Egypt': '🇪🇬',
  'Nigeria': '🇳🇬', 'Israel': '🇮🇱', 'Portugal': '🇵🇹',
};

function flagEmoji(name) {
  return FLAG_MAP[name] ? FLAG_MAP[name] + ' ' : '';
}

function CountUpNumber({ target, duration = 2000, suffix = '', prefix = '', decimals = 0 }) {
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started) return;
    const start = Date.now();
    const step = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setCurrent((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);
  const display = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
  return (
    <span ref={ref} style={{ fontFamily: "'JetBrains Mono', monospace" }} className="font-mono font-bold">
      {prefix}{display}{suffix}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, suffix = '', prefix = '', decimals = 0, color = '#005EB8', sublabel = null, trendValue = null, index = 0 }) {
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="relative rounded-xl p-3.5 flex items-center gap-3 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.045)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }}
      />
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, boxShadow: `0 0 14px ${color}28` }}
      >
        <Icon size={17} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-white text-lg leading-none mb-0.5">
          <CountUpNumber target={Number(value)} suffix={suffix} prefix={prefix} decimals={decimals} />
        </div>
        <div className="text-white/40 text-[10px] leading-tight">{label}</div>
        {sublabel && <div className="text-white/22 text-[9px] mt-0.5">{sublabel}</div>}
      </div>
      {trendValue !== null && (
        <div className="ml-auto text-right flex-shrink-0">
          <span className={`text-[10px] font-bold ${trendValue >= 0 ? 'text-[#00B0A0]' : 'text-red-400'}`}>
            {trendValue >= 0 ? '↑' : '↓'}{Math.abs(trendValue)}%
          </span>
          <div className="text-white/20 text-[8px] mt-0.5">YoY</div>
        </div>
      )}
    </motion.div>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#00B0A0]/15 text-[#00B0A0] border border-[#00B0A0]/25 font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00B0A0] animate-pulse inline-block" />LIVE DATA
    </span>
  );
}

function DCListItem({ dc, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-all relative ${
        selected
          ? 'bg-[#005EB8]/12 border-l-2 border-l-[#005EB8]'
          : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-white/85 text-xs font-semibold truncate leading-tight" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {dc.name}
          </div>
          <div className="text-white/35 text-[10px] mt-0.5 truncate">{dc.city} · {dc.country}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[#005EB8] text-xs font-mono font-bold">{dc.capacity_mw}MW</div>
          <div className="text-white/30 text-[9px] mt-0.5">{dc.tier_rating}</div>
        </div>
      </div>
      {dc.renewable_energy_pct != null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${dc.renewable_energy_pct}%`,
                background: 'linear-gradient(90deg, rgba(0,163,108,0.5), #00B0A0)',
              }}
            />
          </div>
          <span className="text-white/25 text-[9px] flex-shrink-0">{dc.renewable_energy_pct}%</span>
        </div>
      )}
    </button>
  );
}

export default function GlobalDashboard() {
  const [dcData, setDcData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState(null);
  const { selectedCountry, setSelectedCountry, selectedDatacenter, setSelectedDatacenter } = useAppStore();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [localStats, setLocalStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [peeringRaw, setPeeringRaw] = useState([]);
  const [selectedPeeringFacility, setSelectedPeeringFacility] = useState(null);
  const [peeringDetail, setPeeringDetail] = useState(null);
  const [peeringDetailLoading, setPeeringDetailLoading] = useState(false);
  const [indiaFacilitiesRaw, setIndiaFacilitiesRaw] = useState([]);

  useEffect(() => {
    loadDatacenters().then(data => {
      setDcData(data);
      setLocalStats(calculateGlobalStats(data.datacenters));
      setLoading(false);
    });

    fetch('/api/global-stats')
      .then(r => r.json())
      .then(setGlobalStats)
      .catch(() => {});

    fetch('/api/peeringdb-facilities')
      .then(r => r.json())
      .then(data => { if (data.facilities?.length) setPeeringRaw(data.facilities); })
      .catch(() => {});

    fetch('/api/peeringdb-india')
      .then(r => r.json())
      .then(data => { if (data.facilities?.length) setIndiaFacilitiesRaw(data.facilities); })
      .catch(() => {});

    return () => setSelectedDatacenter(null);
  }, []);

  const peeringFacilities = useMemo(() => {
    const merged = [...peeringRaw];
    const existingIds = new Set(peeringRaw.map(f => f.id));
    for (const f of indiaFacilitiesRaw) {
      if (!existingIds.has(f.id)) merged.push(f);
    }
    if (!merged.length || !dcData) return merged;
    return filterPeeringFacilities(merged, dcData.datacenters);
  }, [peeringRaw, indiaFacilitiesRaw, dcData]);

  const peeringCountByCountry = useMemo(() => {
    if (!peeringFacilities.length) return {};
    const nameOverrides = { AE: 'UAE', KR: 'South Korea', HK: 'Hong Kong', TW: 'Taiwan', MO: 'Macau' };
    const isoToName = Object.fromEntries(
      Country.getAllCountries().map(c => [c.isoCode, nameOverrides[c.isoCode] ?? c.name])
    );
    return peeringFacilities.reduce((acc, f) => {
      const name = isoToName[f.country];
      if (name) acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
  }, [peeringFacilities]);

  async function handlePeeringClick(facility) {
    setSelectedDatacenter(null);
    setShowAIPanel(false);
    setSelectedPeeringFacility(facility);
    setPeeringDetail(null);
    setPeeringDetailLoading(true);

    const existingData = `Datacenter: ${facility.name}\nLocation: ${facility.city}, ${facility.country}\nOrganisation: ${facility.org_name || 'Unknown'}\nSource: PeeringDB Global Registry`;
    try {
      const res = await fetch('/api/facility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: facility.name, city: facility.city, country: facility.country, existingData }),
      });
      const data = await res.json();
      setPeeringDetail(data);
    } catch {
      setPeeringDetail({ liveData: null, summary: null });
    } finally {
      setPeeringDetailLoading(false);
    }
  }

  const localCountries = dcData
    ? Array.from(new Set(dcData.datacenters.map(dc => dc.country))).sort()
    : [];

  const allFilterCountries = globalStats?.globalMarkets
    ? ['All', ...globalStats.globalMarkets]
    : ['All', ...localCountries];

  const filteredDCs = dcData?.datacenters.filter(dc => {
    const matchesCountry = !selectedCountry || selectedCountry === 'All' || dc.country === selectedCountry;
    const matchesSearch = !searchQuery ||
      dc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dc.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesSearch;
  }) ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060E1F] flex items-center justify-center pt-16">
        <div className="text-center">
          <LoadingDots color="#005EB8" size={12} />
          <p className="text-white/40 text-sm mt-4">Loading global datacenter intelligence...</p>
        </div>
      </div>
    );
  }

  const displayStats = {
    curatedFacilities: localStats?.total || 0,
    avgPUE: localStats?.avgPUE || 0,
    avgRenewable: localStats?.avgRenewable || 0,
    globalFacilities: peeringFacilities.length || globalStats?.globalFacilities || 9000,
    globalMarkets: globalStats?.marketsCount || localStats?.countries || 0,
    globalExchanges: globalStats?.globalExchanges || 1200,
  };

  const totalPinsOnMap = filteredDCs.length + peeringFacilities.length;

  return (
    <div className="min-h-screen bg-[#060E1F] pt-16 flex flex-col" style={{ height: '100vh' }}>

      {/* ── Top bar ── */}
      <div
        className="flex-shrink-0 border-b px-6 py-3"
        style={{ background: '#070F22', borderColor: 'rgba(255,255,255,0.055)' }}
      >
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-white/30 hover:text-white/70 transition-colors flex items-center gap-1.5 text-xs">
              <ArrowLeft size={14} />Back
            </Link>
            <div className="w-px h-3.5 bg-white/10" />
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-[#005EB8]" />
              <h1 className="text-white font-bold text-base" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                Global Datacenter Dashboard
              </h1>
            </div>
            <div className="ml-auto"><LiveBadge /></div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
            <StatCard index={0} icon={Server}    label="Curated Facilities"  value={displayStats.curatedFacilities}    color="#005EB8" sublabel="KPMG monitored"   trendValue={8} />
            <StatCard index={1} icon={Building2} label="Global Coverage"     value={displayStats.globalFacilities}     color="#0055A4" sublabel="PeeringDB network" />
            <StatCard index={2} icon={Globe}     label="Markets Covered"     value={displayStats.globalMarkets || 25}  color="#00B0A0" sublabel="Active regions"    trendValue={4} />
            <StatCard index={3} icon={Network}   label="Internet Exchanges"  value={displayStats.globalExchanges}      color="#E87722" sublabel="Global IX points"  />
            <StatCard index={4} icon={Activity}  label="Average PUE"         value={displayStats.avgPUE} decimals={2}  color="#005EB8" sublabel="Curated portfolio" />
            <StatCard index={5} icon={Leaf}      label="Avg Renewable"       value={displayStats.avgRenewable} suffix="%" color="#00B0A0" sublabel="Curated portfolio" trendValue={2} />
          </div>
        </div>
      </div>

      {/* ── Main content: sidebar + globe ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left sidebar ── */}
        <aside
          className="w-72 xl:w-80 flex-shrink-0 flex flex-col overflow-hidden border-r"
          style={{ background: '#0A1628', borderColor: 'rgba(255,255,255,0.055)' }}
        >
          {/* Search */}
          <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search facilities..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs text-white/80 placeholder:text-white/25 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(0,119,200,0.5)'; e.target.style.background = 'rgba(255,255,255,0.07)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
              />
            </div>
          </div>

          {/* Country filter pills */}
          <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
            <div className="text-white/25 text-[9px] uppercase tracking-widest mb-2 font-semibold px-0.5">
              Filter by Region
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {allFilterCountries.map(c => {
                const curatedCount = dcData?.datacenters.filter(d => d.country === c).length || 0;
                const totalCount = c === 'All' ? 0 : curatedCount + (peeringCountByCountry[c] || 0);
                const hasLocal = c === 'All' || curatedCount > 0;
                const isSelected = selectedCountry === c;
                return (
                  <button
                    key={c}
                    onClick={() => { setSelectedCountry(c); setSelectedDatacenter(null); setSelectedPeeringFacility(null); }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all whitespace-nowrap"
                    style={isSelected
                      ? { background: '#005EB8', color: '#fff', boxShadow: '0 0 12px rgba(0,119,200,0.4)' }
                      : hasLocal
                      ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.09)' }
                      : { background: 'rgba(255,255,255,0.025)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.05)' }
                    }
                  >
                    {c !== 'All' && flagEmoji(c)}{c}
                    {c !== 'All' && totalCount > 0 && (
                      <span className="ml-1 opacity-60 text-[9px]">{totalCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DC list */}
          <div className="flex-1 overflow-y-auto">
            {filteredDCs.length === 0 ? (
              <div className="p-6 text-center text-white/25 text-xs">No facilities match your filter.</div>
            ) : (
              filteredDCs.map(dc => (
                <DCListItem
                  key={dc.id}
                  dc={dc}
                  selected={selectedDatacenter?.id === dc.id}
                  onClick={() => {
                    setSelectedDatacenter(dc);
                    setSelectedPeeringFacility(null);
                    setShowAIPanel(false);
                  }}
                />
              ))
            )}
          </div>

          {/* Bottom peering count */}
          <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
            <p className="text-white/20 text-[9px] text-center">
              +{peeringFacilities.length.toLocaleString()} PeeringDB facilities on globe
            </p>
          </div>
        </aside>

        {/* ── Globe section ── */}
        <main className="flex-1 relative overflow-hidden bg-[#060E1F]" style={{ minHeight: 0 }}>

          {/* Floating stat badge */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div
              className="flex items-center gap-2 rounded-xl px-3.5 py-2"
              style={{ background: 'rgba(10,22,40,0.80)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="w-2 h-2 rounded-full bg-[#00B0A0] animate-pulse" />
              <span className="text-white/75 text-xs font-semibold">
                {filteredDCs.length} curated
                {peeringFacilities.length > 0 && (
                  <span className="text-white/35 font-normal"> · {totalPinsOnMap.toLocaleString()} total</span>
                )}
              </span>
            </div>
          </div>

          {/* Globe */}
          <GlobeViewer
            datacenters={filteredDCs}
            peeringFacilities={peeringFacilities}
            selectedId={selectedDatacenter?.id ?? null}
            selectedCountry={selectedCountry}
            dcData={dcData}
            onMarkerClick={(dc) => {
              if (dc._isPeering) {
                handlePeeringClick(dc);
              } else {
                setSelectedDatacenter(dc);
                setSelectedPeeringFacility(null);
                setShowAIPanel(false);
              }
            }}
            showLink={false}
            className="w-full h-full"
          />

          {/* Detail panels overlay */}
          <AnimatePresence>
            {selectedDatacenter && (
              showAIPanel ? (
                <motion.div
                  key="ai-panel"
                  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute top-0 right-0 h-full w-96 bg-[#111827] border-l border-white/10 z-[900] flex flex-col"
                >
                  <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
                    <button onClick={() => setShowAIPanel(false)} className="text-white/50 hover:text-white/80 transition-colors">
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <div className="text-white font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                        AI Facility Analysis
                      </div>
                      <div className="text-white/40 text-xs">{selectedDatacenter.name}</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-4">
                    <AIChatPanel
                      context={`You are analyzing this specific datacenter:\n\n${formatDatacenterForAI(selectedDatacenter)}`}
                      title={selectedDatacenter.name}
                      className="h-full"
                    />
                  </div>
                </motion.div>
              ) : (
                <DatacenterDetailPanel
                  key={`detail-${selectedDatacenter.id}`}
                  dc={selectedDatacenter}
                  onClose={() => setSelectedDatacenter(null)}
                  onAskAI={() => setShowAIPanel(true)}
                />
              )
            )}
            {selectedPeeringFacility && !selectedDatacenter && (
              <PeeringDetailPanel
                key={`peering-${selectedPeeringFacility.id}`}
                facility={selectedPeeringFacility}
                detail={peeringDetail}
                loading={peeringDetailLoading}
                onClose={() => setSelectedPeeringFacility(null)}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
