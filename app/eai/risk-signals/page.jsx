'use client';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Filter, Download, ChevronDown, ChevronUp, Plus, FileText, FileSpreadsheet, FileDown,
  ShieldAlert, CloudRain, Waves, Flame, Zap, Scale, Globe2, Building2, Layers, Activity,
  ExternalLink, X, Wrench, RefreshCw, BellRing, ClipboardList, CheckCircle2, Circle,
  ChevronRight, Radio, Satellite, Map as MapIcon, Droplets, Sun, PlugZap,
} from 'lucide-react';

import KpiCard            from '@/components/eai/widgets/KpiCard';
import DetailDrawer, { DrawerTable, DrawerStatRow, DrawerPill } from '@/components/eai/widgets/DetailDrawer';
import DataTable          from '@/components/eai/widgets/DataTable';
import TrendChart         from '@/components/eai/widgets/TrendChart';
import DonutChart         from '@/components/eai/widgets/DonutChart';
import ForecastChart      from '@/components/eai/widgets/ForecastChart';
import ScoreRing          from '@/components/eai/widgets/ScoreRing';
import StatusListCard     from '@/components/eai/widgets/StatusListCard';
import RiskHeatmapGrid    from '@/components/eai/widgets/RiskHeatmapGrid';
import HorizontalBarList  from '@/components/eai/widgets/HorizontalBarList';
import QuickActionsMenu   from '@/components/eai/widgets/QuickActionsMenu';
import FilterPopover      from '@/components/eai/widgets/FilterPopover';
import { useToast }       from '@/components/eai/widgets/Toast';
import AIChatPanel        from '@/components/ai-chat/AIChatPanel';
import { eaiRenewableByRegion } from '@/data/eaiMockData';
import { RENEWABLE_ENERGY, ENERGY_WATER } from '@/data/eaiFinOpsEsgMock';

const RiskSignalMap = dynamic(() => import('@/components/eai/widgets/RiskSignalMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Loading satellite map…</span>
    </div>
  ),
});

import {
  RISK_KPIS, SITE_RISK, SIGNAL_FEED, HAZARD_LAYERS, RISK_BY_CATEGORY, RISK_TREND,
  RISK_FORECAST, RISK_FORECAST_THRESHOLD, RISK_FORECAST_EXCEED_WEEK, TOP_AT_RISK_SITES,
  REGULATORY_WATCH, MITIGATION_TEMPLATES, HAZARD_LABELS,
} from '@/data/eaiRiskSignalsMock';

