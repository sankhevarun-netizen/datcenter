'use client';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, BarChart2, Briefcase, Zap, CheckCircle2, TrendingUp,
  Filter, Download, ChevronDown, ChevronUp, Leaf, Users, Shield,
  MapPin, Layers, Wallet, Gauge, Plus, Bell, AlertTriangle,
  FileSpreadsheet, FileText, FileDown, Snowflake,
} from 'lucide-react';

import DonutChart          from '@/components/eai/widgets/DonutChart';
import HorizontalBarList   from '@/components/eai/widgets/HorizontalBarList';
import BudgetVsActualTable from '@/components/eai/widgets/BudgetVsActualTable';
import StatusListCard      from '@/components/eai/widgets/StatusListCard';
import ScoreRing           from '@/components/eai/widgets/ScoreRing';
import QuickActionsMenu    from '@/components/eai/widgets/QuickActionsMenu';
import DetailDrawer, { DrawerTable, DrawerStatRow, DrawerPill } from '@/components/eai/widgets/DetailDrawer';
import FilterPopover       from '@/components/eai/widgets/FilterPopover';
import DateRangePopover    from '@/components/eai/widgets/DateRangePopover';
import { useToast }        from '@/components/eai/widgets/Toast';

import {
  FINOPS_KPIS, COST_TREND, COST_BY_CATEGORY, COST_BY_LOCATION,
  TOP_COST_DRIVERS, BUDGET_VS_ACTUAL, UNIT_ECONOMICS, FINOPS_INSIGHTS, ALERTS,
  ESG_SCORECARD, CARBON_TREND, ENERGY_WATER, RENEWABLE_ENERGY,
  EMISSIONS_BY_SCOPE, EMISSIONS_BY_LOCATION, ESG_INITIATIVES,
  COMPLIANCE_REPORTING, ESG_INSIGHTS,
} from '@/data/eaiFinOpsEsgMock';
import { COOLING_PROFILES } from '@/data/gpuChipProfiles';

// Real-world adoption mix across the 115-facility public repository
// (public/data/datacenter_repository.json), each facility's free-text
// cooling_type classified into these four tiers by keyword match
// (immersion / direct-to-chip liquid / rear-door heat exchanger / air) —
// computed once offline, not fetched at render time.
const COOLING_ADOPTION = [
  { name: 'Air / Chilled Water', value: 105, pct: 91.3, color: '#94A3B8' },
  { name: 'Direct-to-Chip Liquid', value: 8, pct: 7.0,  color: '#0077C8' },
  { name: 'Immersion',           value: 2, pct: 1.7,   color: '#10B981' },
];

