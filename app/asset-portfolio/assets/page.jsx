'use client';
import { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { fetchAssetRegisterClient, fetchAssetIntelligenceClient, fetchGoogleLocations } from '@/lib/assetPortfolio';
import { ASSET_PORTFOLIO_SEED } from '@/data/assetPortfolioSeed';
import { STATUS_COLORS, assetStatus, worstIntelligenceByAsset, isWithinExpiryWindow } from '@/lib/assetPortfolioCalc';
import { REGIONS, OWNERSHIP_TYPES, RISK_FLAGS, TIER_RATINGS } from '@/data/assetPortfolioSchema';
import AssetDetailPanel from '@/components/asset-portfolio/AssetDetailPanel';

const COLUMNS = [
  { key: 'asset_name', label: 'Name' },
  { key: 'region', label: 'Region' },
  { key: 'ownership_type', label: 'Ownership' },
  { key: 'tier_rating', label: 'Tier' },
  { key: 'total_it_capacity_mw', label: 'MW Capacity' },
  { key: 'utilization_pct', label: 'Utilization %' },
  { key: 'pue', label: 'PUE' },
  { key: 'current_valuation_m', label: 'Valuation ($M)' },
  { key: 'lease_expiry_date', label: 'Lease/PPA Expiry' },
  { key: 'risk_flag', label: 'Risk' },
];

function toCSV(rows) {
  const headers = COLUMNS.map(c => c.label);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(COLUMNS.map(c => `"${(r[c.key] ?? '').toString().replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

export default function AssetPortfolioTablePage() {
  const [assets, setAssets] = useState([]);
  const [intelligence, setIntelligence] = useState([]);
  const [filters, setFilters] = useState({ region: '', ownership_type: '', risk_flag: '', tier_rating: '', expiryWindow: '' });
  const [sortKey, setSortKey] = useState('asset_name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const register = await fetchAssetRegisterClient(supabase);
      if (register.length) {
        setAssets(register);
        setIntelligence(await fetchAssetIntelligenceClient(supabase));
        return;
      }
      setIntelligence([]);
      const { rows } = await fetchGoogleLocations();
      setAssets(rows.length ? rows : ASSET_PORTFOLIO_SEED);
    })();
  }, []);

  const worstIntel = useMemo(() => worstIntelligenceByAsset(intelligence), [intelligence]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (filters.region && a.region !== filters.region) return false;
      if (filters.ownership_type && a.ownership_type !== filters.ownership_type) return false;
      if (filters.risk_flag && a.risk_flag !== filters.risk_flag) return false;
      if (filters.tier_rating && a.tier_rating !== filters.tier_rating) return false;
      if (filters.expiryWindow && !isWithinExpiryWindow(a.lease_expiry_date || a.ppa_expiry_date, Number(filters.expiryWindow))) return false;
      return true;
    });
  }, [assets, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const exportCSV = () => {
    const blob = new Blob([toCSV(sorted)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'asset_portfolio_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedAsset = selectedAssetId ? assets.find(a => a.asset_id === selectedAssetId) : null;

  return (
    <div className="relative px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-extrabold text-text-primary" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          Portfolio Assets ({sorted.length})
        </h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-grey-border text-xs font-semibold text-text-primary hover:bg-grey-bg transition-colors"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filters.region} onChange={e => setFilters(f => ({ ...f, region: e.target.value }))} className="text-xs border border-grey-border rounded-lg px-2.5 py-1.5 text-text-primary bg-white">
          <option value="">All Regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.ownership_type} onChange={e => setFilters(f => ({ ...f, ownership_type: e.target.value }))} className="text-xs border border-grey-border rounded-lg px-2.5 py-1.5 text-text-primary bg-white">
          <option value="">All Ownership</option>
          {OWNERSHIP_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filters.tier_rating} onChange={e => setFilters(f => ({ ...f, tier_rating: e.target.value }))} className="text-xs border border-grey-border rounded-lg px-2.5 py-1.5 text-text-primary bg-white">
          <option value="">All Tiers</option>
          {TIER_RATINGS.map(t => <option key={t} value={t}>Tier {t}</option>)}
        </select>
        <select value={filters.risk_flag} onChange={e => setFilters(f => ({ ...f, risk_flag: e.target.value }))} className="text-xs border border-grey-border rounded-lg px-2.5 py-1.5 text-text-primary bg-white">
          <option value="">All Risk Flags</option>
          {RISK_FLAGS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filters.expiryWindow} onChange={e => setFilters(f => ({ ...f, expiryWindow: e.target.value }))} className="text-xs border border-grey-border rounded-lg px-2.5 py-1.5 text-text-primary bg-white">
          <option value="">Any Expiry</option>
          <option value="12">Expiring in 12mo</option>
          <option value="24">Expiring in 24mo</option>
          <option value="36">Expiring in 36mo</option>
        </select>
      </div>

      <div className="border border-grey-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-grey-bg">
            <tr>
              {COLUMNS.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)} className="px-3 py-2 text-left font-semibold text-text-secondary cursor-pointer hover:text-text-primary whitespace-nowrap">
                  <span className="flex items-center gap-1">{c.label} <ArrowUpDown size={10} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-border">
            {sorted.map(a => {
              const status = assetStatus(a, worstIntel);
              return (
                <tr key={a.asset_id} onClick={() => setSelectedAssetId(a.asset_id)} className="hover:bg-grey-bg cursor-pointer">
                  <td className="px-3 py-2 font-medium text-text-primary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                    {a.asset_name}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{a.region}</td>
                  <td className="px-3 py-2 text-text-secondary">{a.ownership_type}</td>
                  <td className="px-3 py-2 text-text-secondary">{a.tier_rating}</td>
                  <td className="px-3 py-2 text-text-secondary font-mono">{a.total_it_capacity_mw}</td>
                  <td className="px-3 py-2 text-text-secondary font-mono">{a.utilization_pct}%</td>
                  <td className="px-3 py-2 text-text-secondary font-mono">{a.pue}</td>
                  <td className="px-3 py-2 text-text-secondary font-mono">{a.current_valuation_m}</td>
                  <td className="px-3 py-2 text-text-secondary">{a.lease_expiry_date || a.ppa_expiry_date || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">{a.risk_flag}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedAsset && (
        <div className="fixed inset-0 z-30" onClick={() => setSelectedAssetId(null)}>
          <div onClick={e => e.stopPropagation()}>
            <AssetDetailPanel asset={selectedAsset} intelligence={intelligence} onClose={() => setSelectedAssetId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
