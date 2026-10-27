'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useGlobalInfrastructure } from '../hooks/useGlobalInfrastructure';
import { useFacilityFilters } from '../hooks/useFacilityFilters';
import { useFacilitySearch } from '../hooks/useFacilitySearch';
import { useEsgPortfolio } from '../hooks/useEsgPortfolio';
import { useRiskPortfolio } from '../hooks/useRiskPortfolio';
import { useNewsPortfolio } from '../hooks/useNewsPortfolio';
import { distinctValues } from '../utils/facilityFilters';
import { buildRegionRollups } from '../utils/portfolioAnalytics';
import { buildRegionMarkers } from '../utils/regions';
import GIIHeader from '../components/GIIHeader';
import SourceSwitch from '../components/SourceSwitch';
import PortfolioKPIs from '../components/PortfolioKPIs';
import AnalyticsPanel from '../components/AnalyticsPanel';
import SustainabilityDashboard from '../components/SustainabilityDashboard';
import GlobalRiskPanel from '../components/GlobalRiskPanel';
import AIExecutiveBriefing from '../components/AIExecutiveBriefing';
import GlobalNewsPanel from '../components/GlobalNewsPanel';
import IntelligencePanel from '../components/IntelligencePanel';
import IntelligenceDrawer from '../components/IntelligenceDrawer';
import MapToolbar from '../components/map/MapToolbar';
import MapLegend from '../components/map/MapLegend';
import { SkeletonBlock } from '../components/Skeleton';

const WorldMap = dynamic(() => import('../components/map/WorldMap'), {
  ssr: false,
  loading: () => <SkeletonBlock height="h-full" width="w-full" className="rounded-2xl" />,
});

// Each KPI maps to the filter dimension it best represents, so "clicking a
// KPI filters the map" has one clear, consistent meaning per card rather
// than ad hoc behavior. KPIs with no single corresponding filter dimension
// (Countries, Regions, GPU Clusters) clear filters back to the full view.
const KPI_FILTER_ACTIONS = {
  capacity: { capacityBand: 'high' },
  servers: { capacityBand: 'high' },
  utilization: null,
  pue: null,
  renewable: { renewableBand: 'high' },
  critical: { health: 'critical' },
  maintenance: { underMaintenance: 'Yes' },
  carbon: { renewableBand: 'low' },
};

function SectionLabel({ children }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">{children}</p>;
}

