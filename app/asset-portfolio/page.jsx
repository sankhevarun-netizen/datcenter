'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, Server, Zap, DollarSign, AlertTriangle, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { fetchAssetRegisterClient, fetchAssetIntelligenceClient, fetchGoogleLocations } from '@/lib/assetPortfolio';
import { ASSET_PORTFOLIO_SEED } from '@/data/assetPortfolioSeed';
import { computeKPIs, assetsAtRisk, worstIntelligenceByAsset, assetStatus, STATUS_COLORS } from '@/lib/assetPortfolioCalc';
import AssetDetailPanel from '@/components/asset-portfolio/AssetDetailPanel';
import IntelligenceFeedPanel from '@/components/asset-portfolio/IntelligenceFeedPanel';

const GlobeViewer = dynamic(() => import('@/components/globe/GlobeViewer'), { ssr: false });

const POLL_INTERVAL_MS = 15 * 60 * 1000;

function KPICard({ Icon, label, value, color = '#FFFFFF' }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 backdrop-blur-md"
      style={{ background: 'rgba(10,22,40,0.82)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon size={13} color={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-white/50 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold text-white font-mono leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function AssetPortfolioGlobePage() {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState([]);
  const [intelligence, setIntelligence] = useState([]);
  const [usingSeed, setUsingSeed] = useState(false);
  const [sourceNote, setSourceNote] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const loadData = useCallback(async () => {
    const register = await fetchAssetRegisterClient(supabase);
    if (register.length) {
      setAssets(register);
      setUsingSeed(false);
      setSourceNote('');
      const intel = await fetchAssetIntelligenceClient(supabase);
      setIntelligence(intel);
      return;
    }

    setUsingSeed(true);
    setIntelligence([]);
    const { rows, live } = await fetchGoogleLocations();
    if (rows.length) {
      setAssets(rows);
      setSourceNote(live
        ? `Showing ${rows.length} live Google data center locations (sourced from datacenters.google) — capacity and financial figures aren't publicly disclosed by Google. Upload your register to add real operating data.`
        : `Showing ${rows.length} reference assets (live source unreachable, using cached fallback). Upload your register to replace this view.`);
    } else {
      setAssets(ASSET_PORTFOLIO_SEED);
      setSourceNote(`Showing ${ASSET_PORTFOLIO_SEED.length} seeded reference assets — upload your register to replace this view.`);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => { if (!usingSeed) refreshIntelligence(); }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingSeed]);

  const refreshIntelligence = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/asset-portfolio/intelligence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const intel = await fetchAssetIntelligenceClient(supabase);
      setIntelligence(intel);
    } finally {
      setRefreshing(false);
    }
  }, [supabase]);

  const worstIntel = useMemo(() => worstIntelligenceByAsset(intelligence), [intelligence]);
  const kpis = useMemo(() => computeKPIs(assets), [assets]);
  const atRisk = useMemo(() => assetsAtRisk(assets, worstIntel), [assets, worstIntel]);

  const assetsById = useMemo(() => Object.fromEntries(assets.map(a => [a.asset_id, a])), [assets]);
  const selectedAsset = selectedAssetId ? assetsById[selectedAssetId] : null;

  const globeDCs = useMemo(() => assets
    .filter(a => a.latitude && a.longitude)
    .map(a => ({
      ...a,
      id: a.asset_id,
      name: a.asset_name,
      capacity_mw: a.total_it_capacity_mw,
      tier_rating: a.tier_rating,
      coordinates: { latitude: Number(a.latitude), longitude: Number(a.longitude) },
    })), [assets]);

  const getMarkerColor = useCallback((dc) => STATUS_COLORS[assetStatus(dc, worstIntel)], [worstIntel]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    setNoMatch(false);
    const direct = assets.find(a =>
      a.asset_name?.toLowerCase().includes(q) ||
      a.city?.toLowerCase().includes(q) ||
      a.country?.toLowerCase().includes(q) ||
      a.asset_id?.toLowerCase().includes(q)
    );
    if (direct) { setSelectedAssetId(direct.asset_id); return; }

    setSearching(true);
    try {
      const res = await fetch('/api/asset-portfolio/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Which single Asset ID best matches this search: "${search}"? Reply with ONLY the Asset ID, nothing else.` }),
      });
      const data = await res.json();
      const candidate = (data.content || '').trim().split(/\s+/)[0];
      if (candidate && assetsById[candidate]) setSelectedAssetId(candidate);
      else setNoMatch(true);
    } catch {
      setNoMatch(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative" style={{ height: 'calc(100vh - 49px)' }}>
      <div className="absolute inset-0 bg-navy-gradient overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{ height: 220, background: 'linear-gradient(to bottom, rgba(10,18,35,0.55), rgba(10,18,35,0.15) 70%, transparent)' }}
        />
        <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-4 pb-3">
          <form onSubmit={handleSearch} className="relative max-w-md mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setNoMatch(false); }}
              placeholder="Search by name, city, or asset ID…"
              className="w-full backdrop-blur-md rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
              style={{ background: 'rgba(10,22,40,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40">Searching…</span>}
          </form>
          {noMatch && <p className="text-[11px] text-amber mb-2">No matching asset found.</p>}

          <div className="flex flex-wrap gap-2">
            <KPICard Icon={Server} label="Total Assets" value={kpis.totalAssets} />
            <KPICard Icon={Zap} label="Total MW" value={kpis.totalMW.toFixed(0)} />
            <KPICard Icon={DollarSign} label="Lease Liability" value={`$${kpis.totalLeaseLiability.toFixed(0)}M`} />
            <KPICard Icon={AlertTriangle} label="Assets at Risk" value={atRisk.length} color="#E87722" />
            <KPICard Icon={Layers} label="Capex Committed" value={`$${kpis.capexCommitted.toFixed(0)}M`} />
          </div>
          {usingSeed && sourceNote && (
            <p className="text-[10px] text-white/40 mt-2 max-w-2xl">{sourceNote}</p>
          )}
        </div>

        <div className="absolute inset-0">
          <GlobeViewer
            className="h-full"
            datacenters={globeDCs}
            selectedId={selectedAssetId}
            onMarkerClick={(dc) => setSelectedAssetId(dc.id)}
            getMarkerColor={getMarkerColor}
            showLink={false}
          />
        </div>

        <IntelligenceFeedPanel
          feed={intelligence}
          assetsById={assetsById}
          onRefresh={refreshIntelligence}
          refreshing={refreshing}
        />

        {selectedAsset && (
          <AssetDetailPanel
            asset={selectedAsset}
            intelligence={intelligence}
            onClose={() => setSelectedAssetId(null)}
          />
        )}
      </div>
    </div>
  );
}
