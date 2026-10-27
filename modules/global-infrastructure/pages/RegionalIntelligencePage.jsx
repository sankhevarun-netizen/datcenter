'use client';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useGlobalInfrastructure } from '../hooks/useGlobalInfrastructure';
import { useFacilityFilters } from '../hooks/useFacilityFilters';
import { useFacilitySearch } from '../hooks/useFacilitySearch';
import { useEsgPortfolio } from '../hooks/useEsgPortfolio';
import { useRiskPortfolio } from '../hooks/useRiskPortfolio';
import { useNewsPortfolio } from '../hooks/useNewsPortfolio';
import { useWeatherPortfolio } from '../hooks/useWeatherPortfolio';
import { useIncidentPortfolio } from '../hooks/useIncidentPortfolio';
import { distinctValues } from '../utils/facilityFilters';
import { buildRegionalKpis } from '../utils/portfolioAnalytics';
import { buildRegionalBriefing } from '../utils/executiveBriefing';
import { REGION_LABELS } from '../utils/regions';
import GIIHeader from '../components/GIIHeader';
import PortfolioKPIs from '../components/PortfolioKPIs';
import FacilityCardGrid from '../components/FacilityCardGrid';
import RegionalAnalyticsPanel from '../components/RegionalAnalyticsPanel';
import SustainabilityDashboard from '../components/SustainabilityDashboard';
import GlobalRiskPanel from '../components/GlobalRiskPanel';
import RegionalWeatherPanel from '../components/RegionalWeatherPanel';
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

function SectionLabel({ children }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">{children}</p>;
}

export default function RegionalIntelligencePage({ region, showToast }) {
  const regionLabel = REGION_LABELS[region] ?? region;
  const { facilities: allFacilities, regionRollups, loading } = useGlobalInfrastructure();
  const regionFacilities = useMemo(() => allFacilities.filter(f => f.region === region), [allFacilities, region]);

  const { filters, setFilter, resetFilters, filtered, activeCount } = useFacilityFilters(regionFacilities);
  const { query, setQuery, results } = useFacilitySearch(regionFacilities);

  const [selectedFacility, setSelectedFacility] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [mapMode, setMapMode] = useState('dark');
  const [hoveredFacilityId, setHoveredFacilityId] = useState(null);

  const { trendByDc, loading: esgLoading } = useEsgPortfolio(filtered);
  const { risksByDc, loading: riskLoading } = useRiskPortfolio(filtered);
  const { news, loading: newsLoading } = useNewsPortfolio(filtered);
  const { weatherByDc, loading: weatherLoading } = useWeatherPortfolio(filtered);
  const { incidentsByDc, loading: incidentLoading } = useIncidentPortfolio(filtered);

  const countries = distinctValues(regionFacilities, 'country');
  const highlightedFacilityIds = hoveredFacilityId ? [hoveredFacilityId] : [];

  const regionKpis = useMemo(() => buildRegionalKpis(filtered), [filtered]);
  const criticalIncidentCount = useMemo(
    () => Object.values(incidentsByDc).flat().filter(i => i.severity === 'Major' && i.status === 'Monitoring').length,
    [incidentsByDc]
  );
  const briefingLines = useMemo(
    () => buildRegionalBriefing(region, filtered, criticalIncidentCount),
    [region, filtered, criticalIncidentCount]
  );

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

  function handleOpenFacility() {
    showToast?.('Facility detail pages are coming in a future release');
  }

  const isLoading = loading || regionFacilities.length === 0;

  return (
    <div className="p-4">
      <GIIHeader
        title={`${regionLabel} Regional Intelligence`}
        subtitle={`Facility-level intelligence for ${regionLabel} — ${regionFacilities.length} data centers across ${countries.length} countries`}
        breadcrumb={[
          { label: 'Global Infrastructure', href: '/global-infrastructure' },
          { label: regionLabel },
        ]}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-4">
        <SectionLabel>Regional KPI Summary</SectionLabel>
        <PortfolioKPIs kpis={regionKpis} loading={isLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
        <MapToolbar
          searchQuery={query}
          onSearchChange={setQuery}
          searchResults={results}
          onSelectResult={handleSearchSelect}
          filters={filters}
          onFilterChange={setFilter}
          onResetFilters={resetFilters}
          activeFilterCount={activeCount}
          countries={countries}
          mode={mapMode}
          onModeChange={setMapMode}
          hideRegionFilter
        />

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-[68%] relative h-[420px] sm:h-[480px] lg:h-[560px]">
            {isLoading ? (
              <SkeletonBlock height="h-full" width="w-full" className="rounded-2xl" />
            ) : (
              <>
                <WorldMap
                  facilities={filtered}
                  selectedFacilityId={selectedFacility?.id}
                  highlightedFacilityIds={highlightedFacilityIds}
                  onMarkerClick={handleMarkerClick}
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
              regionRollups={regionRollups.filter(r => r.region === region)}
              insights={[]}
              selectedFacility={selectedFacility}
              loading={isLoading}
            />
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6">
        <SectionLabel>Data Center Cards</SectionLabel>
        <FacilityCardGrid
          facilities={filtered}
          loading={isLoading}
          onSelectFacility={setSelectedFacility}
          onOpenFacility={handleOpenFacility}
          onHoverFacility={setHoveredFacilityId}
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
        <SectionLabel>Regional Analytics</SectionLabel>
        <RegionalAnalyticsPanel facilities={filtered} loading={isLoading} onHoverFacility={setHoveredFacilityId} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-6">
        <SectionLabel>Regional ESG &amp; Sustainability</SectionLabel>
        <SustainabilityDashboard facilities={filtered} trendByDc={trendByDc} loading={isLoading || esgLoading} showLeaders />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6">
        <SectionLabel>Regional Risk</SectionLabel>
        <GlobalRiskPanel facilities={filtered} risksByDc={risksByDc} loading={isLoading || riskLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="mt-6">
        <SectionLabel>Regional Weather</SectionLabel>
        <RegionalWeatherPanel facilities={filtered} weatherByDc={weatherByDc} loading={isLoading || weatherLoading} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6">
        <SectionLabel>Regional AI Summary</SectionLabel>
        <AIExecutiveBriefing
          facilities={filtered}
          loading={isLoading || incidentLoading}
          lines={briefingLines}
          title={`${regionLabel} AI Summary`}
          subtitle="Generated from this region's current dataset"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-6 mb-2">
        <SectionLabel>Regional News</SectionLabel>
        <GlobalNewsPanel
          news={news}
          loading={isLoading || newsLoading}
          onSelectNews={handleSelectNews}
          groups={[{ region, label: regionLabel }]}
        />
      </motion.div>

      <IntelligenceDrawer
        facility={selectedFacility}
        onClose={() => setSelectedFacility(null)}
        onOpenFacility={handleOpenFacility}
      />
    </div>
  );
}
