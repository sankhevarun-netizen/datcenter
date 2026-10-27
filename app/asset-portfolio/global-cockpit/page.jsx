'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Globe, BarChart2, AlertTriangle, Zap, Server, CheckCircle2, Construction, Upload, FileSpreadsheet, X, CheckCircle, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { fetchAssetIntelligenceClient } from '@/lib/assetPortfolio';
import { GOOGLE_DC_MASTER, DC_STATS } from '@/data/googleDCMasterData';
import { getWarZonesForRegion } from '@/data/warZoneData';
import GlobalDashboardPanel from '@/components/asset-portfolio/global-cockpit/GlobalDashboardPanel';
import DCCommandCenter from '@/components/asset-portfolio/global-cockpit/DCCommandCenter';
import WarZoneModal from '@/components/asset-portfolio/global-cockpit/WarZoneModal';
import IntelligenceFeedPanel from '@/components/asset-portfolio/IntelligenceFeedPanel';

const GlobeViewer = dynamic(() => import('@/components/globe/GlobeViewer'), { ssr: false });

const REGIONS = ['All', 'North America', 'Europe', 'Asia', 'South America'];
const POLL_INTERVAL_MS = 15 * 60 * 1000;

const REGION_COLORS = { All: '#005EB8', 'North America': '#005EB8', Europe: '#00B0A0', Asia: '#E87722', 'South America': '#7C3AED' };

const STATUS_COLORS = {
  Active: '#00B0A0',
  'Under Construction': '#E87722',
};

const RISK_COLORS = {
  High: '#C8102E',
  Medium: '#E87722',
  Low: '#00B0A0',
};