// ─── shared card styles ──────────────────────────────────────────────────────
const CARD = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 14, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
};
const CARD_HDR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
};
const CARD_TITLE = { fontSize: 11, fontWeight: 700, color: '#1A1F36' };
const LABEL_STYLE = { fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' };
const INPUT_STYLE = { fontSize: 11, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, color: '#1A1F36', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

const ESG_STATUS_COLOR = {
  'On Track': '#00A36C', 'Completed': '#0077C8', 'In Progress': '#F59E0B',
  'Submitted': '#7C3AED', 'Certified': '#06B6D4', 'At Risk': '#EF4444',
};

// ─── date-range helpers ──────────────────────────────────────────────────────
const MONTH_IDX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseMonthLabel(label) {
  const [mon, yr] = label.split(' ');
  return new Date(2000 + parseInt(yr.replace("'", ''), 10), MONTH_IDX[mon], 1);
}
const TREND_MONTHS = COST_TREND.map(d => d.month);
const ANCHOR_DATE = parseMonthLabel(TREND_MONTHS[TREND_MONTHS.length - 1]);

const DATE_PRESETS = [
  { key: 'this-month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'qtd',        label: 'QTD' },
  { key: 'ytd',         label: 'YTD' },
  { key: 'last-12',     label: 'Last 12 Months' },
  { key: 'custom',      label: 'Custom' },
];

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function rangeWindow(range) {
  const { presetKey, from, to } = range;
  switch (presetKey) {
    case 'this-month': return { start: ANCHOR_DATE, end: ANCHOR_DATE };
    case 'last-month': { const d = addMonths(ANCHOR_DATE, -1); return { start: d, end: d }; }
    case 'qtd':         return { start: addMonths(ANCHOR_DATE, -2), end: ANCHOR_DATE };
    case 'ytd':          return { start: new Date(ANCHOR_DATE.getFullYear(), 0, 1), end: ANCHOR_DATE };
    case 'custom':
      if (!from || !to) return { start: addMonths(ANCHOR_DATE, -11), end: ANCHOR_DATE };
      return { start: new Date(from), end: new Date(to) };
    case 'last-12':
    default:
      return { start: addMonths(ANCHOR_DATE, -11), end: ANCHOR_DATE };
  }
}

function monthInRange(monthLabel, range) {
  const { start, end } = rangeWindow(range);
  const d = parseMonthLabel(monthLabel);
  const startM = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
  const endM = new Date(end.getFullYear(), end.getMonth(), 1).getTime();
  return d.getTime() >= startM && d.getTime() <= endM;
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function rangeLabel(range) {
  const { presetKey, from, to } = range;
  const { start, end } = rangeWindow(range);
  switch (presetKey) {
    case 'this-month': return `This Month (${formatMonthYear(ANCHOR_DATE)})`;
    case 'last-month': return `Last Month (${formatMonthYear(start)})`;
    case 'qtd':         return `QTD (${formatMonthYear(start)} – ${formatMonthYear(end)})`;
    case 'ytd':          return `YTD (${formatMonthYear(start)} – ${formatMonthYear(end)})`;
    case 'custom':
      if (!from || !to) return 'Custom Range';
      return `${new Date(from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    case 'last-12':
    default:
      return 'Last 12 Months';
  }
}

function filterByField(list, selected, key) {
  if (!selected.length) return list;
  return list.filter(item => selected.includes(item[key]));
}

function driverTrendSeries(row) {
  const steps = 6;
  const frac = row.trendPct / 100;
  const startVal = row.impactM / (1 + frac);
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return +(startVal + (row.impactM - startVal) * t).toFixed(3);
  });
}

const SYNTH_OWNERS = ['Sustainability Team', 'Facilities Operations', 'Compliance & Legal', 'Site Engineering', 'ESG Program Office'];
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function synthOwner(label) { return SYNTH_OWNERS[hashStr(label) % SYNTH_OWNERS.length]; }
const STATUS_DUE_OFFSET_DAYS = { 'On Track': 60, 'In Progress': 30, 'Completed': -10, 'Submitted': -5, 'Certified': -20, 'At Risk': 14 };
function synthDueDate(status) {
  const days = STATUS_DUE_OFFSET_DAYS[status] ?? 30;
  const d = new Date(ANCHOR_DATE);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── export helpers ──────────────────────────────────────────────────────────
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
  const pxToMm = 0.264583 / 2; // undo scale:2 so the PDF matches on-screen size
  const w = canvas.width * pxToMm;
  const h = canvas.height * pxToMm;
  const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] });
  doc.addImage(imgData, 'PNG', 0, 0, w, h);
  doc.save(filename);
}

function parseListParam(param) { return param ? param.split(',').filter(Boolean) : []; }

// ─── local presentational helpers ────────────────────────────────────────────
function MiniSparkline({ values = [], color = '#0077C8', height = 30 }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length - 1;
  const pts = values.map((v, i) => [
    (i / n) * 100,
    ((1 - (v - min) / range) * height).toFixed(1),
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightsCard({ title, items = [], footerLink, onFooterClick }) {
  return (
    <div style={{ ...CARD, flex: 1 }}>
      <div style={CARD_HDR}><span style={CARD_TITLE}>{title}</span></div>
      <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: item.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
            </div>
            <p style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.55 }}>{item.text}</p>
          </div>
        ))}
        {footerLink && (
          <button
            onClick={onFooterClick}
            className="eai-focusable"
            style={{ fontSize: 10, color: '#0077C8', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, textAlign: 'left' }}
          >
            {footerLink} →
          </button>
        )}
      </div>
    </div>
  );
}

function AlertsCard({ title, items = [], onViewAll }) {
  return (
    <div style={{ ...CARD, flex: 1 }}>
      <div style={CARD_HDR}>
        <span style={CARD_TITLE}>{title}</span>
        <button
          onClick={onViewAll}
          className="eai-focusable"
          style={{ fontSize: 9, color: '#6B7280', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#1A1F36'}
          onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
        >View All</button>
      </div>
      <div style={{ padding: '8px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block', marginTop: 3 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, color: '#1A1F36', lineHeight: 1.4 }}>{item.title}</p>
              <p style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>{item.ago}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinKpiCard({ label, value, sublabel, deltaText, deltaGood, Icon, iconColor, iconBg, valueColor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="eai-focusable"
      style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        cursor: 'pointer', textAlign: 'left', font: 'inherit', width: '100%', boxSizing: 'border-box',
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,24,40,0.10)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(16, 24, 40, 0.04)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.3 }}>{label}</span>
      </div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: valueColor ?? '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>{value}</p>
        {sublabel && <p style={{ fontSize: 9, color: '#00A36C', marginTop: 3, fontWeight: 600 }}>{sublabel}</p>}
      </div>
      {deltaText && (
        <span style={{ fontSize: 9, color: deltaGood ? '#00A36C' : '#EF4444', fontWeight: 600 }}>{deltaText}</span>
      )}
    </button>
  );
}

// Clickable donut legend row (used for Cost by Category / Emissions by Scope)
function DonutLegendRow({ item, unitPrefix = '', unitSuffix = '', isActive, isDimmed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="eai-focusable"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10,
        cursor: 'pointer', padding: '2px 4px', margin: '-2px -4px', borderRadius: 5, width: 'calc(100% + 8px)',
        border: 'none', font: 'inherit', textAlign: 'left',
        background: isActive ? '#F4F6F9' : 'transparent',
        opacity: isDimmed ? 0.5 : 1,
        transition: 'background 0.12s, opacity 0.12s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F8FAFC'; }}
      onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#F4F6F9' : 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ color: '#6B7280' }}>{item.name}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ fontWeight: 700, color: '#1A1F36', fontFamily: 'monospace' }}>{unitPrefix}{item.value.toLocaleString()}{unitSuffix}</span>
        <span style={{ color: '#9CA3AF', fontSize: 9 }}>({item.pct}%)</span>
      </div>
    </button>
  );
}

// ─── drawer-body form widgets ────────────────────────────────────────────────
function NewCostReportForm({ onClose, showToast, categories }) {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('this-month');
  const [selectedCats, setSelectedCats] = useState([]);
  const [notes, setNotes] = useState('');

  function toggleCat(c) {
    setSelectedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function submit() {
    if (!name.trim()) return;
    showToast(`"${name}" report queued for generation`, 'success');
    onClose();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={LABEL_STYLE}>Report Name</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. May APAC Cost Summary" style={INPUT_STYLE} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={LABEL_STYLE}>Period</span>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={INPUT_STYLE}>
          {DATE_PRESETS.filter(p => p.key !== 'custom').map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      <div>
        <span style={LABEL_STYLE}>Categories</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {categories.map(c => {
            const on = selectedCats.includes(c);
            return (
              <button key={c} type="button" onClick={() => toggleCat(c)} className="eai-focusable" style={{
                padding: '4px 9px', borderRadius: 20, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                border: on ? '1px solid #0077C8' : '1px solid #E2E8F0',
                background: on ? 'rgba(0,119,200,0.10)' : '#F8FAFC',
                color: on ? '#0077C8' : '#6B7280',
              }}>{c}</button>
            );
          })}
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={LABEL_STYLE}>Notes (optional)</span>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...INPUT_STYLE, resize: 'vertical' }} />
      </label>
      <button
        type="button" onClick={submit} disabled={!name.trim()} className="eai-focusable"
        style={{
          padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700,
          cursor: name.trim() ? 'pointer' : 'default',
          background: name.trim() ? '#0077C8' : '#E2E8F0', color: name.trim() ? '#fff' : '#9CA3AF',
        }}
      >Generate Report</button>
    </div>
  );
}

function BudgetAlertForm({ onClose, showToast, categories }) {
  const [category, setCategory] = useState(categories[0] ?? '');
  const [threshold, setThreshold] = useState('');

  function submit() {
    if (!threshold) return;
    showToast(`Budget alert set for ${category} at $${threshold}M`, 'success');
    onClose();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={LABEL_STYLE}>Category</span>
        <select value={category} onChange={e => setCategory(e.target.value)} style={INPUT_STYLE}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={LABEL_STYLE}>Threshold ($M)</span>
        <input type="number" min="0" step="0.01" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="e.g. 3.50" style={INPUT_STYLE} />
      </label>
      <button
        type="button" onClick={submit} disabled={!threshold} className="eai-focusable"
        style={{
          padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700,
          cursor: threshold ? 'pointer' : 'default',
          background: threshold ? '#0077C8' : '#E2E8F0', color: threshold ? '#fff' : '#9CA3AF',
        }}
      >Save Alert</button>
    </div>
  );
}

// ─── page (inner — uses useSearchParams, must be wrapped in Suspense) ────────
function FinOpsEsgPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast, ToastHost } = useToast();
  const panelRef = useRef(null);

  const [activeTab, setActiveTab] = useState(() => (searchParams.get('tab') === 'esg' ? 'esg' : 'finops'));
  const [filters, setFilters] = useState(() => ({
    categories: parseListParam(searchParams.get('cat')),
    locations:  parseListParam(searchParams.get('loc')),
    scopes:     parseListParam(searchParams.get('scope')),
  }));
  const [range, setRange] = useState(() => ({
    presetKey: searchParams.get('range') || 'last-12',
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  }));
  const [carbonPeriod, setCarbonPeriod] = useState('6M');
  const [drawer, setDrawer] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [driverSort, setDriverSort] = useState({ key: 'impactM', dir: 'desc' });

  const updateURL = useCallback((patch, { push = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) params.delete(k);
      else params.set(k, Array.isArray(v) ? v.join(',') : v);
    });
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }, [pathname, router, searchParams]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    updateURL({ tab: tab === 'finops' ? undefined : tab }, { push: true });
  }

  function toggleFilter(groupKey, value) {
    setFilters(prev => {
      const cur = prev[groupKey];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      const updated = { ...prev, [groupKey]: next };
      updateURL({ cat: updated.categories, loc: updated.locations, scope: updated.scopes });
      return updated;
    });
  }

  function toggleSingleFilter(groupKey, value) {
    setFilters(prev => {
      const cur = prev[groupKey];
      const next = (cur.length === 1 && cur[0] === value) ? [] : [value];
      const updated = { ...prev, [groupKey]: next };
      updateURL({ cat: updated.categories, loc: updated.locations, scope: updated.scopes });
      return updated;
    });
  }

  function clearFilters() {
    setFilters({ categories: [], locations: [], scopes: [] });
    updateURL({ cat: undefined, loc: undefined, scope: undefined });
    showToast('Filters cleared', 'info');
  }

  function openDrawer(kind, payload) { setDrawer({ kind, payload }); }
  function closeDrawer() { setDrawer(null); }

  function handleSort(key) {
    setDriverSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  }

  async function handleExport(kind) {
    setExportOpen(false);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      if (kind === 'pdf') {
        if (!panelRef.current) return;
        await exportPanelPdf(panelRef.current, `eai-${activeTab}-${dateStr}.pdf`);
        showToast('PDF exported successfully', 'success');
        return;
      }
      const sheets = activeTab === 'finops'
        ? [
            { name: 'Top Cost Drivers', rows: filteredDrivers.map(r => ({ Driver: r.driver, Category: r.category, 'Impact ($M)': r.impactM, 'Trend %': r.trendPct })) },
            { name: 'Budget vs Actual', rows: filteredBudget.map(r => ({ Category: r.category, 'Budget ($M)': r.budgetM, 'Actual ($M)': r.actualM, 'Variance %': r.variancePct })) },
            { name: 'Cost by Location', rows: (filters.locations.length ? COST_BY_LOCATION.filter(l => filters.locations.includes(l.label)) : COST_BY_LOCATION).map(l => ({ Location: l.label, 'Cost ($M)': l.value })) },
          ]
        : [
            { name: 'Emissions by Location', rows: (filters.locations.length ? EMISSIONS_BY_LOCATION.filter(l => filters.locations.includes(l.label)) : EMISSIONS_BY_LOCATION).map(l => ({ Location: l.label, 'Emissions (tCO2e)': l.value })) },
            { name: 'ESG Initiatives', rows: ESG_INITIATIVES.map(i => ({ Initiative: i.label, Status: i.status })) },
            { name: 'Compliance & Reporting', rows: COMPLIANCE_REPORTING.map(i => ({ Item: i.label, Status: i.status })) },
          ];

      if (kind === 'xlsx') {
        await exportWorkbook(sheets, `eai-${activeTab}-export-${dateStr}.xlsx`);
      } else {
        await exportCsv(sheets[0].rows, `eai-${activeTab}-export-${dateStr}.csv`);
      }
      showToast(`${kind.toUpperCase()} exported successfully`, 'success');
    } catch {
      showToast('Export failed — please try again', 'error');
    }
  }

  // ─── derived / filtered data ────────────────────────────────────────────
  const FILTER_GROUPS = useMemo(() => [
    { key: 'locations', label: 'Location', options: Array.from(new Set([...COST_BY_LOCATION.map(l => l.label), ...EMISSIONS_BY_LOCATION.map(l => l.label)])) },
    { key: 'categories', label: 'Cost Category', options: COST_BY_CATEGORY.map(c => c.name) },
    { key: 'scopes', label: 'Emissions Scope', options: EMISSIONS_BY_SCOPE.map(s => s.name) },
  ], []);
  const activeFilterCount = filters.categories.length + filters.locations.length + filters.scopes.length;

  const filteredDrivers = useMemo(() => {
    const rows = filterByField(TOP_COST_DRIVERS, filters.categories, 'category');
    return [...rows].sort((a, b) => {
      const dir = driverSort.dir === 'asc' ? 1 : -1;
      const av = a[driverSort.key], bv = b[driverSort.key];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [filters.categories, driverSort]);

  const filteredBudget = useMemo(() => filterByField(BUDGET_VS_ACTUAL, filters.categories, 'category'), [filters.categories]);

  const totalCostDisplay = useMemo(() => {
    if (filters.categories.length) return COST_BY_CATEGORY.filter(c => filters.categories.includes(c.name)).reduce((s, c) => s + c.value, 0);
    if (filters.locations.length) return COST_BY_LOCATION.filter(l => filters.locations.includes(l.label)).reduce((s, l) => s + l.value, 0);
    return FINOPS_KPIS.totalCostM;
  }, [filters.categories, filters.locations]);

  const emissionsTotalDisplay = useMemo(() => {
    if (filters.scopes.length) return EMISSIONS_BY_SCOPE.filter(s => filters.scopes.includes(s.name)).reduce((s2, s) => s2 + s.value, 0);
    if (filters.locations.length) return EMISSIONS_BY_LOCATION.filter(l => filters.locations.includes(l.label)).reduce((s, l) => s + l.value, 0);
    return EMISSIONS_BY_SCOPE.reduce((s, x) => s + x.value, 0);
  }, [filters.scopes, filters.locations]);

  const filteredCostTrend = useMemo(() => COST_TREND.filter(d => monthInRange(d.month, range)), [range]);
  const trendHeaderLabel = filteredCostTrend.length
    ? `Cost Trend (${filteredCostTrend[0].month} – ${filteredCostTrend[filteredCostTrend.length - 1].month})`
    : 'Cost Trend (no data in range)';

  const visibleMonthIndices = useMemo(() => TREND_MONTHS.map((m, i) => (monthInRange(m, range) ? i : null)).filter(i => i !== null), [range]);
  const filteredEnergyTrend = useMemo(() => visibleMonthIndices.map(i => ENERGY_WATER.consumptionTrend[i]), [visibleMonthIndices]);
  const filteredWaterTrend = useMemo(() => visibleMonthIndices.map(i => ENERGY_WATER.waterTrend[i]), [visibleMonthIndices]);

  const carbonSeries = useMemo(() => {
    const sliceLen = carbonPeriod === '6M' ? 6 : 12;
    return CARBON_TREND.slice(-sliceLen).filter(d => monthInRange(d.month, range));
  }, [carbonPeriod, range]);
  const latestCarbon = carbonSeries.length ? carbonSeries[carbonSeries.length - 1] : CARBON_TREND[CARBON_TREND.length - 1];

  // ─── FinOps tab ──────────────────────────────────────────────────────────
  function FinOpsPanel() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 6 KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          <FinKpiCard
            label="Total Cost (May)" value={`$${totalCostDisplay.toFixed(2)}M`}
            deltaText={`↓${Math.abs(FINOPS_KPIS.totalCostDelta.pct)}% ${FINOPS_KPIS.totalCostDelta.label}`}
            deltaGood={true}
            Icon={DollarSign} iconColor="#0077C8" iconBg="rgba(0,119,200,0.15)"
            onClick={() => openDrawer('kpi', { key: 'total-cost' })}
          />
          <FinKpiCard
            label="CapEx (YTD)" value={`$${FINOPS_KPIS.capexYtdM.toFixed(2)}M`}
            deltaText={`↑${Math.abs(FINOPS_KPIS.capexDelta.pct)}% ${FINOPS_KPIS.capexDelta.label}`}
            deltaGood={false}
            Icon={BarChart2} iconColor="#7C3AED" iconBg="rgba(124,58,237,0.15)"
            onClick={() => openDrawer('kpi', { key: 'capex' })}
          />
          <FinKpiCard
            label="OpEx (Monthly)" value={`$${FINOPS_KPIS.opexMonthlyM.toFixed(2)}M`}
            deltaText={`↓${Math.abs(FINOPS_KPIS.opexDelta.pct)}% ${FINOPS_KPIS.opexDelta.label}`}
            deltaGood={true}
            Icon={Briefcase} iconColor="#0077C8" iconBg="rgba(0,119,200,0.15)"
            onClick={() => openDrawer('kpi', { key: 'opex' })}
          />
          <FinKpiCard
            label="Cost / kW (Monthly)" value={`$${FINOPS_KPIS.costPerKw.toFixed(2)}`}
            deltaText={`↓${Math.abs(FINOPS_KPIS.costPerKwDelta.pct)}% ${FINOPS_KPIS.costPerKwDelta.label}`}
            deltaGood={true}
            Icon={Zap} iconColor="#F59E0B" iconBg="rgba(245,158,11,0.15)"
            onClick={() => openDrawer('kpi', { key: 'cost-per-kw' })}
          />
          <FinKpiCard
            label="Budget Variance" value={`${FINOPS_KPIS.budgetVariancePct}%`}
            sublabel={FINOPS_KPIS.budgetStatus}
            Icon={CheckCircle2} iconColor="#00A36C" iconBg="rgba(0,163,108,0.15)"
            valueColor="#00A36C"
            onClick={() => openDrawer('kpi', { key: 'budget-variance' })}
          />
          <FinKpiCard
            label="Forecast (FY2025)" value={`$${FINOPS_KPIS.forecastFY2025M.toFixed(1)}M`}
            deltaText={`↑${Math.abs(FINOPS_KPIS.forecastDelta.pct)}% ${FINOPS_KPIS.forecastDelta.label}`}
            deltaGood={false}
            Icon={TrendingUp} iconColor="#0077C8" iconBg="rgba(0,119,200,0.15)"
            onClick={() => openDrawer('kpi', { key: 'forecast' })}
          />
        </div>

        {/* Row 1: Cost Trend | Cost by Category | Cost by Location | Insights */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.1fr 1fr 0.9fr', gap: 12, minHeight: 280 }}>

          {/* Cost Trend */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>{trendHeaderLabel}</span></div>
            <div style={{ padding: '12px 10px 8px', flex: 1 }}>
              <div style={{ width: '100%', overflow: 'hidden', height: 210 }}>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={filteredCostTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 8, fill: '#6B7280' }} axisLine={false} tickLine={false} width={38} domain={[0, 16]} />
                    <Tooltip
                      contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 10, color: '#1A1F36', boxShadow: '0 2px 8px rgba(16,24,40,0.08)' }}
                      formatter={(v, n) => [`$${v}M`, n]}
                      labelStyle={{ color: '#6B7280' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, color: '#6B7280' }} iconSize={8} />
                    <Line type="monotone" dataKey="totalCost" name="Total Cost" stroke="#0077C8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="capex"     name="CapEx"      stroke="#7C3AED" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="opex"      name="OpEx"       stroke="#10B981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Cost by Category */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Cost by Category (May)</span></div>
            <div style={{ padding: '8px 14px 12px', flex: 1, overflowY: 'auto' }}>
              <DonutChart
                data={COST_BY_CATEGORY}
                centerLabel={`$${totalCostDisplay.toFixed(2)}M`}
                centerSublabel={filters.categories.length === 1 ? filters.categories[0] : 'Total'}
                height={140}
                innerRadius={46}
                outerRadius={68}
                showLegend={false}
                activeName={filters.categories.length === 1 ? filters.categories[0] : undefined}
                onSegmentClick={item => toggleSingleFilter('categories', item.name)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {COST_BY_CATEGORY.map(item => (
                  <DonutLegendRow
                    key={item.name}
                    item={item}
                    unitPrefix="$" unitSuffix="M"
                    isActive={filters.categories.length === 1 && filters.categories[0] === item.name}
                    isDimmed={filters.categories.length === 1 && filters.categories[0] !== item.name}
                    onClick={() => toggleSingleFilter('categories', item.name)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Cost by Location */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Cost by Location</span></div>
            <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto' }}>
              <HorizontalBarList
                items={COST_BY_LOCATION}
                maxValue={COST_BY_LOCATION[0].value}
                prefix="$"
                unit="M"
                labelWidth={86}
                activeLabel={filters.locations.length === 1 ? filters.locations[0] : undefined}
                onItemClick={item => { toggleSingleFilter('locations', item.label); openDrawer('location-cost', item); }}
              />
            </div>
          </div>

          {/* FinOps Insights */}
          <InsightsCard title="FinOps Insights" items={FINOPS_INSIGHTS} footerLink="View All Insights" onFooterClick={() => openDrawer('finops-insights-all')} />
        </div>

        {/* Row 2: Top Cost Drivers | Budget vs Actual | Unit Economics | Alerts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.75fr 0.75fr', gap: 12, minHeight: 240 }}>

          {/* Top Cost Drivers */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Top Cost Drivers</span></div>
            <div style={{ padding: '0 14px 12px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 56px 48px', padding: '6px 0 4px', borderBottom: '1px solid #E2E8F0' }}>
                {[
                  { key: 'driver', label: 'Driver' },
                  { key: 'category', label: 'Category' },
                  { key: 'impactM', label: 'Impact' },
                  { key: 'trendPct', label: 'Trend' },
                ].map(col => {
                  const active = driverSort.key === col.key;
                  return (
                    <button
                      key={col.key} type="button" onClick={() => handleSort(col.key)}
                      aria-label={`Sort by ${col.label}`} className="eai-focusable"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent',
                        cursor: 'pointer', padding: 0, fontSize: 8, fontWeight: 700,
                        color: active ? '#0077C8' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em',
                      }}
                    >
                      {col.label}
                      {active ? (driverSort.dir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />) : null}
                    </button>
                  );
                })}
              </div>
              {filteredDrivers.map((row, i) => (
                <button
                  key={row.driver} type="button" onClick={() => openDrawer('driver', row)}
                  className="eai-focusable"
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 90px 56px 48px', padding: '7px 0',
                    borderBottom: i < filteredDrivers.length - 1 ? '1px solid #E2E8F0' : 'none',
                    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    alignItems: 'center', width: '100%', background: 'transparent', font: 'inherit',
                    textAlign: 'left', cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 10, color: '#1A1F36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>{row.driver}</span>
                  <span style={{ fontSize: 9, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4 }}>{row.category}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', fontFamily: 'ui-monospace,monospace' }}>${row.impactM.toFixed(2)}M</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: row.up ? '#EF4444' : '#00A36C' }}>
                    {row.up ? '↑' : '↓'}{Math.abs(row.trendPct)}%
                  </span>
                </button>
              ))}
              {filteredDrivers.length === 0 && (
                <p style={{ fontSize: 10, color: '#9CA3AF', padding: '12px 0', textAlign: 'center' }}>No drivers match the current filters.</p>
              )}
            </div>
          </div>

          {/* Budget vs Actual */}
          <BudgetVsActualTable title="Budget vs Actual (May)" items={filteredBudget} onRowClick={row => openDrawer('budget', row)} />

          {/* Unit Economics */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Unit Economics</span></div>
            <div style={{ padding: '8px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              {UNIT_ECONOMICS.map((row, i) => (
                <button
                  key={row.metric} type="button" onClick={() => openDrawer('unit-econ', row)}
                  className="eai-focusable"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0',
                    borderBottom: i < UNIT_ECONOMICS.length - 1 ? '1px solid #E2E8F0' : 'none',
                    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    width: '100%', background: 'transparent', font: 'inherit', textAlign: 'left',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 10, color: '#6B7280', flex: 1, paddingRight: 8 }}>{row.metric}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1F36', fontFamily: 'ui-monospace,monospace' }}>{row.value}</span>
                    <span style={{ fontSize: 9, color: '#00A36C', fontWeight: 600, width: 36, textAlign: 'right' }}>
                      ↓{Math.abs(row.deltaPct)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <AlertsCard title="Alerts" items={ALERTS} onViewAll={() => openDrawer('alerts-all')} />
        </div>
      </div>
    );
  }

  // ─── ESG tab ─────────────────────────────────────────────────────────────
  function EsgPanel() {
    const esgSubScores = [
      { label: 'Environmental', score: ESG_SCORECARD.environmental, color: '#10B981', Icon: Leaf   },
      { label: 'Social',        score: ESG_SCORECARD.social,        color: '#0077C8', Icon: Users  },
      { label: 'Governance',    score: ESG_SCORECARD.governance,    color: '#7C3AED', Icon: Shield },
    ];

    const renewableLegend = [
      { label: 'Renewable',     value: `${RENEWABLE_ENERGY.renewablePct}%`,    color: '#00A36C' },
      { label: 'Non-Renewable', value: `${RENEWABLE_ENERGY.nonRenewablePct}%`, color: '#6B7280' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: ESG Scorecard | Carbon Emissions | Energy & Water | Renewable Energy */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

          {/* ESG Scorecard */}
          <div style={{ ...CARD, alignItems: 'center', padding: '16px 14px', gap: 0 }}>
            <p style={{ ...CARD_TITLE, marginBottom: 14, alignSelf: 'flex-start' }}>ESG Scorecard</p>
            <ScoreRing
              score={ESG_SCORECARD.overall}
              unit="/100"
              color="#10B981"
              sublabel={ESG_SCORECARD.delta}
              size={130}
              items={esgSubScores}
              onItemClick={item => openDrawer('esg-pillar', item)}
            />
          </div>

          {/* Carbon Emissions */}
          <div style={CARD}>
            <div style={CARD_HDR}>
              <span style={CARD_TITLE}>Carbon Emissions</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['6M', '12M'].map(p => (
                  <button
                    key={p} type="button" onClick={() => setCarbonPeriod(p)} className="eai-focusable"
                    aria-label={`Show last ${p}`}
                    style={{
                      padding: '2px 8px', borderRadius: 6, border: '1px solid #E2E8F0', cursor: 'pointer',
                      background: carbonPeriod === p ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: carbonPeriod === p ? '#10B981' : '#9CA3AF', fontSize: 9, fontWeight: 700,
                    }}
                  >{p}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                  {latestCarbon.tCO2e.toLocaleString()}
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', marginLeft: 5 }}>tCO2e</span>
                </p>
                <p style={{ fontSize: 10, color: '#00A36C', fontWeight: 600, marginTop: 4 }}>↓6.2% vs Apr '25</p>
              </div>
              <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={carbonSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 7, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 10, color: '#1A1F36', boxShadow: '0 2px 8px rgba(16,24,40,0.08)' }}
                      formatter={v => [`${v.toLocaleString()} tCO2e`]}
                      labelStyle={{ color: '#6B7280' }}
                    />
                    <Area type="monotone" dataKey="tCO2e" stroke="#10B981" strokeWidth={2} fill="url(#carbonGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Energy & Water */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Energy & Water</span></div>
            <div style={{ padding: '10px 14px', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Energy Consumption</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                  {ENERGY_WATER.consumptionGWh}
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#6B7280', marginLeft: 3 }}>GWh</span>
                </p>
                <p style={{ fontSize: 9, color: '#00A36C', fontWeight: 600 }}>↓{Math.abs(ENERGY_WATER.consumptionDelta)}% vs Apr '25</p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <MiniSparkline values={filteredEnergyTrend.length >= 2 ? filteredEnergyTrend : ENERGY_WATER.consumptionTrend} color="#F59E0B" height={36} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '1px solid #E2E8F0', paddingLeft: 10 }}>
                <p style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Water Usage</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                  {ENERGY_WATER.waterUsageKL}
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#6B7280', marginLeft: 3 }}>kL</span>
                </p>
                <p style={{ fontSize: 9, color: '#00A36C', fontWeight: 600 }}>↓{Math.abs(ENERGY_WATER.waterDelta)}% vs Apr '25</p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  <MiniSparkline values={filteredWaterTrend.length >= 2 ? filteredWaterTrend : ENERGY_WATER.waterTrend} color="#0077C8" height={36} />
                </div>
              </div>
            </div>
          </div>

          {/* Renewable Energy */}
          <div style={{ ...CARD, alignItems: 'center', padding: '16px 14px', gap: 0 }}>
            <p style={{ ...CARD_TITLE, marginBottom: 14, alignSelf: 'flex-start' }}>Renewable Energy</p>
            <ScoreRing
              score={RENEWABLE_ENERGY.renewablePct}
              unit="%"
              color="#00A36C"
              size={120}
              items={renewableLegend}
              legendStyle
            />
          </div>
        </div>

        {/* Row 2: Emissions by Scope | Emissions by Location | Initiatives | Compliance | ESG Insights */}
        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1fr 1.1fr 1.1fr 1fr', gap: 12, minHeight: 220 }}>

          {/* Emissions by Scope */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Emissions by Scope</span></div>
            <div style={{ padding: '8px 14px 12px', flex: 1, overflowY: 'auto' }}>
              <DonutChart
                data={EMISSIONS_BY_SCOPE}
                centerLabel={emissionsTotalDisplay.toLocaleString()}
                centerUnit="tCO2e"
                height={130}
                innerRadius={42}
                outerRadius={60}
                showLegend={false}
                activeName={filters.scopes.length === 1 ? filters.scopes[0] : undefined}
                onSegmentClick={item => toggleSingleFilter('scopes', item.name)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {EMISSIONS_BY_SCOPE.map(item => (
                  <DonutLegendRow
                    key={item.name}
                    item={item}
                    isActive={filters.scopes.length === 1 && filters.scopes[0] === item.name}
                    isDimmed={filters.scopes.length === 1 && filters.scopes[0] !== item.name}
                    onClick={() => toggleSingleFilter('scopes', item.name)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Emissions by Location */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Emissions by Location</span></div>
            <div style={{ padding: '10px 14px', flex: 1, overflowY: 'auto' }}>
              <HorizontalBarList
                items={EMISSIONS_BY_LOCATION}
                maxValue={EMISSIONS_BY_LOCATION[0].value}
                unit=" t"
                labelWidth={88}
                activeLabel={filters.locations.length === 1 ? filters.locations[0] : undefined}
                onItemClick={item => { toggleSingleFilter('locations', item.label); openDrawer('location-emissions', item); }}
              />
            </div>
          </div>

          {/* ESG Initiatives */}
          <StatusListCard title="ESG Initiatives" items={ESG_INITIATIVES} onItemClick={item => openDrawer('esg-initiative', item)} />

          {/* Compliance & Reporting */}
          <StatusListCard title="Compliance & Reporting" items={COMPLIANCE_REPORTING} onItemClick={item => openDrawer('compliance', item)} />

          {/* ESG Insights */}
          <InsightsCard title="ESG Insights" items={ESG_INSIGHTS} footerLink="View All ESG Insights" onFooterClick={() => openDrawer('esg-insights-all')} />
        </div>

        {/* Row 3: Cooling Intelligence */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <Snowflake size={13} color="#0077C8" />
          <h2 style={{ fontSize: 12, fontWeight: 800, color: '#1A1F36', margin: 0 }}>Cooling Intelligence</h2>
          <span style={{ fontSize: 9, color: '#9CA3AF' }}>Technology tradeoffs for AI-density racks, and how the market is actually cooling today</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr', gap: 12, minHeight: 220 }}>

          {/* Cooling technology tiers */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Cooling Technology Tiers</span></div>
            <div style={{ padding: '12px 14px', flex: 1 }}>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 10 }}>Max supportable rack density, by cooling approach</p>
              <HorizontalBarList
                items={COOLING_PROFILES.map(c => ({ label: c.label, value: c.max_rack_kw, color: c.facility_class === 'liquid_ready' ? '#0077C8' : '#94A3B8' }))}
                unit=" kW"
                labelWidth={140}
              />
              <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {COOLING_PROFILES.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6B7280' }}>
                    <span>{c.label}</span>
                    <span style={{ fontFamily: 'ui-monospace,monospace' }}>PUE +{c.pue_penalty.toFixed(2)} · WUE {c.wue_l_per_kwh} L/kWh · capex ×{c.capex_multiplier}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-world adoption */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Real-World Adoption</span></div>
            <div style={{ padding: '8px 14px 12px', flex: 1, overflowY: 'auto' }}>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 6 }}>115 global facilities, by cooling type on record</p>
              <DonutChart data={COOLING_ADOPTION} centerLabel="115" centerSublabel="Facilities" height={130} innerRadius={42} outerRadius={60} showLegend={false} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {COOLING_ADOPTION.map(item => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#374151' }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: '#1A1F36', fontFamily: 'ui-monospace,monospace' }}>{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Achievable PUE by tier vs. portfolio actual */}
          <div style={CARD}>
            <div style={CARD_HDR}><span style={CARD_TITLE}>Achievable PUE by Tier</span></div>
            <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 10 }}>Lower is better · baseline at full load, no chip-specific tuning</p>
              <HorizontalBarList
                items={[
                  { label: 'Portfolio Avg (today)', value: Number(UNIT_ECONOMICS.find(u => u.metric === 'PUE (Avg)')?.value ?? 1.31), color: '#F59E0B' },
                  ...COOLING_PROFILES.map(c => ({ label: c.label, value: Math.round((1 + c.pue_penalty) * 100) / 100, color: c.facility_class === 'liquid_ready' ? '#0077C8' : '#94A3B8' })),
                ]}
                maxValue={1.4}
                labelWidth={140}
              />
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px dashed #E2E8F0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Snowflake size={11} style={{ color: '#CBD5E1', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 9, color: '#9CA3AF', lineHeight: 1.5 }}>
                  The portfolio's actual PUE runs slightly behind even the air-cooled baseline — before any tier upgrade, this is where a cooling-technology partner's efficiency and fluids expertise would show up first.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── drawer content ──────────────────────────────────────────────────────
  function renderDrawer() {
    if (!drawer) return <DetailDrawer open={false} onClose={closeDrawer} />;
    const { kind, payload } = drawer;

    if (kind === 'kpi') {
      const map = {
        'total-cost': {
          title: 'Total Cost', subtitle: rangeLabel(range), icon: <DollarSign size={16} color="#0077C8" />, accent: '#0077C8',
          body: (
            <>
              <DrawerStatRow items={[
                { label: 'Total Cost', value: `$${totalCostDisplay.toFixed(2)}M` },
                { label: 'MoM Change', value: `${FINOPS_KPIS.totalCostDelta.pct}%`, color: FINOPS_KPIS.totalCostDelta.pct <= 0 ? '#00A36C' : '#EF4444' },
              ]} />
              <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>By Category</p>
              <DrawerTable columns={[
                { key: 'name', label: 'Category' },
                { key: 'value', label: 'Cost', align: 'right', render: r => `$${r.value}M` },
                { key: 'pct', label: 'Share', align: 'right', render: r => `${r.pct}%` },
              ]} rows={COST_BY_CATEGORY} keyField="name" />
              <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', margin: '16px 0 8px' }}>By Location</p>
              <DrawerTable columns={[
                { key: 'label', label: 'Location' },
                { key: 'value', label: 'Cost', align: 'right', render: r => `$${r.value}M` },
              ]} rows={COST_BY_LOCATION} keyField="label" />
            </>
          ),
        },
        'capex': {
          title: 'CapEx (YTD)', subtitle: FINOPS_KPIS.capexDelta.label, icon: <BarChart2 size={16} color="#7C3AED" />, accent: '#7C3AED',
          body: (
            <>
              <DrawerStatRow items={[
                { label: 'CapEx YTD', value: `$${FINOPS_KPIS.capexYtdM.toFixed(2)}M` },
                { label: 'vs YTD Apr', value: `+${FINOPS_KPIS.capexDelta.pct}%`, color: '#EF4444' },
              ]} />
              <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>Monthly CapEx Trend</p>
              <MiniSparkline values={COST_TREND.map(d => d.capex)} color="#7C3AED" height={50} />
            </>
          ),
        },
        'opex': {
          title: 'OpEx (Monthly)', subtitle: FINOPS_KPIS.opexDelta.label, icon: <Briefcase size={16} color="#0077C8" />, accent: '#0077C8',
          body: (
            <>
              <DrawerStatRow items={[
                { label: 'OpEx', value: `$${FINOPS_KPIS.opexMonthlyM.toFixed(2)}M` },
                { label: 'vs Apr', value: `${FINOPS_KPIS.opexDelta.pct}%`, color: '#00A36C' },
              ]} />
              <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>Monthly OpEx Trend</p>
              <MiniSparkline values={COST_TREND.map(d => d.opex)} color="#10B981" height={50} />
            </>
          ),
        },
        'cost-per-kw': {
          title: 'Cost / kW (Monthly)', subtitle: FINOPS_KPIS.costPerKwDelta.label, icon: <Zap size={16} color="#F59E0B" />, accent: '#F59E0B',
          body: (
            <DrawerStatRow items={[
              { label: 'Cost / kW', value: `$${FINOPS_KPIS.costPerKw.toFixed(2)}` },
              { label: 'vs Apr', value: `${FINOPS_KPIS.costPerKwDelta.pct}%`, color: '#00A36C' },
            ]} />
          ),
        },
        'budget-variance': {
          title: 'Budget Variance', subtitle: FINOPS_KPIS.budgetStatus, icon: <CheckCircle2 size={16} color="#00A36C" />, accent: '#00A36C',
          body: (
            <>
              <DrawerStatRow items={[
                { label: 'Variance', value: `${FINOPS_KPIS.budgetVariancePct}%`, color: '#00A36C' },
                { label: 'Status', value: FINOPS_KPIS.budgetStatus, color: '#00A36C' },
              ]} />
              <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>Budget vs Actual by Category</p>
              <DrawerTable columns={[
                { key: 'category', label: 'Category' },
                { key: 'variancePct', label: 'Variance', align: 'right', render: r => `${r.variancePct}%` },
              ]} rows={BUDGET_VS_ACTUAL} keyField="category" />
            </>
          ),
        },
        'forecast': {
          title: 'Forecast (FY2025)', subtitle: FINOPS_KPIS.forecastDelta.label, icon: <TrendingUp size={16} color="#0077C8" />, accent: '#0077C8',
          body: (
            <DrawerStatRow items={[
              { label: 'Forecast', value: `$${FINOPS_KPIS.forecastFY2025M.toFixed(1)}M` },
              { label: 'vs FY2024', value: `+${FINOPS_KPIS.forecastDelta.pct}%`, color: '#EF4444' },
            ]} />
          ),
        },
      };
      const cfg = map[payload.key];
      return (
        <DetailDrawer open title={cfg.title} subtitle={cfg.subtitle} icon={cfg.icon} accentColor={cfg.accent} onClose={closeDrawer}>
          {cfg.body}
        </DetailDrawer>
      );
    }

    if (kind === 'location-cost') {
      const item = payload;
      const totalLoc = COST_BY_LOCATION.reduce((s, l) => s + l.value, 0);
      return (
        <DetailDrawer open title={item.label} subtitle="Cost Detail" icon={<MapPin size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Monthly Cost', value: `$${item.value}M` },
            { label: 'Share of Total', value: `${((item.value / totalLoc) * 100).toFixed(1)}%` },
          ]} />
          <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>All Locations</p>
          <DrawerTable columns={[
            { key: 'label', label: 'Location' },
            { key: 'value', label: 'Cost', align: 'right', render: r => `$${r.value}M` },
          ]} rows={COST_BY_LOCATION} keyField="label" />
        </DetailDrawer>
      );
    }

    if (kind === 'location-emissions') {
      const item = payload;
      const totalLoc = EMISSIONS_BY_LOCATION.reduce((s, l) => s + l.value, 0);
      return (
        <DetailDrawer open title={item.label} subtitle="Emissions Detail" icon={<MapPin size={16} color="#10B981" />} accentColor="#10B981" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Emissions', value: `${item.value.toLocaleString()} t` },
            { label: 'Share of Total', value: `${((item.value / totalLoc) * 100).toFixed(1)}%` },
          ]} />
          <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>All Locations</p>
          <DrawerTable columns={[
            { key: 'label', label: 'Location' },
            { key: 'value', label: 'Emissions', align: 'right', render: r => `${r.value.toLocaleString()} t` },
          ]} rows={EMISSIONS_BY_LOCATION} keyField="label" />
        </DetailDrawer>
      );
    }

    if (kind === 'driver') {
      const row = payload;
      const color = row.up ? '#EF4444' : '#00A36C';
      return (
        <DetailDrawer open title={row.driver} subtitle={row.category} icon={<Layers size={16} color={color} />} accentColor={color} onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Impact', value: `$${row.impactM.toFixed(2)}M` },
            { label: 'Trend', value: `${row.up ? '↑' : '↓'}${Math.abs(row.trendPct)}%`, color },
          ]} />
          <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>6-Month Trend</p>
          <MiniSparkline values={driverTrendSeries(row)} color={color} height={50} />
        </DetailDrawer>
      );
    }

    if (kind === 'budget') {
      const row = payload;
      const isUnder = row.variancePct <= 0;
      const color = isUnder ? '#10B981' : '#EF4444';
      return (
        <DetailDrawer open title={row.category} subtitle="Budget vs Actual" icon={<Wallet size={16} color={color} />} accentColor={color} onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Budget', value: `$${row.budgetM.toFixed(2)}M` },
            { label: 'Actual', value: `$${row.actualM.toFixed(2)}M` },
            { label: 'Variance', value: `${row.variancePct > 0 ? '+' : ''}${row.variancePct.toFixed(1)}%`, color },
          ]} />
          <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
            {row.category} spent ${row.actualM.toFixed(2)}M against a ${row.budgetM.toFixed(2)}M budget — {Math.abs(row.variancePct).toFixed(1)}% {isUnder ? 'under' : 'over'} budget for the period.
          </p>
        </DetailDrawer>
      );
    }

    if (kind === 'unit-econ') {
      const row = payload;
      return (
        <DetailDrawer open title={row.metric} subtitle="Unit Economics" icon={<Gauge size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Current', value: row.value },
            { label: 'MoM Change', value: `${row.deltaPct}%`, color: '#00A36C' },
          ]} />
          <p style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
            {row.metric} improved {Math.abs(row.deltaPct)}% month-over-month, consistent with the cost efficiency gains called out in FinOps Insights.
          </p>
        </DetailDrawer>
      );
    }

    if (kind === 'alerts-all') {
      return (
        <DetailDrawer open title="All Alerts" subtitle={`${ALERTS.length} active alerts`} icon={<AlertTriangle size={16} color="#EF4444" />} accentColor="#EF4444" onClose={closeDrawer}>
          <DrawerTable columns={[
            { key: 'title', label: 'Alert' },
            { key: 'ago', label: 'Raised', align: 'right' },
          ]} rows={ALERTS} keyField="title" />
        </DetailDrawer>
      );
    }

    if (kind === 'finops-insights-all' || kind === 'esg-insights-all') {
      const items = kind === 'finops-insights-all' ? FINOPS_INSIGHTS : ESG_INSIGHTS;
      return (
        <DetailDrawer open title={kind === 'finops-insights-all' ? 'All FinOps Insights' : 'All ESG Insights'} subtitle={`${items.length} insights`} icon={<TrendingUp size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: 4 }} />
                <p style={{ fontSize: 11, color: '#1A1F36', lineHeight: 1.6 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </DetailDrawer>
      );
    }

    if (kind === 'esg-pillar') {
      const pillar = payload;
      const weight = ((pillar.score / (ESG_SCORECARD.environmental + ESG_SCORECARD.social + ESG_SCORECARD.governance)) * 100).toFixed(1);
      let extra = null;
      if (pillar.label === 'Environmental') {
        extra = (
          <>
            <DrawerStatRow items={[
              { label: 'Latest Emissions', value: `${CARBON_TREND[CARBON_TREND.length - 1].tCO2e.toLocaleString()} tCO2e` },
              { label: 'Renewable Energy', value: `${RENEWABLE_ENERGY.renewablePct}%` },
            ]} />
            <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>Emissions by Scope</p>
            <DrawerTable columns={[
              { key: 'name', label: 'Scope' },
              { key: 'value', label: 'tCO2e', align: 'right', render: r => r.value.toLocaleString() },
            ]} rows={EMISSIONS_BY_SCOPE} keyField="name" />
          </>
        );
      } else if (pillar.label === 'Governance') {
        extra = (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', marginBottom: 8 }}>Compliance & Reporting</p>
            <DrawerTable columns={[
              { key: 'label', label: 'Item' },
              { key: 'status', label: 'Status', align: 'right', render: r => <DrawerPill label={r.status} color={ESG_STATUS_COLOR[r.status] ?? pillar.color} /> },
            ]} rows={COMPLIANCE_REPORTING} keyField="label" />
          </>
        );
      }
      return (
        <DetailDrawer open title={pillar.label} subtitle="ESG Scorecard Pillar" icon={pillar.Icon ? <pillar.Icon size={16} color={pillar.color} /> : undefined} accentColor={pillar.color} onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Score', value: `${pillar.score}/100` },
            { label: 'Weight of Overall', value: `${weight}%` },
          ]} />
          {extra}
        </DetailDrawer>
      );
    }

    if (kind === 'esg-initiative' || kind === 'compliance') {
      const item = payload;
      const color = ESG_STATUS_COLOR[item.status] ?? '#6B7280';
      return (
        <DetailDrawer open title={item.label} subtitle={kind === 'esg-initiative' ? 'ESG Initiative' : 'Compliance & Reporting'} icon={<Leaf size={16} color={color} />} accentColor={color} onClose={closeDrawer}>
          <div style={{ marginBottom: 14 }}><DrawerPill label={item.status} color={color} /></div>
          <DrawerTable columns={[{ key: 'field', label: 'Field' }, { key: 'val', label: 'Value', align: 'right' }]} rows={[
            { field: 'Owner', val: synthOwner(item.label) },
            { field: 'Due Date', val: synthDueDate(item.status) },
          ]} keyField="field" />
        </DetailDrawer>
      );
    }

    if (kind === 'new-report') {
      return (
        <DetailDrawer open title="New Cost Report" subtitle="FinOps" icon={<Plus size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <NewCostReportForm onClose={closeDrawer} showToast={showToast} categories={COST_BY_CATEGORY.map(c => c.name)} />
        </DetailDrawer>
      );
    }

    if (kind === 'budget-alert') {
      return (
        <DetailDrawer open title="Set Budget Alert" subtitle="FinOps" icon={<Bell size={16} color="#F59E0B" />} accentColor="#F59E0B" onClose={closeDrawer}>
          <BudgetAlertForm onClose={closeDrawer} showToast={showToast} categories={COST_BY_CATEGORY.map(c => c.name)} />
        </DetailDrawer>
      );
    }

    return <DetailDrawer open={false} onClose={closeDrawer} />;
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'row', overflow: 'hidden', background: '#F4F6F9' }}>
      <style>{`
        .eai-focusable:focus-visible { outline: 2px solid #0077C8; outline-offset: 2px; border-radius: 4px; }
      `}</style>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Sub-header: tab strip + date + controls */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20, borderBottom: '1px solid #E2E8F0', flexShrink: 0, background: '#F4F6F9', height: 44 }}>
          {[
            { key: 'finops', label: 'FinOps Overview' },
            { key: 'esg',    label: 'ESG Overview'    },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => handleTabChange(key)} className="eai-focusable" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '0 2px', height: 44, fontSize: 11, fontWeight: 700,
              color: activeTab === key ? '#1A1F36' : '#9CA3AF',
              borderBottom: activeTab === key ? '2px solid #0077C8' : '2px solid transparent',
              transition: 'color 0.12s',
            }}>
              {label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Date range pill */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setDateOpen(o => !o); setFiltersOpen(false); setExportOpen(false); }}
              aria-label="Change date range" className="eai-focusable"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: dateOpen ? '#EEF2F7' : '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EEF2F7'}
              onMouseLeave={e => e.currentTarget.style.background = dateOpen ? '#EEF2F7' : '#F8FAFC'}
            >
              <span style={{ fontSize: 10, color: '#6B7280' }}>{rangeLabel(range)}</span>
              <ChevronDown size={10} style={{ color: '#9CA3AF', transform: dateOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            <DateRangePopover
              open={dateOpen}
              onClose={() => setDateOpen(false)}
              presets={DATE_PRESETS}
              value={range}
              onSelectPreset={key => {
                const next = { presetKey: key, from: '', to: '' };
                setRange(next);
                updateURL({ range: key === 'last-12' ? undefined : key, from: undefined, to: undefined });
              }}
              onCustomChange={(from, to) => {
                const next = { presetKey: 'custom', from, to };
                setRange(next);
                updateURL({ range: 'custom', from, to });
              }}
            />
          </div>

          {/* Filters button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setFiltersOpen(o => !o); setDateOpen(false); setExportOpen(false); }}
              className="eai-focusable"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 8,
                background: activeFilterCount ? 'rgba(0,119,200,0.10)' : '#F8FAFC',
                border: activeFilterCount ? '1px solid rgba(0,119,200,0.30)' : '1px solid #E2E8F0',
                cursor: 'pointer', color: activeFilterCount ? '#0077C8' : '#6B7280', fontSize: 10,
              }}
            >
              <Filter size={11} /> Filters
              {activeFilterCount > 0 && (
                <span style={{ fontSize: 8, fontWeight: 700, background: '#0077C8', color: '#fff', borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            <FilterPopover
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              groups={FILTER_GROUPS}
              selected={filters}
              onToggle={toggleFilter}
              onClear={clearFilters}
            />
          </div>

          {/* Export */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setExportOpen(o => !o); setDateOpen(false); setFiltersOpen(false); }}
              className="eai-focusable"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 14px', borderRadius: 8, background: '#0077C8', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = '#0068AF'}
              onMouseLeave={e => e.currentTarget.style.background = '#0077C8'}
            >
              <Download size={11} /> Export
            </button>
            {exportOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 400, width: 170, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(16,24,40,0.12)', overflow: 'hidden' }}>
                {[
                  { key: 'csv',  label: 'Export CSV',   Icon: FileDown },
                  { key: 'xlsx', label: 'Export XLSX',  Icon: FileSpreadsheet },
                  { key: 'pdf',  label: 'Export as PDF', Icon: FileText },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key} type="button" onClick={() => handleExport(key)} className="eai-focusable"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151', fontSize: 11 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon size={12} style={{ color: '#0077C8' }} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <QuickActionsMenu items={[
            { iconKey: 'Plus',     label: 'New Cost Report',  onClick: () => openDrawer('new-report') },
            { iconKey: 'Download', label: 'Export Data',      onClick: () => setExportOpen(true) },
            { iconKey: 'Filter',   label: 'Apply Filters',    onClick: () => setFiltersOpen(true) },
            { iconKey: 'Bell',     label: 'Set Budget Alert', onClick: () => openDrawer('budget-alert') },
          ]} />
        </div>

        {/* Scrollable content */}
        <div ref={panelRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'finops' ? <FinOpsPanel /> : <EsgPanel />}
        </div>
      </div>

      {renderDrawer()}
      <ToastHost />
    </div>
  );
}

export default function FinOpsEsgPage() {
  return (
    <Suspense fallback={
      <div style={{ height: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', color: '#9CA3AF', fontSize: 12 }}>
        Loading…
      </div>
    }>
      <FinOpsEsgPageInner />
    </Suspense>
  );
}