export default function GlobalInfrastructurePage({ showToast }) {
  const router = useRouter();
  const { facilities, kpis, regionRollups, insights, loading } = useGlobalInfrastructure();
  const { filters, setFilter, setFilters, resetFilters, filtered, activeCount } = useFacilityFilters(facilities);
  const { query, setQuery, results } = useFacilitySearch(facilities);

  const [selectedFacility, setSelectedFacility] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [mapMode, setMapMode] = useState('dark');
  const [hoveredFacilityId, setHoveredFacilityId] = useState(null);
  const [activeKpiId, setActiveKpiId] = useState(null);
  const [transitioningRegion, setTransitioningRegion] = useState(null);

  const { trendByDc, prevByDc, loading: esgLoading } = useEsgPortfolio(filtered);
  const { risksByDc, loading: riskLoading } = useRiskPortfolio(filtered);
  const { news, loading: newsLoading } = useNewsPortfolio(filtered);

  const countries = distinctValues(facilities, 'country');
  const filteredRegionRollups = useMemo(() => buildRegionRollups(filtered), [filtered]);
  const regionMarkers = useMemo(() => buildRegionMarkers(filtered), [filtered]);
  const highlightedFacilityIds = hoveredFacilityId ? [hoveredFacilityId] : [];
  const dimmedFacilityIds = transitioningRegion
    ? filtered.filter(f => f.region !== transitioningRegion).map(f => f.id)
    : [];

  function handleMarkerClick(facility) {
    setSelectedFacility(facility);
  }

  function handleSearchSelect(facility) {
    setQuery('');
    setSelectedFacility(facility);
    setFlyToTarget({ latitude: facility.latitude, longitude: facility.longitude, zoom: 8, key: Date.now() });
  }

  function handleSelectNews(item) {
    setSelectedFacility(item.facility);
    setFlyToTarget({ latitude: item.facility.latitude, longitude: item.facility.longitude, zoom: 8, key: Date.now() });
  }

  function handleKpiSelect(kpi) {
    if (activeKpiId === kpi.id) {
      setActiveKpiId(null);
      resetFilters();
      return;
    }
    setActiveKpiId(kpi.id);
    const action = KPI_FILTER_ACTIONS[kpi.id];
    if (action) setFilters(prev => ({ ...prev, ...action }));
    else resetFilters();
  }

  function handleOpenFacility() {
    showToast?.('Facility detail pages are coming in a future release');
  }

  // Zoom-and-dim the global map toward the clicked region, then hand off to
  // the dedicated regional route — gives the click a "zooming deeper into
  // the same app" feel rather than an abrupt page swap.
  function handleRegionMarkerClick(region) {
    const marker = regionMarkers.find(rm => rm.region === region);
    if (!marker) return;
    setTransitioningRegion(region);
    setFlyToTarget({ latitude: marker.latitude, longitude: marker.longitude, zoom: 4, key: Date.now() });
    setTimeout(() => router.push(`/global-infrastructure/${region}`), 850);
  }

  return (
    <div className="p-4">
      <GIIHeader actions={<SourceSwitch active="global" />} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-4">
        <SectionLabel>Executive KPI Summary</SectionLabel>
        <PortfolioKPIs kpis={kpis} loading={loading} onSelect={handleKpiSelect} activeKpiId={activeKpiId} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
        <MapToolbar
          searchQuery={query}
          onSearchChange={setQuery}
          searchResults={results}
          onSelectResult={handleSearchSelect}
          filters={filters}
          onFilterChange={setFilter}
          onResetFilters={() => { resetFilters(); setActiveKpiId(null); }}
          activeFilterCount={activeCount}
          countries={countries}
          mode={mapMode}
          onModeChange={setMapMode}
        />

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-[68%] relative h-[420px] sm:h-[480px] lg:h-[640px]">
            {loading ? (
              <SkeletonBlock height="h-full" width="w-full" className="rounded-2xl" />
            ) : (
              <>
                <WorldMap
                  facilities={filtered}
                  selectedFacilityId={selectedFacility?.id}
                  highlightedFacilityIds={highlightedFacilityIds}
                  dimmedFacilityIds={dimmedFacilityIds}
                  regionMarkers={regionMarkers}
                  onMarkerClick={handleMarkerClick}
                  onRegionMarkerClick={handleRegionMarkerClick}
                  flyToTarget={flyToTarget}
                  mode={mapMode}
                />
                <MapLegend mode={mapMode} />
              </>
            )}
          </div>

          <div className="w-full lg:w-[32%]">
            <IntelligencePanel
              facilities={filtered}
              regionRollups={filteredRegionRollups}
              insights={insights}
              selectedFacility={selectedFacility}
              loading={loading}
            />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6">
        <SectionLabel>Portfolio Analytics</SectionLabel>
        <AnalyticsPanel
          facilities={filtered}
          regionRollups={filteredRegionRollups}
          loading={loading}
          onHoverFacility={setHoveredFacilityId}
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
        <SectionLabel>Sustainability &amp; ESG</SectionLabel>
        <SustainabilityDashboard facilities={filtered} trendByDc={trendByDc} loading={loading || esgLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-6">
        <SectionLabel>Global Risk</SectionLabel>
        <GlobalRiskPanel facilities={filtered} risksByDc={risksByDc} loading={loading || riskLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6">
        <SectionLabel>AI Executive Briefing</SectionLabel>
        <AIExecutiveBriefing facilities={filtered} prevByDc={prevByDc} loading={loading || esgLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 mb-2">
        <SectionLabel>Global News</SectionLabel>
        <GlobalNewsPanel news={news} loading={loading || newsLoading} onSelectNews={handleSelectNews} />
      </motion.div>

      <IntelligenceDrawer
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        onOpenFacility={handleOpenFacility}
      />
    </div>
  );
}