export default function GlobalCockpitPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeRegion, setActiveRegion] = useState('All');
  const [showGlobalDashboard, setShowGlobalDashboard] = useState(false);
  const [selectedDC, setSelectedDC] = useState(null);
  const [warZoneModal, setWarZoneModal] = useState(null);
  const [detailChip, setDetailChip] = useState(null);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [uploadedDCs, setUploadedDCs] = useState(() => {
    try {
      const s = typeof window !== 'undefined' && sessionStorage.getItem('cockpitUploadedDCs');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [dataSourceName, setDataSourceName] = useState(() => {
    try {
      return (typeof window !== 'undefined' && sessionStorage.getItem('cockpitDataSourceName')) || 'Google DC';
    } catch { return 'Google DC'; }
  });
  const [intelligence, setIntelligence] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [globeVisible, setGlobeVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    try {
      if (uploadedDCs) {
        sessionStorage.setItem('cockpitUploadedDCs', JSON.stringify(uploadedDCs));
        sessionStorage.setItem('cockpitDataSourceName', dataSourceName);
      } else {
        sessionStorage.removeItem('cockpitUploadedDCs');
        sessionStorage.removeItem('cockpitDataSourceName');
      }
    } catch {}
  }, [uploadedDCs, dataSourceName]);

  // GOOGLE_DC_MASTER ids are always prefixed 'GDC-', so this filters out any
  // intelligence rows that belong to a user's uploaded asset_register (Globe
  // tab) rather than this Global Cockpit campus list.
  const assetsById = useMemo(
    () => Object.fromEntries(GOOGLE_DC_MASTER.map(d => [d.id, { asset_name: d.name }])),
    []
  );

  const loadIntelligence = useCallback(async () => {
    const rows = await fetchAssetIntelligenceClient(supabase);
    setIntelligence(rows.filter(r => r.asset_id?.startsWith('GDC-')));
  }, [supabase]);

  useEffect(() => { loadIntelligence(); }, [loadIntelligence]);

  const refreshIntelligence = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/asset-portfolio/global-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: activeRegion }),
      });
      await loadIntelligence();
    } finally {
      setRefreshing(false);
    }
  }, [activeRegion, loadIntelligence]);

  useEffect(() => {
    intervalRef.current = setInterval(() => { refreshIntelligence(); }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [refreshIntelligence]);

  // Filter DCs by region — uses uploaded dataset if present, else default
  const filteredDCs = useMemo(() => {
    const base = uploadedDCs ?? GOOGLE_DC_MASTER;
    if (activeRegion === 'All') return base;
    return base.filter(d => d.region === activeRegion);
  }, [activeRegion, uploadedDCs]);

  // Map DC data to GlobeViewer shape
  const globeDCs = useMemo(() => filteredDCs.map(d => ({
    ...d,
    id: d.id,
    name: d.name,
    capacity_mw: d.capacity_mw,
    tier_rating: d.tier,
    coordinates: { latitude: d.lat, longitude: d.lng },
  })), [filteredDCs]);

  const getMarkerColor = useCallback((dc) => {
    const src = filteredDCs.find(d => d.id === dc.id);
    if (!src) return '#005EB8';
    if (src.risk_flag === 'High') return '#C8102E';
    if (src.risk_flag === 'Medium') return '#E87722';
    if (src.status === 'Under Construction') return '#7C3AED';
    return '#00B0A0';
  }, [filteredDCs]);

  const handleMarkerClick = useCallback((dc) => {
    const base = uploadedDCs ?? GOOGLE_DC_MASTER;
    const src = base.find(d => d.id === dc.id);
    if (src) {
      setSelectedDC(src);
      setShowGlobalDashboard(false);
      setGlobeVisible(false);
    }
  }, [uploadedDCs]);

  const handleGlobalDashboard = () => {
    const next = !showGlobalDashboard;
    setShowGlobalDashboard(next);
    setSelectedDC(null);
    if (next) setGlobeVisible(false);
  };

  // Reset globe visibility when panel fully closes
  useEffect(() => {
    if (!showGlobalDashboard && !selectedDC) setGlobeVisible(true);
  }, [showGlobalDashboard, selectedDC]);

  const handleRegion = (region) => {
    setActiveRegion(region);
    setSelectedDC(null);
    setShowGlobalDashboard(false);
    const alerts = getWarZonesForRegion(region);
    if (alerts.length > 0) setWarZoneModal({ region, alerts });
  };

  const regionStats = useMemo(() => {
    const active = filteredDCs.filter(d => d.status === 'Active');
    const uc     = filteredDCs.filter(d => d.status === 'Under Construction');
    return {
      total:    filteredDCs.length,
      active:   active.length,
      uc:       uc.length,
      atRisk:   filteredDCs.filter(d => d.risk_flag !== 'Low').length,
      highRisk: filteredDCs.filter(d => d.risk_flag === 'High').length,
      medRisk:  filteredDCs.filter(d => d.risk_flag === 'Medium').length,
      totalMW:  Math.round(filteredDCs.reduce((s, d) => s + d.capacity_mw, 0)),
      activeMW: Math.round(active.reduce((s, d) => s + d.capacity_mw, 0)),
      ucMW:     Math.round(uc.reduce((s, d) => s + d.capacity_mw, 0)),
      avgUtil:  Math.round(active.reduce((s, d) => s + d.utilization_pct, 0) / (active.length || 1)),
      avgPUE:   active.length ? (active.reduce((s, d) => s + d.pue, 0) / active.length).toFixed(2) : '—',
      regions:  [...new Set(filteredDCs.map(d => d.region))].length,
    };
  }, [filteredDCs]);

  const panelOpen = showGlobalDashboard || !!selectedDC;
  const globeHeight = !panelOpen
    ? 'calc(100vh - 110px)'
    : globeVisible
      ? 'calc(50vh - 49px)'
      : '0px';

  const allDCsForSearch = uploadedDCs ?? GOOGLE_DC_MASTER;
  const searchResults = searchQuery.length > 1
    ? allDCsForSearch.filter(dc =>
        [dc.name, dc.market, dc.city, dc.country, dc.region]
          .some(f => f?.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 8)
    : [];

  return (
    <div style={{ background: '#0B1929', height: 'calc(100vh - 49px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        background: '#00338D', flexWrap: 'wrap',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ display: 'flex', gap: 1.5 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#4285F4' }} />
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#EA4335' }} />
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#FBBC05' }} />
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#34A853' }} />
          </div>
          <Globe size={14} color="#005EB8" />
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              {dataSourceName} &nbsp;·&nbsp; Global Cockpit
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginRight: 4 }}>
          <Search size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
            placeholder="Search datacenter…"
            style={{
              paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
              width: 188, background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8,
              color: '#fff', fontSize: 11, outline: 'none',
            }}
          />
          {searchFocused && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 60, width: 280,
              background: '#0F1E35', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
              {searchResults.map((dc, i) => (
                <button
                  key={dc.id}
                  onMouseDown={() => {
                    setSelectedDC(dc);
                    setShowGlobalDashboard(false);
                    setGlobeVisible(false);
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0 }}>{dc.name}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>
                    {[dc.market, dc.region, dc.status].filter(Boolean).join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Region Filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          {REGIONS.map(r => {
            const active = activeRegion === r;
            return (
              <button
                key={r}
                onClick={() => handleRegion(r)}
                style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${active ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}`,
                  background: active ? '#FFFFFF' : 'transparent',
                  color: active ? '#00338D' : 'rgba(255,255,255,0.85)',
                  transition: 'all 0.15s',
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Stat Chips */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip icon={<Server size={10} />} label={`${regionStats.total} DCs`} color="#FFFFFF"
            tooltip={`${regionStats.total} data centers across ${regionStats.regions} region${regionStats.regions !== 1 ? 's' : ''} — ${regionStats.active} active, ${regionStats.uc} under construction`}
            onDoubleClick={() => setDetailChip('dcs')} />
          <Chip icon={<CheckCircle2 size={10} color="#4ADE80" />} label={`${regionStats.active} Active`} color="#4ADE80"
            tooltip={`${regionStats.active} sites in live commercial operation — ${regionStats.activeMW.toLocaleString()} MW total capacity, avg ${regionStats.avgUtil}% utilisation`}
            onDoubleClick={() => setDetailChip('active')} />
          <Chip icon={<Construction size={10} color="#FCD34D" />} label={`${regionStats.uc} In Build`} color="#FCD34D"
            tooltip={`${regionStats.uc} sites under active construction — ${regionStats.ucMW.toLocaleString()} MW planned capacity in pipeline`}
            onDoubleClick={() => setDetailChip('build')} />
          <Chip icon={<AlertTriangle size={10} color="#F87171" />} label={`${regionStats.atRisk} At Risk`} color="#F87171"
            tooltip={`${regionStats.atRisk} sites with Medium or High risk flags — ${regionStats.highRisk} High, ${regionStats.medRisk} Medium`}
            onDoubleClick={() => setDetailChip('risk')} />
          <Chip icon={<Zap size={10} color="#38BDF8" />} label={`${regionStats.totalMW.toLocaleString()} MW`} color="#38BDF8"
            tooltip={`${regionStats.totalMW.toLocaleString()} MW total IT capacity — ${regionStats.activeMW.toLocaleString()} MW active, ${regionStats.ucMW.toLocaleString()} MW pipeline`}
            onDoubleClick={() => setDetailChip('mw')} />
        </div>

        {/* Global Dashboard Button */}
        <button
          onClick={handleGlobalDashboard}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: showGlobalDashboard ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.4)',
            color: '#FFFFFF',
            transition: 'all 0.15s',
          }}
        >
          <BarChart2 size={12} />
          Global Dashboard
        </button>

        {/* Ingest Data Button */}
        <button
          onClick={() => setIngestOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.4)',
            color: '#FFFFFF',
            transition: 'all 0.15s',
          }}
        >
          <Upload size={12} />
          Ingest Data
        </button>
      </div>

      {/* ── Globe ───────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: globeHeight, transition: 'height 0.3s ease', overflow: 'hidden', flexShrink: 0 }}>
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 40%, #060e1a 100%)',
          }}
        >
          <GlobeViewer
            datacenters={globeDCs}
            selectedId={selectedDC?.id ?? null}
            onMarkerClick={handleMarkerClick}
            getMarkerColor={getMarkerColor}
            showLink={false}
          />
        </div>

        {/* Legend overlay */}
        <div style={{
          position: 'absolute', bottom: 16, left: 20,
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          {[
            { color: '#00B0A0', label: 'Active' },
            { color: '#7C3AED', label: 'Under Construction' },
            { color: '#E87722', label: 'Medium Risk' },
            { color: '#C8102E', label: 'High Risk' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Click hint when nothing selected */}
        {!panelOpen && (
          <div style={{
            position: 'absolute', bottom: 16, right: 20,
            fontSize: 10, color: 'rgba(255,255,255,0.3)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Click a pin to open DC Command Center
          </div>
        )}

        <IntelligenceFeedPanel
          feed={intelligence}
          assetsById={assetsById}
          onRefresh={refreshIntelligence}
          refreshing={refreshing}
        />
      </div>

      {/* ── Dashboard Panel ──────────────────────────────────────────────────── */}
      {panelOpen && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Globe toggle bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 16px', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: '#081422',
          }}>
            <button
              onClick={() => setGlobeVisible(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: globeVisible ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.7)',
                transition: 'all 0.15s',
              }}
            >
              <Globe size={11} />
              {globeVisible ? 'Hide Globe' : 'Show Globe & Pins'}
            </button>
            {/* Pin legend — always visible in this bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 8 }}>
              {[
                { color: '#00B0A0', label: 'Active' },
                { color: '#7C3AED', label: 'Under Construction' },
                { color: '#E87722', label: 'Medium Risk' },
                { color: '#C8102E', label: 'High Risk' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {showGlobalDashboard ? (
              <GlobalDashboardPanel activeRegion={activeRegion} dataSource={dataSourceName} dcsOverride={uploadedDCs} />
            ) : selectedDC ? (
              <DCCommandCenter dc={selectedDC} onClose={() => setSelectedDC(null)} allDCs={uploadedDCs ?? GOOGLE_DC_MASTER} />
            ) : null}
          </div>
        </div>
      )}

      {warZoneModal && (
        <WarZoneModal
          region={warZoneModal.region}
          alerts={warZoneModal.alerts}
          onDismiss={() => setWarZoneModal(null)}
        />
      )}

      {detailChip && (
        <ChipDetailModal
          type={detailChip}
          filteredDCs={filteredDCs}
          regionStats={regionStats}
          onClose={() => setDetailChip(null)}
        />
      )}

      {ingestOpen && (
        <IngestDataModal
          onClose={() => setIngestOpen(false)}
          onImport={(rows, sourceName) => { setUploadedDCs(rows); setDataSourceName(sourceName || 'Custom Dataset'); setIngestOpen(false); }}
          hasUploadedData={!!uploadedDCs}
          onRemovePrevious={() => setUploadedDCs(null)}
        />
      )}
    </div>
  );
}

function Chip({ icon, label, color, tooltip, onDoubleClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: 'relative', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onDoubleClick}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 12px', borderRadius: 20,
        background: hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.2)',
        fontSize: 12, fontWeight: 600, color,
        transition: 'background 0.15s',
        userSelect: 'none',
      }}>
        {icon}
        {label}
      </div>
      {tooltip && hovered && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999, whiteSpace: 'nowrap',
          background: '#0d1e35', color: 'rgba(255,255,255,0.85)',
          fontSize: 10, padding: '6px 10px', borderRadius: 7,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {tooltip}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>Double-click for full details</div>
        </div>
      )}
    </div>
  );
}

function StatRow({ items }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{
          flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '10px 14px',
        }}>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: color || '#fff', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function ModalTable({ headers, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: '7px 8px', color: j === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)', fontFamily: j > 0 ? "'JetBrains Mono', monospace" : 'inherit' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChipDetailModal({ type, filteredDCs, regionStats, onClose }) {
  const active  = filteredDCs.filter(d => d.status === 'Active');
  const uc      = filteredDCs.filter(d => d.status === 'Under Construction');
  const atRisk  = filteredDCs.filter(d => d.risk_flag !== 'Low');
  const high    = filteredDCs.filter(d => d.risk_flag === 'High');
  const medium  = filteredDCs.filter(d => d.risk_flag === 'Medium');

  const REGIONS = ['North America', 'Europe', 'Asia', 'South America'];

  const getConstructionPct = (dc) => Math.min(95, Math.round(40 + dc.utilization_pct * 2.5));
  const getMonthsLeft = (dc) => {
    const pct = getConstructionPct(dc);
    return Math.max(3, Math.round(((100 - pct) / 100) * (dc.capacity_mw / 25)));
  };
  const getHandover = (dc) => {
    const h = new Date();
    h.setMonth(h.getMonth() + getMonthsLeft(dc));
    return h.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  const TITLES = {
    dcs:    'Portfolio Overview',
    active: 'Active Operations',
    build:  'Construction Pipeline',
    risk:   'Risk Intelligence',
    mw:     'Capacity Intelligence',
  };

  const ELABORATIONS = {
    dcs:    `${regionStats.total} data centers spanning ${regionStats.regions} region${regionStats.regions !== 1 ? 's' : ''} — ${regionStats.active} in live operation and ${regionStats.uc} actively under construction. This portfolio represents one of the largest hyperscale data center fleets globally. The ${Math.round((regionStats.uc / Math.max(1, regionStats.total)) * 100)}% under-construction rate signals aggressive capacity expansion to support accelerating AI and cloud workload demand.`,
    active: `${regionStats.active} sites in live commercial operation with ${regionStats.activeMW.toLocaleString()} MW of active IT capacity at an average utilisation of ${regionStats.avgUtil}% and PUE of ${regionStats.avgPUE}. ${regionStats.avgUtil > 80 ? 'High portfolio utilisation underscores the urgency of the construction pipeline to avoid regional capacity constraints.' : 'Healthy utilisation range — the active fleet is generating strong asset yield while maintaining headroom for demand spikes.'}`,
    build:  `${regionStats.uc} sites under active construction representing ${regionStats.ucMW.toLocaleString()} MW of committed forward capacity. Once commissioned, this pipeline will ${regionStats.uc > regionStats.active ? 'more than double' : 'significantly expand'} the active fleet. The under-construction portfolio represents billions in deployed capital not yet generating utilisation revenue — commissioning velocity is a key portfolio performance driver.`,
    risk:   `${regionStats.atRisk} site${regionStats.atRisk !== 1 ? 's' : ''} carry elevated risk flags — ${regionStats.highRisk} High (P1 escalation) and ${regionStats.medRisk} Medium (P2 monitoring). Risk flags are set by NOC operations teams based on alarm severity thresholds for power, cooling, connectivity, and physical security. High-risk sites require immediate remediation planning; Medium-risk sites are tracked in the weekly operations review.`,
    mw:     `${regionStats.totalMW.toLocaleString()} MW total nameplate IT capacity — ${regionStats.activeMW.toLocaleString()} MW active and ${regionStats.ucMW.toLocaleString()} MW in the construction pipeline. At scale, each additional gigawatt of IT capacity supports approximately ${Math.round(regionStats.totalMW / 10)} MW of AI training infrastructure. This capacity underpins Google's Gemini, Search, YouTube, and GCP AI Platform workloads.`,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998 }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999, width: '100%', maxWidth: 700,
        maxHeight: '75vh', overflowY: 'auto',
        background: '#0d1e35',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: 24,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif", margin: 0 }}>
              {TITLES[type]}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* DCS — Portfolio Overview */}
        {type === 'dcs' && (
          <>
            <StatRow items={[
              { label: 'Total DCs', value: regionStats.total, color: '#60A5FA' },
              { label: 'Active', value: regionStats.active, color: '#00B0A0' },
              { label: 'Under Construction', value: regionStats.uc, color: '#E87722' },
              { label: 'At Risk', value: regionStats.atRisk, color: regionStats.highRisk > 0 ? '#C8102E' : '#E87722' },
            ]} />
            <ModalTable
              headers={['Region', 'Total', 'Active', 'UC', 'MW', 'Countries']}
              rows={REGIONS.map(r => {
                const rDCs = filteredDCs.filter(d => d.region === r);
                return [
                  r,
                  rDCs.length,
                  rDCs.filter(d => d.status === 'Active').length,
                  rDCs.filter(d => d.status === 'Under Construction').length,
                  Math.round(rDCs.reduce((s, d) => s + d.capacity_mw, 0)).toLocaleString(),
                  [...new Set(rDCs.map(d => d.country))].length,
                ];
              }).filter(r => r[1] > 0)}
            />
          </>
        )}

        {/* ACTIVE — Active Operations */}
        {type === 'active' && (
          <>
            <StatRow items={[
              { label: 'Active DCs', value: regionStats.active, color: '#00B0A0' },
              { label: 'Active MW', value: `${regionStats.activeMW.toLocaleString()} MW`, color: '#06B6D4' },
              { label: 'Avg Utilization', value: `${regionStats.avgUtil}%`, color: regionStats.avgUtil > 85 ? '#C8102E' : regionStats.avgUtil > 70 ? '#E87722' : '#00B0A0' },
              { label: 'Avg PUE', value: regionStats.avgPUE, color: '#60A5FA' },
            ]} />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top 5 by Utilisation</p>
            <ModalTable
              headers={['Site', 'Market', 'MW', 'Util %', 'Risk']}
              rows={[...active].sort((a, b) => b.utilization_pct - a.utilization_pct).slice(0, 5).map(d => [
                d.name, d.market, `${d.capacity_mw} MW`, `${d.utilization_pct}%`,
                d.risk_flag,
              ])}
            />
          </>
        )}

        {/* BUILD — Construction Pipeline */}
        {type === 'build' && (
          <>
            <StatRow items={[
              { label: 'UC Sites', value: regionStats.uc, color: '#E87722' },
              { label: 'Pipeline MW', value: `${regionStats.ucMW.toLocaleString()} MW`, color: '#06B6D4' },
              { label: 'Avg Completion', value: `${Math.round(uc.reduce((s, d) => s + getConstructionPct(d), 0) / (uc.length || 1))}%`, color: '#60A5FA' },
              { label: 'Avg Months Left', value: `${Math.round(uc.reduce((s, d) => s + getMonthsLeft(d), 0) / (uc.length || 1))} mo`, color: '#9CA3AF' },
            ]} />
            <ModalTable
              headers={['Site', 'Region', 'MW', 'Completion', 'Est. Handover']}
              rows={[...uc].sort((a, b) => getConstructionPct(b) - getConstructionPct(a)).map(d => [
                d.name, d.region, `${d.capacity_mw} MW`,
                `${getConstructionPct(d)}%`, getHandover(d),
              ])}
            />
          </>
        )}

        {/* RISK — Risk Intelligence */}
        {type === 'risk' && (
          <>
            <StatRow items={[
              { label: 'High Risk', value: regionStats.highRisk, color: '#C8102E' },
              { label: 'Medium Risk', value: regionStats.medRisk, color: '#E87722' },
              { label: 'Total At Risk', value: regionStats.atRisk, color: '#F59E0B' },
              { label: 'Low Risk', value: regionStats.total - regionStats.atRisk, color: '#00B0A0' },
            ]} />
            {high.length > 0 && (
              <>
                <p style={{ fontSize: 10, color: '#C8102E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>High Risk Sites</p>
                <ModalTable
                  headers={['Site', 'Market', 'Crit', 'High', 'Med']}
                  rows={high.map(d => [d.name, d.market, d.alarm_critical, d.alarm_high, d.alarm_medium])}
                />
              </>
            )}
            {medium.length > 0 && (
              <>
                <p style={{ fontSize: 10, color: '#E87722', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Medium Risk Sites</p>
                <ModalTable
                  headers={['Site', 'Market', 'High Alarms', 'Med Alarms']}
                  rows={medium.map(d => [d.name, d.market, d.alarm_high, d.alarm_medium])}
                />
              </>
            )}
            {atRisk.length === 0 && (
              <p style={{ color: '#00B0A0', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No at-risk sites in the current view</p>
            )}
          </>
        )}

        {/* MW — Capacity Intelligence */}
        {type === 'mw' && (
          <>
            <StatRow items={[
              { label: 'Total MW', value: `${regionStats.totalMW.toLocaleString()} MW`, color: '#06B6D4' },
              { label: 'Active MW', value: `${regionStats.activeMW.toLocaleString()} MW`, color: '#00B0A0' },
              { label: 'Pipeline MW', value: `${regionStats.ucMW.toLocaleString()} MW`, color: '#E87722' },
              { label: 'Avg Utilization', value: `${regionStats.avgUtil}%`, color: '#60A5FA' },
            ]} />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Capacity by Region</p>
            <ModalTable
              headers={['Region', 'Active MW', 'Pipeline MW', 'Total MW', 'Avg Util %']}
              rows={REGIONS.map(r => {
                const rActive = filteredDCs.filter(d => d.region === r && d.status === 'Active');
                const rUC     = filteredDCs.filter(d => d.region === r && d.status === 'Under Construction');
                const rAll    = filteredDCs.filter(d => d.region === r);
                return [
                  r,
                  Math.round(rActive.reduce((s, d) => s + d.capacity_mw, 0)).toLocaleString(),
                  Math.round(rUC.reduce((s, d) => s + d.capacity_mw, 0)).toLocaleString(),
                  Math.round(rAll.reduce((s, d) => s + d.capacity_mw, 0)).toLocaleString(),
                  rActive.length ? `${Math.round(rActive.reduce((s, d) => s + d.utilization_pct, 0) / rActive.length)}%` : '—',
                ];
              }).filter(r => r[3] !== '0')}
            />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Top 5 by Capacity</p>
            <ModalTable
              headers={['Site', 'Region', 'MW', 'Utilization', 'Tier']}
              rows={[...filteredDCs].sort((a, b) => b.capacity_mw - a.capacity_mw).slice(0, 5).map(d => [
                d.name, d.region, `${d.capacity_mw} MW`, `${d.utilization_pct}%`, `Tier ${d.tier}`,
              ])}
            />
          </>
        )}

        {/* AI Elaboration */}
        <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 10 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65, margin: 0 }}>{ELABORATIONS[type]}</p>
        </div>
      </div>
    </>
  );
}

// Maps raw Excel/CSV header strings to internal DC field names
const FIELD_MAP = {
  // ID
  id: 'id', dc_id: 'id', site_id: 'id',
  // Name / operator
  name: 'name', dc_name: 'name', site_name: 'name',
  operator: 'operator',
  // Location
  lat: 'lat', latitude: 'lat',
  lng: 'lng', lon: 'lng', longitude: 'lng',
  region: 'region', country: 'country', city: 'city', address: 'address', market: 'market',
  // Status & tier
  status: 'status', tier: 'tier',
  // Capacity (IT Capacity (MW) → normalises to it_capacity)
  capacity_mw: 'capacity_mw', capacity: 'capacity_mw',
  it_capacity: 'capacity_mw', it_capacity_mw: 'capacity_mw',
  // Utilization
  utilization_pct: 'utilization_pct', utilization: 'utilization_pct', util_pct: 'utilization_pct',
  // PUE
  pue: 'pue',
  // Renewable (Renewable Energy (%) → renewable_energy)
  renewable_pct: 'renewable_pct', renewable: 'renewable_pct',
  renewable_energy: 'renewable_pct', renewable_energy_pct: 'renewable_pct',
  // Carbon (Carbon Emissions (MT/yr) → carbon_emissions)
  carbon_mt: 'carbon_mt', carbon: 'carbon_mt',
  carbon_mt_yr: 'carbon_mt', carbon_emissions: 'carbon_mt',
  // Carbon intensity
  carbon_intensity: 'carbon_intensity',
  // Risk
  risk_flag: 'risk_flag', risk: 'risk_flag',
  // Alarms — map both old names and verbose Excel column names
  alarm_critical: 'alarm_critical', critical_alarms: 'alarm_critical',
  alarm_high: 'alarm_high',    high_alarms: 'alarm_high',
  alarm_medium: 'alarm_medium', alarm_med: 'alarm_medium', medium_alarms: 'alarm_medium',
  alarm_low: 'alarm_low',      low_alarms: 'alarm_low',
  // Assets — GlobalDashboardPanel reads asset_racks / asset_servers / asset_gpus
  racks: 'asset_racks', asset_racks: 'asset_racks',
  servers: 'asset_servers', asset_servers: 'asset_servers',
  gpus: 'asset_gpus', asset_gpus: 'asset_gpus',
};

function normalizeHeader(h) {
  return h.toLowerCase().trim()
    .replace(/\s*\(.*?\)\s*/g, '')   // strip "(MW)", "(%)", "(MT/yr)" etc.
    .replace(/%/g, '_pct')
    .replace(/[\s\-\/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')             // collapse double-underscores
    .replace(/^_|_$/g, '');          // strip leading/trailing underscores
}

function mapRow(headers, rawRow) {
  const obj = {};
  headers.forEach((h, i) => {
    if (/\(original\)/i.test(h)) return; // skip raw/original duplicate columns
    const norm = normalizeHeader(h);
    const key = FIELD_MAP[norm] ?? norm;
    let val = rawRow[i] ?? '';
    const numFields = [
      'lat','lng','capacity_mw','utilization_pct','pue',
      'renewable_pct','carbon_mt','carbon_intensity',
      'alarm_critical','alarm_high','alarm_medium','alarm_low',
      'asset_racks','asset_servers','asset_gpus',
    ];
    if (numFields.includes(key)) val = parseFloat(val) || 0;
    // Normalise "Tier IV" → "IV"; anything not a standard level → empty string
    if (key === 'tier' && typeof val === 'string') {
      const t = val.replace(/^tier\s+/i, '').trim().toUpperCase();
      val = ['I', 'II', 'III', 'IV'].includes(t) ? t : '';
    }
    obj[key] = val;
  });
  if (!obj.id) obj.id = `UPL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return obj;
}

function IngestDataModal({ onClose, onImport, hasUploadedData, onRemovePrevious }) {
  const [dragging, setDragging]       = useState(false);
  const [file, setFile]               = useState(null);
  const [status, setStatus]           = useState('idle');
  const [preview, setPreview]         = useState(null);
  const [allRows, setAllRows]         = useState(null);
  const [sourceName, setSourceName]   = useState('');
  const fileRef = useRef(null);

  async function processFile(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) { setStatus('error'); return; }
    setFile(f);
    setStatus('parsing');
    try {
      let headers = [], rawRows = [];
      // Find the first row with at least 3 non-empty cells — that's the real header row,
      // even when the file starts with title/description rows (like the non-google dataset).
      function detectHeaderIdx(rows) {
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          if (rows[i].filter(c => String(c).trim() !== '').length >= 3) return i;
        }
        return 0;
      }

      if (ext === 'csv') {
        const text = await f.text();
        const allLines = text.split('\n').map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
        const hIdx = detectHeaderIdx(allLines);
        headers = allLines[hIdx];
        rawRows = allLines.slice(hIdx + 1).filter(r => r.some(c => c !== ''));
      } else {
        const XLSX = await import('xlsx');
        const buf  = await f.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const hIdx = detectHeaderIdx(data.map(r => r.map(String)));
        headers  = data[hIdx] ? data[hIdx].map(String) : [];
        rawRows  = data.slice(hIdx + 1).map(r => headers.map((_, i) => String(r[i] ?? '')));
      }
      const mapped = rawRows.filter(r => r.some(c => c !== '')).map(r => mapRow(headers, r));
      setAllRows(mapped);
      setPreview({ headers: headers.slice(0, 8), rows: rawRows.slice(0, 5).map(r => r.slice(0, 8)), totalRows: mapped.length });
      setStatus('done');
    } catch { setStatus('error'); }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) processFile(f);
  }

  function reset() { setFile(null); setStatus('idle'); setPreview(null); setAllRows(null); }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9998 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999, width: '100%', maxWidth: 620, maxHeight: '80vh', overflowY: 'auto',
        background: '#0d1e35', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={16} color="#7C3AED" />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif", margin: 0 }}>Ingest Data</h2>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>Upload Excel or CSV dataset to the Global Cockpit</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
        </div>

        {/* Data Source Name Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Data Source Name
          </label>
          <input
            type="text"
            value={sourceName}
            onChange={e => setSourceName(e.target.value)}
            placeholder="e.g. Google DC, Microsoft Azure, Equinix…"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {/* Quick-select chips */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Google DC', colors: ['#4285F4','#EA4335','#FBBC05','#34A853'] },
              { label: 'Microsoft Azure', colors: null },
              { label: 'AWS', colors: null },
              { label: 'Equinix', colors: null },
            ].map(chip => (
              <button
                key={chip.label}
                onClick={() => setSourceName(chip.label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  background: sourceName === chip.label ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${sourceName === chip.label ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: sourceName === chip.label ? '#A78BFA' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.15s',
                }}
              >
                {chip.colors && (
                  <span style={{ display: 'flex', gap: 1.5 }}>
                    {chip.colors.map((c, i) => <span key={i} style={{ width: 4, height: 10, borderRadius: 2, background: c, display: 'block' }} />)}
                  </span>
                )}
                {chip.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '6px 0 0' }}>
            Select <span style={{ color: '#4285F4', fontWeight: 600 }}>Google DC</span> to restore Google branding · Otherwise this label replaces "Google DC" across the cockpit
          </p>
        </div>

        {/* Remove Previous Dataset banner */}
        {hasUploadedData && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#F87171" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>A custom dataset is currently active in the cockpit.</span>
            </div>
            <button
              onClick={() => { onRemovePrevious(); onClose(); }}
              style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#F87171', whiteSpace: 'nowrap' }}
            >
              Remove Previous Dataset
            </button>
          </div>
        )}

        {/* Drop Zone */}
        {status !== 'done' && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#7C3AED' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s', marginBottom: 16,
            }}
          >
            <Upload size={28} color={dragging ? '#7C3AED' : 'rgba(255,255,255,0.25)'} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: dragging ? '#7C3AED' : 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>
              {status === 'parsing' ? 'Parsing file…' : 'Drop your file here or click to browse'}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Supports .xlsx, .xls, .csv</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => processFile(e.target.files?.[0])} />
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#C8102E', margin: 0 }}>Unsupported file type. Please upload a .xlsx, .xls, or .csv file.</p>
          </div>
        )}

        {status === 'done' && preview && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: 'rgba(0,163,108,0.08)', border: '1px solid rgba(0,163,108,0.2)', borderRadius: 10 }}>
              <CheckCircle size={16} color="#00B0A0" />
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#00B0A0', margin: 0 }}>{file.name}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>{preview.totalRows.toLocaleString()} rows · {preview.headers.length} columns detected</p>
              </div>
              <button onClick={reset} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>Change file</button>
            </div>

            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Preview — first 5 rows</p>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 400 }}>
                <thead>
                  <tr>{preview.headers.map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '6px 8px', color: 'rgba(255,255,255,0.45)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h || `Col ${i+1}`}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {row.map((cell, j) => <td key={j} style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
              <button
                onClick={() => onImport(allRows, sourceName.trim())}
                style={{ padding: '8px 20px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#7C3AED', border: '1px solid rgba(124,58,237,0.6)', color: '#fff' }}
              >
                Confirm Import — {preview.totalRows} DCs
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
