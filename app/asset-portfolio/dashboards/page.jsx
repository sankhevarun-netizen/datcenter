'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ASSET_PORTFOLIO_SEED } from '@/data/assetPortfolioSeed';
import { mockAssets, mockGRNs, mockCapitalizations } from '@/data/mock/index';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceLine,
} from 'recharts';
import {
  Server, Zap, Activity, Leaf, AlertTriangle, Building2,
  DollarSign, ShieldCheck, Clock, BarChart2, Repeat2,
  ClipboardCheck, PackageX,
} from 'lucide-react';

// ─── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:     '#0B1929',
  card:   '#0d1f3c',
  card2:  'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.09)',
  green:  '#00B0A0',
  amber:  '#E87722',
  red:    '#C8102E',
  blue:   '#005EB8',
  navy:   '#00338D',
  purple: '#7C3AED',
  cyan:   '#06B6D4',
};

// ─── Shared helpers ────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#00338D', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      {label && <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#fff', margin: '2px 0' }}>{p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</b></p>
      ))}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", letterSpacing: '0.1em' }}
      className="text-white font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-3">
      <span className="flex-1 h-px opacity-20" style={{ background: 'white' }} />
      {children}
      <span className="flex-1 h-px opacity-20" style={{ background: 'white' }} />
    </h2>
  );
}