// ─── shared card styles (mirrors app/eai/intelligence-center/page.jsx) ───────
const CARD = {
  background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
  overflow: 'hidden', display: 'flex', flexDirection: 'column',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
};
const CARD_HDR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
};
const CARD_TITLE = { fontSize: 11, fontWeight: 700, color: '#1A1F36' };
const LABEL_STYLE = { fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' };
const INPUT_STYLE = { fontSize: 11, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, color: '#1A1F36', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

const BAND_COLOR = { low: '#10B981', elevated: '#F59E0B', high: '#EF4444', critical: '#991B1B' };
const SEVERITY_COLOR = { critical: '#DC2626', warning: '#F59E0B', watch: '#0077C8', info: '#6B7280' };
const HAZARD_ICONS = { weather: CloudRain, seismic: Activity, flood: Waves, wildfire: Flame, grid: Zap, regulatory: Scale, geopolitical: Globe2 };
const HAZARD_KEY_TO_SUB = { weather: 'weather', seismic: 'seismic', flood: 'flood', wildfire: 'wildfire', grid: 'gridReliability', regulatory: 'regulatory', geopolitical: 'geopolitical' };
const HEATMAP_HAZARDS = ['weather', 'seismic', 'flood', 'wildfire', 'gridReliability'];

const PERIOD_PRESETS = [
  { key: '7d',  label: '7 Days',  weeks: 2 },
  { key: '30d', label: '30 Days', weeks: 4 },
  { key: '90d', label: '90 Days', weeks: 8 },
];

function agoTier(ago) {
  if (ago.includes('min')) return 'Last Hour';
  if (ago.includes('hr')) return 'Last 24 Hours';
  return 'Older';
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

function mitigationsForSite(site) {
  const top2 = Object.entries(site.sub).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return top2.map(([hazardKey, score]) => ({
    hazard: HAZARD_LABELS[hazardKey] ?? hazardKey,
    score,
    recommendation: MITIGATION_TEMPLATES[hazardKey],
    priority: score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low',
  }));
}

// ── drawer <-> URL param encoding ─────────────────────────────────────────────
function drawerToParam(d) {
  if (!d) return undefined;
  switch (d.kind) {
    case 'kpi':        return `kpi:${d.kpi.key}`;
    case 'site':       return `site:${d.site.facilityId}`;
    case 'signal':     return `signal:${d.signal.id}`;
    case 'signals-all':return 'signals-all';
    case 'regulatory': return `regulatory:${d.item.id}`;
    default: return undefined;
  }
}
function paramToDrawer(param) {
  if (!param) return null;
  if (param === 'signals-all') return { kind: 'signals-all' };
  const sep = param.indexOf(':');
  if (sep === -1) return null;
  const kind = param.slice(0, sep);
  const id = decodeURIComponent(param.slice(sep + 1));
  switch (kind) {
    case 'kpi':        { const kpi = RISK_KPIS.find(k => k.key === id); return kpi ? { kind: 'kpi', kpi } : null; }
    case 'site':       { const site = SITE_RISK.find(s => s.facilityId === id); return site ? { kind: 'site', site } : null; }
    case 'signal':     { const signal = SIGNAL_FEED.find(s => s.id === id); return signal ? { kind: 'signal', signal } : null; }
    case 'regulatory': { const item = REGULATORY_WATCH.find(r => r.id === id); return item ? { kind: 'regulatory', item } : null; }
    default: return null;
  }
}

function hazardCellStyle(ri, ci, val) {
  if (val >= 70) return { bg: '#EF4444', text: '#fff' };
  if (val >= 45) return { bg: '#F59E0B', text: '#1a1a1a' };
  if (val >= 25) return { bg: 'rgba(251,191,36,0.85)', text: '#1a1a1a' };
  return { bg: '#22C55E', text: '#fff' };
}

// ── sub-score bar row (compact "gauge") for the site drawer ──────────────────
function SubScoreBar({ label, value }) {
  const color = value >= 70 ? '#EF4444' : value >= 45 ? '#F59E0B' : value >= 25 ? '#D4A017' : '#10B981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#6B7280', width: 92, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#E2E8F0', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', width: 24, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }}>{value}</span>
    </div>
  );
}

// ── page (inner — uses useSearchParams, must be wrapped in Suspense) ────────
function RiskSignalsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast, ToastHost } = useToast();
  const dashboardRef = useRef(null);
  const siteDrawerRef = useRef(null);

  const [selectedFacilityId, setSelectedFacilityIdState] = useState(() => searchParams.get('site') || null);
  const [activeLayers, setActiveLayersState] = useState(() => {
    const param = searchParams.get('layers');
    if (param) return param.split(',').filter(Boolean);
    return HAZARD_LAYERS.filter(l => l.defaultOn).map(l => l.key);
  });
  const [basemap, setBasemap] = useState('satellite');
  const [layersOpen, setLayersOpen] = useState(false);

  const [drawer, setDrawerState] = useState(() => paramToDrawer(searchParams.get('drawer')));

  const [filters, setFilters] = useState({ hazardType: [], severity: [], region: [], band: [], dateRange: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState('90d');

  const [ackSignals, setAckSignals] = useState(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const [siteSort, setSiteSort] = useState(null);

  const updateURL = useCallback((patch) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') params.delete(k);
      else params.set(k, v);
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function setSelectedFacilityId(id) { setSelectedFacilityIdState(id); updateURL({ site: id || undefined }); }
  function setActiveLayers(next) { setActiveLayersState(next); updateURL({ layers: next.length ? next.join(',') : undefined }); }
  function toggleLayer(key) { setActiveLayers(activeLayers.includes(key) ? activeLayers.filter(k => k !== key) : [...activeLayers, key]); }
  function openDrawer(kind, payload) { const d = { kind, ...payload }; setDrawerState(d); updateURL({ drawer: drawerToParam(d) }); }
  function closeDrawer() { setDrawerState(null); updateURL({ drawer: undefined }); }

  // ── Filters ────────────────────────────────────────────────────────────────
  const FILTER_GROUPS = useMemo(() => [
    { key: 'hazardType', label: 'Hazard Type', options: HAZARD_LAYERS.map(l => l.label) },
    { key: 'severity',   label: 'Severity',    options: ['Critical', 'Warning', 'Watch', 'Info'] },
    { key: 'region',     label: 'Region',      options: [...new Set(SITE_RISK.map(s => s.region))].sort() },
    { key: 'band',       label: 'Risk Band',   options: ['Critical', 'High', 'Elevated', 'Low'] },
    { key: 'dateRange',  label: 'Signal Age',  options: ['Last Hour', 'Last 24 Hours', 'Older'], single: true },
  ], []);
  const filterSelected = {
    hazardType: filters.hazardType, severity: filters.severity, region: filters.region,
    band: filters.band, dateRange: filters.dateRange ? [filters.dateRange] : [],
  };
  const filtersActive = filters.hazardType.length > 0 || filters.severity.length > 0 || filters.region.length > 0 || filters.band.length > 0 || !!filters.dateRange;
  const activeFilterCount = filters.hazardType.length + filters.severity.length + filters.region.length + filters.band.length + (filters.dateRange ? 1 : 0);

  function toggleFilter(groupKey, value) {
    if (groupKey === 'dateRange') { setFilters(prev => ({ ...prev, dateRange: prev.dateRange === value ? '' : value })); return; }
    setFilters(prev => {
      const cur = prev[groupKey];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      return { ...prev, [groupKey]: next };
    });
  }
  function clearAllFilters() {
    setFilters({ hazardType: [], severity: [], region: [], band: [], dateRange: '' });
    showToast('Filters cleared', 'info');
  }
  function toggleSingleHazardFilter(label) {
    setFilters(prev => ({ ...prev, hazardType: (prev.hazardType.length === 1 && prev.hazardType[0] === label) ? [] : [label] }));
  }

  const activeHazardKeys = useMemo(() => (
    filters.hazardType.length ? HAZARD_LAYERS.filter(l => filters.hazardType.includes(l.label)).map(l => l.key) : null
  ), [filters.hazardType]);
  const activeSeverities = useMemo(() => (filters.severity.length ? filters.severity.map(s => s.toLowerCase()) : null), [filters.severity]);
  const activeBands = useMemo(() => (filters.band.length ? filters.band.map(b => b.toLowerCase()) : null), [filters.band]);

  const facilityRegion = useMemo(() => Object.fromEntries(SITE_RISK.map(s => [s.facilityId, s.region])), []);

  const filteredSignals = useMemo(() => SIGNAL_FEED.filter(s => {
    if (activeHazardKeys && !activeHazardKeys.includes(s.type)) return false;
    if (activeSeverities && !activeSeverities.includes(s.severity)) return false;
    if (filters.region.length && !filters.region.includes(facilityRegion[s.facilityId])) return false;
    if (filters.dateRange && agoTier(s.ago) !== filters.dateRange) return false;
    return true;
  }), [activeHazardKeys, activeSeverities, filters.region, filters.dateRange, facilityRegion]);

  const filteredSites = useMemo(() => SITE_RISK.filter(s => {
    if (filters.region.length && !filters.region.includes(s.region)) return false;
    if (activeBands && !activeBands.includes(s.band)) return false;
    return true;
  }), [filters.region, activeBands]);

  // ── KPI strip ────────────────────────────────────────────────────────────
  const displayKpis = useMemo(() => {
    if (!filtersActive) return RISK_KPIS;
    const sitesAtRisk = filteredSites.filter(s => s.band === 'high' || s.band === 'critical').length;
    const avgRisk = filteredSites.length ? Math.round(filteredSites.reduce((s, x) => s + x.riskScore, 0) / filteredSites.length) : 0;
    const highSev = filteredSignals.filter(s => s.severity === 'critical' || s.severity === 'warning').length;
    return RISK_KPIS.map(k => {
      if (k.key === 'sitesAtRisk')        return { ...k, value: sitesAtRisk, sublabel: `of ${filteredSites.length} facilities (filtered)` };
      if (k.key === 'activeSignals24h')   return { ...k, value: filteredSignals.length, sublabel: 'Filtered view' };
      if (k.key === 'highSeveritySignals')return { ...k, value: highSev, sublabel: 'Filtered view' };
      if (k.key === 'avgSiteRisk')        return { ...k, value: avgRisk, sublabel: 'Filtered sites' };
      return k;
    });
  }, [filtersActive, filteredSites, filteredSignals]);

  // ── Trend (period-sliced) ─────────────────────────────────────────────────
  const periodWeeks = PERIOD_PRESETS.find(p => p.key === period)?.weeks ?? 8;
  const trendData = RISK_TREND.slice(-periodWeeks);

  // ── Heatmap: top sites × 5 physical hazards ──────────────────────────────
  const heatmapRows = useMemo(() => [...filteredSites]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .map(s => ({
      label: s.name.length > 15 ? `${s.name.slice(0, 14)}…` : s.name,
      facilityId: s.facilityId,
      cells: HEATMAP_HAZARDS.map(h => s.sub[h]),
    })), [filteredSites]);
  const heatmapColLabels = HEATMAP_HAZARDS.map(h => HAZARD_LABELS[h]);

  // ── Top At-Risk Sites table ───────────────────────────────────────────────
  const SITE_COLUMNS = [
    { key: 'name',      label: 'Facility', sortable: true },
    { key: 'region',    label: 'Region', sortable: true },
    { key: 'band',      label: 'Band', sortable: true, render: v => <DrawerPill label={v} color={BAND_COLOR[v] ?? '#6B7280'} /> },
    { key: 'riskScore', label: 'Risk Score', align: 'right', sortable: true },
    { key: 'topHazard', label: 'Top Hazard', sortable: true },
  ];
  const sortedTopSites = useMemo(() => {
    if (!siteSort) return TOP_AT_RISK_SITES;
    const { key, dir } = siteSort;
    const mult = dir === 'asc' ? 1 : -1;
    return [...TOP_AT_RISK_SITES].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [siteSort]);
  function handleSiteSort(key) {
    setSiteSort(prev => (prev && prev.key === key) ? (prev.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' });
  }

  // ── Energy Intelligence: grid/water risk by region, supply mix, energy regs ─
  function regionRiskColor(v) { return v >= 40 ? '#EF4444' : v >= 25 ? '#F59E0B' : '#10B981'; }
  function avgByRegion(subKey) {
    const byRegion = {};
    SITE_RISK.forEach(s => { (byRegion[s.region] ??= []).push(s.sub[subKey]); });
    return Object.entries(byRegion)
      .map(([region, vals]) => ({ label: region, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }))
      .sort((a, b) => b.value - a.value)
      .map(r => ({ ...r, color: regionRiskColor(r.value) }));
  }
  const gridRiskByRegion = useMemo(() => avgByRegion('gridReliability'), []);
  const waterStressByRegion = useMemo(() => avgByRegion('waterStress'), []);
  const energyRegulatoryWatch = useMemo(() => (
    REGULATORY_WATCH.filter(r => /energy|grid|water/i.test(r.title))
  ), []);

  // ── Acknowledge / scan ────────────────────────────────────────────────────
  function handleAcknowledgeSignal(id) {
    setAckSignals(prev => new Set(prev).add(id));
    showToast('Signal acknowledged', 'success');
  }
  async function handleRunRiskScan() {
    const sites = filteredSites.length ? filteredSites : SITE_RISK;
    setScanning(true); setScanProgress(0);
    let done = 0;
    try {
      await Promise.all(sites.map(async site => {
        try {
          await fetch('/api/risk-signal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: site.name, lat: site.lat, lon: site.lon }),
          });
        } catch { /* individual site failures don't block the scan */ }
        done++; setScanProgress(Math.round((done / sites.length) * 100));
      }));
      showToast(`Risk scan complete — refreshed live data for ${sites.length} sites`, 'success');
    } finally {
      setScanning(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport(kind) {
    setExportOpen(false);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      if (kind === 'pdf') {
        if (!dashboardRef.current) return;
        await exportPanelPdf(dashboardRef.current, `risk-signals-${dateStr}.pdf`);
        showToast('Risk summary exported as PDF', 'success');
        return;
      }
      if (kind === 'sites') {
        const rows = filteredSites.map(s => ({ Facility: s.name, City: s.city, Country: s.country, Region: s.region, Band: s.band, 'Risk Score': s.riskScore }));
        await exportWorkbook([{ name: 'Site Risk', rows }], `risk-signals-sites-${dateStr}.xlsx`);
        showToast(`Exported ${rows.length} sites`, 'success');
        return;
      }
      if (kind === 'signals') {
        const rows = filteredSignals.map(s => ({ Type: HAZARD_LABELS[HAZARD_KEY_TO_SUB[s.type]] ?? s.type, Severity: s.severity, Facility: SITE_RISK.find(x => x.facilityId === s.facilityId)?.name ?? s.facilityId, Title: s.title, Source: s.source, Reported: s.ago }));
        await exportCsv(rows, `risk-signals-signals-${dateStr}.csv`);
        showToast(`Exported ${rows.length} signals`, 'success');
      }
    } catch {
      showToast('Export failed — please try again', 'error');
    }
  }

  const contextLabel = drawer?.kind === 'site' ? drawer.site.name : null;
  const periodDef = PERIOD_PRESETS.find(p => p.key === period);

  // ── AI Risk Intelligence context ──────────────────────────────────────────
  const AI_SYSTEM_CONTEXT = `You are the EAI Platform Risk Signals Engine — an AI assistant specialized in EXTERNAL, environmental, geospatial, and regulatory risk affecting a global datacenter portfolio (weather, seismic, flood, wildfire, grid reliability, water stress, regulatory change, geopolitical exposure). You do NOT cover internal asset-failure or anomaly risk — that is a different system (Intelligence Center). Always be specific, cite site names and scores, and be concise.`;
  const AI_CONTEXT = `Risk Signals Dashboard — ${SITE_RISK.length} facilities monitored. Avg site risk score: ${Math.round(SITE_RISK.reduce((s, x) => s + x.riskScore, 0) / SITE_RISK.length)}/100.
Sites at Critical/High risk: ${SITE_RISK.filter(s => s.band === 'critical' || s.band === 'high').map(s => `${s.name} (${s.riskScore})`).join(', ')}.
Top 5 open signals: ${SIGNAL_FEED.slice(0, 5).map(s => `${s.title} [${s.severity}]`).join('; ')}.
Pending regulatory changes: ${REGULATORY_WATCH.filter(r => r.status === 'Pending' || r.status === 'Proposed').map(r => r.title).join('; ')}.`;
  const AI_CHIPS = [
    'Which sites face the highest climate risk this week?',
    'Summarize regulatory changes affecting APAC',
    "What's driving Mumbai DC's flood score?",
    'Recommend mitigations for grid-reliability risk',
  ];

  // ── drawer content ──────────────────────────────────────────────────────
  function renderDrawer() {
    if (!drawer) return <DetailDrawer open={false} onClose={closeDrawer} />;

    if (drawer.kind === 'kpi') {
      const kpi = drawer.kpi;
      let body = <DrawerStatRow items={[{ label: kpi.label, value: `${kpi.value}${kpi.unit}` }, { label: 'Trend', value: kpi.delta }]} />;
      if (kpi.key === 'sitesAtRisk' || kpi.key === 'avgSiteRisk') {
        body = <DrawerTable columns={[{ key: 'name', label: 'Facility' }, { key: 'band', label: 'Band' }, { key: 'riskScore', label: 'Score', align: 'right' }]} rows={[...SITE_RISK].sort((a, b) => b.riskScore - a.riskScore).slice(0, 12)} keyField="facilityId" />;
      } else if (kpi.key === 'activeSignals24h' || kpi.key === 'highSeveritySignals' || kpi.key === 'signalsIngested24h') {
        body = <DrawerTable columns={[{ key: 'title', label: 'Signal' }, { key: 'severity', label: 'Severity', render: r => <DrawerPill label={r.severity} color={SEVERITY_COLOR[r.severity]} /> }, { key: 'ago', label: 'Reported', align: 'right' }]} rows={SIGNAL_FEED.slice(0, 15)} keyField="id" />;
      } else if (kpi.key === 'regulatoryPending') {
        body = <DrawerTable columns={[{ key: 'jurisdiction', label: 'Jurisdiction' }, { key: 'title', label: 'Change' }, { key: 'status', label: 'Status', align: 'right' }]} rows={REGULATORY_WATCH} keyField="id" />;
      }
      return <DetailDrawer open title={kpi.label} subtitle={kpi.sublabel} icon={<ShieldAlert size={16} color={kpi.color} />} accentColor={kpi.color} onClose={closeDrawer}>{body}</DetailDrawer>;
    }

    if (drawer.kind === 'site') {
      const site = drawer.site;
      const siteSignals = SIGNAL_FEED.filter(s => s.facilityId === site.facilityId);
      const mitigations = mitigationsForSite(site);
      const color = BAND_COLOR[site.band] ?? '#6B7280';
      return (
        <DetailDrawer
          open title={site.name} subtitle={`${site.city}, ${site.country} · ${site.region}`}
          icon={<Building2 size={16} color={color} />} accentColor={color} width={460} onClose={closeDrawer}
          footer={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => router.push(`/eai/operations-hub?node=${site.facilityId}`)} className="eai-focusable" style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#0077C8', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Create Work Order</button>
                <button onClick={() => router.push(`/eai/real-estate-explorer?node=${site.facilityId}`)} className="eai-focusable" style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#1A1F36', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>View in Real Estate Explorer</button>
              </div>
              <button
                onClick={async () => { if (!siteDrawerRef.current) return; await exportPanelPdf(siteDrawerRef.current, `site-risk-${site.facilityId}.pdf`); showToast('Site risk exported as PDF', 'success'); }}
                className="eai-focusable"
                style={{ padding: '8px 0', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#6B7280', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >Export site risk (PDF)</button>
            </div>
          }
        >
          <div ref={siteDrawerRef}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <ScoreRing score={site.riskScore} unit="/100" color={color} sublabel={`${site.band.charAt(0).toUpperCase() + site.band.slice(1)} risk`} size={104} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(site.sub).map(([k, v]) => <SubScoreBar key={k} label={HAZARD_LABELS[k] ?? k} value={v} />)}
              </div>
            </div>

            <SiteLiveRiskPanel site={site} />

            {siteSignals.length > 0 && (
              <>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', margin: '16px 0 8px' }}>Recent Signals</p>
                <DrawerTable columns={[
                  { key: 'title', label: 'Signal' },
                  { key: 'severity', label: 'Severity', render: r => <DrawerPill label={r.severity} color={SEVERITY_COLOR[r.severity]} /> },
                  { key: 'ago', label: 'Reported', align: 'right' },
                ]} rows={siteSignals} keyField="id" />
              </>
            )}

            <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', margin: '16px 0 8px' }}>Recommended Mitigations</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mitigations.map((m, i) => (
                <div key={i} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36' }}>{m.hazard}</span>
                    <DrawerPill label={`${m.priority} Priority`} color={m.priority === 'High' ? '#EF4444' : m.priority === 'Medium' ? '#F59E0B' : '#10B981'} />
                  </div>
                  <p style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.5 }}>{m.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </DetailDrawer>
      );
    }

    if (drawer.kind === 'signal') {
      const s = drawer.signal;
      const site = SITE_RISK.find(x => x.facilityId === s.facilityId);
      const Icon = HAZARD_ICONS[s.type] ?? ShieldAlert;
      const acked = ackSignals.has(s.id);
      return (
        <DetailDrawer
          open title={s.title} subtitle={site?.name} icon={<Icon size={16} color={SEVERITY_COLOR[s.severity]} />} accentColor={SEVERITY_COLOR[s.severity]} onClose={closeDrawer}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => site && openDrawer('site', { site })} className="eai-focusable" style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#1A1F36', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>View Site Risk</button>
              <button
                onClick={() => handleAcknowledgeSignal(s.id)} disabled={acked} className="eai-focusable"
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: acked ? '#E2E8F0' : '#0077C8', color: acked ? '#9CA3AF' : '#fff', fontSize: 11, fontWeight: 700, cursor: acked ? 'default' : 'pointer' }}
              >{acked ? 'Acknowledged' : 'Acknowledge'}</button>
            </div>
          }
        >
          <DrawerStatRow items={[
            { label: 'Severity', value: s.severity, color: SEVERITY_COLOR[s.severity] },
            { label: 'Type', value: HAZARD_LABELS[HAZARD_KEY_TO_SUB[s.type]] ?? s.type },
            { label: 'Reported', value: s.ago },
          ]} />
          <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Source</p>
          <a href={s.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0077C8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
            {s.source} <ExternalLink size={10} />
          </a>
          {site && (
            <>
              <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Affected Facility</p>
              <DrawerStatRow items={[{ label: 'Facility', value: site.name }, { label: 'Site Risk Score', value: site.riskScore, color: BAND_COLOR[site.band] }]} />
            </>
          )}
        </DetailDrawer>
      );
    }

    if (drawer.kind === 'signals-all') {
      return (
        <DetailDrawer open title="Live Signal Feed" subtitle={`${SIGNAL_FEED.length} signals`} icon={<ShieldAlert size={16} color="#DC2626" />} accentColor="#DC2626" onClose={closeDrawer}>
          <DrawerTable columns={[
            { key: 'title', label: 'Signal' },
            { key: 'severity', label: 'Severity', render: r => <DrawerPill label={r.severity} color={SEVERITY_COLOR[r.severity]} /> },
            { key: 'ago', label: 'Reported', align: 'right' },
          ]} rows={SIGNAL_FEED.map(s => ({ ...s, __onClick: () => openDrawer('signal', { signal: s }) }))} keyField="id" />
        </DetailDrawer>
      );
    }

    if (drawer.kind === 'regulatory') {
      const item = drawer.item;
      return (
        <DetailDrawer open title={item.title} subtitle={item.jurisdiction} icon={<Scale size={16} color="#10B981" />} accentColor="#10B981" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Status', value: item.status },
            { label: 'Effective', value: item.effectiveDate },
            { label: 'Impact', value: item.impact, color: item.impact === 'High' ? '#EF4444' : item.impact === 'Medium' ? '#F59E0B' : '#10B981' },
          ]} />
          <p style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Affected Sites ({item.affectedSites.length})</p>
          <DrawerTable columns={[{ key: 'name', label: 'Facility' }, { key: 'riskScore', label: 'Risk Score', align: 'right' }]}
            rows={SITE_RISK.filter(s => item.affectedSites.includes(s.facilityId))} keyField="facilityId" />
        </DetailDrawer>
      );
    }

    return <DetailDrawer open={false} onClose={closeDrawer} />;
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F4F6F9' }}>
      <style>{`
        .eai-focusable:focus-visible { outline: 2px solid #0077C8; outline-offset: 2px; border-radius: 4px; }
        @keyframes eaiLivePulse { 0% { opacity:1; } 50% { opacity:0.35; } 100% { opacity:1; } }
      `}</style>

      {/* Sub-header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid #E2E8F0', flexShrink: 0, background: '#F4F6F9' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1A1F36', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>Risk Signals</h1>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 20, padding: '2px 8px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', display: 'inline-block', animation: 'eaiLivePulse 1.4s ease-in-out infinite' }} />
              LIVE
            </span>
            {scanning && (
              <span style={{ fontSize: 9, color: '#6B7280' }}>Scanning… {scanProgress}%</span>
            )}
          </div>
          <p style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Geospatial, environmental &amp; regulatory risk intelligence across the portfolio</p>
        </div>

        {/* Period selector */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setPeriodOpen(o => !o); setFiltersOpen(false); setExportOpen(false); }} className="eai-focusable" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>
            Last {periodDef?.label ?? '90 Days'} <ChevronDown size={9} />
          </button>
          {periodOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 400, width: 130, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(16,24,40,0.12)', overflow: 'hidden' }}>
              {PERIOD_PRESETS.map(p => (
                <button key={p.key} type="button" onClick={() => { setPeriod(p.key); setPeriodOpen(false); }} className="eai-focusable"
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: p.key === period ? 'rgba(0,119,200,0.08)' : 'transparent', color: p.key === period ? '#0077C8' : '#374151', fontSize: 10, fontWeight: p.key === period ? 700 : 400, cursor: 'pointer' }}>
                  Last {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setFiltersOpen(o => !o); setPeriodOpen(false); setExportOpen(false); }} className="eai-focusable" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: filtersActive ? '#0077C8' : '#6B7280', background: filtersActive ? 'rgba(0,119,200,0.08)' : '#F8FAFC', border: `1px solid ${filtersActive ? 'rgba(0,119,200,0.30)' : '#E2E8F0'}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>
            <Filter size={11} /> Filters
            {activeFilterCount > 0 && <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#0077C8', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>}
          </button>
          <FilterPopover open={filtersOpen} onClose={() => setFiltersOpen(false)} groups={FILTER_GROUPS} selected={filterSelected} onToggle={toggleFilter} onClear={clearAllFilters} width={230} />
        </div>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setExportOpen(o => !o); setPeriodOpen(false); setFiltersOpen(false); }} className="eai-focusable" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: '#fff', background: '#0077C8', border: 'none', borderRadius: 7, padding: '5px 14px', cursor: 'pointer' }}>
            <Download size={11} /> Export
          </button>
          {exportOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 400, width: 220, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,0.12)', overflow: 'hidden' }}>
              {[
                { key: 'pdf',     label: 'Risk summary (PDF)',    Icon: FileText },
                { key: 'sites',   label: 'Site risk table (XLSX)',Icon: FileSpreadsheet },
                { key: 'signals', label: 'Signals (CSV)',         Icon: FileDown },
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

        <QuickActionsMenu items={[
          { iconKey: 'RefreshCw',   label: 'Run risk scan',       onClick: handleRunRiskScan },
          { iconKey: 'FileText',    label: 'Create risk report',  onClick: () => setExportOpen(true) },
          { iconKey: 'Bell',        label: 'Subscribe to alerts', onClick: () => showToast('Subscribed to Risk Signals alerts', 'success') },
          { iconKey: 'Download',    label: 'Export signals',      onClick: () => handleExport('signals') },
        ]} />
      </div>

      {/* Scrollable content */}
      <div ref={dashboardRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {displayKpis.map(k => {
            const { key, ...cardProps } = k;
            return <KpiCard key={key} {...cardProps} onClick={() => openDrawer('kpi', { kpi: k })} />;
          })}
        </div>

        {/* Row 2: Satellite map | Right rail */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, minHeight: 440, alignItems: 'start' }}>

          {/* Map card */}
          <div style={{ ...CARD, height: 440 }}>
            <div style={CARD_HDR}>
              <span style={CARD_TITLE}>Global Risk Map</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, overflow: 'hidden' }}>
                  {[{ key: 'satellite', label: 'Satellite', Icon: Satellite }, { key: 'street', label: 'Street', Icon: MapIcon }].map(({ key, label, Icon }) => (
                    <button key={key} onClick={() => setBasemap(key)} className="eai-focusable" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 9, fontWeight: basemap === key ? 700 : 400, background: basemap === key ? '#0077C8' : 'transparent', border: 'none', color: basemap === key ? '#fff' : '#6B7280', cursor: 'pointer' }}>
                      <Icon size={10} /> {label}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setLayersOpen(o => !o)} className="eai-focusable" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 9, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, cursor: 'pointer' }}>
                    <Layers size={10} /> Layers <ChevronDown size={9} />
                  </button>
                  {layersOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 500, width: 170, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 8px 24px rgba(16,24,40,0.12)', padding: '6px 4px' }}>
                      {HAZARD_LAYERS.map(l => {
                        const on = activeLayers.includes(l.key);
                        return (
                          <button key={l.key} type="button" onClick={() => toggleLayer(l.key)} className="eai-focusable"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${on ? l.color : '#CBD5E1'}`, background: on ? l.color : '#fff', flexShrink: 0 }} />
                            <span style={{ fontSize: 10.5, color: '#1A1F36' }}>{l.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <RiskSignalMap
                sites={filteredSites}
                signals={filteredSignals}
                activeLayers={activeLayers}
                layerColors={Object.fromEntries(HAZARD_LAYERS.map(l => [l.key, l.color]))}
                selectedFacilityId={selectedFacilityId}
                basemap={basemap}
                onSiteClick={site => setSelectedFacilityId(site.facilityId)}
                onSiteDoubleClick={site => openDrawer('site', { site })}
              />
              {/* Legend */}
              <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(255,255,255,0.9)', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 260, zIndex: 500 }}>
                {Object.entries(BAND_COLOR).map(([band, color]) => (
                  <div key={band} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6B7280', textTransform: 'capitalize' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} /> {band}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: 440 }}>

            {/* Live Signal Feed */}
            <div style={{ ...CARD, flex: 1, minHeight: 0 }}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Live Signal Feed</span>
                <button onClick={() => openDrawer('signals-all', {})} className="eai-focusable" style={{ fontSize: 9, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
              </div>
              {/* Filter chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', borderBottom: '1px solid #E2E8F0' }}>
                {HAZARD_LAYERS.map(l => {
                  const on = filters.hazardType.includes(l.label);
                  const Icon = HAZARD_ICONS[l.key] ?? ShieldAlert;
                  return (
                    <button key={l.key} onClick={() => toggleSingleHazardFilter(l.label)} className="eai-focusable"
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${on ? l.color : '#E2E8F0'}`, background: on ? l.color + '18' : '#F8FAFC', color: on ? l.color : '#9CA3AF' }}>
                      <Icon size={9} /> {l.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
                {filteredSignals.slice(0, 20).map((s, i) => {
                  const Icon = HAZARD_ICONS[s.type] ?? ShieldAlert;
                  const site = SITE_RISK.find(x => x.facilityId === s.facilityId);
                  const acked = ackSignals.has(s.id);
                  return (
                    <button
                      key={s.id} type="button"
                      onClick={() => setSelectedFacilityId(s.facilityId)}
                      onDoubleClick={() => openDrawer('signal', { signal: s })}
                      className="eai-focusable"
                      style={{
                        display: 'flex', gap: 8, width: '100%', textAlign: 'left', padding: '7px 4px',
                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        borderBottomWidth: i < filteredSignals.slice(0, 20).length - 1 ? 1 : 0, borderBottomStyle: 'solid', borderBottomColor: '#E2E8F0',
                        background: selectedFacilityId === s.facilityId ? 'rgba(0,119,200,0.06)' : 'transparent', cursor: 'pointer', opacity: acked ? 0.55 : 1,
                      }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: SEVERITY_COLOR[s.severity] + '22', border: `1px solid ${SEVERITY_COLOR[s.severity]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Icon size={11} style={{ color: SEVERITY_COLOR[s.severity] }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                        <p style={{ fontSize: 9, color: '#6B7280', marginTop: 1 }}>{site?.name ?? s.facilityId} · {s.ago}</p>
                      </div>
                      {acked && <CheckCircle2 size={12} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />}
                    </button>
                  );
                })}
                {filteredSignals.length === 0 && <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>No signals match the current filters.</p>}
              </div>
            </div>

            {/* Regulatory Watch */}
            <div style={{ flexShrink: 0, maxHeight: 190, overflowY: 'auto' }}>
              <StatusListCard
                title="Regulatory Watch"
                items={REGULATORY_WATCH.map(r => ({ label: r.title, status: r.status, ...r }))}
                onItemClick={item => openDrawer('regulatory', { item })}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Donut | Trend/Forecast | Heatmap | Top At-Risk Table */}
        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.1fr 1fr 1.3fr', gap: 12, minHeight: 260 }}>

          {/* Risk by Category */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Risk by Category</span></div>
            <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto' }}>
              <DonutChart
                data={RISK_BY_CATEGORY}
                centerLabel={String(Math.round(RISK_BY_CATEGORY.reduce((s, x) => s + x.value, 0) / RISK_BY_CATEGORY.length))}
                centerSublabel="Avg Score"
                height={140} innerRadius={44} outerRadius={64}
                activeName={filters.hazardType.length === 1 ? filters.hazardType[0] : null}
                onSegmentClick={item => toggleSingleHazardFilter(item.name)}
              />
            </div>
          </div>

          {/* Risk Trend / Forecast */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Risk Trend &amp; Forecast</span></div>
            <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 9, color: '#9CA3AF' }}>Portfolio avg risk score — last {periodDef?.label ?? '90 days'}</p>
              <TrendChart type="line" data={trendData} color="#7C3AED" dataKey="value" xKey="week" domain={[0, 100]} height={70} />
              <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 4 }}>4-week forward projection</p>
              <ForecastChart
                data={RISK_FORECAST}
                capacityLimitMW={RISK_FORECAST_THRESHOLD}
                projectedExceedDate={RISK_FORECAST_EXCEED_WEEK ?? 'Not projected within 4 weeks'}
                height={120}
                yDomain={[0, 100]}
                thresholdLabel="High-Risk Threshold"
                annotationLabel="Projected to enter High band by"
                valueUnit=""
              />
            </div>
          </div>

          {/* Site × Hazard heatmap */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Site × Hazard</span></div>
            <div style={{ padding: '12px 14px', flex: 1, overflowY: 'auto' }}>
              <RiskHeatmapGrid rows={heatmapRows} colLabels={heatmapColLabels} getCellStyle={hazardCellStyle} likelihoodLabel="Facility" impactLabel="Hazard Type" footerLabel="" />
            </div>
          </div>

          {/* Top At-Risk Sites */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Top At-Risk Sites</span></div>
            <DataTable
              columns={SITE_COLUMNS}
              data={sortedTopSites}
              keyField="facilityId"
              selectedKey={selectedFacilityId}
              onRowClick={row => setSelectedFacilityId(row.facilityId)}
              onRowDoubleClick={row => openDrawer('site', { site: row })}
              sortState={siteSort}
              onSort={handleSiteSort}
              compact
              style={{ border: 'none', boxShadow: 'none', flex: 1 }}
            />
          </div>
        </div>

        {/* Row 4: Energy Intelligence */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <PlugZap size={13} color="#0077C8" />
          <h2 style={{ fontSize: 12, fontWeight: 800, color: '#1A1F36', margin: 0 }}>Energy Intelligence</h2>
          <span style={{ fontSize: 9, color: '#9CA3AF' }}>Grid, water &amp; regulatory exposure relevant to power strategy — demand side only, see note below</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr 1.1fr', gap: 12, minHeight: 220 }}>

          {/* Grid reliability risk by region */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Grid Reliability Risk</span></div>
            <div style={{ padding: '12px 14px', flex: 1 }}>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 10 }}>By region · 0 (stable) – 100 (unreliable)</p>
              <HorizontalBarList items={gridRiskByRegion} maxValue={100} labelWidth={92} />
            </div>
          </div>

          {/* Water stress by region */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Water Stress</span></div>
            <div style={{ padding: '12px 14px', flex: 1 }}>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 10 }}>By region · cooling-water availability risk</p>
              <HorizontalBarList items={waterStressByRegion} maxValue={100} labelWidth={92} />
            </div>
          </div>

          {/* Power supply composition */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Power Supply Composition</span></div>
            <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto' }}>
              {eaiRenewableByRegion.map(r => (
                <div key={r.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9.5, color: '#374151', fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>{r.value}% renewable / {100 - r.value}% grid</span>
                  </div>
                  <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#E2E8F0' }}>
                    <div style={{ width: `${r.value}%`, background: '#00A36C' }} />
                    <div style={{ width: `${100 - r.value}%`, background: '#94A3B8' }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px dashed #E2E8F0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Sun size={11} style={{ color: '#CBD5E1', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 9, color: '#9CA3AF', lineHeight: 1.5 }}>
                  Grid vs. renewable-PPA split shown. On-site / dedicated generation (gas, LNG-fired, or other behind-the-meter supply) isn't modeled yet — this is the layer a power-and-energy partner would fill in.
                </p>
              </div>
            </div>
          </div>

          {/* Energy-relevant regulatory watch */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <StatusListCard
              title="Energy & Grid Regulation"
              items={energyRegulatoryWatch.map(r => ({ label: r.title, status: r.status, ...r }))}
              onItemClick={item => openDrawer('regulatory', { item })}
            />
          </div>
        </div>

        {/* Bottom: Risk Intelligence AI chat */}
        <div style={{ minHeight: 380 }}>
          <AIChatPanel
            title="Risk Intelligence"
            systemContext={AI_SYSTEM_CONTEXT}
            context={AI_CONTEXT}
            suggestionChips={AI_CHIPS}
            defaultExpanded
            className="h-full"
          />
        </div>
      </div>

      {renderDrawer()}
      <ToastHost />
    </div>
  );
}

// ── Live risk panel inside the Site Risk Drawer (mirrors DatacenterDetailPanel's
//    live-fetch pattern: POST to /api/risk-signal on open, LIVE badge, graceful
//    fallback when no ANTHROPIC_API_KEY / no data). ─────────────────────────────
function SiteLiveRiskPanel({ site }) {
  const [liveData, setLiveData] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useState(() => {
    setLiveData(null); setSummary(''); setLoading(true);
    fetch('/api/risk-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: site.name, lat: site.lat, lon: site.lon,
        existingData: `${site.name} (${site.city}, ${site.country}) — composite risk score ${site.riskScore}/100 (${site.band}). Sub-scores: ${Object.entries(site.sub).map(([k, v]) => `${HAZARD_LABELS[k] ?? k} ${v}`).join(', ')}.`,
      }),
    })
      .then(r => r.json())
      .then(d => { setLiveData(d.liveData || null); setSummary(d.summary || ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return undefined;
  });

  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Radio size={12} color="#0077C8" />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Risk Intelligence</span>
        </div>
        {!loading && liveData && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, fontWeight: 700, color: '#00A36C', background: 'rgba(0,163,108,0.12)', border: '1px solid rgba(0,163,108,0.3)', borderRadius: 20, padding: '2px 6px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00A36C', display: 'inline-block' }} /> LIVE
          </span>
        )}
      </div>
      <div style={{ padding: 12 }}>
        {loading && <p style={{ fontSize: 10, color: '#9CA3AF' }}>Fetching live risk intelligence…</p>}
        {!loading && summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} style={{ fontSize: 10, color: '#1A1F36', lineHeight: 1.55 }}>{line.replace(/#{1,3}\s*/g, '').replace(/\*\*/g, '')}</p>
            ))}
          </div>
        )}
        {!loading && !summary && <p style={{ fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' }}>No live intelligence available.</p>}
        {!loading && liveData?.seismic?.recentQuakes?.length > 0 && (
          <p style={{ fontSize: 9, color: '#6B7280', marginTop: 8 }}>
            {liveData.seismic.recentQuakes.length} recent M4.5+ quake(s) within 500km (USGS).
          </p>
        )}
      </div>
    </div>
  );
}

export default function RiskSignalsPage() {
  return (
    <Suspense fallback={
      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', color: '#9CA3AF', fontSize: 12 }}>
        Loading…
      </div>
    }>
      <RiskSignalsInner />
    </Suspense>
  );
}
