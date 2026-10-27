'use client';
import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { GOOGLE_DC_MASTER, DC_STATS } from '@/data/googleDCMasterData';

const C = {
  bg:     '#F0F2F5',
  card:   '#FFFFFF',
  border: '#D8DCE3',
  blue:   '#005EB8',
  green:  '#00B0A0',
  amber:  '#E87722',
  red:    '#C8102E',
  cyan:   '#06B6D4',
  purple: '#7C3AED',
  text:   '#1A1F36',
  muted:  '#9CA3AF',
  label:  '#4B5563',
};

const REGION_COLORS = { 'North America': '#005EB8', Europe: '#00B0A0', Asia: '#E87722', 'South America': '#7C3AED' };

function KPIModal({ label, value, sub, color, elaboration, impact, onClose }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.6)', zIndex: 9998, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999, width: 560, maxHeight: '88vh', overflowY: 'auto',
        background: '#FFFFFF', borderRadius: 20, padding: '36px 40px',
        boxShadow: '0 40px 100px rgba(0,0,0,0.3)',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 20, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, fontSize: 14, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

        {/* Hero */}
        <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>{label}</p>
        {value != null && <p style={{ fontSize: 52, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, margin: '0 0 6px' }}>{value}</p>}
        {sub && <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{sub}</p>}

        <div style={{ borderTop: '1px solid #D8DCE3', margin: '28px 0' }} />

        {/* AI Intelligence */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: color + '18', border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color }}>✦</div>
            <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.09em' }}>AI Intelligence</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', margin: 0 }}>{elaboration}</p>
        </div>

        {/* Impact */}
        {impact && impact.length > 0 && (
          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '20px 22px', border: '1px solid #E8EDF3' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 16px' }}>Impact & Recommended Actions</p>
            {impact.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < impact.length - 1 ? 14 : 0 }}>
                <span style={{ color, fontSize: 18, lineHeight: 1, flexShrink: 0, fontWeight: 700, marginTop: 1 }}>›</span>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: '#374151', margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </>,
    document.body
  );
}

// Returns {top, left} for a fixed-position tooltip, flipping above the element
// if there isn't enough space below the viewport fold.
function calcTooltipPos(rect, tooltipW = 280) {
  const GAP = 8;
  const MAX_H = 220;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - tooltipW - 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow < MAX_H + GAP
    ? Math.max(8, rect.top - MAX_H - GAP)
    : rect.bottom + GAP;
  return { top, left };
}

const TOOLTIP_STYLE = {
  position: 'fixed', zIndex: 9990, width: 270,
  background: '#00338D', color: '#fff',
  borderRadius: 10, padding: '12px 14px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)',
  maxHeight: 220, overflowY: 'auto',
  pointerEvents: 'none',
};

