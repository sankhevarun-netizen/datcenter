'use client';
// A presentation cockpit for one client. Every value comes from the client's
// data file (data/cockpit/*); nothing is fetched and nothing is random. Tabs
// switch on the client and record themselves in the URL hash, so moving
// around the cockpit makes no requests.
import { useEffect, useState } from 'react';
import CockpitShell, { NAV } from './CockpitShell';
import Hero from './Hero';
import KpiStrip from './KpiStrip';
import MarketPanel from './MarketPanel';
import SegmentPanel from './SegmentPanel';
import GeographyPanel from './GeographyPanel';
import InsightsPanel from './InsightsPanel';
import OpportunitiesTable from './OpportunitiesTable';
import RoadmapPanel from './RoadmapPanel';
import MarketAnalysisTab from './tabs/MarketAnalysisTab';
import OpportunitiesTab from './tabs/OpportunitiesTab';
import CompetitiveTab from './tabs/CompetitiveTab';
import RoadmapTab from './tabs/RoadmapTab';
import ReportsTab from './tabs/ReportsTab';
import { ENTER } from './tokens';

const TABS = { market: MarketAnalysisTab, opportunities: OpportunitiesTab, competitive: CompetitiveTab, roadmap: RoadmapTab, reports: ReportsTab };
const isTab = (id) => NAV.some((n) => n.id === id);

function Overview({ data, go }) {
  const r1 = (i) => ENTER.row1Start + i * ENTER.row1Step;
  const r2 = (i) => ENTER.row2Start + i * ENTER.row2Step;
  return (
    <>
      <KpiStrip kpis={data.kpis} />
      <div className="flex-1 min-h-0 grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        <div className="grid gap-4 min-w-0 min-h-0" style={{ gridTemplateRows: 'minmax(300px, 1.04fr) minmax(300px, 1fr)' }}>
          <div className="grid gap-4 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.1fr) minmax(0, 0.9fr)' }}>
            <MarketPanel market={data.market} delay={r1(0)} onAction={() => go('market')} />
            <SegmentPanel segments={data.segments} delay={r1(1)} onAction={() => go('market')} />
            <GeographyPanel geography={data.geography} delay={r1(2)} />
          </div>
          <div className="grid gap-4 min-h-0" style={{ gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)' }}>
            <OpportunitiesTable opportunities={data.opportunities} delay={r2(0)} onAction={() => go('opportunities')} />
            <RoadmapPanel roadmap={data.roadmap} delay={r2(1)} onAction={() => go('roadmap')} />
          </div>
        </div>
        <InsightsPanel insights={data.insights} delay={r1(3)} onAction={() => go('competitive')} />
      </div>
    </>
  );
}

export default function CockpitView({ data, heroImage = null }) {
  const [tab, setTab] = useState('overview');

  // Open the tab named in the hash (#market etc.); follow back/forward.
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); setTab(isTab(h) ? h : 'overview'); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const go = (id) => {
    setTab(id);
    window.history.replaceState(null, '', id === 'overview' ? window.location.pathname : `#${id}`);
  };

  const Tab = TABS[tab];
  const nav = NAV.find((n) => n.id === tab);
  return (
    <CockpitShell client={data.client} active={tab} onNavigate={go}>
      <div className="h-full flex flex-col">
        <Hero client={data.client} image={heroImage} tab={Tab ? { title: nav.label, lede: data.tabLedes[tab] } : null} />
        <div key={tab} className="flex-1 flex flex-col gap-4 min-h-0" style={{ padding: 20 }}>
          {Tab ? <div className="flex-1 min-h-0"><Tab data={data} delay={0.05} /></div> : <Overview data={data} go={go} />}
        </div>
      </div>
    </CockpitShell>
  );
}
