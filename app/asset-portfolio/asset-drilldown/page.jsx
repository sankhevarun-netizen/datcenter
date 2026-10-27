'use client';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { mockAssets } from '@/data/mock/index';
import { Search, Layers, X } from 'lucide-react';

const C = {
  bg:     '#0B1929',
  card:   '#0d1f3c',
  card2:  'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.09)',
  green:  '#00B0A0',
  amber:  '#E87722',
  red:    '#C8102E',
  blue:   '#005EB8',
  cyan:   '#06B6D4',
  purple: '#7C3AED',
};

const STATUS_COLORS = {
  healthy:  C.green,
  warning:  C.amber,
  critical: C.red,
  degraded: C.amber,
  spare:    'rgba(255,255,255,0.4)',
};

function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function Mono({ children, color = 'white', size = 'text-xl' }) {
  return <span className={`font-bold ${size}`} style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{children}</span>;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

const FILTER_LABELS = { class: 'Class', make: 'Make', model: 'Model', status: 'Status', site: 'Site', assetType: 'Type' };

function AssetDrilldownContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    class: searchParams.get('class') || '',
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    status: searchParams.get('status') || '',
    site: searchParams.get('site') || '',
    assetType: searchParams.get('assetType') || '',
  });
  const [search, setSearch] = useState('');

  const classOptions = useMemo(() => uniqueSorted(mockAssets.map(a => a.class)), []);
  const makeOptions = useMemo(() => uniqueSorted(mockAssets.map(a => a.make)), []);
  const statusOptions = useMemo(() => uniqueSorted(mockAssets.map(a => a.status)), []);
  const siteOptions = useMemo(() => uniqueSorted(mockAssets.map(a => a.dcName)), []);

  const filtered = useMemo(() => {
    return mockAssets.filter(a => {
      if (filters.class && a.class !== filters.class) return false;
      if (filters.make && a.make !== filters.make) return false;
      if (filters.model && a.model !== filters.model) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.site && a.dcName !== filters.site) return false;
      if (filters.assetType && a.assetType !== filters.assetType) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${a.id} ${a.make} ${a.model} ${a.type} ${a.dcName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [filters, search]);

  const stats = useMemo(() => {
    const count = filtered.length;
    const activeSites = new Set(filtered.map(a => a.dcName)).size;
    const avgAge = count ? (filtered.reduce((s, a) => s + a.ageYears, 0) / count).toFixed(1) : '0.0';
    return { count, activeSites, avgAge };
  }, [filtered]);

  const clearFilters = () => {
    setFilters({ class: '', make: '', model: '', status: '', site: '', assetType: '' });
    setSearch('');
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px 36px' }}>
      <div className="flex items-center gap-2.5 mb-1">
        <Layers size={16} color={C.cyan} />
        <h1 className="text-lg font-extrabold text-white" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          Asset Drilldown
        </h1>
      </div>
      <p className="text-xs text-white/40 mb-4">Equipment-level inventory detail — filter by class, make, model, status or site.</p>

      {Object.entries(filters).some(([, v]) => v) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[10px] text-white/35 uppercase tracking-wider mr-1">Filtered from chart:</span>
          {Object.entries(filters).filter(([, v]) => v).map(([key, value]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full" style={{ background: `${C.cyan}18`, border: `1px solid ${C.cyan}40`, color: C.cyan }}>
              {FILTER_LABELS[key]}: {value}
              <button onClick={() => setFilters(f => ({ ...f, [key]: '' }))} className="hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Count</p>
          <Mono size="text-2xl">{stats.count}</Mono>
        </Card>
        <Card>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Active Sites</p>
          <Mono size="text-2xl" color={C.cyan}>{stats.activeSites}</Mono>
        </Card>
        <Card>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Avg Age</p>
          <Mono size="text-2xl" color={C.amber}>{stats.avgAge} yrs</Mono>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: C.card2, border: `1px solid ${C.border}` }}>
          <Search size={12} color="rgba(255,255,255,0.4)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ID, make, model, site…"
            className="bg-transparent text-xs text-white outline-none placeholder:text-white/30"
            style={{ width: 200 }}
          />
        </div>
        {[
          { key: 'class', label: 'All Classes', options: classOptions },
          { key: 'make', label: 'All Makes', options: makeOptions },
          { key: 'status', label: 'All Statuses', options: statusOptions },
          { key: 'site', label: 'All Sites', options: siteOptions },
        ].map(({ key, label, options }) => (
          <select
            key={key}
            value={filters[key]}
            onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
            className="text-[11px] rounded-lg px-2.5 py-1.5 outline-none"
            style={{ background: C.card2, color: 'rgba(255,255,255,0.7)', border: `1px solid ${C.border}` }}
          >
            <option value="" style={{ background: C.card }}>{label}</option>
            {options.map(o => <option key={o} value={o} style={{ background: C.card }}>{o}</option>)}
          </select>
        ))}
        <select
          value={filters.assetType}
          onChange={e => setFilters(f => ({ ...f, assetType: e.target.value }))}
          className="text-[11px] rounded-lg px-2.5 py-1.5 outline-none"
          style={{ background: C.card2, color: 'rgba(255,255,255,0.7)', border: `1px solid ${C.border}` }}
        >
          <option value="" style={{ background: C.card }}>Physical + Virtual</option>
          <option value="Physical" style={{ background: C.card }}>Physical only</option>
          <option value="Virtual" style={{ background: C.card }}>Virtual only</option>
        </select>
        {(search || Object.values(filters).some(Boolean)) && (
          <button onClick={clearFilters} className="text-[11px] text-cyan-400 hover:text-cyan-300 px-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Data grid */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
              <tr>
                {['Asset ID', 'Site', 'Make', 'Model', 'Class', 'Status', 'Type'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-white/45 uppercase tracking-wider whitespace-nowrap" style={{ fontSize: 10 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-t" style={{ borderColor: C.border }}>
                  <td className="px-3 py-2.5 font-mono text-white/80">{a.id}</td>
                  <td className="px-3 py-2.5 text-white/65">{a.dcName}</td>
                  <td className="px-3 py-2.5 text-white/65">{a.make}</td>
                  <td className="px-3 py-2.5 text-white/65">{a.model}</td>
                  <td className="px-3 py-2.5 text-white/65">{a.class}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[a.status] || 'rgba(255,255,255,0.4)' }} />
                      <span className="text-white/65 capitalize">{a.status}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/65">
                    {a.type}
                    {a.assetType === 'Virtual' && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${C.purple}22`, color: C.purple }}>VM</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-white/30">No assets match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AssetDrilldownPage() {
  return (
    <Suspense fallback={null}>
      <AssetDrilldownContent />
    </Suspense>
  );
}
