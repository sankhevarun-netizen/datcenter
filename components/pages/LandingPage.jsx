'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Clock, Newspaper, ExternalLink, Globe, ArrowRight, Building2, Share2, Server,
  Layers, BarChart3, Target,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import LandingChatPanel from '@/components/chat/LandingChatPanel';
import useAppStore from '@/store/appStore';
import { loadDatacenters, calculateGlobalStats } from '@/lib/datacenter-data';
import { LENSES } from '@/lib/platform-registry';

// Globe loaded client-side only (requires WebGL)
const DottedGlobe = dynamic(() => import('@/components/globe/DottedGlobe'), { ssr: false });

// Metros called out around the globe. Positions are tuned to the face the
// globe opens on; capacity and site counts come from the dataset, not typed.
const HUB_CARDS = [
  { city: 'Frankfurt',    top: '6%',  left: '-2%'  },
  { city: 'Tokyo',        top: '12%', left: '62%'  },
  { city: 'Mumbai',       top: '38%', left: '56%'  },
  { city: 'Singapore',    top: '60%', left: '66%'  },
  { city: 'Johannesburg', top: '76%', left: '4%'   },
];

const GLOBE_MARKERS = [
  { location: [50.11, 8.68],    size: 0.055 }, // Frankfurt
  { location: [35.63, 139.74],  size: 0.055 }, // Tokyo
  { location: [19.08, 72.90],   size: 0.065 }, // Mumbai
  { location: [1.30, 103.79],   size: 0.07  }, // Singapore
  { location: [-26.11, 28.06],  size: 0.045 }, // Johannesburg
  { location: [39.04, -77.49],  size: 0.06  }, // Ashburn
  { location: [53.36, -6.31],   size: 0.045 }, // Dublin
  { location: [-33.87, 151.21], size: 0.05  }, // Sydney
  { location: [25.20, 55.27],   size: 0.04  }, // Dubai
  { location: [37.57, 126.98],  size: 0.045 }, // Seoul
];

// Thin great-circle links between the called-out metros.
const GLOBE_ARCS = [
  { from: [50.11, 8.68],   to: [19.08, 72.90] },   // Frankfurt → Mumbai
  { from: [19.08, 72.90],  to: [1.30, 103.79] },   // Mumbai → Singapore
  { from: [1.30, 103.79],  to: [35.63, 139.74] },  // Singapore → Tokyo
  { from: [50.11, 8.68],   to: [-26.11, 28.06] },  // Frankfurt → Johannesburg
  { from: [53.36, -6.31],  to: [39.04, -77.49] },  // Dublin → Ashburn
  { from: [25.20, 55.27],  to: [1.30, 103.79] },   // Dubai → Singapore
];

const CAPABILITIES = [
  { Icon: Globe,     title: 'Global Coverage',        copy: 'Unified view of datacenters worldwide' },
  { Icon: Layers,    title: 'Lifecycle Intelligence', copy: 'From site selection to operations' },
  { Icon: BarChart3, title: 'Data-Driven Insights',   copy: 'Capacity, power, cooling, sustainability' },
  { Icon: Target,    title: 'Decision Support',       copy: 'For builders, operators and investors' },
];