function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-xl p-4 ${className}`}
      style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function CardLabel({ children }) {
  return (
    <p className="text-[10px] text-white/50 uppercase tracking-widest mb-3 font-bold"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {children}
    </p>
  );
}

function Mono({ children, color = 'white', size = 'text-xl' }) {
  return (
    <span className={`font-bold ${size}`} style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
      {children}
    </span>
  );
}

function TrendBadge({ value, positive }) {
  return (
    <span className="text-xs font-semibold" style={{ color: positive ? C.green : C.red, fontFamily: "'JetBrains Mono', monospace" }}>
      {positive ? '▲' : '▼'} {value}
    </span>
  );
}

function MiniStatBox({ label, value, color = 'white' }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: C.card2 }}>
      <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1"
        style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
      <Mono color={color} size="text-base">{value}</Mono>
    </div>
  );
}

// ─── DC data (computed from seed) ─────────────────────────────────────────────
const assets = ASSET_PORTFOLIO_SEED;

const totalSites       = assets.length;
const totalCapacityMW  = assets.reduce((s, a) => s + a.total_it_capacity_mw, 0);
const avgPUE           = (assets.reduce((s, a) => s + a.pue, 0) / totalSites).toFixed(2);
const avgUtil          = Math.round(assets.reduce((s, a) => s + a.utilization_pct, 0) / totalSites);
const avgRenewable     = Math.round(assets.reduce((s, a) => s + a.renewable_energy_pct, 0) / totalSites);

const pueData = [...assets]
  .sort((a, b) => a.pue - b.pue)
  .map(a => ({ name: a.asset_id, pue: a.pue }));

const regionCapacity = ['AMER', 'EMEA', 'APAC', 'LATAM'].map(r => ({
  region: r,
  capacity: assets.filter(a => a.region === r).reduce((s, a) => s + a.total_it_capacity_mw, 0),
  load:     assets.filter(a => a.region === r).reduce((s, a) => s + a.current_it_load_mw, 0),
}));

const tierData = [
  { name: 'Tier IV', value: assets.filter(a => a.tier_rating === 'IV').length,  color: C.blue },
  { name: 'Tier III', value: assets.filter(a => a.tier_rating === 'III').length, color: C.navy },
];

const ownershipData = [
  { name: 'Owned',  value: assets.filter(a => a.ownership_type === 'Owned').length,  color: C.green },
  { name: 'Leased', value: assets.filter(a => a.ownership_type === 'Leased').length, color: C.amber },
  { name: 'Colo',   value: assets.filter(a => a.ownership_type === 'Colo').length,   color: C.blue },
];

const capexData = [...assets]
  .sort((a, b) => b.capex_budget_m - a.capex_budget_m)
  .slice(0, 10)
  .map(a => ({ name: a.asset_id, budget: a.capex_budget_m, spent: a.capex_spent_m }));

const renewableData = [...assets]
  .sort((a, b) => b.renewable_energy_pct - a.renewable_energy_pct)
  .map(a => ({ name: a.asset_id, pct: a.renewable_energy_pct }));

const riskData = [
  { name: 'Low',    value: assets.filter(a => a.risk_flag === 'Low').length,    color: C.green },
  { name: 'Medium', value: assets.filter(a => a.risk_flag === 'Medium').length, color: C.amber },
  { name: 'High',   value: assets.filter(a => a.risk_flag === 'High').length,   color: C.red },
];

// ─── Asset Composition (equipment-level, from mockAssets) ─────────────────────
const physicalVirtualData = [
  { name: 'Physical', value: mockAssets.filter(a => a.assetType === 'Physical').length, color: C.blue },
  { name: 'Virtual',  value: mockAssets.filter(a => a.assetType === 'Virtual').length,  color: C.purple },
];

const GROUP_FIELDS = { Make: 'make', Model: 'model', Class: 'class' };
const LIMIT_OPTIONS = ['Top 5', 'Top 10', 'All'];

function buildCompositionData(groupKey, limit) {
  const field = GROUP_FIELDS[groupKey];
  const counts = {};
  mockAssets.forEach(a => {
    const key = a[field] || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  let rows = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (limit === 'Top 5') rows = rows.slice(0, 5);
  else if (limit === 'Top 10') rows = rows.slice(0, 10);
  return rows;
}

function AssetCompositionCard() {
  const router = useRouter();
  const [groupKey, setGroupKey] = useState('Make');
  const [limit, setLimit] = useState('Top 10');

  const data = useMemo(() => buildCompositionData(groupKey, limit), [groupKey, limit]);

  const handleBarClick = (entry) => {
    if (!entry?.name) return;
    const field = GROUP_FIELDS[groupKey];
    router.push(`/asset-portfolio/asset-drilldown?${field}=${encodeURIComponent(entry.name)}`);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardLabel>Asset Composition by {groupKey}</CardLabel>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: C.border }}>
            {Object.keys(GROUP_FIELDS).map(g => (
              <button
                key={g}
                onClick={() => setGroupKey(g)}
                className="px-2.5 py-1 text-[10px] font-semibold transition-colors"
                style={{
                  background: groupKey === g ? C.blue : 'transparent',
                  color: groupKey === g ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontFamily: "'Inter', 'Segoe UI', sans-serif",
                }}
              >
                {g}
              </button>
            ))}
          </div>
          <select
            value={limit}
            onChange={e => setLimit(e.target.value)}
            className="text-[10px] rounded-md px-2 py-1 outline-none"
            style={{ background: C.card2, color: 'rgba(255,255,255,0.7)', border: `1px solid ${C.border}` }}
          >
            {LIMIT_OPTIONS.map(o => <option key={o} value={o} style={{ background: C.card }}>{o}</option>)}
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={120} />
          <Tooltip content={<DarkTooltip />} />
          <Bar dataKey="value" name="Count" fill={C.cyan} radius={[0, 3, 3, 0]} cursor="pointer" onClick={handleBarClick} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[9px] text-white/25 mt-1">Click a bar to view underlying assets</p>
    </Card>
  );
}

// ─── EAM static data (from reference images) ───────────────────────────────────
const EXEC_SCORECARD = [
  { label: 'Total Asset Base',       value: '₹40,576M',  sub: '33,645 assets',     trend: '+5.2%',  pos: true,  Icon: DollarSign,    color: C.blue   },
  { label: 'Governed Asset %',       value: '133%',       sub: '32,460.8M governed',trend: '+2.1%',  pos: true,  Icon: ShieldCheck,   color: C.green  },
  { label: 'At-Risk Asset Value',    value: '₹7,327.5M', sub: '18.06% of base',    trend: '-1.5%',  pos: false, Icon: AlertTriangle, color: C.red    },
  { label: 'PV Completion %',        value: '79%',        sub: 'Assets verified',   trend: '+3.2%',  pos: true,  Icon: ClipboardCheck,color: C.green  },
  { label: 'Movement SLA %',         value: '81%',        sub: 'MRL + STS',         trend: '+1.8%',  pos: true,  Icon: Repeat2,       color: C.blue   },
  { label: 'Data Quality Score',     value: '72',         sub: '0–100 scale',       trend: '+2.5%',  pos: true,  Icon: BarChart2,     color: C.purple },
  { label: 'Capitalisation Pending', value: '₹380.0M',   sub: 'Awaiting approval', trend: '-0.8%',  pos: false, Icon: Clock,         color: C.amber  },
  { label: 'CWIP > 12 Months',       value: '₹1,065.5M', sub: 'Aged CWIP',         trend: '-2.3%',  pos: false, Icon: PackageX,      color: C.red    },
];

const FINANCIAL_PILLS = [
  { label: 'Avg GRN→FA (Days)',  value: '25'         },
  { label: 'Cap Efficiency %',   value: '81%'        },
  { label: 'CWIP > 180 Days',    value: '₹1,617M'   },
  { label: 'Pending Value',      value: '₹380M'     },
  { label: 'Total Capitalised',  value: '₹40,576M'  },
  { label: 'Impaired Asset Val', value: '₹2,028.8M' },
];

const ASSET_VALUE_DIST = [
  { name: 'Book Value',      value: 40576, color: C.blue   },
  { name: 'Capitalised',     value: 32460, color: C.cyan   },
  { name: 'Net Asset Value', value: 28000, color: C.purple },
  { name: 'CWIP',            value: 1617,  color: C.amber  },
  { name: 'Impaired',        value: 2028,  color: C.red    },
];

const CAP_TREND = [
  { month: 'Feb', grn: 28000, cwip: 1200, fin: 24000 },
  { month: 'Apr', grn: 31000, cwip: 1400, fin: 27000 },
  { month: 'Jun', grn: 35000, cwip: 1500, fin: 30000 },
  { month: 'Aug', grn: 42000, cwip: 1800, fin: 38000 },
  { month: 'Oct', grn: 38000, cwip: 1600, fin: 35000 },
  { month: 'Dec', grn: 40576, cwip: 1617, fin: 37000 },
];

const AGING_DATA = [
  { range: '< 90 Days', value: 15, color: C.blue  },
  { range: '90–180',    value: 8,  color: C.cyan  },
  { range: '180–365',   value: 5,  color: C.amber },
  { range: '365+ Days', value: 2,  color: C.red   },
];

const TOP_ALERTS = [
  { title: 'Missing Assets Found During PV',    site: 'Mumbai',    desc: '₹3.8M worth assets missing during PV at Mumbai site',                       time: '2 hrs ago',  sev: 'red'   },
  { title: 'MRL Pending > 7 Days',              site: 'Delhi',     desc: '189 MRLs pending for acknowledgement > 7 days in Delhi',                     time: '5 hrs ago',  sev: 'amber' },
  { title: 'CWIP Ageing > 180 Days',            site: 'Hyderabad', desc: 'CWIP ageing exceeding ₹60.0M at Hyderabad – pending financial approval',     time: '3 days ago', sev: 'amber' },
  { title: 'Duplicate Serial Number Spike',     site: 'Unknown',   desc: '10 duplicate serial numbers detected in Unknown warehouse',                  time: '6 hrs ago',  sev: 'amber' },
  { title: 'Untagged Assets at Critical Sites', site: 'Chennai',   desc: '267 untagged assets found at Chennai data center',                           time: '4 hrs ago',  sev: 'amber' },
  { title: 'Location Mismatch Increase',        site: 'Multiple',  desc: 'Location mismatch rate increased 2.3% across warehouses',                    time: '12 hrs ago', sev: 'amber' },
];

const MOVE_FLOW = [
  { label: 'Created',       count: 6600, color: C.blue   },
  { label: 'Transferred',   count: 5946, color: C.cyan   },
  { label: 'Acknowledged',  count: 5350, color: C.green  },
  { label: 'Fin. Approved', count: 3240, color: C.amber  },
  { label: 'Closed',        count: 3240, color: '#6B7280'},
];

const STS_CITIES = ['Bangalore', 'Chennai', 'Delhi', 'Hyderabad', 'Mumbai'];
const STS_VALUES = {
  'Bangalore–Hyderabad': 80,
  'Chennai–Delhi':       75,
  'Delhi–Bangalore':     80,
  'Delhi–Mumbai':        140,
  'Hyderabad–Chennai':   60,
  'Mumbai–Chennai':      90,
  'Mumbai–Delhi':        70,
};

const PV_GRID = [
  { label: 'PV Completion %',         value: '79%',      color: C.amber },
  { label: 'Missing Assets',          value: '8,000',    color: C.red   },
  { label: 'Location Mismatch %',     value: '4%',       color: C.amber },
  { label: 'Serialized Traceability', value: '2%',       color: C.amber },
  { label: 'Tagged vs Untagged',      value: '4%/96%',   color: C.red   },
  { label: 'Avg PV Delay (Days)',     value: '30',       color: C.amber },
  { label: 'PV Completed Late %',     value: '4%',       color: C.amber },
  { label: 'PV SLA Compliance %',     value: '96%',      color: C.green },
];

const PV_EXCEPTIONS = [
  { label: 'Missing Assets',     value: '8,000',  color: C.red   },
  { label: 'Duplicate Serials',  value: '1,200',  color: C.amber },
  { label: 'Location Mismatch',  value: '6,000',  color: C.amber },
  { label: 'Not Verified',       value: '32,000', color: C.red   },
];

const PV_BAR = [
  { name: 'Mismatch',    value: 6000  },
  { name: 'Extra Asset', value: 32000 },
];

const RADAR_DATA = [
  { subject: 'Master Data',        score: 72 },
  { subject: 'Serial Validity',    score: 65 },
  { subject: 'Location Accuracy',  score: 78 },
  { subject: 'Tag Compliance',     score: 45 },
  { subject: 'Category Accuracy',  score: 82 },
  { subject: 'Field Completeness', score: 60 },
];

const DATA_ISSUES = [
  { label: 'Untagged assets',        value: 15000 },
  { label: 'Duplicate tags',         value: 3000  },
  { label: 'Invalid locations',      value: 3000  },
  { label: 'Missing serial numbers', value: 2400  },
  { label: 'Category mismatch',      value: 1800  },
  { label: 'Location code errors',   value: 1200  },
];

// ─── Page ──────────────────────────────────────────────────────────────────────
function computeAvgGrnToFaDays() {
  const capitalized = mockCapitalizations.filter(r => r.status === 'Capitalized' && r.capitalizationDate);
  if (!capitalized.length) return null;
  const totalDays = capitalized.reduce((sum, r) => {
    const grn = mockGRNs.find(g => g.grnId === r.grnId);
    if (!grn) return sum;
    return sum + Math.round((new Date(r.capitalizationDate) - new Date(grn.receivedDate)) / 86400000);
  }, 0);
  return Math.round(totalDays / capitalized.length);
}

export default function DashboardsPage() {
  const router = useRouter();
  const avgGrnToFaDays = useMemo(computeAvgGrnToFaDays, []);
  const financialPills = useMemo(
    () => FINANCIAL_PILLS.map(p => (p.label === 'Avg GRN→FA (Days)' && avgGrnToFaDays != null ? { ...p, value: String(avgGrnToFaDays) } : p)),
    [avgGrnToFaDays]
  );
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px 36px' }}>

      {/* Toggle bar */}
      <div className="flex items-center gap-3 mb-8">
        <button
          className="px-5 py-2 rounded-lg text-xs font-bold text-white"
          style={{ background: C.navy, border: `1px solid ${C.blue}`, fontFamily: "'Inter', 'Segoe UI', sans-serif", letterSpacing: '0.05em' }}>
          Overall Dashboard
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 1 – DC Portfolio KPI Cards
         ═══════════════════════════════════════════════════════════════════════ */}
      <SectionTitle>Data Center Portfolio Overview</SectionTitle>
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Sites',       value: totalSites,                  unit: 'sites',  Icon: Building2, color: C.blue   },
          { label: 'Total IT Capacity', value: `${totalCapacityMW.toLocaleString()} MW`, unit: '', Icon: Server,    color: C.cyan   },
          { label: 'Avg Portfolio PUE', value: avgPUE,                      unit: '',       Icon: Zap,       color: C.amber  },
          { label: 'Avg Utilization',   value: `${avgUtil}%`,               unit: '',       Icon: Activity,  color: C.green  },
          { label: 'Avg Renewable Mix', value: `${avgRenewable}%`,          unit: '',       Icon: Leaf,      color: C.green  },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] text-white/50 uppercase tracking-wider leading-snug"
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
              <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${color}22` }}>
                <Icon size={16} style={{ color }} />
              </div>
            </div>
            <Mono size="text-2xl">{value}</Mono>
          </Card>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 2 – DC Charts Row 1
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4 mb-6">

        {/* PUE by Site */}
        <Card>
          <CardLabel>PUE by Site</CardLabel>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={pueData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 52 }}>
              <XAxis type="number" domain={[1.0, 1.35]} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine x={1.2} stroke={C.amber} strokeDasharray="4 2" strokeWidth={1} />
              <Bar dataKey="pue" name="PUE" radius={[0, 3, 3, 0]}>
                {pueData.map((e, i) => (
                  <Cell key={i} fill={e.pue < 1.15 ? C.green : e.pue < 1.22 ? C.amber : C.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-white/25 mt-1">Dashed = industry avg 1.20</p>
        </Card>

        {/* MW Capacity vs Load by Region */}
        <Card>
          <CardLabel>IT Capacity vs Current Load by Region</CardLabel>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={regionCapacity} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis dataKey="region" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9CA3AF', paddingTop: 4 }} />
              <Bar dataKey="capacity" fill={C.blue}  name="Capacity (MW)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="load"     fill={C.cyan}  name="Current Load (MW)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Tier + Ownership donuts */}
        <Card className="flex flex-col gap-5">
          <div>
            <CardLabel>Tier Rating Distribution</CardLabel>
            <div className="flex items-center gap-4">
              <PieChart width={88} height={88}>
                <Pie data={tierData} innerRadius={26} outerRadius={42} dataKey="value" strokeWidth={0}>
                  {tierData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-2">
                {tierData.map(t => (
                  <div key={t.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="text-[11px] text-white/60">{t.name}: <b className="text-white">{t.value}</b></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <CardLabel>Ownership Type</CardLabel>
            <div className="flex items-center gap-4">
              <PieChart width={88} height={88}>
                <Pie data={ownershipData} innerRadius={26} outerRadius={42} dataKey="value" strokeWidth={0}>
                  {ownershipData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-2">
                {ownershipData.map(t => (
                  <div key={t.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="text-[11px] text-white/60">{t.name}: <b className="text-white">{t.value}</b></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 2b – Asset Composition (equipment-level)
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <AssetCompositionCard />
        </div>

        {/* Physical vs Virtual */}
        <Card className="flex flex-col">
          <CardLabel>Physical vs Virtual</CardLabel>
          <div className="flex items-center justify-center gap-8 flex-1 py-4">
            <PieChart width={120} height={120}>
              <Pie
                data={physicalVirtualData}
                innerRadius={36}
                outerRadius={56}
                dataKey="value"
                strokeWidth={0}
                cursor="pointer"
                onClick={(entry) => router.push(`/asset-portfolio/asset-drilldown?assetType=${encodeURIComponent(entry.name)}`)}
              >
                {physicalVirtualData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-4">
              {physicalVirtualData.map(d => {
                const total = physicalVirtualData.reduce((s, x) => s + x.value, 0);
                const pct = total ? Math.round((d.value / total) * 100) : 0;
                return (
                  <button
                    key={d.name}
                    onClick={() => router.push(`/asset-portfolio/asset-drilldown?assetType=${encodeURIComponent(d.name)}`)}
                    className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <div>
                      <p className="text-[10px] text-white/45">{d.name} ({pct}%)</p>
                      <Mono size="text-xl" color={d.color}>{d.value}</Mono>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[9px] text-white/25">Click a segment to view underlying assets</p>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 3 – DC Charts Row 2
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4 mb-8">

        {/* Capex Budget vs Spent */}
        <Card>
          <CardLabel>Capex Budget vs Spent — Top 10 Sites ($M)</CardLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={capexData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 50 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9CA3AF' }} />
              <Bar dataKey="budget" fill={`${C.blue}55`} name="Budget" radius={[0, 3, 3, 0]} />
              <Bar dataKey="spent"  fill={C.blue}         name="Spent"  radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Renewable Energy % by Site */}
        <Card>
          <CardLabel>Renewable Energy % by Site</CardLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={renewableData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 50 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine x={80} stroke={C.green} strokeDasharray="4 2" strokeWidth={1} />
              <Bar dataKey="pct" name="Renewable %" radius={[0, 3, 3, 0]}>
                {renewableData.map((e, i) => <Cell key={i} fill={e.pct >= 80 ? C.green : e.pct >= 50 ? C.amber : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Risk Flag Distribution */}
        <Card className="flex flex-col">
          <CardLabel>Risk Flag Distribution</CardLabel>
          <div className="flex items-center justify-center gap-8 flex-1 py-4">
            <PieChart width={120} height={120}>
              <Pie data={riskData} innerRadius={36} outerRadius={56} dataKey="value" strokeWidth={0}>
                {riskData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-4">
              {riskData.map(r => (
                <div key={r.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                  <div>
                    <p className="text-[10px] text-white/45">{r.name}</p>
                    <Mono size="text-xl" color={r.color}>{r.value}</Mono>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 4 – Executive Scorecard
         ═══════════════════════════════════════════════════════════════════════ */}
      <SectionTitle>Executive Scorecard</SectionTitle>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {EXEC_SCORECARD.map(({ label, value, sub, trend, pos, Icon, color }) => (
          <Card key={label} className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <p className="text-[10px] text-white/50 uppercase tracking-wider leading-snug"
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
              <div className="p-1.5 rounded-md flex-shrink-0 ml-2" style={{ background: `${color}25` }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <Mono size="text-xl">{value}</Mono>
            <p className="text-[11px] text-white/35">{sub}</p>
            <TrendBadge value={trend} positive={pos} />
          </Card>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 5 – Financial Governance
         ═══════════════════════════════════════════════════════════════════════ */}
      <SectionTitle>Financial Governance</SectionTitle>
      <div className="grid grid-cols-6 gap-3 mb-4">
        {financialPills.map(({ label, value }) => (
          <Card key={label} className="text-center py-3">
            <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5"
              style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
            <Mono size="text-sm">{value}</Mono>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardLabel>Asset Value Distribution</CardLabel>
          <div className="flex items-center gap-6">
            <PieChart width={160} height={160}>
              <Pie data={ASSET_VALUE_DIST} innerRadius={48} outerRadius={74} dataKey="value" strokeWidth={0}>
                {ASSET_VALUE_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="flex flex-col gap-2.5">
              {ASSET_VALUE_DIST.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-[11px] text-white/60">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardLabel>Capitalisation Trend</CardLabel>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={CAP_TREND} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#9CA3AF' }} />
              <Line type="monotone" dataKey="grn" stroke={C.cyan}   strokeWidth={2} dot={false} name="GRN Value" />
              <Line type="monotone" dataKey="cwip" stroke={C.amber}  strokeWidth={2} dot={false} name="CWIP" />
              <Line type="monotone" dataKey="fin"  stroke={C.purple} strokeWidth={2} dot={false} name="Financial Approval" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 6 – Inventory Governance + Top 10 Alerts
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 mb-6">

        {/* Inventory */}
        <Card>
          <CardLabel>Inventory Governance</CardLabel>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-[9px] text-white/40 mb-1">Total Inventory Value</p>
              <Mono size="text-xl">₹29.4M</Mono>
            </div>
            <div>
              <p className="text-[9px] text-white/40 mb-1">Slow-moving</p>
              <Mono size="text-xl" color={C.amber}>₹8.8M</Mono>
            </div>
            <div>
              <p className="text-[9px] text-white/40 mb-1">Dead Inventory</p>
              <Mono size="text-xl" color={C.red}>₹2.9M</Mono>
            </div>
          </div>
          <div className="rounded-lg p-2.5 mb-4" style={{ background: C.card2 }}>
            <p className="text-[9px] text-white/40 mb-0.5">Carrying Cost %</p>
            <Mono size="text-base">15%</Mono>
          </div>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-2">Ageing Buckets</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={AGING_DATA} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 60 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="range" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="value" name="Value (₹M)" radius={[0, 3, 3, 0]}>
                {AGING_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="border-t border-white/10 mt-3 pt-3 grid grid-cols-2 gap-3">
            <MiniStatBox label="Items Pending Dispatch" value="450" />
            <MiniStatBox label="Write-off Value" value="₹1.2M" color={C.red} />
          </div>
        </Card>

        {/* Top 10 Alerts */}
        <Card>
          <CardLabel>Top 10 Alerts</CardLabel>
          <div className="flex flex-col gap-3 overflow-y-auto pr-0.5" style={{ maxHeight: 380 }}>
            {TOP_ALERTS.map((a, i) => (
              <div key={i} className="rounded-lg p-3"
                style={{ background: C.card2, borderLeft: `3px solid ${a.sev === 'red' ? C.red : C.amber}` }}>
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-xs font-bold text-white leading-snug"
                    style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{a.title}</p>
                  <span className="text-[10px] text-white/30 whitespace-nowrap flex-shrink-0">{a.time}</span>
                </div>
                <p className="text-[10px] text-white/45 mb-1">Site/Warehouse: {a.site}</p>
                <p className="text-[11px] text-white/60 leading-snug">{a.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 7 – Movement Governance + PV Governance
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 mb-6">

        {/* Movement Governance */}
        <Card>
          <CardLabel>Movement Governance</CardLabel>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {[
              { l: 'Total Transfers',       v: '6,600',    c: 'white'  },
              { l: 'Pending ACKs',          v: '655',      c: C.amber  },
              { l: 'Rollback %',            v: '8%',       c: C.red    },
              { l: 'Movement SLA %',        v: '81%',      c: C.green  },
              { l: 'Transit Damage %',      v: '2%',       c: C.amber  },
              { l: 'Unacknowledged Value',  v: '₹327.5M', c: C.amber  },
            ].map(({ l, v, c }) => <MiniStatBox key={l} label={l} value={v} color={c} />)}
          </div>

          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-2">Movement Flow</p>
          <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
            {MOVE_FLOW.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg"
                  style={{ background: `${step.color}28`, border: `1px solid ${step.color}55`, minWidth: 76 }}>
                  <Mono size="text-sm" color="white">{step.count.toLocaleString()}</Mono>
                  <span className="text-[9px] text-white/55 text-center">{step.label}</span>
                </div>
                {i < MOVE_FLOW.length - 1 && (
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>›</span>
                )}
              </div>
            ))}
          </div>

          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-2">STS Heatmap</p>
          <div className="overflow-x-auto">
            <table className="w-full text-center" style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
              <thead>
                <tr>
                  <td />
                  {STS_CITIES.map(c => (
                    <td key={c} className="text-[9px] text-white/40 pb-1 font-semibold px-1"
                      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                      {c.slice(0, 5)}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STS_CITIES.map(from => (
                  <tr key={from}>
                    <td className="text-[9px] text-white/40 pr-2 font-semibold text-left whitespace-nowrap"
                      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                      {from.slice(0, 5)}
                    </td>
                    {STS_CITIES.map(to => {
                      const key1 = `${from}–${to}`;
                      const key2 = `${to}–${from}`;
                      const val = STS_VALUES[key1] ?? STS_VALUES[key2] ?? null;
                      const isSelf = from === to;
                      const bg = isSelf
                        ? 'rgba(255,255,255,0.03)'
                        : val
                          ? val >= 100 ? C.red : val >= 75 ? '#D97706' : C.amber
                          : C.card2;
                      return (
                        <td key={to} className="p-0.5">
                          <div className="w-10 h-7 flex items-center justify-center rounded text-[10px] font-bold text-white mx-auto"
                            style={{ background: bg }}>
                            {!isSelf && val ? val : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* PV Governance */}
        <Card>
          <CardLabel>PV Governance</CardLabel>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PV_GRID.map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2.5" style={{ background: C.card2 }}>
                <p className="text-[9px] text-white/40 mb-0.5">{label}</p>
                <Mono size="text-sm" color={color}>{value}</Mono>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            {/* PV Completion donut */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative" style={{ width: 110, height: 110 }}>
                <PieChart width={110} height={110}>
                  <Pie
                    data={[{ value: 79 }, { value: 21 }]}
                    innerRadius={34} outerRadius={52}
                    startAngle={90} endAngle={-270}
                    dataKey="value" strokeWidth={0}>
                    <Cell fill={C.cyan} />
                    <Cell fill="rgba(255,255,255,0.08)" />
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Mono size="text-lg" color={C.cyan}>79%</Mono>
                  <span className="text-[9px] text-white/40">PV Done</span>
                </div>
              </div>
            </div>

            {/* PV Exception Summary */}
            <div>
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-2">PV Exception Summary</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PV_EXCEPTIONS.map(({ label, value, color }) => (
                  <div key={label} className="rounded p-2" style={{ background: C.card2 }}>
                    <p className="text-[9px] text-white/35 leading-snug mb-0.5">{label}</p>
                    <Mono size="text-sm" color={color}>{value}</Mono>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">PV Exceptions Detail</p>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={PV_BAR} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="value" fill={C.blue} radius={[3, 3, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 8 – Data Quality & Master Data
         ═══════════════════════════════════════════════════════════════════════ */}
      <SectionTitle>Data Quality &amp; Master Data</SectionTitle>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card>
          <CardLabel>Master Data Health Radar</CardLabel>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={RADAR_DATA} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#9CA3AF' }} />
              <Radar dataKey="score" stroke={C.cyan} fill={C.cyan} fillOpacity={0.18} strokeWidth={2} name="Score" />
              <Tooltip content={<DarkTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <CardLabel>Top Data Issues</CardLabel>
          <div className="flex flex-col gap-3.5">
            {DATA_ISSUES.map(({ label, value }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-white/65">{label}</span>
                  <Mono size="text-xs" color="white">{value.toLocaleString()}</Mono>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${(value / 15000) * 100}%`,
                      background: value > 5000 ? C.red : value > 2000 ? C.amber : C.blue,
                    }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
}
