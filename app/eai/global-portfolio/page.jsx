'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Filter, Download, ChevronRight, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Leaf, Droplets, Recycle,
  X, Building2, Layers, Zap, Timer, Activity, ShieldAlert, Globe2, MapPin, Wrench, Newspaper,
  Search, FileText, FileSpreadsheet, FileDown,
} from 'lucide-react';

import KpiCard      from '@/components/eai/widgets/KpiCard';
import DonutChart    from '@/components/eai/widgets/DonutChart';
import TrendChart    from '@/components/eai/widgets/TrendChart';
import MapPanel      from '@/components/eai/widgets/MapPanel';
import ListCard      from '@/components/eai/widgets/ListCard';
import StatTile      from '@/components/eai/widgets/StatTile';
import DetailDrawer, { DrawerTable, DrawerStatRow, DrawerPill } from '@/components/eai/widgets/DetailDrawer';
import FilterPopover    from '@/components/eai/widgets/FilterPopover';
import DateRangePopover from '@/components/eai/widgets/DateRangePopover';
import { useToast }     from '@/components/eai/widgets/Toast';
import DatacenterDetailPanel from '@/components/pages/DatacenterDetailPanel';
import AIChatPanel            from '@/components/ai-chat/AIChatPanel';
import { formatDatacenterForAI } from '@/lib/datacenter-data';
import { resolveEaiFacilityToDatacenter } from '@/lib/eaiFacilityResolver';

import {
  eaiKpis as mockEaiKpis, eaiCapacityByRegion as mockEaiCapacityByRegion, eaiAiBriefing,
  eaiUtilizationTrend, eaiPueTrend, eaiRenewableByRegion as mockEaiRenewableByRegion, eaiAssetStatus as mockEaiAssetStatus,
  eaiCriticalAlerts, eaiRecentNews, eaiUpcomingMaintenance,
  eaiDemandPlanning, eaiEsgMetrics, eaiMapClusters as mockEaiMapClusters,
  eaiFacilities as mockEaiFacilities, eaiUtilizationByRegion as mockEaiUtilizationByRegion,
} from '@/data/eaiMockData';

// Same dynamic-import pattern as app/asset-portfolio/global-cockpit/page.jsx
const GlobeViewer = dynamic(() => import('@/components/globe/GlobeViewer'), { ssr: false });

const ESG_ICONS = { leaf: Leaf, droplets: Droplets, recycle: Recycle };
const KPI_ICONS = { building: Building2, layers: Layers, zap: Zap, timer: Timer, activity: Activity, droplets: Droplets, leaf: Leaf, shieldAlert: ShieldAlert };
const STATUS_COLOR = { optimal: '#00A36C', good: '#0077C8', warning: '#D4A017', critical: '#DC2626', maintenance: '#6B7280' };

// Facility-scoped system prompt for the "AI Facility Analysis" chatbot opened
// from a globe marker — keeps the assistant grounded to the single datacenter
// under discussion rather than the whole portfolio.
const KPMG_ENGINE_SYSTEM_PROMPT = `You are the KPMG Datacenter Intelligence Engine, a specialist AI analyst for enterprise datacenter operations. You are scoped to a single facility for this conversation — answer only using the facility context provided, be precise with numbers, and flag when information isn't available rather than guessing. Keep responses concise and operationally focused (capacity, utilization, health, risk, sustainability, connectivity).`;

// EAI-authoritative operational metrics, rendered as extra cells in
// DatacenterDetailPanel's metrics grid so the globe's rich panel still shows
// the numbers the rest of the EAI platform reports for this facility.
function buildExtraMetrics(f) {
  if (!f) return [];
  const utilColor = f.utilizationPct >= 85 ? '#EF4444' : f.utilizationPct >= 70 ? '#D4A017' : '#00A36C';
  const healthColor = f.healthScore >= 85 ? '#00A36C' : f.healthScore >= 70 ? '#D4A017' : '#EF4444';
  return [
    { label: 'Utilization',  value: `${f.utilizationPct}%`, color: utilColor },
    { label: 'Health Score', value: f.healthScore,           color: healthColor },
    { label: 'Region',       value: f.region,                color: '#6B7280' },
  ];
}

// ── Capacity-by-Region metric switcher ────────────────────────────────────────
const METRIC_OPTIONS = [
  { key: 'itPower',     label: 'IT Power (MW)', unit: 'MW' },
  { key: 'totalPower',  label: 'Total Power',   unit: 'MW' },
  { key: 'rackCount',   label: 'Rack Count',    unit: '' },
  { key: 'utilization', label: 'Utilization %', unit: '%' },
];
const LATEST_PUE = eaiPueTrend[eaiPueTrend.length - 1].value;
const RACK_KW = 22; // assumed blended average kW/rack, used only to derive an estimated rack count

// ── Date range ─────────────────────────────────────────────────────────────
const RANGE_PRESETS = [
  { key: '7d',     label: 'Last 7 Days' },
  { key: '30d',    label: 'Last 30 Days' },
  { key: 'qtd',    label: 'This Quarter (QTD)' },
  { key: 'ytd',    label: 'Year to Date (YTD)' },
  { key: '12m',    label: 'Last 12 Months' },
  { key: 'custom', label: 'Custom' },
];
const RANGE_WEEKS = { '7d': 1, '30d': 5, 'qtd': 5, 'ytd': 5, '12m': 5 };

function parseWeekLabel(label) {
  return new Date(`${label}, 2025`);
}

function sliceTrendByRange(trend, range) {
  if (range.presetKey === 'custom') {
    if (!range.from || !range.to) return trend;
    const from = new Date(range.from), to = new Date(range.to);
    return trend.filter(t => { const d = parseWeekLabel(t.week); return d >= from && d <= to; });
  }
  const weeks = RANGE_WEEKS[range.presetKey] ?? 5;
  return trend.slice(-weeks);
}