function KPI({ label, value, sub, color = C.blue, elaboration = null, impact = null }) {
  const [shown, setShown] = useState(false);
  const [modal, setModal] = useState(false);
  const [pos, setPos]     = useState({ top: 0, left: 0 });
  const timer = useRef(null);
  const ref   = useRef(null);

  const show = () => {
    clearTimeout(timer.current);
    if (ref.current) setPos(calcTooltipPos(ref.current.getBoundingClientRect()));
    setShown(true);
  };
  const hide = () => { timer.current = setTimeout(() => setShown(false), 180); };

  return (
    <>
      <div
        ref={ref}
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 120, boxShadow: '0 1px 2px rgba(16,24,40,0.04)', cursor: elaboration ? 'pointer' : 'default' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onDoubleClick={() => elaboration && setModal(true)}
      >
        <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</p>}
      </div>
      {elaboration && shown && createPortal(
        <div style={{ ...TOOLTIP_STYLE, top: pos.top, left: pos.left }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>{label}</span>
          <p style={{ fontSize: 10.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px' }}>{elaboration}</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Double-click for full analysis</p>
        </div>,
        document.body
      )}
      {modal && <KPIModal label={label} value={value} sub={sub} color={color} elaboration={elaboration} impact={impact} onClose={() => setModal(false)} />}
    </>
  );
}

function WithElab({ children, label, value = null, elaboration, color = '#60A5FA', impact = null }) {
  const [hovered, setHovered] = useState(false);
  const [modal, setModal]     = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const onEnter = () => {
    if (ref.current) setPos(calcTooltipPos(ref.current.getBoundingClientRect()));
    setHovered(true);
  };

  return (
    <>
      <div
        ref={ref}
        style={{ cursor: elaboration ? 'pointer' : 'default' }}
        onMouseEnter={onEnter}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => elaboration && setModal(true)}
      >
        {children}
      </div>
      {elaboration && hovered && createPortal(
        <div style={{ ...TOOLTIP_STYLE, top: pos.top, left: pos.left, width: 280 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
          <p style={{ fontSize: 10.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', margin: '0 0 6px' }}>{elaboration}</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Double-click for full analysis</p>
        </div>,
        document.body
      )}
      {modal && <KPIModal label={label} value={value} sub={null} color={color} elaboration={elaboration} impact={impact} onClose={() => setModal(false)} />}
    </>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </p>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(16,24,40,0.08)' }}>
      <p style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || C.text, fontSize: 12, fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function GlobalDashboardPanel({ activeRegion, dataSource = 'Google DC', dcsOverride = null }) {
  const baseData = dcsOverride ?? GOOGLE_DC_MASTER;
  const dcs = useMemo(() => {
    if (!activeRegion || activeRegion === 'All') return baseData;
    return baseData.filter(d => d.region === activeRegion);
  }, [activeRegion, baseData]);

  const stats = useMemo(() => ({
    total: dcs.length,
    active: dcs.filter(d => d.status === 'Active').length,
    uc: dcs.filter(d => d.status === 'Under Construction').length,
    atRisk: dcs.filter(d => d.risk_flag !== 'Low').length,
    highRisk: dcs.filter(d => d.risk_flag === 'High').length,
    totalMW: Math.round(dcs.reduce((s, d) => s + d.capacity_mw, 0)),
    totalServers: dcs.reduce((s, d) => s + d.asset_servers, 0).toLocaleString(),
    totalGPUs: dcs.reduce((s, d) => s + d.asset_gpus, 0).toLocaleString(),
    totalRacks: dcs.reduce((s, d) => s + d.asset_racks, 0).toLocaleString(),
    avgPUE: (dcs.reduce((s, d) => s + d.pue, 0) / dcs.length).toFixed(2),
    avgRenewable: Math.round(dcs.reduce((s, d) => s + d.renewable_pct, 0) / dcs.length),
    totalCarbon: Math.round(dcs.reduce((s, d) => s + d.carbon_mt, 0)),
    critAlarms: dcs.reduce((s, d) => s + d.alarm_critical, 0),
    highAlarms: dcs.reduce((s, d) => s + d.alarm_high, 0),
    medAlarms: dcs.reduce((s, d) => s + d.alarm_medium, 0),
    lowAlarms: dcs.reduce((s, d) => s + d.alarm_low, 0),
    countries: [...new Set(dcs.map(d => d.country))].length,
    avgUtil: Math.round(dcs.reduce((s, d) => s + d.utilization_pct, 0) / (dcs.length || 1)),
    tierIV: dcs.filter(d => d.tier === 'IV').length,
  }), [dcs]);

  const regionBarData = useMemo(() => {
    return ['North America', 'Europe', 'Asia', 'South America'].map(r => ({
      region: r,
      Active: baseData.filter(d => d.region === r && d.status === 'Active').length,
      'Under Construction': baseData.filter(d => d.region === r && d.status === 'Under Construction').length,
      MW: Math.round(baseData.filter(d => d.region === r).reduce((s, d) => s + d.capacity_mw, 0)),
    }));
  }, [baseData]);

  const tierData = useMemo(() => {
    const VALID = new Set(['I', 'II', 'III', 'IV']);
    const map = {};
    dcs.forEach(d => {
      const t = VALID.has(d.tier) ? `Tier ${d.tier}` : 'Other / N/A';
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [dcs]);

  const tierColors = ['#005EB8', '#00B0A0', '#E87722', '#7C3AED'];

  const topRisk = useMemo(() => dcs.filter(d => d.risk_flag !== 'Low').sort((a, b) => {
    const order = { High: 0, Medium: 1 };
    return order[a.risk_flag] - order[b.risk_flag];
  }).slice(0, 6), [dcs]);

  const mwByRegion = useMemo(() => ['North America', 'Europe', 'Asia', 'South America'].map(r => ({
    region: r,
    MW: Math.round(dcs.filter(d => d.region === r).reduce((s, d) => s + d.capacity_mw, 0)),
  })), [dcs]);

  return (
    <div style={{ background: C.bg, padding: '20px 24px', minHeight: '100%' }}>

      {/* Google DC Source Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dataSource.toLowerCase().includes('google') && (
            <div style={{ display: 'flex', gap: 2.5 }}>
              <div style={{ width: 5, height: 22, borderRadius: 3, background: '#4285F4' }} />
              <div style={{ width: 5, height: 22, borderRadius: 3, background: '#EA4335' }} />
              <div style={{ width: 5, height: 22, borderRadius: 3, background: '#FBBC05' }} />
              <div style={{ width: 5, height: 22, borderRadius: 3, background: '#34A853' }} />
            </div>
          )}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Inter', 'Segoe UI', sans-serif", margin: 0 }}>
              {dataSource} Data Center Infrastructure
            </p>
            <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 0' }}>
              Source: {dataSource} &nbsp;·&nbsp; {dcs.length} campus{dcs.length !== 1 ? 'es' : ''} in view &nbsp;·&nbsp; GSRS Regional Taxonomy
            </p>
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 6,
          background: dataSource.toLowerCase().includes('google') ? 'rgba(66,133,244,0.10)' : 'rgba(0,51,141,0.08)',
          border: `1px solid ${dataSource.toLowerCase().includes('google') ? 'rgba(66,133,244,0.22)' : 'rgba(0,51,141,0.20)'}`,
          fontSize: 9, fontWeight: 700,
          color: dataSource.toLowerCase().includes('google') ? '#4285F4' : '#00338D',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {dataSource.toUpperCase().slice(0, 20)}
        </div>
      </div>

      {/* Row 1 — KPI Cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI label="Total DCs" value={stats.total} sub={`${stats.countries} Countries`} color={C.blue}
          elaboration={`${stats.total} data center sites across ${stats.countries} countries in the current view — ${stats.active} active and ${stats.uc} under construction. This is the master inventory count and the denominator for all portfolio-level ratios including utilisation, risk rate, and carbon intensity.`}
          impact={[
            `Portfolio scale of ${stats.total} sites across ${stats.countries} countries drives negotiating leverage with OEMs, power utilities, and hyperscale network carriers — larger site counts unlock volume discounts on hardware, energy contracts, and colocation services.`,
            `Geographic diversity across ${stats.countries} countries provides resilience against regional regulatory shifts, geopolitical risk, and natural disaster clustering. A single-country portfolio would face material concentration risk.`,
            `Commissioning velocity (sites moving from Under Construction to Active per quarter) is the leading operational indicator of capacity available for new AI workload onboarding. Monitor the ${stats.uc} UC sites for handover schedule adherence.`,
          ]} />
        <KPI label="Active" value={stats.active} sub={`${stats.countries} Countries`} color={C.green}
          elaboration={`${stats.active} sites currently in live commercial operation, accepting workloads and generating revenue. Active count as a percentage of total (${Math.round((stats.active / stats.total) * 100)}%) indicates how much of the planned portfolio is generating utilisation versus still consuming build capital.`}
          impact={[
            `${stats.active} active sites represent the revenue-generating base of the portfolio. The ${Math.round((stats.active / stats.total) * 100)}% active rate means ${100 - Math.round((stats.active / stats.total) * 100)}% of deployed capital is still pre-revenue, consuming build cost without contributing to EBITDA.`,
            `Active site count anchors SLA capacity commitments to enterprise and hyperscaler tenants. Dropping below regional minimum thresholds requires cross-region load balancing, increasing latency exposure and contractual complexity.`,
            `Accelerating the ${stats.uc} under-construction sites through final commissioning milestones is the highest-leverage near-term action to grow the active fleet and expand utilisation revenue base.`,
          ]} />
        <KPI label="Under Construction" value={stats.uc} sub="Planned campuses" color={C.amber}
          elaboration={`${stats.uc} sites where physical construction, fit-out, or commissioning is underway but commercial operations have not yet commenced. Represents committed forward capacity — capital already deployed but not yet generating utilisation. Once commissioned, these sites will ${stats.uc > stats.active ? 'more than double' : 'significantly expand'} the active fleet.`}
          impact={[
            `${stats.uc} sites in the build pipeline represent committed forward capacity — capex already deployed but not yet generating utilisation revenue. Capital efficiency tracking (cost per MW delivered) is critical during this phase.`,
            `Build pipeline scale directly determines 12–24 month capacity availability for AI and hyperscale workload contracting. Delays in commissioning compress the available supply window for new tenant agreements.`,
            `Construction risk (cost overruns, grid interconnection delays, long-lead equipment) is highest during this phase. Schedule milestone tracking and supply-chain visibility are the primary risk mitigation levers.`,
          ]} />
        <KPI label="Total MW" value={`${stats.totalMW.toLocaleString()} MW`} sub="IT Load Capacity" color={C.cyan}
          elaboration={`${stats.totalMW.toLocaleString()} MW total nameplate IT power capacity across all sites in view. This is the primary sizing metric for data center scale — it represents the maximum theoretical AI and cloud compute load the portfolio can support. Includes both active and under-construction sites.`}
          impact={[
            `${stats.totalMW.toLocaleString()} MW represents the theoretical ceiling for AI compute density the portfolio can support. At modern GPU cluster densities (50–100 kW/rack), this translates to significant machine learning training and inference capacity.`,
            `MW capacity is the primary metric for power purchase agreement sizing, grid interconnection applications, and utility capacity reservation — all long lead-time procurement activities that must be initiated well ahead of demand.`,
            `Active MW (from ${stats.active} live sites) is the revenue-generating subset. Maximising active site utilisation toward the 80–85% optimal range is the primary short-term yield improvement lever.`,
          ]} />
        <KPI label="Avg PUE" value={stats.avgPUE} sub="Power Usage Effectiveness" color={C.blue}
          elaboration={`Portfolio-average PUE of ${stats.avgPUE} — the ratio of total facility energy to IT energy. A PUE of 1.0 is theoretical perfection; industry best practice is ≤1.10. At ${stats.avgPUE}, this portfolio is ${parseFloat(stats.avgPUE) <= 1.12 ? 'world-class' : parseFloat(stats.avgPUE) <= 1.16 ? 'above-industry-average' : 'at industry average'}. Each 0.01 PUE reduction represents millions of dollars in annual energy savings at this scale.`}
          impact={[
            `Each 0.01 PUE reduction across ${stats.totalMW.toLocaleString()} MW of installed capacity translates to substantial annual energy cost savings — at commercial electricity rates, a multi-million dollar efficiency gain per percentage point.`,
            `PUE is a primary input to CDP Climate Disclosure, CSRD Scope 2 reporting, and RE100 commitments. Sub-1.15 PUE qualifies for green bond classification and ESG-linked financing at preferential interest rates.`,
            `Low PUE enables higher IT power density per unit of cooling infrastructure investment, directly reducing capex per usable MW. Target ≤1.10 for all new builds with free-cooling and precision liquid cooling design.`,
          ]} />
        <KPI label="Avg Utilization" value={`${stats.avgUtil}%`} sub="Across DCs in view" color={stats.avgUtil > 85 ? C.red : stats.avgUtil > 70 ? C.amber : C.green}
          elaboration={`Average utilisation of ${stats.avgUtil}% across all sites in view, including under-construction sites with low shell-commissioning loads. Filtered to active sites only, utilisation is significantly higher. ${stats.avgUtil > 85 ? 'High portfolio utilisation — expansion pipeline is critical to avoid capacity constraints.' : stats.avgUtil > 70 ? 'Healthy range indicating strong asset yield.' : 'Blended average is moderated by under-construction sites; active-site utilisation is materially higher.'}`}
          impact={[
            `At ${stats.avgUtil}% blended utilisation (including pre-operational UC sites), active-site utilisation is materially higher. ${stats.avgUtil > 85 ? 'Portfolio is approaching capacity ceiling — accelerate expansion pipeline immediately.' : stats.avgUtil > 70 ? 'Healthy range. Monitor high-utilisation sites for early capacity warnings.' : 'Active-site utilisation is well above the portfolio average. Prioritise load balancing across sites.'}`,
            `The optimal operating range of 70–85% maximises revenue yield while maintaining expansion headroom. Below 60% indicates underutilised capital; above 85% indicates constraint risk — both warrant operational action.`,
            `Monitor individual site utilisation rather than the portfolio average — high variance across sites signals load imbalancing opportunities that can defer new build capex by better distributing existing workloads.`,
          ]} />
        <KPI label="Renewable" value={`${stats.avgRenewable}%`} sub="Avg Renewable Energy" color={C.green}
          elaboration={`${stats.avgRenewable}% portfolio-average renewable energy percentage. Google's target is 100% 24/7 CFE matching. ${stats.avgRenewable >= 90 ? 'Near-target performance — exceptional portfolio-wide renewable penetration.' : stats.avgRenewable >= 70 ? 'Above-average. Sites in fossil-heavy grids are pulling the average below the CFE target.' : 'Below the 71% global portfolio average — regional grid constraints are limiting renewable procurement options.'} Sites below 80% represent material Scope 2 carbon liability under CSRD and CDP frameworks.`}
          impact={[
            `${stats.avgRenewable}% portfolio-average renewable energy directly determines Scope 2 market-based emissions under the GHG Protocol. Each percentage point improvement reduces reportable carbon liability in CDP Climate Disclosure and CSRD sustainability reports.`,
            `Sites below 80% renewable penetration represent material ESG reporting risk under EU CSRD regulations. Prioritise PPA execution at fossil-grid sites to close the gap to the 100% 24/7 CFE target.`,
            `Renewable energy sourcing strategy (direct PPAs vs. market RECs vs. on-site generation) materially impacts both the cost and credibility of renewable claims — additionality and temporal matching are increasingly scrutinised by regulators and investors.`,
          ]} />
        <KPI label="At Risk" value={stats.atRisk} sub={`${stats.highRisk} Critical`} color={stats.highRisk > 0 ? C.red : C.amber}
          elaboration={`${stats.atRisk} site${stats.atRisk !== 1 ? 's' : ''} carrying a Medium or High risk flag — ${stats.highRisk} High (immediate P1 escalation required) and ${stats.atRisk - stats.highRisk} Medium. Risk flags are set by NOC operations teams based on threshold crossings for power, cooling, connectivity, and physical security alarms. At-risk rate: ${Math.round((stats.atRisk / stats.active) * 100)}% of active sites.`}
          impact={[
            `${stats.atRisk} at-risk sites (${stats.highRisk} High, ${stats.atRisk - stats.highRisk} Medium) represent ${Math.round((stats.atRisk / Math.max(1, stats.active)) * 100)}% of the active portfolio under elevated operational stress. High-risk sites require immediate P1 escalation and may need capacity de-rating until remediation is complete.`,
            `Each High-risk site carries potential SLA breach exposure for enterprise tenants dependent on that campus. Legal and contractual liability accrues from hour 1 of SLA non-compliance — NOC response within 30 days is contractually mandated for High-risk classifications.`,
            `Risk flag trends (week-on-week change) are a stronger indicator of portfolio health than the absolute count. A rising at-risk count signals systemic maintenance or infrastructure degradation requiring portfolio-level investigation.`,
          ]} />
        <KPI label="Tier IV DCs" value={stats.tierIV} sub="Tier IV campuses" color={C.purple}
          elaboration={`${stats.tierIV} Tier IV certified campuses in view — fault-tolerant 2N design with 99.995% uptime SLA. Tier IV sites support the highest-value enterprise and regulated-industry workloads where any downtime carries significant financial or compliance consequences. ${Math.round((stats.tierIV / stats.total) * 100)}% of the portfolio holds Tier IV certification.`}
          impact={[
            `${stats.tierIV} Tier IV campuses (${Math.round((stats.tierIV / Math.max(1, stats.total)) * 100)}% of portfolio) are qualified to host the highest-value, most SLA-sensitive workloads — regulated financial services, AI model serving at hyperscale, and mission-critical enterprise applications.`,
            `Tier IV certification commands a 20–35% premium in colocation pricing versus Tier III, directly improving revenue per MW at certified campuses. Certification audit and maintenance is a recurring investment but delivers compounding revenue benefit.`,
            `New data center designs should target Tier IV (2N power + cooling) for sites planned to host AI GPU clusters, where the workload density (>30 kW/rack) and premium pricing from AI infrastructure tenants justify the 15–20% capex premium.`,
          ]} />
      </div>

      {/* Row 2 — Assets */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI label="Servers" value={stats.totalServers} color={C.muted}
          elaboration={`${stats.totalServers} server instances deployed across all sites in view. Drives hardware refresh capex cycles, OEM contract volume, and is the primary metric for compute capacity planning. Server count growth rate is a leading indicator of workload onboarding velocity.`}
          impact={[
            `${stats.totalServers} server instances drive OEM contract volume, maintenance SLA coverage requirements, and asset refresh capex planning. Hardware refresh cycles of 4–5 years mean a significant portion of servers entering end-of-life annually and requiring replacement.`,
            `Server count growth rate is the primary leading indicator of workload onboarding velocity — each percentage increase in server count corresponds to new capacity being activated and generating utilisation revenue.`,
            `High server density (servers per rack) drives cooling requirements. GPU-heavy configurations require liquid cooling or precision air handling beyond standard CRAC unit capacity — validate cooling design at high-density zones.`,
          ]} />
        <KPI label="GPUs" value={stats.totalGPUs} color={C.muted}
          elaboration={`${stats.totalGPUs} GPU accelerator units deployed — powering Gemini model training, Google Search AI, YouTube recommendations, and GCP AI Platform. GPU count is the fastest-growing metric in the portfolio as AI workload density accelerates. GPU expansion drives high-density power design requirements (≥20 kW/rack).`}
          impact={[
            `${stats.totalGPUs} GPU accelerators represent the portfolio's AI compute capacity — the fastest-growing and highest-value asset class in the fleet. GPU demand for LLM training and inference is growing 10× per 3 years, making this the primary capacity constraint metric.`,
            `GPU density drives power design requirements (≥20 kW/rack for H100-class clusters, up to 120 kW/rack for liquid-cooled GB200 NVL configurations). Verify power and cooling design headroom at sites with high GPU concentrations.`,
            `GPU asset lifecycle is shorter than standard servers (2–3 year generation cycles for AI accelerators vs 4–5 years for CPU servers). Factor accelerated refresh capex into 3-year capex planning for all AI infrastructure campuses.`,
          ]} />
        <KPI label="Racks" value={stats.totalRacks} color={C.muted}
          elaboration={`${stats.totalRacks} installed rack positions across the portfolio in view. Rack count combined with average power density per rack gives a more operationally accurate picture of usable IT capacity than MW alone — high-density GPU racks can draw 30–60 kW versus a standard 5–8 kW server rack.`}
          impact={[
            `${stats.totalRacks} rack positions represent the physical IT real estate of the portfolio. Rack fill rate (occupied vs. installed positions) is a key asset yield metric — unfilled racks represent overhead cost without revenue generation. Target >85% rack utilisation in active sites.`,
            `Average power density of ${(stats.totalMW * 1000 / Math.max(1, parseInt(stats.totalRacks.replace(/,/g,'')))).toFixed(1)} kW/rack across the fleet — ${(stats.totalMW * 1000 / Math.max(1, parseInt(stats.totalRacks.replace(/,/g,'')))) > 15 ? 'indicating significant GPU and high-density AI compute deployment.' : 'consistent with a mixed standard and high-density configuration.'}`,
            `Planned capacity expansion should be sized in rack increments — validate cooling and power distribution per rack aligns with the intended workload density mix (standard vs. GPU vs. liquid-cooled configurations).`,
          ]} />
        <KPI label="Carbon Output" value={`${stats.totalCarbon.toLocaleString()} MT`} sub="Estimated CO₂/yr" color={C.amber}
          elaboration={`Estimated ${stats.totalCarbon.toLocaleString()} metric tonnes of CO₂ equivalent per year from the portfolio's electricity consumption. At ${stats.avgRenewable}% renewable penetration, this is materially below what a fossil-grid-only footprint would produce. Reported as Scope 2 market-based emissions under the GHG Protocol for CDP and CSRD disclosures.`}
          impact={[
            `${stats.totalCarbon.toLocaleString()} MT of CO₂ per year requires disclosure under EU CSRD, CDP Climate Questionnaire, and Science Based Targets initiative alignment tracking. Accuracy of the underlying calculation is subject to third-party assurance under CSRD from 2024 onwards.`,
            `Net-zero pathway requires: (1) PUE reduction to ≤1.10, (2) 100% renewable energy matching with additionality, (3) direct PPAs for temporal matching, and (4) residual carbon offsetting via high-quality nature-based or industrial carbon removal credits.`,
            `Both market-based (using RECs) and location-based (using grid average intensity) Scope 2 methodologies must be disclosed under CSRD. Ensure the methodology is consistent year-on-year to avoid disclosure inconsistencies in audited sustainability reports.`,
          ]} />
        <KPI label="Carbon Intensity" value={`${(stats.totalCarbon / (stats.totalMW || 1)).toFixed(1)} MT/MW`} sub="Per MW IT load" color={C.purple}
          elaboration={`Carbon intensity of ${(stats.totalCarbon / (stats.totalMW || 1)).toFixed(1)} MT CO₂ per MW normalises emissions by IT capacity for like-for-like comparison across portfolios of different scales. Best-in-class Nordic sites achieve 0.04–0.06 MT/MW via near-100% hydropower. This portfolio intensity reflects the blended impact of the ${stats.avgRenewable}% renewable mix.`}
          impact={[
            `At ${(stats.totalCarbon / (stats.totalMW || 1)).toFixed(1)} MT/MW, this portfolio is ${(stats.totalCarbon / (stats.totalMW || 1)) < 0.3 ? 'in the leading ESG tier — values below 0.3 MT/MW qualify for LEED Platinum recognition and ESG-linked financing advantages.' : (stats.totalCarbon / (stats.totalMW || 1)) < 0.5 ? 'in the above-average sustainability band — below the 0.4–0.6 MT/MW industry benchmark.' : 'near the industry average — improvement required to unlock ESG financing advantages.'}`,
            `Carbon intensity is the primary metric used by institutional ESG investors and sustainability rating agencies (MSCI, Sustainalytics) when evaluating infrastructure asset holdings. Portfolios below 0.3 MT/MW attract preferential capital allocation.`,
            `Intensity reduction can be achieved through PUE improvement, renewable penetration increase, and portfolio mix shift — commissioning new low-carbon campuses with solar/hydro PPAs raises the portfolio average while growing total capacity.`,
          ]} />
        <KPI label="Critical Alarms" value={stats.critAlarms} color={stats.critAlarms > 0 ? C.red : C.green}
          elaboration={stats.critAlarms > 0
            ? `${stats.critAlarms} active Critical alarms across the portfolio — P1 incidents with actual or imminent service disruption risk requiring NOC response within 15 minutes. These are concentrated at the ${stats.highRisk} High-risk site${stats.highRisk !== 1 ? 's' : ''} and require immediate remediation tracking.`
            : `No active Critical alarms across the portfolio. All sites are operating within critical thresholds. P1 status is clear.`}
          impact={[
            stats.critAlarms > 0
              ? `${stats.critAlarms} P1 incidents require immediate NOC escalation within 15 minutes. Each unresolved Critical alarm risks SLA breach for enterprise tenants at affected sites — contractual penalties accrue from hour 1 of non-compliance.`
              : `Zero Critical alarms is the target portfolio state. Maintain by executing all Medium alarm corrective actions within the 8-hour SLA window to prevent escalation chains.`,
            `Critical alarm concentration at ${stats.highRisk} High-risk site${stats.highRisk !== 1 ? 's' : ''} warrants immediate on-site facilities response and parallel escalation to the infrastructure engineering team for root cause analysis.`,
            `Post-incident reviews (PIR) for all Critical alarms are mandatory — document root cause, contributing factors, and corrective actions in the NOC CMDB to prevent recurrence and support regulatory audit trails.`,
          ]} />
        <KPI label="High Alarms" value={stats.highAlarms} color={stats.highAlarms > 0 ? C.amber : C.green}
          elaboration={`${stats.highAlarms} active High-severity alarms — P2 conditions indicating significant degradation or redundancy loss. Response SLA is 2 hours. At ${stats.highAlarms} alarms across ${stats.active} active sites, the average is ${(stats.highAlarms / Math.max(1, stats.active)).toFixed(1)} per site — ${stats.highAlarms / Math.max(1, stats.active) > 2 ? 'elevated and warranting portfolio-level review.' : 'within normal operational range.'}`}
          impact={[
            `${stats.highAlarms} P2 alarms with a 2-hour response SLA represent degraded redundancy across the active fleet. Average of ${(stats.highAlarms / Math.max(1, stats.active)).toFixed(1)} high alarms per active site — ${stats.highAlarms / Math.max(1, stats.active) > 2 ? 'elevated. Portfolio-level investigation into systemic causes (ageing UPS, cooling capacity) is warranted.' : 'within normal operational range for a fleet of this scale.'}`,
            `High alarms at N+1 redundant systems mean the site is operating in a degraded state with no backup for the affected component. Any further failure in that subsystem will cascade to a Critical alarm and potential service outage.`,
            `Systematic high alarm reduction requires a preventive maintenance uplift program — identifying sites with recurring High alarms and scheduling component replacement before failures propagate to Critical.`,
          ]} />
        <KPI label="Med Alarms" value={stats.medAlarms} color={stats.medAlarms > 0 ? '#F59E0B' : C.green}
          elaboration={`${stats.medAlarms} active Medium-severity alarms — P3 early-warning signals (temperature trending, generator fuel, UPS battery health) requiring corrective action within 8 hours. Medium alarms feed the weekly preventive maintenance schedule and average ${(stats.medAlarms / Math.max(1, stats.active)).toFixed(1)} per active site.`}
          impact={[
            `${stats.medAlarms} Medium alarms represent early warning signals that need corrective action within 8 hours. Unresolved Medium alarms have a documented escalation path to High alarms within 24–48 hours if underlying conditions worsen.`,
            `Medium alarm density (${(stats.medAlarms / Math.max(1, stats.active)).toFixed(1)} per active site) is a leading indicator of maintenance backlog accumulation. Sites with persistently high medium alarm counts should be prioritised for preventive maintenance visits.`,
            `Common medium alarm root causes — UPS battery age, CRAC filter blockage, generator fuel level, network path redundancy — have known remediation playbooks. Ensure NOC teams execute corrective actions within the 8-hour SLA window consistently.`,
          ]} />
        <KPI label="Low Alarms" value={stats.lowAlarms} color={C.muted}
          elaboration={`${stats.lowAlarms} active Low-severity notices — P4 informational alerts such as firmware updates, minor sensor drift, and inspection reminders. While non-urgent individually, a sustained high volume signals potential maintenance backlog accumulation. Monthly trend analysis is used to identify sites where deferred maintenance is compounding into systemic risk.`}
          impact={[
            `${stats.lowAlarms} Low-severity notices across ${stats.active} active sites average ${(stats.lowAlarms / Math.max(1, stats.active)).toFixed(1)} per site. While individually non-urgent, this volume warrants monthly trend review — a rising trend signals deferred maintenance compounding across the fleet.`,
            `P4 alerts include firmware update notifications (security patching compliance), minor sensor calibration drift, and scheduled inspection reminders. Tracking close rates ensures these don't create gaps in compliance reporting audit trails.`,
            `Automated alert correlation and deduplication across the fleet can significantly reduce Low alarm noise, allowing NOC analysts to focus attention on High and Critical alarms where manual intervention has highest operational impact.`,
          ]} />
      </div>

      {/* Row 3 — Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Regional DC Count */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <SectionTitle>DCs by Region</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={regionBarData} barSize={14}>
              <XAxis dataKey="region" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Active" fill={C.blue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Under Construction" fill={C.amber} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* MW by Region */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <SectionTitle>Capacity MW by Region</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={mwByRegion} barSize={20}>
              <XAxis dataKey="region" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="MW" radius={[4, 4, 0, 0]}>
                {mwByRegion.map((d, i) => (
                  <Cell key={d.region} fill={Object.values(REGION_COLORS)[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Donut */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <SectionTitle>Tier Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={tierData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                {tierData.map((_, i) => <Cell key={i} fill={tierColors[i % tierColors.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: C.muted }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 — Alarms + At Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Alarm Summary */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <SectionTitle>Alarm Summary</SectionTitle>
          {[
            { label: 'Critical', count: stats.critAlarms, color: C.red,     elab: 'Critical alarms require immediate remediation — typically power, cooling, or network failures affecting service availability. A count above 0 triggers P1 incident response protocols with a 15-minute NOC response SLA. Industry target: 0 critical alarms per 100 MW of installed capacity.',
              impact: [
                `${stats.critAlarms} P1 Critical alarms require NOC response within 15 minutes. Each minute of unresolved critical status erodes SLA uptime guarantees for enterprise tenants — typical colocation SLAs carry penalty clauses from 15 minutes of incident onset.`,
                `Critical alarms at power or cooling subsystems require immediate capacity de-rating at affected sites to prevent cascading failures. Emergency vendor callout and on-site incident command should be activated simultaneously.`,
                `All Critical alarms must have a post-incident review (PIR) completed within 72 hours — root cause documented, corrective action assigned, and timeline committed in the CMDB for regulatory audit compliance.`,
              ]},
            { label: 'High',     count: stats.highAlarms, color: C.amber,   elab: 'High-severity alarms signal degraded redundancy or imminent failure risk — A/B-feed imbalance, cooling unit failures, or generator test failures. Response SLA is 2 hours. Each high alarm must be resolved before fault-tolerance margins can be considered restored.',
              impact: [
                `${stats.highAlarms} High alarms mean the portfolio is operating with degraded redundancy across affected systems. A second failure in any of these subsystems will cascade to a Critical alarm — the 2-hour response SLA must be strictly enforced.`,
                `High alarms at UPS, generator, or cooling units mean the site is in N+0 mode for that subsystem — no redundancy margin. Tenant-facing SLA risk should be logged and communicated to account management for proactive customer notification.`,
                `High alarm volume of ${stats.highAlarms} across ${stats.active} active sites (avg ${(stats.highAlarms / Math.max(1, stats.active)).toFixed(1)}/site) — ${stats.highAlarms / Math.max(1, stats.active) > 2 ? 'above normal; initiate portfolio-level preventive maintenance review.' : 'within normal range; maintain current PM cadence.'}`,
              ]},
            { label: 'Medium',   count: stats.medAlarms,  color: '#F59E0B', elab: 'Medium alarms flag conditions that reduce fault-tolerance margins without yet impacting uptime. Common causes: elevated temperatures, UPS battery health alerts, or partial network path degradation. Corrective action required within 8 hours.',
              impact: [
                `${stats.medAlarms} Medium alarms carry an 8-hour corrective action SLA. Each unresolved medium alarm represents a degrading condition that statistically escalates to High severity within 24–48 hours if the root cause isn't addressed.`,
                `Medium alarms are the primary input to the weekly preventive maintenance schedule. Sites with 3+ medium alarms should receive accelerated site visits and component inspection beyond the standard quarterly PM cycle.`,
                `Common medium alarm root causes — elevated return air temperature, UPS battery age >4 years, generator fuel <70%, partial network path loss — all have documented remediation playbooks. Verify NOC teams are executing these, not just acknowledging and closing without action.`,
              ]},
            { label: 'Low',      count: stats.lowAlarms,  color: C.muted,   elab: 'Low-severity alarms are informational and typically auto-resolve. Represent minor threshold breaches, routine maintenance notifications, or monitoring health checks. A sustained high volume signals potential maintenance backlog accumulation.',
              impact: [
                `${stats.lowAlarms} Low-severity notices across ${stats.active} active sites — individually non-urgent, but a rising trend month-on-month signals deferred maintenance compounding. Track close rates, not just open counts.`,
                `Low alarms include security patch and firmware update notifications. Firmware update backlog creates cybersecurity exposure — particularly for BMC/IPMI firmware, network device OS, and BMS controller software which are common lateral movement vectors.`,
                `Automated deduplication and correlation of Low alarms (grouping related alerts into single incidents) can reduce operational noise by 40–60%, allowing NOC analysts to focus on High/Critical conditions requiring genuine human intervention.`,
              ]},
          ].map(a => (
            <WithElab key={a.label} label={a.label} value={a.count} elaboration={a.elab} color={a.color} impact={a.impact}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                  <span style={{ fontSize: 12, color: C.text }}>{a.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: a.color, fontFamily: "'JetBrains Mono', monospace" }}>{a.count}</span>
              </div>
            </WithElab>
          ))}
          <WithElab label="Total Alarms" value={stats.critAlarms + stats.highAlarms + stats.medAlarms + stats.lowAlarms} color={C.text}
            elaboration="Aggregate alarm load across all severity tiers in the selected region. A healthy portfolio targets fewer than 5 critical and fewer than 20 high alarms per 100 MW of installed capacity. Use this number as a trend indicator — a rising total warrants portfolio-level review."
            impact={[
              `Total alarm volume of ${stats.critAlarms + stats.highAlarms + stats.medAlarms + stats.lowAlarms} across ${stats.active} active sites equals ${((stats.critAlarms + stats.highAlarms + stats.medAlarms + stats.lowAlarms) / Math.max(1, stats.totalMW) * 100).toFixed(1)} alarms per 100 MW — compare against the 5 critical / 20 high per 100 MW industry benchmark to assess portfolio operational health.`,
              `A rising total alarm trend (month-on-month) is a leading indicator of fleet-wide maintenance underinvestment. Benchmark against prior quarters and flag if total alarms are growing faster than the rate of new sites being commissioned.`,
              `Alarm severity distribution tells a more useful story than the total: a high total driven by Low alarms is manageable noise; the same total driven by Critical/High alarms requires immediate portfolio-level escalation to the infrastructure leadership team.`,
            ]}>

            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Total Alarms</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>
                {stats.critAlarms + stats.highAlarms + stats.medAlarms + stats.lowAlarms}
              </span>
            </div>
          </WithElab>
        </div>

        {/* At Risk DCs */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <SectionTitle>At Risk DCs</SectionTitle>
          {topRisk.length === 0 ? (
            <p style={{ fontSize: 12, color: C.green }}>No at-risk DCs in this region</p>
          ) : topRisk.map(d => (
            <WithElab
              key={d.id}
              label={d.name}
              color={d.risk_flag === 'High' ? C.red : C.amber}
              elaboration={`${d.name} is rated ${d.risk_flag} risk based on alarm density, utilisation headroom, and infrastructure health indicators. ${d.risk_flag === 'High' ? 'High risk sites require a site assessment within 30 days and may be subject to capacity restrictions pending remediation.' : 'Medium risk sites are flagged for monitoring and scheduled review within 90 days. No immediate service impact expected.'} Alarm load: ${d.alarm_critical ?? 0} critical · ${d.alarm_high ?? 0} high · ${d.alarm_medium ?? 0} medium.`}
              impact={[
                d.risk_flag === 'High'
                  ? `${d.name} is rated HIGH risk — requires a formal site assessment within 30 days and immediate NOC escalation. Active alarm load (${d.alarm_critical ?? 0} critical, ${d.alarm_high ?? 0} high) must be reduced before risk rating can be downgraded.`
                  : `${d.name} is rated MEDIUM risk — scheduled for review within 90 days. Alarm load (${d.alarm_critical ?? 0} critical, ${d.alarm_high ?? 0} high, ${d.alarm_medium ?? 0} medium) should be tracked weekly to detect escalation to High risk.`,
                `Utilisation at ${d.utilization_pct ?? 'N/A'}% leaves ${d.capacity_mw ? (d.capacity_mw * (1 - (d.utilization_pct ?? 0) / 100)).toFixed(1) : 'N/A'} MW of headroom. ${(d.utilization_pct ?? 0) > 85 ? 'Above 85% utilisation headroom is critically constrained — emergency capacity reservation may be required to prevent stranded workloads.' : 'Headroom is available for workload scaling, but risk flag means new tenant commitments should be deferred until remediation is confirmed complete.'}`,
                `PUE ${d.pue ?? 'N/A'} · Renewable ${d.renewable_pct ?? 'N/A'}% · Tier ${d.tier ?? 'N/A'}. ${(d.pue ?? 0) > 1.4 ? 'Elevated PUE at a risk-flagged site compounds operational exposure — cooling inefficiency during a thermal event reduces the margin before service impact.' : 'PUE is within normal range.'} Escalation path: NOC → Site Director → Regional Infrastructure VP within 24 hours of High risk assignment.`,
              ]}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <div>
                  <p style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{d.name}</p>
                  <p style={{ fontSize: 10, color: C.muted }}>{d.market} · {d.region}</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: d.risk_flag === 'High' ? 'rgba(220,38,38,0.15)' : 'rgba(212,160,23,0.15)',
                  color: d.risk_flag === 'High' ? C.red : C.amber,
                  border: `1px solid ${d.risk_flag === 'High' ? 'rgba(220,38,38,0.3)' : 'rgba(212,160,23,0.3)'}`,
                }}>
                  {d.risk_flag}
                </span>
              </div>
            </WithElab>
          ))}
        </div>
      </div>

      {/* Row 5 — ESG */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
        <SectionTitle>ESG Snapshot</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <KPI label="Avg PUE" value={stats.avgPUE} sub="Power Efficiency" color={C.blue}
            elaboration={`Power Usage Effectiveness: total facility power ÷ IT equipment power. Industry average is 1.58; hyperscaler best-in-class is below 1.10. A PUE of ${stats.avgPUE} means every watt of compute draws ${stats.avgPUE}W from the grid — the overhead above 1.0 is cooling, lighting, and power conversion losses. Each 0.01 PUE reduction saves millions in annual energy cost at this portfolio scale.`}
            impact={[
              `PUE ${stats.avgPUE} means ${((stats.avgPUE - 1) * 100).toFixed(0)}% of energy consumed by this portfolio is overhead — cooling, lighting, and power conversion losses not delivering compute. At ${stats.totalMW} MW IT load, that overhead represents ${(stats.totalMW * (stats.avgPUE - 1)).toFixed(0)} MW of non-productive energy draw annually.`,
              `Each 0.01 PUE reduction translates to ${(stats.totalMW * 0.01 * 8760 / 1000).toFixed(0)} MWh of avoided annual consumption. At average grid cost of $60–80/MWh, this represents $${(stats.totalMW * 0.01 * 8760 * 70 / 1000000).toFixed(1)}M per year in direct energy cost savings at this portfolio scale.`,
              `PUE below 1.10 qualifies for LEED Platinum data center certification, green bond alignment, and preferred ESG-linked financing rates (typically 15–25bps interest reduction). PUE is evaluated in all major sustainability frameworks: CDP, RE100, CSRD, and ENERGY STAR Data Center.`,
            ]} />
          <KPI label="Avg Renewable" value={`${stats.avgRenewable}%`} sub="Renewable Energy Mix" color={C.green}
            elaboration={`${stats.avgRenewable}% of energy consumption is matched by renewable energy certificates (RECs) or direct power purchase agreements (PPAs) with wind, solar, or hydro generators. The 24/7 carbon-free energy (CFE) target means every hour of operation matched by zero-carbon generation, not just annual averages.`}
            impact={[
              `At ${stats.avgRenewable}% renewable, ${100 - stats.avgRenewable}% of grid consumption is still fossil-sourced. Closing the gap to 100% requires ${Math.ceil((100 - stats.avgRenewable) / 10)} additional PPA or REC procurement tranches, prioritising sites in high-carbon-intensity grid regions first for maximum Scope 2 impact.`,
              `Temporal matching (24/7 CFE) is the next frontier beyond annual % matching. It requires hourly procurement aligned to grid conditions — pairing solar generation daytime hours with battery storage or hydro dispatchability for off-peak hours. Report both annual % and 24/7 CFE score under emerging CDP and GHG Protocol guidance.`,
              `Sites below 80% renewable penetration represent the primary Scope 2 reduction opportunity. Identify the grid region for each and evaluate available PPAs, on-site solar, or VPPA structures. Regions with active renewable markets (Texas, Nordics, Iberia) offer the fastest path to 100% CFE at competitive tariffs.`,
            ]} />
          <KPI label="Total Carbon" value={`${stats.totalCarbon.toLocaleString()} MT/yr`} sub="Est. CO₂ emissions" color={C.amber}
            elaboration={`Estimated Scope 1 + Scope 2 CO₂-equivalent emissions across all facilities in scope, measured in metric tonnes per year. Includes grid electricity carbon intensity adjusted for renewable coverage, plus direct diesel generator emissions during outage events. Reported under the GHG Protocol for CDP and CSRD compliance disclosures.`}
            impact={[
              `${stats.totalCarbon.toLocaleString()} MT CO₂/yr is the portfolio's total climate liability — the figure reported to CDP Climate Questionnaire, CSRD sustainability reports, and Science Based Targets initiative (SBTi) progress tracking. Third-party assurance is required for all CSRD submissions from 2025.`,
              `Net-zero pathway milestones: (1) Achieve 100% renewable matching by 2025 via PPA/VPPA, (2) reduce PUE portfolio average to ≤1.10 by 2027, (3) implement 24/7 CFE hourly matching by 2030, (4) offset residual Scope 1 diesel emissions via high-quality nature-based removal credits.`,
              `Both market-based (using RECs) and location-based (using grid average intensity) Scope 2 methods must be disclosed under CSRD — ensure methodology is consistent year-on-year. The market-based total shown here (${stats.totalCarbon.toLocaleString()} MT) may differ significantly from the location-based total depending on REC quality and vintage.`,
            ]} />
          <KPI label="Carbon Intensity" value={`${(stats.totalCarbon / (stats.totalMW || 1)).toFixed(1)} MT/MW`} sub="Per MW of IT Load" color={C.purple}
            elaboration={`Carbon intensity normalises emissions against installed IT capacity, enabling fair cross-portfolio comparison regardless of campus size. Industry benchmark is 0.4–0.6 MT/MW; best-in-class Nordic hydro sites achieve 0.04–0.06 MT/MW. Values below 0.3 indicate a leading ESG position. Calculated as total carbon ÷ total installed MW across the current region filter.`}
            impact={[
              `Carbon intensity of ${(stats.totalCarbon / (stats.totalMW || 1)).toFixed(1)} MT/MW places this portfolio in the ${(stats.totalCarbon / (stats.totalMW || 1)) < 0.15 ? 'top-tier ESG band (< 0.15 MT/MW) — eligible for green bond labelling and SBTi 1.5°C-aligned infrastructure certification.' : (stats.totalCarbon / (stats.totalMW || 1)) < 0.4 ? 'above-average ESG band (0.15–0.4 MT/MW) — above industry average; continue PPA and PUE improvement programs to reach top-tier.' : 'at or above industry average (> 0.4 MT/MW) — material ESG improvement required to avoid rating agency downgrades and ESG-linked financing penalties.'}`,
              `Intensity is the primary metric used by institutional ESG investors (MSCI, Sustainalytics, ISS) and sovereign wealth infrastructure allocators. Portfolios in the <0.3 MT/MW band attract 30–50bps lower borrowing cost on green-linked credit facilities.`,
              `Intensity reduction levers in order of impact: (1) commission new campuses in low-carbon grids, (2) convert existing sites to 100% renewable PPAs, (3) improve PUE through adiabatic/liquid cooling upgrades, (4) offset residual via CORSIA/VCS carbon credits for reporting year bridging.`,
            ]} />
        </div>
      </div>
    </div>
  );
}