// ── Hero stats, computed from the operating dataset ──────────────────────────
function useGlobalFigures() {
  const [figures, setFigures] = useState(null);

  useEffect(() => {
    let alive = true;
    loadDatacenters()
      .then(data => {
        if (!alive) return;
        const stats = calculateGlobalStats(data.datacenters);
        const byCity = {};
        for (const dc of data.datacenters) {
          const key = dc.city;
          byCity[key] = byCity[key] ?? { mw: 0, sites: 0 };
          byCity[key].mw += dc.capacity_mw ?? 0;
          byCity[key].sites += 1;
        }
        setFigures({ stats, byCity });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return figures;
}

// ── News helpers ──────────────────────────────────────────────────────────────
function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = (new Date(isoString) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60)    return fmt.format(Math.round(diff), 'second');
  if (abs < 3600)  return fmt.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return fmt.format(Math.round(diff / 3600), 'hour');
  return fmt.format(Math.round(diff / 86400), 'day');
}

function IndiaBadge() {
  return (
    <span
      className="inline-flex items-center justify-center text-[9px] font-extrabold rounded px-1 py-0.5 leading-none tracking-wide"
      style={{ background: '#FF9933', color: '#ffffff', minWidth: 18 }}
    >
      IN
    </span>
  );
}

// ── News Section ──────────────────────────────────────────────────────────────
function DatacenterNewsSection() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indiaMode, setIndiaMode] = useState(false);

  const fetchNews = async (india = indiaMode) => {
    try {
      setError(null);
      setLoading(true);
      const res = await fetch(`/api/news${india ? '?mode=india' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setArticles(data.articles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(indiaMode);
    const interval = setInterval(() => fetchNews(indiaMode), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [indiaMode]);

  const sectionTitle = indiaMode ? 'India Datacenter News' : 'Global Datacenter News';

  const IndiaToggle = () => (
    <button
      onClick={() => setIndiaMode(m => !m)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
        indiaMode
          ? 'bg-[#FF9933]/10 border-[#FF9933]/40 text-[#CC6600]'
          : 'bg-white border-[#D8DCE3] text-[#9CA3AF] hover:bg-[#F0F2F5]'
      }`}
    >
      {indiaMode ? <IndiaBadge /> : <Globe size={11} />}
      <span>{indiaMode ? 'India Focus' : 'Global'}</span>
    </button>
  );

  if (loading) return (
    <div className="mt-16">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[#9CA3AF] text-sm font-semibold uppercase tracking-widest">{sectionTitle}</h2>
        <IndiaToggle />
      </div>
      <div style={{ columnCount: 3, columnGap: '12px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="break-inside-avoid mb-3 bg-white border border-[#D8DCE3] rounded-xl overflow-hidden shadow-sm">
            {i % 4 === 0 && <div className="shimmer h-44 w-full" />}
            <div className="p-4 space-y-2">
              <div className="shimmer h-3 w-1/3 rounded" />
              <div className="shimmer h-4 w-full rounded" />
              <div className="shimmer h-4 w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (error || articles.length === 0) return (
    <div className="mt-16">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[#9CA3AF] text-sm font-semibold uppercase tracking-widest">{sectionTitle}</h2>
        <IndiaToggle />
      </div>
      <div className="bg-white border border-[#D8DCE3] rounded-xl p-8 text-center shadow-sm">
        <Newspaper size={32} className="text-[#CBD5E1] mx-auto mb-3" />
        <p className="text-[#6B7280] text-sm font-semibold mb-1">News unavailable</p>
        <p className="text-[#9CA3AF] text-xs mb-4">{error || 'No articles found at this time.'}</p>
        <button
          onClick={() => fetchNews(indiaMode)}
          className="px-4 py-2 bg-[#00338D] text-white text-xs font-bold rounded-lg hover:bg-[#002A73] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      className="mt-16"
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-[#9CA3AF] text-sm font-semibold uppercase tracking-widest">{sectionTitle}</h2>
        </div>
        <div className="flex items-center gap-3">
          <IndiaToggle />
          <span className="text-[#CBD5E1] text-[10px]">Refreshes hourly</span>
        </div>
      </div>
      <div style={{ columnGap: '12px' }} className="[column-count:1] md:[column-count:2] lg:[column-count:3]">
        {articles.map((article, i) => {
          const featured = i % 4 === 0;
          const showImage = article.urlToImage && (featured || i % 3 === 1);
          return (
            <motion.a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-inside-avoid block mb-3 bg-white border border-[#D8DCE3] rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-[#005EB8]/30 transition-all duration-200 group relative"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00338D] to-[#005EB8] opacity-0 group-hover:opacity-100 transition-opacity" />
              {showImage && (
                <div className={`overflow-hidden ${featured ? 'h-44' : 'h-28'}`}>
                  <img
                    src={article.urlToImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[#005EB8] text-[10px] font-bold uppercase tracking-wider truncate">{article.source}</span>
                  <span className="flex items-center gap-1 text-[#9CA3AF] text-[10px] flex-shrink-0">
                    <Clock size={9} />{relativeTime(article.publishedAt)}
                  </span>
                </div>
                <h3
                  className={`text-[#1A1F36] font-bold leading-snug mb-2 group-hover:text-[#00338D] transition-colors ${featured ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'}`}
                  style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
                >
                  {article.title}
                </h3>
                {article.description && (
                  <p className={`text-[#6B7280] leading-relaxed mb-3 ${featured ? 'text-xs line-clamp-3' : 'text-[10px] line-clamp-2'}`}>
                    {article.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-[#005EB8] text-[10px] font-semibold group-hover:gap-2 transition-all">
                  Read more <ExternalLink size={9} />
                </div>
              </div>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Hub card floating beside the globe ───────────────────────────────────────
function HubCard({ city, mw, sites, top, left, delay }) {
  return (
    <motion.div
      className="absolute z-20"
      style={{ top, left }}
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <motion.div
        className="rounded-xl bg-white px-3.5 py-2.5 min-w-[136px]"
        style={{ border: '1px solid #E4EAF4', boxShadow: '0 8px 24px -10px rgba(16,42,94,0.28)' }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 5 + delay * 2, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Building2 size={12} className="text-[#2F5EA8]" />
          <span className="text-[13px] font-bold text-[#17233F] leading-none">{city}</span>
        </div>
        <div className="flex items-center gap-1.5 leading-none mb-1">
          <Server size={11} className="text-[#9BAAC6]" />
          <span className="text-[12px] text-[#53617D]">{mw}</span>
        </div>
        <div className="flex items-center gap-1.5 leading-none">
          <Share2 size={11} className="text-[#9BAAC6]" />
          <span className="text-[12px] text-[#53617D]">{sites}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { introComplete, setIntroComplete } = useAppStore();
  const [phase, setPhase] = useState(introComplete ? 'done' : 'logo');
  const [guideExpanded, setGuideExpanded] = useState(false);
  const figures = useGlobalFigures();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (introComplete) return;
    const t1 = setTimeout(() => setPhase('shrink'), 1500);
    const t2 = setTimeout(() => { setPhase('done'); setIntroComplete(); }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const contentVisible = phase === 'done';

  const stats = useMemo(() => {
    const s = figures?.stats;
    return [
      { value: s ? String(s.countries) : '—',                       label: 'Markets' },
      { value: s ? String(s.total) : '—',                           label: 'Sites' },
      { value: s ? `${(s.totalCapacity / 1000).toFixed(1)} GW` : '—', label: 'Capacity' },
      { value: String(LENSES.length),                               label: 'Intelligence Lenses' },
    ];
  }, [figures]);

  return (
    <div className="min-h-screen bg-white relative overflow-x-hidden" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* ── KPMG intro loader ── */}
      <AnimatePresence>
        {(phase === 'logo' || phase === 'shrink') && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none"
            style={{ background: 'white' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 1, opacity: 0 }}
              animate={{
                scale: phase === 'shrink' ? 0.3 : 1,
                opacity: phase === 'logo' ? 1 : 0,
                y: phase === 'shrink' ? -100 : 0,
              }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kpmg-logo-navy.svg" alt="KPMG" className="h-16 w-auto mb-4 mx-auto" />
              <div className="text-[#00338D] text-xs tracking-[6px] uppercase font-semibold">
                Data Centre Lifecycle Intelligence
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero: copy · globe · guide ── */}
      <section
        className="relative"
        style={{
          paddingTop: 64,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 60%, #F7F9FD 100%)',
        }}
      >
        {/* soft wash behind the globe */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '8%', left: '42%', width: 760, height: 760, transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, rgba(0,94,184,0.07) 0%, transparent 62%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-screen-2xl px-8 xl:px-10">
          <div className="flex items-start gap-6 xl:gap-8" style={{ minHeight: 'calc(100vh - 160px)' }}>

            {/* Left — copy, CTA, stats */}
            <motion.div
              className="flex-shrink-0 flex flex-col justify-center pt-10 xl:pt-14"
              style={{ width: '31%', minHeight: 'calc(100vh - 200px)' }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 18 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <p className="text-[#7E97C6] text-[12px] font-semibold uppercase tracking-[2.5px] mb-5">
                Global Datacenter Intelligence
              </p>

              <h1 className="text-[#17307A] font-extrabold leading-[1.1] tracking-[-0.5px] text-[40px] xl:text-[46px]">
                Datacenters across
                <br />
                the world,{' '}
                <span className="text-[#5A8AD8]">at your fingertips</span>
              </h1>

              <p className="text-[#5B6880] text-[16px] xl:text-[17px] leading-[1.65] mt-6 max-w-[430px]">
                Explore capacity, sites, power, sustainability and investment across
                the world&rsquo;s datacenter network.
              </p>

              <button
                onClick={() => router.push('/dashboard')}
                className="group mt-9 inline-flex items-center gap-3 self-start rounded-full pl-7 pr-6 py-4 text-white text-[16px] font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(100deg, #1B3F93 0%, #00338D 55%, #002B78 100%)',
                  boxShadow: '0 14px 30px -12px rgba(0,51,141,0.55)',
                }}
              >
                <Globe size={19} className="opacity-90" />
                Explore Global Dashboard
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>

              {/* Stats */}
              <div
                className="mt-12 rounded-2xl bg-white/80 px-7 py-5 flex items-center gap-7 self-start"
                style={{ border: '1px solid #E6EBF4' }}
              >
                {stats.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-7">
                    {i > 0 && <span className="w-px h-9 bg-[#E6EBF4]" />}
                    <div>
                      <p className="text-[#17307A] text-[26px] font-extrabold leading-none tracking-tight">{s.value}</p>
                      <p className="text-[#93A0B8] text-[10px] font-semibold uppercase tracking-[1.2px] mt-1.5">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Centre — globe with hub cards */}
            <motion.div
              className="relative flex-1 flex items-center justify-center self-center"
              style={{ minWidth: 0 }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: contentVisible ? 1 : 0, scale: contentVisible ? 1 : 0.94 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative w-full" style={{ maxWidth: 620 }}>
                <DottedGlobe markers={GLOBE_MARKERS} arcs={GLOBE_ARCS} className="w-full" />

                {contentVisible && HUB_CARDS.map((hub, i) => {
                  const agg = figures?.byCity?.[hub.city];
                  if (!agg) return null;
                  return (
                    <HubCard
                      key={hub.city}
                      city={hub.city}
                      mw={`${agg.mw} MW`}
                      sites={`${agg.sites} ${agg.sites === 1 ? 'Site' : 'Sites'}`}
                      top={hub.top}
                      left={hub.left}
                      delay={0.35 + i * 0.12}
                    />
                  );
                })}
              </div>
            </motion.div>

            {/* Right — K-Nexus Guide. Expanding only restyles this wrapper, so
                the panel keeps its conversation. */}
            <motion.div
              className={guideExpanded ? 'fixed inset-0 z-[60] p-6 lg:p-12' : 'flex-shrink-0 self-center'}
              style={guideExpanded
                ? { background: 'rgba(14,27,56,0.34)', backdropFilter: 'blur(3px)' }
                : { width: '27%', minWidth: 330 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: contentVisible ? 1 : 0, x: contentVisible ? 0 : 20 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div
                className="rounded-2xl bg-white overflow-hidden mx-auto"
                style={{
                  border: '1px solid #E4EAF4',
                  boxShadow: '0 18px 44px -24px rgba(16,42,94,0.30)',
                  height: guideExpanded ? '100%' : 'calc(100vh - 216px)',
                  minHeight: guideExpanded ? 0 : 520,
                  maxWidth: guideExpanded ? 760 : 'none',
                }}
              >
                <LandingChatPanel
                  expanded={guideExpanded}
                  onToggleExpand={() => setGuideExpanded(v => !v)}
                />
              </div>
            </motion.div>

          </div>
        </div>

        {/* ── Capability strip ── */}
        <motion.div
          className="relative z-10 border-t"
          style={{ borderColor: '#E9EEF6', background: 'rgba(255,255,255,0.72)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: contentVisible ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          <div className="mx-auto max-w-screen-2xl px-8 xl:px-10">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map(({ Icon, title, copy }, i) => (
                <div
                  key={title}
                  className="flex items-center gap-3.5 py-5 px-6"
                  style={{ borderLeft: i === 0 ? 'none' : '1px solid #E9EEF6' }}
                >
                  <Icon size={22} className="text-[#2F5EA8] flex-shrink-0" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="text-[#17307A] text-[14.5px] font-bold leading-tight">{title}</p>
                    <p className="text-[#7C879C] text-[12.5px] leading-tight mt-1 truncate">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── News — below the fold ── */}
      <div className="relative z-10 px-10 pb-16 bg-white">
        <DatacenterNewsSection />
        <div className="mt-12 text-center">
          <p className="text-[#CBD5E1] text-xs">
            © KPMG 2026 · KNexus.AI Data Centre Intelligence · Strictly Confidential
          </p>
        </div>
      </div>
    </div>
  );
}