function rangeLabel(range) {
  if (range.presetKey === 'custom') {
    if (!range.from || !range.to) return 'Custom Range';
    return `${new Date(range.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(range.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return RANGE_PRESETS.find(p => p.key === range.presetKey)?.label ?? 'Last 30 Days';
}

function trendDeltaPct(trend) {
  if (trend.length < 2) return null;
  const first = trend[0].value, last = trend[trend.length - 1].value;
  return +(((last - first) / first) * 100).toFixed(1);
}

// ── export helpers ────────────────────────────────────────────────────────────
async function exportWorkbook(sheets, filename) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

async function exportCsv(rows, filename) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportPanelPdf(el, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#F4F6F9' });
  const imgData = canvas.toDataURL('image/png');
  const pxToMm = 0.264583 / 2;
  const w = canvas.width * pxToMm;
  const h = canvas.height * pxToMm;
  const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] });
  doc.addImage(imgData, 'PNG', 0, 0, w, h);
  doc.save(filename);
}

// ── drawer <-> URL param encoding ─────────────────────────────────────────────
function drawerToParam(d) {
  if (!d) return undefined;
  switch (d.kind) {
    case 'kpi':         return `kpi:${d.kpi.key}`;
    case 'cluster':      return `cluster:${d.cluster.id}`;
    case 'alert':        return `alert:${d.item.id}`;
    case 'news':         return `news:${d.item.id}`;
    case 'news-all':     return 'news-all';
    case 'maintenance':  return `maintenance:${d.item.id}`;
    case 'demand':       return `demand:${encodeURIComponent(d.item.label)}`;
    case 'esg':          return `esg:${encodeURIComponent(d.item.label)}`;
    default:              return undefined;
  }
}

function paramToDrawer(param) {
  if (!param) return null;
  if (param === 'news-all') return { kind: 'news-all' };
  const sep = param.indexOf(':');
  if (sep === -1) return null;
  const kind = param.slice(0, sep);
  const id = decodeURIComponent(param.slice(sep + 1));
  switch (kind) {
    case 'kpi':        { const kpi = mockEaiKpis.find(k => k.key === id); return kpi ? { kind: 'kpi', kpi } : null; }
    case 'cluster':    { const cluster = mockEaiMapClusters.find(c => c.id === id); return cluster ? { kind: 'cluster', cluster } : null; }
    case 'alert':      { const item = eaiCriticalAlerts.find(a => a.id === id); return item ? { kind: 'alert', item } : null; }
    case 'news':       { const item = eaiRecentNews.find(n => n.id === id); return item ? { kind: 'news', item } : null; }
    case 'maintenance':{ const item = eaiUpcomingMaintenance.find(m => m.id === id); return item ? { kind: 'maintenance', item } : null; }
    case 'demand':     { const item = eaiDemandPlanning.find(x => x.label === id); return item ? { kind: 'demand', item } : null; }
    case 'esg':        { const item = eaiEsgMetrics.find(x => x.label === id); return item ? { kind: 'esg', item } : null; }
    default: return null;
  }
}

// ── Shared card shell ─────────────────────────────────────────────────────────
function Card({ title, action, children, border, noPad = false }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${border ?? '#E2E8F0'}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid #E2E8F0',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1F36' }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ flex: 1, padding: noPad ? 0 : 14 }}>{children}</div>
    </div>
  );
}

// DropBtn: plain presentational button by default (unchanged visual). Pass
// `options` + `value` + `onChange` to turn it into a real dropdown menu — the
// reusable pattern any card-level selector on this page can adopt.
function DropBtn({ children, options, value, onChange, menuWidth = 180 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const btnStyle = {
    background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 8, padding: '3px 9px', cursor: 'pointer',
    color: '#6B7280', fontSize: 9,
  };

  if (!options) {
    return <button style={btnStyle}>{children}</button>;
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} className="eai-focusable" style={btnStyle}>{children}</button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 400, width: menuWidth, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(16,24,40,0.12)', overflow: 'hidden' }}>
          {options.map(opt => {
            const active = opt.key === value;
            return (
              <button
                key={opt.key} type="button" onClick={() => { onChange(opt.key); setOpen(false); }} className="eai-focusable"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: active ? 'rgba(0,119,200,0.08)' : 'transparent', color: active ? '#0077C8' : '#374151', fontSize: 10, fontWeight: active ? 700 : 400, cursor: 'pointer' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >{opt.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Skeleton shell shown while a clicked facility is being resolved against the
// master datacenter dataset — same w-96 dark slide-in shape as the real panel.
function DatacenterDetailSkeleton({ onClose }) {
  return (
    <motion.div
      key="skeleton"
      initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 h-full w-96 bg-[#111827] border-l border-white/10 z-[900] flex flex-col shadow-2xl overflow-hidden"
    >
      <div className="p-5 flex-shrink-0 border-b border-white/10 flex items-center justify-between">
        <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-0.5">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white/[0.05] rounded-xl p-3 border border-white/[0.06] h-16 animate-pulse" />
          ))}
        </div>
        <div className="h-24 bg-white/[0.04] rounded-xl border border-white/[0.08] animate-pulse" />
        <div className="h-32 bg-white/[0.04] rounded-xl border border-white/[0.08] animate-pulse" />
      </div>
    </motion.div>
  );
}

// ── 3D globe modal — expand target for the map card's hover-revealed icon ────
// Clicking any datacenter marker resolves it into the rich dc shape (see
// lib/eaiFacilityResolver.js) and shows the same DatacenterDetailPanel +
// AI Facility Analysis chatbot used on the Global Dashboard, scoped to that
// facility. `autoSelectFacilityId` lets callers outside the 3D view (e.g. the
// main-body facility table) open straight into a specific facility's panel.
function GlobeModal({ open, onClose, facilities, focusClusterId, autoSelectFacilityId, onFacilitySelected }) {
  const [eaiFacility, setEaiFacility] = useState(null);
  const [selectedDc, setSelectedDc] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const selectFacility = useCallback(async (facility) => {
    if (!facility) return;
    setEaiFacility(facility);
    setSelectedDc(null);
    setShowAI(false);
    setResolving(true);
    onFacilitySelected?.(facility.id);
    try {
      const resolved = await resolveEaiFacilityToDatacenter(facility);
      setSelectedDc(resolved);
    } finally {
      setResolving(false);
    }
  }, [onFacilitySelected]);

  const clearSelection = useCallback(() => {
    setEaiFacility(null);
    setSelectedDc(null);
    setShowAI(false);
    onFacilitySelected?.(null);
  }, [onFacilitySelected]);

  useEffect(() => {
    if (!open) { clearSelection(); return; }
    if (autoSelectFacilityId) {
      const f = facilities.find(x => x.id === autoSelectFacilityId);
      if (f) selectFacility(f);
    }
    // Only re-run when the modal opens or the target facility changes — not
    // on every selectFacility/clearSelection identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoSelectFacilityId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (showAI) setShowAI(false);
      else if (eaiFacility) clearSelection();
      else onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, showAI, eaiFacility, onClose, clearSelection]);

  if (!open) return null;

  const datacenters = facilities.map(f => ({
    id: f.id,
    name: f.name,
    capacity_mw: f.capacityMW,
    tier_rating: undefined,
    coordinates: { latitude: f.lat, longitude: f.lon },
    status: f.status,
  }));

  const focusFacility = focusClusterId
    ? facilities.find(f => f.mapClusterId === focusClusterId)
    : null;

  function handleMarkerClick(dc) {
    const facility = facilities.find(f => f.id === dc.id);
    if (facility) selectFacility(facility);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.55)', zIndex: 998 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 999, width: '90vw', maxWidth: 1100, height: '82vh',
        background: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
        border: '1px solid #E2E8F0', boxShadow: '0 24px 64px rgba(16,24,40,0.35)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe2 size={16} color="#0077C8" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1F36' }}>Global Infrastructure — 3D View</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{facilities.length} facilities</span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC',
            color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Globe canvas + rich facility overlay — kept on a dark backdrop, same as the
            reference cockpit globe, since the starfield/globe render needs contrast a
            white page background can't give it. The detail panel + AI chat are dark by
            design and sit over this same backdrop, so they stay dark too. */}
        <div style={{
          flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden',
          background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 40%, #060e1a 100%)',
        }}>
          <GlobeViewer
            datacenters={datacenters}
            selectedId={eaiFacility?.id ?? focusFacility?.id ?? null}
            getMarkerColor={dc => STATUS_COLOR[dc.status] ?? '#6B7280'}
            onMarkerClick={handleMarkerClick}
            showLink={false}
          />

          <AnimatePresence>
            {showAI && (selectedDc || resolving) && (
              <motion.div
                key="ai-panel"
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 right-0 h-full w-96 bg-[#111827] border-l border-white/10 z-[900] flex flex-col"
              >
                <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
                  <button onClick={() => setShowAI(false)} className="text-white/50 hover:text-white/80 transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div className="text-white font-bold text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      AI Facility Analysis
                    </div>
                    <div className="text-white/40 text-xs">{selectedDc?.name ?? eaiFacility?.name}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden p-4">
                  {selectedDc && eaiFacility && (
                    <AIChatPanel
                      title={selectedDc.name}
                      context={`You are analyzing this specific datacenter:\n\n${formatDatacenterForAI(selectedDc)}\n\nEAI operational data: utilization ${eaiFacility.utilizationPct}%, health score ${eaiFacility.healthScore}, status ${eaiFacility.status}, region ${eaiFacility.region}.`}
                      systemContext={KPMG_ENGINE_SYSTEM_PROMPT}
                      defaultExpanded
                      suggestionChips={[
                        `Why is the health score ${eaiFacility.healthScore}?`,
                        `What's driving ${eaiFacility.utilizationPct}% utilization?`,
                        'Top operational risks for this facility',
                        'How does it compare to regional peers?',
                      ]}
                      className="h-full"
                    />
                  )}
                </div>
              </motion.div>
            )}
            {!showAI && resolving && (
              <DatacenterDetailSkeleton onClose={clearSelection} />
            )}
            {!showAI && !resolving && selectedDc && (
              <DatacenterDetailPanel
                key={`detail-${selectedDc.id}`}
                dc={selectedDc}
                extraMetrics={buildExtraMetrics(eaiFacility)}
                onClose={clearSelection}
                onAskAI={() => setShowAI(true)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          padding: '10px 18px', borderTop: '1px solid #E2E8F0', flexShrink: 0,
        }}>
          {Object.entries(STATUS_COLOR).map(([status, color]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#6B7280', textTransform: 'capitalize' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {status}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Page (inner — uses useSearchParams, must be wrapped in Suspense) ─────────
function GlobalPortfolioInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast, ToastHost } = useToast();
  const dashboardRef = useRef(null);

  // Live data uploaded via /eai/administration/data-import (Facilities + IT
  // Assets + Alerts & Activity Feed sheets), fetched once on mount. Stays
  // null — and every eai* binding below falls back to the bundled demo
  // dataset (data/eaiMockData.js) — until the user has uploaded at least one
  // Facilities row. See /api/eai/global-portfolio.
  const [liveData, setLiveData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/eai/global-portfolio')
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (!cancelled && json?.live) setLiveData(json.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const isLive = !!liveData;
  const eaiKpis = liveData?.kpis ?? mockEaiKpis;
  const eaiFacilities = liveData?.facilities ?? mockEaiFacilities;
  const eaiCapacityByRegion = liveData?.capacityByRegion ?? mockEaiCapacityByRegion;
  const eaiUtilizationByRegion = liveData?.utilizationByRegion ?? mockEaiUtilizationByRegion;
  const eaiRenewableByRegion = liveData?.renewableByRegion ?? mockEaiRenewableByRegion;
  const eaiAssetStatus = liveData?.assetStatus ?? mockEaiAssetStatus;
  const eaiMapClusters = liveData?.mapClusters ?? mockEaiMapClusters;

  // { kind, ...payload } | null — everything the DetailDrawer currently shows
  const [drawer, setDrawerState] = useState(() => paramToDrawer(searchParams.get('drawer')));

  // Cross-highlight between Capacity by Region legend and the map pins.
  const [highlight, setHighlightState] = useState(() => {
    const hl = searchParams.get('hl');
    if (hl) {
      const sep = hl.indexOf(':');
      if (sep !== -1) {
        const source = hl.slice(0, sep), value = decodeURIComponent(hl.slice(sep + 1));
        if (source === 'region' || source === 'cluster') return { source, value };
      }
    }
    const regionParam = searchParams.get('region');
    if (regionParam && eaiCapacityByRegion.some(r => r.name === regionParam)) return { source: 'region', value: regionParam };
    const nodeParam = searchParams.get('node');
    if (nodeParam) {
      const fac = eaiFacilities.find(f => f.id === nodeParam);
      if (fac) return { source: 'cluster', value: fac.mapClusterId };
      const cluster = eaiMapClusters.find(c => c.id === nodeParam);
      if (cluster) return { source: 'cluster', value: cluster.id };
    }
    return null;
  });

  // The 3D globe modal also opens directly to a specific facility's rich panel
  // when arriving via `?drawer=facility:<id>` (e.g. from the main-body table).
  const [globeOpen, setGlobeOpen] = useState(() => {
    const param = searchParams.get('drawer');
    return !!(param && param.startsWith('facility:'));
  });
  const [globeAutoSelectId, setGlobeAutoSelectId] = useState(() => {
    const param = searchParams.get('drawer');
    return (param && param.startsWith('facility:')) ? decodeURIComponent(param.slice('facility:'.length)) : null;
  });

  const [range, setRange] = useState(() => {
    const key = searchParams.get('range');
    if (key && RANGE_PRESETS.some(p => p.key === key)) {
      return { presetKey: key, from: searchParams.get('from') || '', to: searchParams.get('to') || '' };
    }
    return { presetKey: '30d', from: '', to: '' };
  });

  const [metric, setMetric] = useState('itPower');
  const [filters, setFilters] = useState({ region: [], status: [] });
  const [utilMin, setUtilMin] = useState(0);

  const [rangeOpen, setRangeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const [facilitySearch, setFacilitySearch] = useState('');
  const [facilitySort, setFacilitySort] = useState(null);

  const updateURL = useCallback((patch) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') params.delete(k);
      else params.set(k, v);
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function setDrawer(d) {
    setDrawerState(d);
    updateURL({ drawer: drawerToParam(d) });
  }
  function closeDrawer() { setDrawer(null); }

  function setHighlight(h) {
    setHighlightState(h);
    updateURL({ hl: h ? `${h.source}:${encodeURIComponent(h.value)}` : undefined, region: undefined, node: undefined });
  }

  const highlightedClusterIds = highlight?.source === 'region'
    ? [...new Set(eaiFacilities.filter(f => f.region === highlight.value).map(f => f.mapClusterId))]
    : highlight?.source === 'cluster'
      ? [highlight.value]
      : [];
  const activeRegionName = highlight?.source === 'region' ? highlight.value : null;

  function handleRegionClick(item) {
    setHighlight(
      highlight?.source === 'region' && highlight.value === item.name ? null : { source: 'region', value: item.name }
    );
  }

  function handleMarkerClick(cluster) {
    setHighlight({ source: 'cluster', value: cluster.id });
    setDrawer({ kind: 'cluster', cluster });
  }

  function handleExpandGlobe() {
    setGlobeOpen(true);
  }

  // Opens the 3D globe modal already focused on one facility's rich detail
  // panel — the single "facility experience" entry point used by every click
  // target that isn't a marker inside the globe itself (marker clicks are
  // handled internally by GlobeModal).
  function openGlobeToFacility(facilityId) {
    setGlobeAutoSelectId(facilityId);
    setGlobeOpen(true);
    updateURL({ drawer: `facility:${facilityId}` });
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  const FILTER_GROUPS = useMemo(() => [
    { key: 'region', label: 'Region',          options: eaiCapacityByRegion.map(r => r.name) },
    { key: 'status', label: 'Facility Status', options: Object.keys(STATUS_COLOR) },
  ], [eaiCapacityByRegion]);
  const filterSelected = { region: filters.region, status: filters.status };
  const filtersActive = filters.region.length > 0 || filters.status.length > 0 || utilMin > 0;
  const activeFilterCount = filters.region.length + filters.status.length + (utilMin > 0 ? 1 : 0);

  function toggleFilter(groupKey, value) {
    setFilters(prev => {
      const cur = prev[groupKey];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      return { ...prev, [groupKey]: next };
    });
  }
  function clearAllFilters() {
    setFilters({ region: [], status: [] });
    setUtilMin(0);
    showToast('Filters cleared', 'info');
  }

  const filterExtra = (
    <div style={{ padding: '10px 12px' }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        Min Utilization: {utilMin}%+
      </p>
      <input type="range" min="0" max="95" step="5" value={utilMin} onChange={e => setUtilMin(+e.target.value)} style={{ width: '100%', accentColor: '#0077C8' }} />
    </div>
  );

  const filteredFacilities = useMemo(() => {
    if (!filtersActive) return eaiFacilities;
    return eaiFacilities.filter(f => {
      if (filters.region.length && !filters.region.includes(f.region)) return false;
      if (filters.status.length && !filters.status.includes(f.status)) return false;
      if (utilMin > 0 && f.utilizationPct < utilMin) return false;
      return true;
    });
  }, [eaiFacilities, filters, utilMin, filtersActive]);

  // Compose filters with the existing region/cluster highlight rather than overriding it:
  // if both are active, only show clusters that satisfy both; if only one is active, use it.
  const filterMatchedClusterIds = filtersActive ? [...new Set(filteredFacilities.map(f => f.mapClusterId))] : null;
  const finalSelectedClusterIds = useMemo(() => {
    if (highlightedClusterIds.length && filterMatchedClusterIds) {
      return highlightedClusterIds.filter(id => filterMatchedClusterIds.includes(id));
    }
    if (highlightedClusterIds.length) return highlightedClusterIds;
    if (filterMatchedClusterIds) return filterMatchedClusterIds;
    return [];
  }, [highlightedClusterIds, filterMatchedClusterIds]);

  // ── Date range → trend charts + deltas ───────────────────────────────────
  const filteredUtilTrend = useMemo(() => sliceTrendByRange(eaiUtilizationTrend, range), [range]);
  const filteredPueTrend  = useMemo(() => sliceTrendByRange(eaiPueTrend, range), [range]);
  const rangeIsDefault = range.presetKey === '30d';

  // ── KPI strip: filters + range compose onto the base KPI list ───────────
  const displayKpis = useMemo(() => {
    let kpis = eaiKpis;
    if (filtersActive) {
      const n = filteredFacilities.length;
      const totalCap = filteredFacilities.reduce((s, f) => s + f.capacityMW, 0);
      const avgUtil = n ? Math.round(filteredFacilities.reduce((s, f) => s + f.utilizationPct, 0) / n) : 0;
      const avgHealth = n ? Math.round(filteredFacilities.reduce((s, f) => s + f.healthScore, 0) / n) : 0;
      const countries = new Set(filteredFacilities.map(f => f.country)).size;
      kpis = kpis.map(k => {
        if (k.key === 'facilities')  return { ...k, value: String(n), sublabel: `Across ${countries} countries (filtered)` };
        if (k.key === 'capacity')    return { ...k, value: totalCap.toLocaleString(), sublabel: 'IT Power Capacity (filtered)' };
        if (k.key === 'utilization') return { ...k, value: String(avgUtil), sublabel: 'Average Utilization (filtered)' };
        if (k.key === 'health')      return { ...k, value: String(avgHealth), sublabel: 'Average Health (filtered)' };
        return k;
      });
    }
    if (!rangeIsDefault) {
      const uPct = trendDeltaPct(filteredUtilTrend);
      const pPct = trendDeltaPct(filteredPueTrend);
      kpis = kpis.map(k => {
        if (k.key === 'utilization' && uPct != null) return { ...k, delta: `${uPct >= 0 ? '▲' : '▼'}${Math.abs(uPct)}% over ${rangeLabel(range)}`, up: uPct >= 0 };
        if (k.key === 'pue' && pPct != null)          return { ...k, delta: `${pPct >= 0 ? '▲' : '▼'}${Math.abs(pPct)}% over ${rangeLabel(range)}`, up: pPct <= 0 };
        return k;
      });
    }
    return kpis;
  }, [eaiKpis, filtersActive, filteredFacilities, rangeIsDefault, filteredUtilTrend, filteredPueTrend, range]);

  // ── Capacity by Region: metric switcher + filter-aware aggregation ──────
  const regionMetricData = useMemo(() => {
    const source = filtersActive ? filteredFacilities : eaiFacilities;
    return eaiCapacityByRegion.map(r => {
      const regionFacilities = source.filter(f => f.region === r.name);
      const capacityMW = filtersActive ? regionFacilities.reduce((s, f) => s + f.capacityMW, 0) : r.mw;
      const avgUtil = filtersActive
        ? (regionFacilities.length ? Math.round(regionFacilities.reduce((s, f) => s + f.utilizationPct, 0) / regionFacilities.length) : 0)
        : (eaiUtilizationByRegion.find(u => u.name === r.name)?.value ?? 0);
      return {
        name: r.name, color: r.color,
        itPower: capacityMW,
        totalPower: +(capacityMW * LATEST_PUE).toFixed(1),
        rackCount: Math.round(capacityMW * 1000 / RACK_KW),
        utilization: avgUtil,
      };
    });
  }, [filtersActive, filteredFacilities, eaiFacilities, eaiCapacityByRegion, eaiUtilizationByRegion]);

  const donutData = useMemo(() => {
    const total = regionMetricData.reduce((s, r) => s + r[metric], 0) || 1;
    return regionMetricData.map(r => ({
      name: r.name, color: r.color,
      value: r[metric],
      pct: Math.round((r[metric] / total) * 100),
      ...(metric === 'itPower' ? { mw: r[metric] } : {}),
    }));
  }, [regionMetricData, metric]);

  const metricDef = METRIC_OPTIONS.find(m => m.key === metric);
  const donutTotal = donutData.reduce((s, r) => s + r.value, 0);
  const donutCenterLabel = metric === 'utilization' ? String(Math.round(donutTotal / donutData.length)) : donutTotal.toLocaleString();
  const donutCenterSublabel = metric === 'utilization' ? 'Avg Utilization' : metric === 'rackCount' ? 'Total Racks' : 'Total Capacity';

  // ── Main-body facility table ─────────────────────────────────────────────
  const searchedFacilities = useMemo(() => {
    const q = facilitySearch.toLowerCase();
    if (!q) return filteredFacilities;
    return filteredFacilities.filter(f => `${f.name} ${f.city} ${f.country} ${f.region}`.toLowerCase().includes(q));
  }, [filteredFacilities, facilitySearch]);

  const sortedFacilitiesTable = useMemo(() => {
    if (!facilitySort) return searchedFacilities;
    const { key, dir } = facilitySort;
    const mult = dir === 'asc' ? 1 : -1;
    return [...searchedFacilities].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [searchedFacilities, facilitySort]);

  function handleFacilitySort(key) {
    setFacilitySort(prev => (prev && prev.key === key) ? (prev.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' });
  }

  function handleFacilityRowClick(f) {
    setHighlight({ source: 'cluster', value: f.mapClusterId });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport(kind) {
    setExportOpen(false);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      if (kind === 'pdf') {
        if (!dashboardRef.current) return;
        await exportPanelPdf(dashboardRef.current, `global-portfolio-${dateStr}.pdf`);
        showToast('Portfolio summary exported as PDF', 'success');
        return;
      }
      if (kind === 'facilities') {
        const rows = filteredFacilities.map(f => ({
          Facility: f.name, City: f.city, Country: f.country, Region: f.region, Status: f.status,
          'Capacity (MW)': f.capacityMW, 'Utilization %': f.utilizationPct, 'Health Score': f.healthScore,
        }));
        await exportWorkbook([{ name: 'Facilities', rows }], `global-portfolio-facilities-${dateStr}.xlsx`);
        showToast(`Exported ${rows.length} facilities`, 'success');
        return;
      }
      if (kind === 'kpi') {
        const rows = displayKpis.map(k => ({ Metric: k.label, Value: `${k.value}${k.unit ? ' ' + k.unit : ''}`, Sublabel: k.sublabel, Delta: k.delta }));
        await exportCsv(rows, `global-portfolio-kpi-snapshot-${dateStr}.csv`);
        showToast('KPI snapshot exported', 'success');
      }
    } catch {
      showToast('Export failed — please try again', 'error');
    }
  }

  const FACILITY_COLUMNS = [
    { key: 'name',            label: 'Facility' },
    { key: 'country',         label: 'Country' },
    { key: 'region',          label: 'Region' },
    { key: 'status',          label: 'Status' },
    { key: 'capacityMW',      label: 'Capacity', align: 'right' },
    { key: 'utilizationPct',  label: 'Util.', align: 'right' },
    { key: 'healthScore',     label: 'Health', align: 'right' },
  ];

  return (
    <div style={{ background: '#F4F6F9', minHeight: '100%', color: '#1A1F36' }}>
      <style>{`
        .eai-focusable:focus-visible { outline: 2px solid #0077C8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid #E2E8F0',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#9CA3AF', marginBottom: 5 }}>
            <span>Global Portfolio</span>
            <ChevronRight size={8} />
            <span style={{ color: '#6B7280' }}>Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A1F36', margin: 0, lineHeight: 1 }}>Global Portfolio Dashboard</h1>
            <span
              title={isLive ? 'Showing data from your uploaded master template' : 'Showing bundled demo data — upload a master template to see your own data here'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '3px 7px', borderRadius: 5,
                color: isLive ? '#00A36C' : '#9CA3AF',
                background: isLive ? 'rgba(0,163,108,0.12)' : '#F1F5F9',
                border: `1px solid ${isLive ? 'rgba(0,163,108,0.3)' : '#E2E8F0'}`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isLive ? '#00A36C' : '#9CA3AF', flexShrink: 0 }} />
              {isLive ? 'Live Data' : 'Demo Data'}
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>Real-time overview of your global asset portfolio</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Date range */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setRangeOpen(o => !o); setFiltersOpen(false); setExportOpen(false); }}
              className="eai-focusable"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                color: '#6B7280', fontSize: 11,
              }}
            >
              <Calendar size={12} /> {rangeLabel(range)} ▾
            </button>
            <DateRangePopover
              open={rangeOpen} onClose={() => setRangeOpen(false)}
              presets={RANGE_PRESETS} value={range}
              onSelectPreset={key => { const next = { presetKey: key, from: '', to: '' }; setRange(next); updateURL({ range: key === '30d' ? undefined : key, from: undefined, to: undefined }); }}
              onCustomChange={(from, to) => { const next = { presetKey: 'custom', from, to }; setRange(next); updateURL({ range: 'custom', from, to }); }}
            />
          </div>

          {/* Filters */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setFiltersOpen(o => !o); setRangeOpen(false); setExportOpen(false); }}
              className="eai-focusable"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: filtersActive ? 'rgba(0,119,200,0.08)' : '#F8FAFC',
                border: `1px solid ${filtersActive ? 'rgba(0,119,200,0.30)' : '#E2E8F0'}`,
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                color: filtersActive ? '#0077C8' : '#6B7280', fontSize: 11,
              }}
            >
              <Filter size={12} /> Filters
              {activeFilterCount > 0 && (
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#0077C8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>{activeFilterCount}</span>
              )}
            </button>
            <FilterPopover
              open={filtersOpen} onClose={() => setFiltersOpen(false)}
              groups={FILTER_GROUPS} selected={filterSelected} onToggle={toggleFilter} onClear={clearAllFilters}
              extra={filterExtra} width={240}
            />
          </div>

          {/* Export */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setExportOpen(o => !o); setRangeOpen(false); setFiltersOpen(false); }}
              className="eai-focusable"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#0077C8', border: 'none', borderRadius: 8,
                padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700,
              }}
            >
              <Download size={12} /> Export ▾
            </button>
            {exportOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 400, width: 230, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,0.12)', overflow: 'hidden' }}>
                {[
                  { key: 'pdf',        label: 'Portfolio summary (PDF)',  Icon: FileText },
                  { key: 'facilities', label: 'Facilities (XLSX)',        Icon: FileSpreadsheet },
                  { key: 'kpi',        label: 'KPI snapshot (CSV)',       Icon: FileDown },
                ].map(({ key, label, Icon }) => (
                  <button key={key} type="button" onClick={() => handleExport(key)} className="eai-focusable"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151', fontSize: 11 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Icon size={12} style={{ color: '#0077C8' }} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={dashboardRef} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KPI Strip (8 cards) ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {displayKpis.map(k => {
            const { key, ...cardProps } = k;
            return <KpiCard key={key} {...cardProps} onClick={() => setDrawer({ kind: 'kpi', kpi: k })} />;
          })}
        </div>

        {/* ── Row 2: Map+Capacity stack | Right Rail ────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 258px', gap: 14, alignItems: 'stretch' }}>

          {/* Map + Capacity by Region, stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

            {/* Map */}
            <MapPanel
              clusters={eaiMapClusters}
              fillHeight
              onMarkerClick={handleMarkerClick}
              selectedClusterIds={finalSelectedClusterIds}
              onViewFull={handleExpandGlobe}
            />

            {/* Capacity by Region */}
            <Card title="Capacity by Region" action={
              <DropBtn options={METRIC_OPTIONS.map(m => ({ key: m.key, label: m.label }))} value={metric} onChange={setMetric}>
                {metricDef.label} ▾
              </DropBtn>
            }>
              {/* Capped width — DonutChart's legend is a single-column list designed for a
                  narrow card; letting it stretch to this row's new full width spreads each
                  legend row's label/value apart with a big gap between them. */}
              <div style={{ maxWidth: 360 }}>
                <DonutChart
                  data={donutData}
                  centerLabel={donutCenterLabel}
                  centerUnit={metricDef.unit}
                  centerSublabel={donutCenterSublabel}
                  height={155}
                  innerRadius={50}
                  outerRadius={74}
                  activeName={activeRegionName}
                  onSegmentClick={handleRegionClick}
                />
              </div>
            </Card>
          </div>

          {/* Right Rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* AI Executive Briefing */}
            <div style={{
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.22)',
              borderRadius: 16, padding: 14, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1F36' }}>AI Executive Briefing</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, color: '#7C3AED',
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.30)',
                  borderRadius: 5, padding: '2px 6px',
                }}>Beta</span>
              </div>
              {eaiAiBriefing.paragraphs.map((para, i) => (
                <p key={i} style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.6, marginBottom: 6 }}>
                  {para.includes(eaiAiBriefing.linkText)
                    ? para.split(eaiAiBriefing.linkText).flatMap((part, j) =>
                        j === 0
                          ? [part]
                          : [<a key={j} href={eaiAiBriefing.linkHref} style={{ color: '#7C3AED', textDecoration: 'underline' }}>{eaiAiBriefing.linkText}</a>, part]
                      )
                    : para}
                </p>
              ))}
              <a href="/eai/intelligence-center" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, color: '#7C3AED', textDecoration: 'none', marginTop: 4,
              }}>
                View Full Briefing <ArrowRight size={10} />
              </a>
            </div>

            {/* Critical Alerts */}
            <ListCard
              title="Critical Alerts"
              count={24}
              viewAllHref="/eai/operations-hub"
              items={eaiCriticalAlerts}
              variant="alerts"
              footer={{ label: 'Go to Operations Hub', href: '/eai/operations-hub' }}
              onItemClick={item => setDrawer({ kind: 'alert', item })}
            />

            {/* Recent News */}
            <ListCard
              title="Recent News"
              items={eaiRecentNews}
              variant="news"
              onItemClick={item => setDrawer({ kind: 'news', item })}
              onViewAll={() => setDrawer({ kind: 'news-all' })}
            />
          </div>
        </div>

        {/* ── Row 3: 4 Chart Cards ──────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>

          {/* Utilization Trend */}
          <Card title="Utilization Trend" action={<DropBtn>All Regions ▾</DropBtn>}>
            <TrendChart type="line" data={filteredUtilTrend} color="#0077C8" unit="%" domain={[50, 100]} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <span style={{ width: 14, height: 2, background: '#0077C8', display: 'inline-block', borderRadius: 1 }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Avg Utilization</span>
            </div>
          </Card>

          {/* PUE Trend */}
          <Card title="PUE Trend" action={<DropBtn>All Regions ▾</DropBtn>}>
            <TrendChart type="line" data={filteredPueTrend} color="#00A36C" domain={[1.1, 1.6]} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <span style={{ width: 14, height: 2, background: '#00A36C', display: 'inline-block', borderRadius: 1 }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>Power Usage Effectiveness</span>
            </div>
          </Card>

          {/* Renewable Energy % */}
          <Card title="Renewable Energy %" action={<DropBtn>All Regions ▾</DropBtn>}>
            <TrendChart type="bar" data={eaiRenewableByRegion} color="#34D399" unit="%" xKey="name" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <span style={{ width: 14, height: 6, background: '#34D399', display: 'inline-block', borderRadius: 2 }} />
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>% Renewable by Region</span>
            </div>
          </Card>

          {/* Assets by Status */}
          <Card title="Assets by Status">
            <DonutChart
              data={eaiAssetStatus}
              centerLabel="21,342"
              centerSublabel="Total"
              height={130}
              innerRadius={36}
              outerRadius={56}
            />
          </Card>
        </div>

        {/* ── Row 4: Bottom 3-col ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

          {/* Upcoming Maintenance */}
          <Card
            title="Upcoming Maintenance"
            action={<a href="/eai/operations-hub" style={{ fontSize: 9, color: '#6B7280', textDecoration: 'none' }}>View All</a>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {eaiUpcomingMaintenance.map((m, i) => (
                <div
                  key={i}
                  onClick={() => setDrawer({ kind: 'maintenance', item: m })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                    paddingBottom: i < eaiUpcomingMaintenance.length - 1 ? 10 : 0,
                    borderBottom: i < eaiUpcomingMaintenance.length - 1 ? '1px solid #E2E8F0' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.asset}</p>
                    <p style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>{m.facility}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 9, color: '#6B7280' }}>{m.type}</p>
                    <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>{m.date}</p>
                    <span style={{
                      display: 'inline-block', marginTop: 3,
                      background: m.pc + '22', color: m.pc,
                      fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    }}>{m.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Demand Planning Summary */}
          <Card title="Demand Planning Summary">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {eaiDemandPlanning.map(d => (
                <StatTile key={d.label} {...d} onClick={() => setDrawer({ kind: 'demand', item: d })} />
              ))}
            </div>
          </Card>

          {/* ESG Summary */}
          <Card title="ESG Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eaiEsgMetrics.map(e => {
                const Icon = ESG_ICONS[e.iconKey] ?? Leaf;
                return (
                  <div
                    key={e.label}
                    onClick={() => setDrawer({ kind: 'esg', item: e })}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                      borderRadius: 10, padding: 10, cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: e.color + '18',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={15} style={{ color: e.color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{e.label}</p>
                      <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1F36', fontFamily: 'monospace', lineHeight: 1.1, marginTop: 2 }}>
                        {e.value}{e.unit === '%' && <span style={{ fontSize: 12, marginLeft: 2 }}>%</span>}
                      </p>
                      {e.unit && e.unit !== '%' && <p style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>{e.unit}</p>}
                      <p style={{ fontSize: 9, fontWeight: 600, color: '#00A36C', marginTop: 3 }}>{e.delta}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Row 5: All Facilities (main-body table — sortable + searchable) ── */}
        <Card
          title="All Facilities"
          noPad
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '4px 8px' }}>
                <Search size={10} style={{ color: '#9CA3AF' }} />
                <input value={facilitySearch} onChange={e => setFacilitySearch(e.target.value)} placeholder="Search facilities..."
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: 10, color: '#1A1F36', width: 130 }} />
              </div>
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>{sortedFacilitiesTable.length} of {eaiFacilities.length}</span>
            </div>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {FACILITY_COLUMNS.map(c => {
                    const active = facilitySort?.key === c.key;
                    return (
                      <th key={c.key} style={{ padding: '8px 14px', textAlign: c.align ?? 'left', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => handleFacilitySort(c.key)} className="eai-focusable" aria-label={`Sort by ${c.label}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontSize: 9, fontWeight: 700, color: active ? '#0077C8' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {c.label}
                          {active ? (facilitySort.dir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedFacilitiesTable.map((f, i) => {
                  const isSel = highlight?.source === 'cluster' && highlight.value === f.mapClusterId;
                  const color = STATUS_COLOR[f.status] ?? '#6B7280';
                  return (
                    <tr
                      key={f.id}
                      onClick={() => handleFacilityRowClick(f)}
                      onDoubleClick={() => openGlobeToFacility(f.id)}
                      style={{
                        background: isSel ? 'rgba(0,119,200,0.08)' : i % 2 === 0 ? 'transparent' : '#F8FAFC',
                        cursor: 'pointer', transition: 'background 0.12s',
                      }}
                    >
                      <td style={{ padding: '7px 14px', color: '#1A1F36', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.name}</td>
                      <td style={{ padding: '7px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{f.country}</td>
                      <td style={{ padding: '7px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{f.region}</td>
                      <td style={{ padding: '7px 14px', whiteSpace: 'nowrap' }}>
                        <DrawerPill label={f.status} color={color} />
                      </td>
                      <td style={{ padding: '7px 14px', color: '#1A1F36', textAlign: 'right', whiteSpace: 'nowrap' }}>{f.capacityMW} MW</td>
                      <td style={{ padding: '7px 14px', color: '#1A1F36', textAlign: 'right', whiteSpace: 'nowrap' }}>{f.utilizationPct}%</td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: f.healthScore < 70 ? '#DC2626' : '#1A1F36' }}>{f.healthScore}</td>
                    </tr>
                  );
                })}
                {sortedFacilitiesTable.length === 0 && (
                  <tr><td colSpan={FACILITY_COLUMNS.length} style={{ textAlign: 'center', padding: 20, color: '#9CA3AF', fontSize: 11 }}>No facilities match the current search/filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

      {/* ── Detail Drawer — the one shared "show me more" pattern ────────── */}
      <DrawerRouter
        drawer={drawer} onClose={closeDrawer} onOpen={setDrawer}
        facilities={eaiFacilities} assetStatus={eaiAssetStatus}
        capacityByRegion={eaiCapacityByRegion} utilizationByRegion={eaiUtilizationByRegion}
        renewableByRegion={eaiRenewableByRegion}
      />

      {/* ── 3D Globe expand modal ─────────────────────────────────────────── */}
      <GlobeModal
        open={globeOpen}
        onClose={() => { setGlobeOpen(false); setGlobeAutoSelectId(null); updateURL({ drawer: undefined }); }}
        facilities={eaiFacilities}
        focusClusterId={highlightedClusterIds[0] ?? null}
        autoSelectFacilityId={globeAutoSelectId}
        onFacilitySelected={id => updateURL({ drawer: id ? `facility:${id}` : undefined })}
      />
      <ToastHost />
    </div>
  );
}

export default function GlobalPortfolioPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', color: '#9CA3AF', fontSize: 12 }}>
        Loading…
      </div>
    }>
      <GlobalPortfolioInner />
    </Suspense>
  );
}

// ── Drawer content router ────────────────────────────────────────────────────
// Translates a `drawer` state value into the right DetailDrawer title/icon/body
// for each interaction built in this pass. Kept local to this page for now —
// once a second EAI page needs the same "kpi" / "facility" content shapes,
// this is the piece to lift into a shared helper.
function DrawerRouter({ drawer, onClose, onOpen, facilities, assetStatus, capacityByRegion, utilizationByRegion, renewableByRegion }) {
  if (!drawer) return <DetailDrawer open={false} onClose={onClose} />;

  const goToOperationsFooter = (
    <a href="/eai/operations-hub" style={{ fontSize: 11, color: '#0077C8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
      Go to Operations Hub <ChevronRight size={12} />
    </a>
  );

  switch (drawer.kind) {
    case 'kpi': {
      const kpi = drawer.kpi;
      const Icon = KPI_ICONS[kpi.iconKey] ?? Building2;
      return (
        <DetailDrawer open title={kpi.label} subtitle={kpi.sublabel} icon={<Icon size={16} color={kpi.color} />} accentColor={kpi.color} onClose={onClose}>
          <KpiDrawerBody
            kpi={kpi} onOpen={onOpen} facilities={facilities} assetStatus={assetStatus}
            capacityByRegion={capacityByRegion} utilizationByRegion={utilizationByRegion} renewableByRegion={renewableByRegion}
          />
        </DetailDrawer>
      );
    }

    case 'cluster': {
      const cluster = drawer.cluster;
      const clusterFacilities = facilities.filter(f => f.mapClusterId === cluster.id);
      const color = STATUS_COLOR[cluster.status] ?? '#6B7280';
      return (
        <DetailDrawer open title={cluster.label} subtitle={`${clusterFacilities.length} facilities in this region`} icon={<MapPin size={16} color={color} />} accentColor={color} onClose={onClose}>
          <FacilityTable facilities={clusterFacilities} />
        </DetailDrawer>
      );
    }

    case 'alert': {
      const item = drawer.item;
      return (
        <DetailDrawer open title={item.title} subtitle={item.sub} icon={<ShieldAlert size={16} color={item.color} />} accentColor={item.color} onClose={onClose} footer={goToOperationsFooter}>
          <DrawerStatRow items={[
            { label: 'Severity', value: item.severity, color: item.color },
            { label: 'Asset ID', value: item.assetId },
            { label: 'Detected', value: item.detectedAt },
          ]} />
          <p style={{ fontSize: 11, color: '#1A1F36', lineHeight: 1.6, marginBottom: 14 }}>{item.description}</p>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Recommended Action</p>
            <p style={{ fontSize: 11, color: '#1A1F36', lineHeight: 1.55 }}>{item.recommendedAction}</p>
          </div>
        </DetailDrawer>
      );
    }

    case 'news': {
      const item = drawer.item;
      return (
        <DetailDrawer open title={item.title} subtitle={`${item.cat} · ${item.ago}`} icon={<Newspaper size={16} color="#0077C8" />} accentColor="#0077C8" onClose={onClose}>
          <p style={{ fontSize: 11, color: '#1A1F36', lineHeight: 1.65 }}>{item.body}</p>
        </DetailDrawer>
      );
    }

    case 'news-all': {
      return (
        <DetailDrawer open title="Recent News" subtitle={`${eaiRecentNews.length} articles`} icon={<Newspaper size={16} color="#0077C8" />} accentColor="#0077C8" onClose={onClose}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {eaiRecentNews.map(item => (
              <div
                key={item.id}
                onClick={() => onOpen({ kind: 'news', item })}
                style={{ cursor: 'pointer', paddingBottom: 12, borderBottom: '1px solid #E2E8F0' }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, color: '#1A1F36', marginBottom: 4 }}>{item.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: '#9CA3AF' }}>{item.ago}</span>
                  <span style={{ width: 2, height: 2, borderRadius: '50%', background: '#E2E8F0', display: 'inline-block' }} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#0077C8' }}>{item.cat}</span>
                </div>
                <p style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.55 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </DetailDrawer>
      );
    }

    case 'maintenance': {
      const item = drawer.item;
      return (
        <DetailDrawer open title={item.asset} subtitle={`${item.facility} · ${item.type}`} icon={<Wrench size={16} color={item.pc} />} accentColor={item.pc} onClose={onClose} footer={goToOperationsFooter}>
          <DrawerStatRow items={[
            { label: 'Work Order', value: item.workOrderId },
            { label: 'Technician', value: item.technician },
            { label: 'Duration', value: `${item.durationHrs} hrs` },
            { label: 'Scheduled', value: item.date },
          ]} />
          <div style={{ marginBottom: 12 }}><DrawerPill label={`${item.priority} Priority`} color={item.pc} /></div>
          <p style={{ fontSize: 11, color: '#1A1F36', lineHeight: 1.6 }}>{item.notes}</p>
        </DetailDrawer>
      );
    }

    case 'demand': {
      const item = drawer.item;
      return (
        <DetailDrawer open title={item.label} subtitle={`${item.value}${item.unit ? ' ' + item.unit : ''} · ${item.delta}`} icon={<Layers size={16} color="#0077C8" />} accentColor="#0077C8" onClose={onClose}>
          <DrawerTable
            columns={[{ key: 'label', label: 'Category' }, { key: 'value', label: 'Value', align: 'right' }]}
            rows={item.breakdown}
            keyField="label"
          />
        </DetailDrawer>
      );
    }

    case 'esg': {
      const item = drawer.item;
      const Icon = ESG_ICONS[item.iconKey] ?? Leaf;
      return (
        <DetailDrawer open title={item.label} subtitle={`${item.value}${item.unit ? ' ' + item.unit : ''} · ${item.delta}`} icon={<Icon size={16} color={item.color} />} accentColor={item.color} onClose={onClose}>
          <DrawerTable
            columns={[{ key: 'label', label: 'Region' }, { key: 'value', label: 'Value', align: 'right' }]}
            rows={item.breakdown}
            keyField="label"
          />
        </DetailDrawer>
      );
    }

    default:
      return <DetailDrawer open={false} onClose={onClose} />;
  }
}

function FacilityTable({ facilities }) {
  return (
    <DrawerTable
      keyField="id"
      columns={[
        { key: 'name', label: 'Facility' },
        { key: 'country', label: 'Country' },
        { key: 'status', label: 'Status', render: row => <DrawerPill label={row.status} color={STATUS_COLOR[row.status] ?? '#6B7280'} /> },
        { key: 'capacityMW', label: 'Capacity', align: 'right', render: row => `${row.capacityMW} MW` },
        { key: 'utilizationPct', label: 'Util.', align: 'right', render: row => `${row.utilizationPct}%` },
      ]}
      rows={facilities}
    />
  );
}

function KpiDrawerBody({ kpi, onOpen, facilities, assetStatus, capacityByRegion, utilizationByRegion, renewableByRegion }) {
  switch (kpi.key) {
    case 'facilities':
      return (
        <>
          <DrawerStatRow items={[
            { label: 'Total Facilities', value: facilities.length },
            { label: 'Countries', value: new Set(facilities.map(f => f.country)).size },
            { label: 'Total Capacity', value: `${facilities.reduce((s, f) => s + f.capacityMW, 0).toLocaleString()} MW` },
          ]} />
          <FacilityTable facilities={facilities} />
        </>
      );

    case 'assets':
      return (
        <DrawerTable
          keyField="name"
          columns={[
            { key: 'name', label: 'Status' },
            { key: 'value', label: 'Assets', align: 'right', render: row => row.value.toLocaleString() },
            { key: 'pct', label: '% of Total', align: 'right', render: row => `${row.pct}%` },
          ]}
          rows={assetStatus}
        />
      );

    case 'capacity':
      return (
        <DrawerTable
          keyField="name"
          columns={[
            { key: 'name', label: 'Region' },
            { key: 'mw', label: 'MW', align: 'right', render: row => row.mw.toLocaleString() },
            { key: 'pct', label: '% of Total', align: 'right', render: row => `${row.pct}%` },
          ]}
          rows={capacityByRegion}
        />
      );

    case 'utilization':
      return (
        <DrawerTable
          keyField="name"
          columns={[
            { key: 'name', label: 'Region' },
            { key: 'value', label: 'Utilization', align: 'right', render: row => `${row.value}%` },
          ]}
          rows={utilizationByRegion}
        />
      );

    case 'health': {
      const sorted = [...facilities].sort((a, b) => a.healthScore - b.healthScore);
      const avg = Math.round(facilities.reduce((s, f) => s + f.healthScore, 0) / facilities.length);
      return (
        <>
          <DrawerStatRow items={[
            { label: 'Portfolio Avg', value: avg, color: '#00A36C' },
            { label: 'Lowest Score', value: sorted[0].healthScore, color: '#DC2626' },
            { label: 'At Risk (<70)', value: facilities.filter(f => f.healthScore < 70).length, color: '#D4A017' },
          ]} />
          <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Lowest-scoring facilities</p>
          <DrawerTable
            keyField="id"
            columns={[
              { key: 'name', label: 'Facility' },
              { key: 'region', label: 'Region' },
              { key: 'healthScore', label: 'Score', align: 'right', render: row => <span style={{ fontWeight: 700, color: row.healthScore < 70 ? '#DC2626' : '#1A1F36' }}>{row.healthScore}</span> },
            ]}
            rows={sorted.slice(0, 10)}
          />
        </>
      );
    }

    case 'pue':
      return (
        <DrawerTable
          keyField="week"
          columns={[
            { key: 'week', label: 'Week' },
            { key: 'value', label: 'PUE', align: 'right' },
          ]}
          rows={eaiPueTrend}
        />
      );

    case 'renewable':
      return (
        <DrawerTable
          keyField="name"
          columns={[
            { key: 'name', label: 'Region' },
            { key: 'value', label: 'Renewable %', align: 'right', render: row => `${row.value}%` },
          ]}
          rows={renewableByRegion}
        />
      );

    case 'alerts':
      return (
        <>
          <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 10 }}>Showing 3 of 24 active alerts — click a row for full detail.</p>
          <DrawerTable
            keyField="id"
            columns={[
              { key: 'title', label: 'Alert' },
              { key: 'sub', label: 'Facility' },
              { key: 'severity', label: 'Severity', render: row => <DrawerPill label={row.severity} color={row.color} /> },
              { key: 'ago', label: 'Detected', align: 'right' },
            ]}
            rows={eaiCriticalAlerts.map(item => ({ ...item, __onClick: () => onOpen({ kind: 'alert', item }) }))}
          />
        </>
      );

    default:
      return null;
  }
}
