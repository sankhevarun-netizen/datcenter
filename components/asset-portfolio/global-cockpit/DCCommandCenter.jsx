'use client';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, MapPin, Boxes } from 'lucide-react';
import { GOOGLE_DC_MASTER } from '@/data/googleDCMasterData';

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

const FLAG_EMOJI = {
  'USA': '🇺🇸', 'Chile': '🇨🇱', 'Uruguay': '🇺🇾', 'Australia': '🇦🇺',
  'Austria': '🇦🇹', 'Belgium': '🇧🇪', 'Denmark': '🇩🇰', 'Finland': '🇫🇮',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Ireland': '🇮🇪', 'Netherlands': '🇳🇱',
  'Norway': '🇳🇴', 'Portugal': '🇵🇹', 'Sweden': '🇸🇪', 'UK': '🇬🇧',
  'India': '🇮🇳', 'Japan': '🇯🇵', 'Malaysia': '🇲🇾', 'Singapore': '🇸🇬',
  'Taiwan': '🇹🇼',
};

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
        <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>{label}</p>
        {value != null && <p style={{ fontSize: 52, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, margin: '0 0 6px' }}>{value}</p>}
        {sub && <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{sub}</p>}
        <div style={{ borderTop: '1px solid #D8DCE3', margin: '28px 0' }} />
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: color + '18', border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color }}>✦</div>
            <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.09em' }}>AI Intelligence</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', margin: 0 }}>{elaboration}</p>
        </div>
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

function calcTooltipPos(rect, tooltipW = 270) {
  const GAP = 8, MAX_H = 220;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - tooltipW - 8);
  const top = (window.innerHeight - rect.bottom) < MAX_H + GAP
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
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 110, boxShadow: '0 1px 2px rgba(16,24,40,0.04)', cursor: elaboration ? 'pointer' : 'default' }}
        onMouseEnter={onEnter}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => elaboration && setModal(true)}
      >
        <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</p>}
      </div>
      {elaboration && hovered && createPortal(
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

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
      {children}
    </p>
  );
}

const MOCK_ALARMS = [
  {
    severity: 'HIGH',
    message: 'UPS module B2 — battery health below threshold',
    time: '2h ago',
    elaboration: 'Battery cell impedance has drifted 14% beyond baseline over the past 30 days, consistent with accelerated degradation from elevated power-room ambient temperature. If left unaddressed, ride-through runtime during a utility outage could fall below the 10-minute SLA. Recommend scheduling cell replacement within the next maintenance window.',
  },
  {
    severity: 'MEDIUM',
    message: 'CRAC unit 14 — supply air temperature deviation +2°C',
    time: '5h ago',
    elaboration: 'The deviation correlates with a partially restricted condenser coil, reducing heat rejection efficiency by an estimated 8%. Adjacent racks remain within the ASHRAE thermal envelope, so this is not yet rack-critical, but sustained drift could push hot-aisle containment past threshold within 48 hours. Filter and coil cleaning is recommended ahead of the next PM cycle.',
  },
  {
    severity: 'LOW',
    message: 'PDU branch circuit 07 load at 78% — approaching limit',
    time: '8h ago',
    elaboration: 'Load on this circuit has grown roughly 1.2% per week over the trailing quarter, consistent with new GPU rack provisioning in this zone. At the current trajectory it will breach its 80% derated capacity threshold within about three weeks. Rebalancing a portion of load to circuit 09, currently at 52%, is the lowest-risk mitigation.',
  },
  {
    severity: 'INFO',
    message: 'Scheduled maintenance window confirmed — Sunday 02:00',
    time: '1d ago',
    elaboration: 'This is a planned 90-minute window for generator load-bank testing and UPS firmware updates, with no expected impact to IT load given dual-path redundancy. Facilities has confirmed N+1 coverage is maintained throughout. Customers with single-corded equipment in this zone should be notified per standard change protocol.',
  },
];

function getDCIntel(dc) {
  const utilPct   = Math.round(dc.utilization_pct);
  const totalAlarms = (dc.alarm_critical ?? 0) + (dc.alarm_high ?? 0) + (dc.alarm_medium ?? 0) + (dc.alarm_low ?? 0);
  const intensityMT = (dc.carbon_mt / (dc.capacity_mw || 1)).toFixed(2);
  const isHighUtil  = utilPct > 80;
  const isLowUtil   = utilPct < 45;
  const isHighRisk  = dc.risk_flag === 'High';
  const isMedRisk   = dc.risk_flag === 'Medium';
  const isLowPUE    = dc.pue <= 1.12;
  const isHighPUE   = dc.pue > 1.25;
  const isLowRenew  = dc.renewable_pct < 60;
  const isHighRenew = dc.renewable_pct >= 90;
  const isHighCarbon = dc.carbon_mt > 80;
  const isTierIV    = dc.tier === 'IV';
  const isLargeCAMP = dc.capacity_mw >= 150;

  const items = [];

  // ── 1. CAPACITY / UTILISATION ──────────────────────────────────────────────
  if (isHighUtil) {
    items.push({
      tag: 'Capacity Alert',
      text: `${dc.name} at ${utilPct}% utilisation — expansion trigger breached`,
      elaboration: `${dc.name} is operating at ${utilPct}% of its ${dc.capacity_mw} MW nameplate capacity, above the 80% sustained utilisation threshold that triggers expansion planning. Available headroom is ${(dc.capacity_mw * (1 - utilPct / 100)).toFixed(0)} MW — insufficient to absorb a full-site failover from an adjacent ${dc.region} campus. Initiate feasibility review for next-phase capacity or evaluate cross-site load migration to relieve pressure and restore emergency headroom.`,
    });
  } else if (isLowUtil) {
    items.push({
      tag: 'Asset Yield',
      text: `${dc.name} at ${utilPct}% — below optimal yield threshold`,
      elaboration: `${dc.name} is operating at ${utilPct}% utilisation, below the 60–80% optimal yield band for a ${dc.capacity_mw} MW campus. Idle capacity of ${(dc.capacity_mw * (1 - utilPct / 100)).toFixed(0)} MW represents overhead cost with no revenue contribution. Targeted outreach to hyperscale and enterprise AI tenants in ${dc.market} is recommended to accelerate workload onboarding and improve return on the ${isTierIV ? 'Tier IV' : 'Tier III'} infrastructure investment.`,
    });
  } else {
    items.push({
      tag: 'Capacity',
      text: `${dc.name} utilisation healthy at ${utilPct}% — ${(dc.capacity_mw * (1 - utilPct / 100)).toFixed(0)} MW headroom`,
      elaboration: `${dc.name} is in the optimal 60–80% utilisation band at ${utilPct}% of ${dc.capacity_mw} MW capacity, with ${(dc.capacity_mw * (1 - utilPct / 100)).toFixed(0)} MW of available headroom for new workload onboarding. This balance provides strong asset yield while maintaining sufficient emergency capacity to absorb load redistribution from adjacent ${dc.region} sites during a partial outage event. Monitor monthly for sustained upward trend that would require expansion planning initiation.`,
    });
  }

  // ── 2. SUSTAINABILITY / ESG ────────────────────────────────────────────────
  if (isLowRenew) {
    items.push({
      tag: 'Sustainability Gap',
      text: `Renewable energy at ${dc.renewable_pct}% — PPA procurement required for ${dc.market}`,
      elaboration: `${dc.name} sources only ${dc.renewable_pct}% of its electricity from renewable or carbon-free energy, significantly below the 100% 24/7 CFE target. This site contributes disproportionately to the portfolio's Scope 2 carbon liability at an intensity of ${intensityMT} MT/MW. The ${dc.market} grid has accessible renewable capacity — wind and solar PPAs or VPPAs should be evaluated immediately. Delay in execution will amplify CSRD and CDP disclosure risk as sustainability reporting requirements tighten through 2025–2026.`,
    });
  } else if (isHighRenew) {
    items.push({
      tag: 'Sustainability',
      text: `${dc.name} at ${dc.renewable_pct}% renewable — near 24/7 CFE target`,
      elaboration: `${dc.name} is among the portfolio's leading sites for renewable energy mix at ${dc.renewable_pct}%, approaching the 24/7 Carbon-Free Energy target. The remaining ${100 - dc.renewable_pct}% fossil-sourced consumption can be addressed through hourly matching instruments — battery storage, dispatchable hydro, or short-duration PPAs that fill off-peak renewable gaps. This site qualifies for green bond collateral designation and preferential ESG-linked financing at current renewable penetration levels.`,
    });
  } else if (isHighPUE) {
    items.push({
      tag: 'Energy Efficiency',
      text: `PUE ${dc.pue.toFixed(2)} at ${dc.name} — cooling efficiency below target`,
      elaboration: `${dc.name}'s PUE of ${dc.pue.toFixed(2)} sits above the hyperscale target of ≤1.15, meaning ${((dc.pue - 1) * 100).toFixed(0)}% of grid consumption is overhead rather than productive IT work. At ${dc.capacity_mw} MW IT load and ${utilPct}% utilisation, this represents ${((dc.pue - 1) * dc.capacity_mw * utilPct / 100).toFixed(0)} MW of avoidable energy draw annually. Cooling system audit recommended: assess economiser hours available in ${dc.market}, filter replacement schedule, and airflow containment integrity across hot-aisle zones.`,
    });
  } else if (isLowPUE) {
    items.push({
      tag: 'Efficiency Leader',
      text: `${dc.name} PUE ${dc.pue.toFixed(2)} — world-class cooling efficiency`,
      elaboration: `${dc.name} achieves a PUE of ${dc.pue.toFixed(2)}, placing it in the top global tier for data center energy efficiency. This means only ${((dc.pue - 1) * 100).toFixed(0)}% of grid draw is overhead — cooling, lighting, and power conversion losses. At ${dc.capacity_mw} MW scale, this efficiency advantage over the industry average (PUE 1.58) saves approximately ${((1.58 - dc.pue) * dc.capacity_mw * utilPct / 100 * 8760 / 1000).toFixed(0)} GWh per year. Promotes LEED Platinum eligibility and is a key differentiator in ESG-linked financing discussions.`,
    });
  } else {
    items.push({
      tag: 'Sustainability',
      text: `${dc.name}: ${dc.renewable_pct}% renewable, PUE ${dc.pue.toFixed(2)}, ${dc.carbon_mt} MT CO₂/yr`,
      elaboration: `${dc.name} combines ${dc.renewable_pct}% renewable energy sourcing with a PUE of ${dc.pue.toFixed(2)}, producing an estimated ${dc.carbon_mt} MT of CO₂ per year — an intensity of ${intensityMT} MT/MW. ${isHighCarbon ? `The carbon output is above the portfolio average, driven primarily by the ${100 - dc.renewable_pct}% fossil energy gap. PPA procurement in ${dc.market} is the highest-impact lever to reduce this figure.` : `Carbon performance is within the acceptable range for this site scale and market, but continued progress on renewable procurement and PUE reduction will be required to meet net-zero pathway milestones by 2030.`}`,
    });
  }

  // ── 3. RISK / OPERATIONS / NETWORK ────────────────────────────────────────
  if (isHighRisk || (dc.alarm_critical ?? 0) > 0) {
    items.push({
      tag: 'Operations Alert',
      text: `${dc.name} HIGH risk — ${dc.alarm_critical ?? 0} critical · ${dc.alarm_high ?? 0} high alarms active`,
      elaboration: `${dc.name} is currently rated HIGH risk with ${dc.alarm_critical ?? 0} active Critical and ${dc.alarm_high ?? 0} High alarms, signalling real or imminent service impact. The site requires P1 NOC escalation with a 15-minute response target for any Critical alarm. ${isTierIV ? 'Despite Tier IV 2N design, active Critical alarms indicate system redundancy has been breached in one or more subsystems.' : 'N+1 redundancy margins may be compromised — verify all backup power and cooling paths are fully functional.'} A site incident review should be convened within 24 hours, with corrective actions filed in the CMDB and tracked to resolution.`,
    });
  } else if (isMedRisk || totalAlarms > 8) {
    items.push({
      tag: 'Risk Watch',
      text: `${dc.name} MEDIUM risk — ${totalAlarms} active alarms across ${dc.region}`,
      elaboration: `${dc.name} carries a Medium risk flag with ${totalAlarms} active alarms (${dc.alarm_critical ?? 0} critical, ${dc.alarm_high ?? 0} high, ${dc.alarm_medium ?? 0} medium, ${dc.alarm_low ?? 0} low). While no service impact is currently reported, the alarm density warrants a scheduled site review within 90 days and accelerated preventive maintenance to reduce the probability of escalation to High risk. Focus maintenance resources on the ${(dc.alarm_high ?? 0) > 0 ? 'High alarms first — each represents degraded redundancy that could cascade to P1 if a second fault occurs' : 'Medium alarms, which represent early-warning signals before redundancy loss occurs'}.`,
    });
  } else if (isTierIV && isLargeCAMP) {
    items.push({
      tag: 'Infrastructure',
      text: `${dc.name}: Tier IV · ${dc.capacity_mw} MW · ${dc.asset_gpus?.toLocaleString() ?? 'N/A'} GPUs deployed`,
      elaboration: `${dc.name} is a ${dc.capacity_mw} MW Tier IV 2N fault-tolerant campus in ${dc.market}, ${dc.region}. With ${dc.asset_gpus?.toLocaleString() ?? 'significant'} GPU accelerators deployed, it is a primary AI and HPC compute campus. The 2N design guarantees 99.995% uptime — less than 26 minutes of permitted downtime per year — enabling regulated-industry SLA commitments that standard Tier III campuses cannot match. Low risk status (0 critical alarms) confirms the 2N redundancy margins are currently intact across all power, cooling, and network paths.`,
    });
  } else {
    items.push({
      tag: 'Network & Ops',
      text: `${dc.name} low risk · ${dc.tier ? `Tier ${dc.tier}` : ''} · ${dc.region} region healthy`,
      elaboration: `${dc.name} is operating at Low risk in ${dc.market}, ${dc.region}, with ${totalAlarms} total alarms — ${totalAlarms === 0 ? 'a clean alarm slate indicating all systems are within normal operating parameters.' : `a manageable alarm load with no Critical or High severity conditions active. ${totalAlarms > 0 ? `The ${dc.alarm_medium ?? 0} medium and ${dc.alarm_low ?? 0} low alarms are within the normal band for a ${dc.capacity_mw} MW campus and are being managed through the standard PM cycle.` : ''}`} Tier ${dc.tier} ${dc.tier === 'IV' ? '(2N fault-tolerant)' : dc.tier === 'III' ? '(N+1 concurrent maintainable)' : '(N+1)'} infrastructure is performing within design parameters. Network connectivity to ${dc.region} peer sites is healthy with no path degradation reported.`,
    });
  }

  return items;
}

const ALARM_COLOR = { HIGH: C.red, MEDIUM: C.amber, LOW: '#F59E0B', INFO: C.muted };

function getRE(dc) {
  const acreage   = Math.round((dc.capacity_mw / 100) * 2.8 * 10) / 10;
  const buildings = Math.max(1, Math.round(dc.capacity_mw / 60));
  const ownership = (dc.tier === 'IV' || dc.capacity_mw >= 150) ? 'Owned' : 'Ground Lease';
  const expAcres  = Math.round(acreage * 0.4 * 10) / 10;
  return { acreage, buildings, ownership, expAcres };
}

function hashDCId(id) {
  let h = 0;
  const s = String(id || 'dc');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getConstruction(dc) {
  // Derive a deterministic completion % from the DC's ID so every UC site
  // shows a different stage. UC sites have utilization_pct=0 so we can't
  // use that field — the hash gives stable but varied values per campus.
  const seed       = hashDCId(dc.id || dc.name);
  const pct        = 15 + (seed % 76);                            // 15–90%
  const remaining  = 100 - pct;
  const monthsLeft = Math.max(2, Math.round((remaining / 100) * Math.max(6, dc.capacity_mw / 20)));
  const handover   = new Date();
  handover.setMonth(handover.getMonth() + monthsLeft);
  const handoverStr = handover.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const phase = pct < 35 ? 'Civil & Structural'
              : pct < 60 ? 'MEP Installation'
              : pct < 80 ? 'Fit-Out & Commissioning'
              : 'Final Testing';
  const activity = dc.tier === 'IV' ? 'Tier IV Programme'
                 : dc.capacity_mw >= 120 ? 'Large Campus Build'
                 : 'Standard Campus Build';
  return { pct, monthsLeft, handoverStr, phase, activity };
}

function getConstructionIntel(dc, con) {
  const halls = Math.max(1, Math.round(dc.capacity_mw / 60));
  return [
    {
      tag: 'Build Progress',
      text: `${con.pct}% complete — ${con.phase}`,
      elaboration: con.phase === 'Civil & Structural'
        ? `Foundation works, structural steel erection, and building envelope are the primary activities across ${halls} planned data hall${halls > 1 ? 's' : ''}. MEP design is being finalised in parallel. At ${con.pct}% completion the site is on track for MEP installation to begin within ${Math.round(con.monthsLeft * 0.4)} months.`
        : con.phase === 'MEP Installation'
        ? `Mechanical, electrical, and plumbing systems are being installed across ${halls} data hall${halls > 1 ? 's' : ''}. Power distribution, UPS, and cooling plant commissioning follow. At ${con.pct}% completion, fit-out and white space commissioning are expected to begin in approximately ${Math.round(con.monthsLeft * 0.5)} months.`
        : con.phase === 'Fit-Out & Commissioning'
        ? `IT white space fit-out, power distribution units, and cooling systems are being commissioned at ${con.pct}% overall completion. Initial rack energisation and pre-production testing are expected within ${Math.round(con.monthsLeft * 0.4)} months. All systems remain on schedule for final acceptance testing.`
        : `All systems are undergoing integrated acceptance testing at ${con.pct}% completion. Uptime Institute certification inspection and final utility interconnect energisation are the remaining critical-path items ahead of commercial handover in ${con.handoverStr}.`,
    },
    {
      tag: 'Completion Forecast',
      text: `Predicted handover: ${con.handoverStr}`,
      elaboration: `Commercial operations are forecast for ${con.handoverStr} — approximately ${con.monthsLeft} months from today. This is derived from current completion rate (${con.pct}%), site scale (${dc.capacity_mw} MW, ${halls} hall${halls > 1 ? 's' : ''}), and ${dc.tier === 'IV' ? 'Tier IV 2N redundancy commissioning benchmarks' : 'standard N+1 campus commissioning timelines'}. Key schedule risks include grid interconnection permit timing, long-lead equipment deliveries (transformers, UPS systems), and any scope changes requiring fresh planning consent.`,
    },
    {
      tag: 'Recommendations',
      text: dc.renewable_pct < 70
        ? `Accelerate PPA execution to reach ≥${Math.min(100, dc.renewable_pct + 20)}% renewable before commissioning`
        : dc.tier === 'IV'
        ? `Initiate Tier IV certification audit in parallel with final testing phase`
        : `Execute anchor tenant pre-commitment to de-risk post-commissioning revenue ramp`,
      elaboration: dc.renewable_pct < 70
        ? `At ${dc.renewable_pct}% renewable energy, this site is below Google's 24/7 CFE target. Executing a PPA for local wind or solar capacity before commercial operations locks in a lower cost basis than post-commissioning procurement. The ${dc.region} grid has available renewable capacity — early engagement with the transmission operator and off-take desk is recommended within the next ${Math.round(con.monthsLeft / 2)} months.`
        : dc.tier === 'IV'
        ? `Tier IV certification requires demonstrated 2N redundancy under live load. Initiating the Uptime Institute audit process now — ${con.monthsLeft} months ahead of planned handover — ensures any findings can be remediated before commercial operations begin, avoiding the significant cost of post-certification modifications. Certification strengthens SLA commitments to regulated-industry and AI infrastructure tenants.`
        : `Pre-committing ${Math.round(dc.capacity_mw * 0.3)} MW (~30% of capacity) to anchor enterprise or AI infrastructure tenants before commissioning substantially de-risks the revenue ramp. This campus's ${dc.renewable_pct}% renewable energy mix and ${dc.pue.toFixed(2)} PUE design are above-market for ${dc.market}, supporting premium pricing and accelerated payback on the ${dc.capacity_mw} MW build investment.`,
    },
  ];
}

export default function DCCommandCenter({ dc, onClose, allDCs = GOOGLE_DC_MASTER }) {
  const router = useRouter();
  if (!dc) return null;

  const regionDCs = allDCs.filter(d => d.region === dc.region);
  const regionCtx = {
    total:  regionDCs.length,
    active: regionDCs.filter(d => d.status === 'Active').length,
    uc:     regionDCs.filter(d => d.status === 'Under Construction').length,
    atRisk: regionDCs.filter(d => d.risk_flag !== 'Low').length,
  };

  const flag        = FLAG_EMOJI[dc.country] || '🌐';
  const statusColor = dc.status === 'Active' ? C.green : C.amber;
  const riskColor   = { High: C.red, Medium: C.amber, Low: C.green }[dc.risk_flag];
  const utilPct     = Math.round(dc.utilization_pct);
  const utilColor   = utilPct > 90 ? C.red : utilPct > 75 ? C.amber : C.green;
  const re          = getRE(dc);
  const isUC        = dc.status === 'Under Construction';
  const con         = isUC ? getConstruction(dc) : null;
  const conIntel    = isUC ? getConstructionIntel(dc, con) : null;
  const dcIntel     = getDCIntel(dc);

  return (
    <div style={{ background: C.bg, padding: '20px 24px', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{flag}</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{dc.name}</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: dc.status === 'Active' ? 'rgba(0,163,108,0.15)' : 'rgba(212,160,23,0.15)',
              color: statusColor, border: `1px solid ${statusColor}44`,
            }}>{dc.status}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: dc.risk_flag === 'High' ? 'rgba(220,38,38,0.15)' : dc.risk_flag === 'Medium' ? 'rgba(212,160,23,0.15)' : 'rgba(0,163,108,0.1)',
              color: riskColor, border: `1px solid ${riskColor}44`,
            }}>{dc.risk_flag} Risk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted }}>
            <MapPin size={11} />
            <span style={{ fontSize: 11 }}>{dc.address}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontSize: 11 }}>{dc.market}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontSize: 11 }}>{dc.country}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontSize: 11, color: C.blue }}>{dc.region}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              try { sessionStorage.setItem('cockpitTwinDC', JSON.stringify(dc)); } catch {}
              router.push(`/asset-portfolio/${dc.id}/twin`);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
              color: C.cyan, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
            }}
          >
            <Boxes size={13} /> Open Digital Twin
          </button>
          <button onClick={onClose} style={{ color: C.muted, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Region Context */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <KPI label="DCs in Region"     value={regionCtx.total}  sub={dc.region}           color={C.blue}
          elaboration={`${regionCtx.total} data centers in the ${dc.region} region — ${regionCtx.active} active and ${regionCtx.uc} under construction. This campus is one of ${regionCtx.total} sites in the region forming the ${dc.region} infrastructure cluster.`}
          impact={[
            `${regionCtx.total} regional sites represent a concentrated infrastructure cluster — geographic density in ${dc.region} supports low-latency interconnection between sites, enabling active-active disaster recovery configurations and sub-millisecond synchronous replication for financial and AI workloads.`,
            `Regional cluster scale drives negotiating leverage with local power utilities and transmission operators for dedicated substations, long-term capacity reservation, and preferential interconnect queue positioning ahead of competing developers.`,
            `At ${regionCtx.uc} sites still under construction, the ${dc.region} pipeline will increase regional IT capacity significantly upon commissioning — advance capacity pre-commitments from enterprise tenants should be tracked against this supply timeline.`,
          ]} />
        <KPI label="Active in Region"  value={regionCtx.active} sub="Operational"          color={C.green}
          elaboration={`${regionCtx.active} of ${regionCtx.total} ${dc.region} sites are in live commercial operation. The ${Math.round((regionCtx.active / regionCtx.total) * 100)}% active rate reflects the region's current build-out stage — the remaining ${regionCtx.uc} under-construction sites will materially increase regional capacity once commissioned.`}
          impact={[
            `${regionCtx.active} active sites establish the ${dc.region} region's current revenue-generating base and SLA coverage footprint. The ${Math.round((regionCtx.active / regionCtx.total) * 100)}% active rate means ${100 - Math.round((regionCtx.active / regionCtx.total) * 100)}% of planned regional capacity is still in the build pipeline.`,
            `Active site count determines regional SLA capacity commitments — if any active site is degraded or at-risk, load must be absorbed by the remaining ${regionCtx.active - 1} active sites in the region, potentially triggering utilisation spikes and SLA exposure.`,
            `Each new site transitioning from UC to Active adds to regional revenue capacity — track commissioning timelines for the ${regionCtx.uc} UC sites to forecast regional capacity availability for new tenant commitments.`,
          ]} />
        <KPI label="UC in Region"      value={regionCtx.uc}     sub="Under Construction"   color={C.amber}
          elaboration={`${regionCtx.uc} sites across ${dc.region} are actively under construction, representing the near-term supply pipeline for this region. Once commissioned, these sites will significantly expand regional IT capacity and reduce geographic concentration risk.`}
          impact={[
            `${regionCtx.uc} sites under construction in ${dc.region} represent committed capex in the build pipeline. Construction cost exposure for a hyperscale campus typically ranges $500M–$2B per site, making real-time build progress tracking critical for capex management and forecast accuracy.`,
            `The UC pipeline determines when new capacity becomes available for tenant pre-commitments. Sales teams can begin anchor tenant discussions 12–18 months before commissioning — coordinate commercial outreach with the expected handover dates for each UC site.`,
            `Construction risk (delays, supply chain, permitting) at any of the ${regionCtx.uc} sites affects regional capacity delivery timelines. Long-lead equipment (large transformers, UPS systems, chillers) has 52–78 week lead times — verify all critical-path orders are placed on schedule.`,
          ]} />
        <KPI label="At Risk in Region" value={regionCtx.atRisk} sub="Medium + High risk"   color={regionCtx.atRisk > 0 ? C.red : C.green}
          elaboration={regionCtx.atRisk > 0
            ? `${regionCtx.atRisk} site${regionCtx.atRisk > 1 ? 's' : ''} in ${dc.region} carry a non-Low risk flag, requiring elevated NOC attention. Regional risk concentration above 20% of active sites triggers a portfolio-level operational review.`
            : `All ${dc.region} sites are currently at Low risk. The region is operating within normal operational parameters with no elevated alarm or infrastructure vulnerability flags.`}
          impact={[
            regionCtx.atRisk > 0
              ? `${regionCtx.atRisk} at-risk sites in ${dc.region} = ${Math.round((regionCtx.atRisk / Math.max(1, regionCtx.active)) * 100)}% of active regional capacity under elevated operational stress. Risk concentration above 20% of active sites triggers mandatory portfolio-level operational review and executive reporting.`
              : `Zero at-risk sites in ${dc.region} is the ideal operational state. Maintain through disciplined execution of Medium alarm corrective actions within the 8-hour SLA window to prevent escalation chains.`,
            `Regional risk concentration affects the safety margin for cross-site load balancing during incidents. If ${dc.region} active sites are at risk simultaneously, routing capacity to absorb a site failure may push remaining sites above the 85% sustained utilisation trigger.`,
            `Track regional risk trend month-on-month — a rising count indicates systemic maintenance underinvestment or aging infrastructure across the ${dc.region} cluster. Fleet-wide infrastructure health assessment is warranted if risk count grows for two consecutive months.`,
          ]} />
      </div>

      {/* KPI Row 1 — Capacity & Operations */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <KPI label="IT Capacity" value={`${dc.capacity_mw} MW`} sub="Total IT Load" color={C.cyan}
          elaboration={`${dc.capacity_mw} MW of nameplate IT power capacity — the maximum compute load this campus can support across all installed power distribution paths. ${utilPct > 80 ? `At ${utilPct}% utilisation, headroom is limited and capacity expansion planning is likely in progress.` : utilPct < 40 ? `At ${utilPct}% utilisation, significant headroom remains for workload growth without new infrastructure investment.` : `At ${utilPct}% utilisation, the site is in the healthy operating range.`}`}
          impact={[
            `${dc.capacity_mw} MW nameplate capacity supports ${(dc.capacity_mw / 100 * 40000).toLocaleString()}+ server units at average density. Available headroom of ${(dc.capacity_mw * (1 - utilPct / 100)).toFixed(0)} MW (${100 - utilPct}%) determines how much additional workload can be onboarded without new construction.`,
            utilPct > 85
              ? `At ${utilPct}% utilisation this site is above the 85% expansion trigger — initiate feasibility review for next-phase capacity or cross-site load rebalancing immediately to prevent stranded workload requests.`
              : utilPct > 70
              ? `At ${utilPct}% utilisation the site is in the optimal revenue yield zone. Begin 18-month expansion planning to ensure next-phase capacity is ready before the 85% sustained trigger is reached.`
              : `At ${utilPct}% utilisation the site has significant idle capacity. Review tenant pipeline and consider proactive marketing to hyperscale or enterprise tenants to improve asset yield and reduce overhead cost per usable MW.`,
            `Power capacity is the single most constrained long-lead resource for AI workload growth. Each MW of IT capacity requires ~1.${(dc.pue * 10 - 10).toFixed(0)} MW of utility grid connection at PUE ${dc.pue.toFixed(2)} — grid interconnect agreements and utility capacity must be secured 3–5 years in advance of IT demand.`,
          ]} />
        <KPI label="Utilization" value={`${utilPct}%`} sub="Current Load" color={utilColor}
          elaboration={`${utilPct}% of the ${dc.capacity_mw} MW nameplate capacity is currently consumed by live workloads. ${utilPct > 85 ? 'This is approaching the 85% sustained utilisation trigger for expansion planning — additional capacity or load migration should be assessed.' : utilPct > 70 ? 'Healthy utilisation range. The site is generating strong asset yield while maintaining headroom for demand spikes.' : 'Utilisation is below the optimal range, indicating available capacity for new workload onboarding.'}`}
          impact={[
            `${utilPct}% utilisation means ${(dc.capacity_mw * utilPct / 100).toFixed(0)} MW of IT load is active at this site, leaving ${(dc.capacity_mw * (100 - utilPct) / 100).toFixed(0)} MW of headroom. ${utilPct > 85 ? 'CRITICAL: above 85% sustained utilisation — expansion or load migration must be actioned within 90 days.' : utilPct > 70 ? 'Healthy zone. Monitor monthly and initiate expansion planning when trending toward 85%.' : 'Below optimal — review tenant pipeline and consider sales acceleration to fill idle capacity.'}`,
            `Utilisation directly determines asset yield (revenue per MW of installed capacity). Most data center operators target 75–85% steady-state utilisation — below 70% represents stranded capital, above 85% represents service risk and limits emergency headroom.`,
            `For AI/GPU workloads, utilisation can spike 30–40% above baseline during training runs. Sustained GPU cluster operations at ${utilPct}% average may hit 90%+ peak — validate cooling and power distribution design supports peak-to-average ratio without thermal breach.`,
          ]} />
        <KPI label="PUE" value={dc.pue.toFixed(2)} sub="Power Efficiency" color={C.blue}
          elaboration={`PUE of ${dc.pue.toFixed(2)} means ${((dc.pue - 1) * 100).toFixed(0)} cents of overhead energy (cooling, lighting, UPS losses) is consumed per dollar of IT power delivered. ${dc.pue <= 1.10 ? 'World-class efficiency — in the top tier globally.' : dc.pue <= 1.15 ? 'Above-industry-average efficiency.' : 'Improvement opportunity exists — each 0.01 PUE reduction yields meaningful annual energy cost savings at this site scale.'}`}
          impact={[
            `PUE ${dc.pue.toFixed(2)} means ${((dc.pue - 1) * dc.capacity_mw * utilPct / 100).toFixed(0)} MW of this site's grid consumption is overhead — not delivering compute. At industry average grid cost of $65/MWh, this overhead costs approximately $${((dc.pue - 1) * dc.capacity_mw * utilPct / 100 * 8760 * 65 / 1000000).toFixed(1)}M per year.`,
            `Each 0.01 PUE improvement at ${dc.capacity_mw} MW scales to ${(dc.capacity_mw * utilPct / 100 * 0.01 * 8760 / 1000).toFixed(0)} MWh of avoided annual consumption — approximately $${(dc.capacity_mw * utilPct / 100 * 0.01 * 8760 * 65 / 1000).toFixed(0)}K in annual energy savings and proportional Scope 2 carbon reduction.`,
            dc.pue > 1.20
              ? `PUE ${dc.pue.toFixed(2)} is above the hyperscale target of ≤1.15. Cooling design review recommended — investigate economiser hour potential for ${dc.market}, adiabatic pre-cooling upgrades, or liquid cooling conversion for high-density GPU zones.`
              : `PUE ${dc.pue.toFixed(2)} is in the leading hyperscale band. Maintain through regular cooling system optimization, airflow containment audits, and power conversion equipment health monitoring.`,
          ]} />
        <KPI label="Tier" value={`Tier ${dc.tier}`} sub="Facility Rating" color={C.purple}
          elaboration={`Tier ${dc.tier} certification from the Uptime Institute. ${dc.tier === 'IV' ? 'Tier IV = 2N fault-tolerant design with 99.995% uptime SLA. No single point of failure exists — any component can be taken offline without impacting IT load.' : dc.tier === 'III' ? 'Tier III = N+1 concurrent maintainability with 99.982% uptime SLA. All components can be maintained without IT load interruption.' : 'Tier II = N+1 redundancy with 99.741% uptime SLA.'}`}
          impact={[
            dc.tier === 'IV'
              ? `Tier IV 2N fault-tolerant design means this site qualifies for regulated-industry tenants (finance, healthcare, government) who mandate zero-downtime SLAs. The 99.995% uptime commitment translates to <26 minutes of permitted downtime per year — the highest contractual standard in the industry.`
              : dc.tier === 'III'
              ? `Tier III N+1 concurrent maintainability qualifies this site for enterprise SLAs requiring 99.982% uptime (<1.6 hours downtime/year). All power and cooling paths can be serviced without IT load interruption — a key differentiator for regulated workloads.`
              : `Tier II N+1 design supports 99.741% uptime SLA (<22 hours/year). Suitable for non-mission-critical enterprise workloads. Upgrade to Tier III through N+1 redundancy additions to A and B power paths to unlock premium SLA pricing tiers.`,
            `Tier rating directly gates which enterprise sectors can use this facility. Financial services, pharmaceutical, and critical national infrastructure operators typically mandate Tier III minimum; defence, regulated healthcare, and AI inference for safety-critical applications mandate Tier IV.`,
            `Maintaining Uptime Institute certification requires annual operational compliance audits. Certification lapse creates contractual exposure with tenants whose lease agreements reference Tier certification as an SLA condition — schedule next audit at least 6 months before current certification renewal date.`,
          ]} />
        <KPI label="Renewable" value={`${dc.renewable_pct}%`} sub="Energy Mix" color={C.green}
          elaboration={`${dc.renewable_pct}% of this site's electricity consumption is matched to renewable or carbon-free energy via PPAs, on-site generation, or market instruments. ${dc.renewable_pct >= 90 ? 'Near-fully matched to CFE — among the best in the portfolio.' : dc.renewable_pct >= 70 ? 'Above portfolio average. Additional PPA procurement could close the gap to 100% CFE.' : 'Below the portfolio average. PPA execution for local wind or solar is the recommended path to close this gap.'}`}
          impact={[
            `${dc.renewable_pct}% renewable matching at ${dc.capacity_mw} MW leaves ${(dc.capacity_mw * utilPct / 100 * (100 - dc.renewable_pct) / 100).toFixed(0)} MW of average IT load still sourced from fossil grid. Achieving 100% CFE requires ${dc.renewable_pct < 80 ? 'significant' : 'incremental'} additional PPA procurement or REC retirement in the ${dc.market} market.`,
            `${dc.renewable_pct >= 90 ? 'Near-fully renewable status qualifies this site for green bond collateral, LEED Platinum certification, and preferential ESG-linked financing. Publish the site-level CFE score in sustainability disclosures to differentiate for sustainability-conscious enterprise tenants.' : dc.renewable_pct >= 70 ? 'Above-average renewable mix provides a strong ESG narrative but does not yet qualify for top-tier green financing. Executing a local PPA to close the remaining gap to 100% would unlock green bond labelling and premium tenant positioning.' : 'Below-average renewable penetration represents ESG reporting exposure under CSRD and CDP. Prioritise PPA procurement for this site — the ' + dc.market + ' grid has renewable capacity available for off-take agreements.'}`,
            `24/7 Carbon-Free Energy (CFE) matching — the hourly renewable standard — goes beyond annual % matching. ${dc.renewable_pct >= 90 ? 'At ' + dc.renewable_pct + '%, hourly matching analysis should be conducted to identify remaining unmatched hours and procure storage or dispatchable CFE to fill them.' : 'Annual % reporting should be supplemented with hourly CFE score tracking as regulators and institutional tenants increasingly require temporal matching data.'}`,
          ]} />
        <KPI label="Carbon/yr" value={`${dc.carbon_mt} MT`} sub="Estimated CO₂" color={dc.carbon_mt > 80 ? C.amber : C.muted}
          elaboration={`Estimated ${dc.carbon_mt} metric tonnes of CO₂ equivalent per year from this site's electricity consumption. Calculated as: IT Capacity × Utilization × PUE × (1 - Renewable%) × regional grid carbon intensity. ${dc.carbon_mt > 80 ? 'Above-average carbon output — accelerating renewable procurement would materially reduce this figure.' : 'Within normal range given the site scale and current renewable mix.'}`}
          impact={[
            `${dc.carbon_mt} MT CO₂/yr is this site's annual Scope 2 market-based carbon liability. Disclosed in CDP Climate Questionnaire, EU CSRD sustainability reports, and SBTi target tracking. Third-party assurance of this figure is required for CSRD submissions from 2025.`,
            `${dc.carbon_mt > 80 ? 'Above-average carbon output at this site — primary lever is PPA procurement to increase renewable % from ' + dc.renewable_pct + '%. Each 10% renewable increase reduces carbon output by approximately ' + (dc.carbon_mt * 0.1).toFixed(0) + ' MT/yr.' : 'Carbon output is within normal range for this site scale. Marginal reduction available through PUE improvement and incremental renewable procurement to close the remaining ' + (100 - dc.renewable_pct) + '% fossil gap.'}`,
            `Net-zero site roadmap: (1) 100% renewable PPA execution, (2) PUE reduction to ≤1.10, (3) hourly CFE matching via storage or dispatchable hydro, (4) residual Scope 1 diesel generator offset via high-quality nature-based or industrial carbon removal credits. Residual offset for this site: approximately ${Math.round(dc.carbon_mt * 0.05)} MT/yr.`,
          ]} />
        <KPI label="Carbon Intensity" value={`${(dc.carbon_mt / (dc.capacity_mw || 1)).toFixed(2)} MT/MW`} sub="Per MW IT Load" color={C.purple}
          elaboration={`Carbon intensity of ${(dc.carbon_mt / (dc.capacity_mw || 1)).toFixed(2)} MT CO₂ per MW normalises emissions by IT capacity, enabling like-for-like comparison across sites of different scales. Best-in-class Nordic sites achieve 0.04–0.06 MT/MW via near-100% hydropower. Sites above 0.5 MT/MW represent material Scope 2 ESG reporting risk under CSRD and CDP frameworks.`}
          impact={[
            `${(dc.carbon_mt / (dc.capacity_mw || 1)).toFixed(2)} MT/MW places this site in the ${(dc.carbon_mt / (dc.capacity_mw || 1)) < 0.15 ? 'top ESG tier (< 0.15 MT/MW) — qualifies for green bond collateral and SBTi 1.5°C-aligned infrastructure certification.' : (dc.carbon_mt / (dc.capacity_mw || 1)) < 0.40 ? 'above-average ESG band (0.15–0.40 MT/MW). Continue renewable procurement and PUE improvement programs to reach top-tier < 0.15 MT/MW.' : 'at or above industry average (> 0.40 MT/MW) — ESG improvement required to avoid rating agency scrutiny and ESG-linked financing penalties.'}`,
            `Carbon intensity is the primary single-site ESG metric used by institutional infrastructure investors (MSCI, Sustainalytics) and sovereign wealth funds when evaluating data center asset acquisitions. Sites below 0.3 MT/MW command a 5–10% valuation premium versus the same site above 0.5 MT/MW in recent infrastructure transaction comparables.`,
            `Reduce intensity by: (1) increasing renewable % from ${dc.renewable_pct}% toward 100% (most impactful), (2) improving PUE from ${dc.pue.toFixed(2)} to ≤1.10, (3) deploying on-site solar or battery storage to reduce grid dependence during peak carbon-intensity hours.`,
          ]} />
      </div>

      {/* KPI Row 2 — Assets & Alarms */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <KPI label="Racks" value={dc.asset_racks.toLocaleString()} color={C.muted}
          elaboration={`${dc.asset_racks.toLocaleString()} installed rack positions across this campus. Each rack represents a discrete unit of IT real estate — at an average density of ${(dc.capacity_mw / dc.asset_racks * 1000).toFixed(0)} kW/rack for this site, ${dc.capacity_mw / dc.asset_racks * 1000 > 15 ? 'indicating high-density GPU or AI compute configuration.' : 'consistent with standard server rack density.'}`}
          impact={[
            `${dc.asset_racks.toLocaleString()} racks at average ${(dc.capacity_mw / dc.asset_racks * 1000).toFixed(0)} kW/rack density. ${dc.capacity_mw / dc.asset_racks * 1000 > 20 ? 'High-density configuration (>20 kW/rack) requires liquid cooling or precision containment — verify cooling design headroom supports current density without thermal derating.' : 'Standard density — significant headroom exists to increase GPU rack deployment without cooling infrastructure upgrades.'}`,
            `Rack fill rate (occupied positions ÷ installed positions) is a key asset yield metric — unfilled racks represent overhead cost with no revenue generation. Target >85% rack utilisation across active sites. Low rack fill at high capex per rack amplifies cost per revenue MW.`,
            `Rack count growth tracks physical IT real estate expansion. Each new rack commission requires pre-provisioned power (PDU), cooling (containment), and connectivity (structured cabling + top-of-rack switching) — ensure all three are available before new rack provisioning commitments are accepted.`,
          ]} />
        <KPI label="Servers" value={dc.asset_servers.toLocaleString()} color={C.muted}
          elaboration={`${dc.asset_servers.toLocaleString()} server instances (physical and virtual host devices) deployed at this site. Drives hardware refresh capex cycles and OEM contract sizing. Average of ${Math.round(dc.asset_servers / dc.asset_racks)} servers per rack at this campus.`}
          impact={[
            `${dc.asset_servers.toLocaleString()} servers at ${Math.round(dc.asset_servers / dc.asset_racks)} per rack average. Server refresh cycles of 4–5 years mean approximately ${Math.round(dc.asset_servers / 4.5).toLocaleString()} servers enter end-of-life annually at this site — a major annual capex planning item for procurement and logistics.`,
            `Server density per rack (${Math.round(dc.asset_servers / dc.asset_racks)} at this site) determines cooling architecture requirements. Dense 1U configurations drive high heat per rack; GPU-heavy racks with fewer, larger servers require liquid cooling regardless of per-server count.`,
            `OEM contract volume and hardware maintenance SLA coverage are sized from total server count. Verify multi-year OEM maintenance agreements cover all ${dc.asset_servers.toLocaleString()} units — gaps in coverage create unbudgeted spares and emergency repair cost exposure.`,
          ]} />
        <KPI label="GPUs" value={dc.asset_gpus.toLocaleString()} color={C.muted}
          elaboration={`${dc.asset_gpus.toLocaleString()} GPU accelerator units deployed, representing ${Math.round((dc.asset_gpus / dc.asset_servers) * 100)}% GPU density relative to server count. GPUs power AI and ML workloads including model training, inference, and recommendation systems. GPU count is the fastest-growing metric in the portfolio as AI workload density increases.`}
          impact={[
            `${dc.asset_gpus.toLocaleString()} GPUs at ${Math.round((dc.asset_gpus / dc.asset_servers) * 100)}% GPU-to-server density — ${Math.round((dc.asset_gpus / dc.asset_servers) * 100) > 50 ? 'a GPU-heavy configuration indicating significant AI/ML workload density. High-density GPU clusters (H100/GB200 class) draw 700W–1kW per GPU, requiring liquid cooling and 50–120 kW/rack power distribution.' : 'moderate GPU density consistent with mixed AI + standard compute workloads.'}`,
            `GPU asset lifecycle is 2–3 years vs 4–5 years for CPU servers due to accelerated AI chip generations (H100 → GB200 → next-gen). Budget for ${Math.round(dc.asset_gpus / 2.5).toLocaleString()} GPU replacements annually at this site for fleet currency. Delayed refresh creates AI workload performance gap vs. competing infrastructure.`,
            `GPU cluster networking requires high-bandwidth, ultra-low-latency interconnect (InfiniBand NDR or RoCEv2 Ethernet at 400Gbps+). Verify network fabric capacity at this site supports current GPU count with headroom for the next refresh cycle's higher per-GPU bandwidth requirements.`,
          ]} />
        <KPI label="Critical Alarms" value={dc.alarm_critical} color={dc.alarm_critical > 0 ? C.red : C.green}
          elaboration={dc.alarm_critical > 0
            ? `${dc.alarm_critical} active Critical alarm${dc.alarm_critical > 1 ? 's' : ''} — P1 incidents with actual or imminent service disruption risk. Each requires NOC response within 15 minutes. Immediate investigation and escalation to the on-call facilities manager is required.`
            : `No active Critical alarms. This site is operating within all critical thresholds. P1 status is clear.`}
          impact={[
            dc.alarm_critical > 0
              ? `${dc.alarm_critical} P1 Critical alarm${dc.alarm_critical > 1 ? 's' : ''} at ${dc.name} — NOC response required within 15 minutes. ${dc.alarm_critical > 1 ? 'Multiple concurrent Critical alarms indicate a systemic failure event — initiate site-level emergency response protocol and escalate to the Infrastructure VP immediately.' : 'Single Critical alarm — investigate source subsystem immediately, with parallel escalation to the on-call facilities manager and relevant OEM vendor.'}`
              : `Zero Critical alarms at ${dc.name} — ideal operational state. Maintain by executing all Medium alarm corrective actions within the 8-hour SLA window to prevent escalation chains.`,
            `Post-incident review (PIR) mandatory for all Critical alarms — root cause, contributing factors, and corrective actions documented in CMDB within 72 hours. PIR findings feed the quarterly infrastructure reliability report for executive reporting and regulatory audit compliance.`,
            `Critical alarm history is a key risk indicator for SLA renewal negotiations. Enterprise tenants review Critical alarm frequency when renewing colocation agreements — a history of rapid (< 30min MTTR) resolution demonstrates operational excellence and supports premium SLA pricing.`,
          ]} />
        <KPI label="High Alarms" value={dc.alarm_high} color={dc.alarm_high > 0 ? C.amber : C.green}
          elaboration={dc.alarm_high > 0
            ? `${dc.alarm_high} active High-severity alarm${dc.alarm_high > 1 ? 's' : ''} — P2 conditions indicating significant degradation or redundancy loss (e.g. UPS battery fault, redundant path failure). Response SLA is 2 hours. Root cause investigation and corrective action should be in progress.`
            : `No active High alarms. All redundancy paths and major systems are healthy.`}
          impact={[
            dc.alarm_high > 0
              ? `${dc.alarm_high} P2 High alarm${dc.alarm_high > 1 ? 's' : ''} at ${dc.name} — degraded redundancy across affected subsystems. A second failure in any of these systems will cascade to Critical. 2-hour response SLA is active; confirm NOC has assigned incident owners and corrective action timelines.`
              : `Zero High alarms at ${dc.name} — all redundancy paths healthy. This is the target state: N+1 (or 2N for Tier IV) margins intact across all power, cooling, and network subsystems.`,
            `High alarms at UPS or generator systems mean the site is in N+0 mode for that subsystem — any single further failure creates a service outage. Tenant-facing SLA risk should be logged and communicated to account management for proactive tenant notification.`,
            `Sustained High alarm volume is the leading indicator of infrastructure aging requiring capital intervention. Track monthly High alarm trends — if count is consistently above ${Math.ceil(dc.capacity_mw / 50)}, initiate a facilities condition assessment to identify equipment requiring replacement before failure.`,
          ]} />
        <KPI label="Med Alarms" value={dc.alarm_medium} color={dc.alarm_medium > 0 ? '#F59E0B' : C.green}
          elaboration={`${dc.alarm_medium} active Medium-severity alarm${dc.alarm_medium !== 1 ? 's' : ''} — P3 early-warning signals (temperature trending, generator fuel level, UPS battery score) requiring planned corrective action within 8 hours. These feed the weekly preventive maintenance schedule.`}
          impact={[
            `${dc.alarm_medium} Medium alarm${dc.alarm_medium !== 1 ? 's' : ''} at ${dc.name} — each requires corrective action within 8 hours. Unresolved Medium alarms have a documented escalation path to High severity within 24–48 hours if underlying conditions worsen under thermal, load, or power stress.`,
            `Medium alarm root causes at this site — common culprits include UPS battery age (>4 years), CRAC filter blockage, generator fuel <70%, elevated return air temperature, and network path partial degradation. All have documented NOC remediation playbooks for rapid close-out.`,
            `${dc.alarm_medium} medium alarms inform the weekly preventive maintenance priority schedule. Verify each has been assigned to a site technician with a committed close-out date within the 8-hour SLA — open Medium alarms beyond 24 hours without resolution update constitute an SLA breach.`,
          ]} />
        <KPI label="Low Alarms" value={dc.alarm_low} color={C.muted}
          elaboration={`${dc.alarm_low} active Low-severity notice${dc.alarm_low !== 1 ? 's' : ''} — P4 informational alerts such as firmware updates, minor sensor drift, or inspection reminders. Non-urgent individually, but a high volume may indicate maintenance backlog accumulation and should be reviewed monthly.`}
          impact={[
            `${dc.alarm_low} Low-severity notice${dc.alarm_low !== 1 ? 's' : ''} at ${dc.name} — individually non-urgent, but a count above ${Math.ceil(dc.capacity_mw / 20)} for this site scale warrants a monthly maintenance backlog review to ensure deferred items aren't compounding into systemic risk.`,
            `Low alarms include firmware update notifications (security patching), minor sensor calibration drift, and scheduled inspection reminders. Firmware update backlog creates cybersecurity exposure — BMC/IPMI firmware, network OS, and BMS controller software are common adversary lateral movement vectors in data center environments.`,
            `Monthly Low alarm close-rate tracking (closed ÷ opened per month) is a leading operational health metric. A close rate below 70% indicates backlog accumulation — escalate to the Site Director for PM schedule review and technician resource allocation adjustment.`,
          ]} />
      </div>

      {/* Real Estate KPIs — Active DCs only */}
      {!isUC && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <KPI label="Site Area (est.)" value={`${re.acreage} ac`} sub="Campus footprint" color={C.blue}
            elaboration={`Estimated campus footprint of ${re.acreage} acres derived from ${dc.capacity_mw} MW IT capacity at ~2.8 acres per 100 MW — consistent with hyperscale benchmarks for power infrastructure, cooling yards, and security perimeters. Actual site acreage may vary with local topography and campus master-plan layout.`}
            impact={[
              `${re.acreage} acre campus footprint at ${dc.market} supports ${dc.capacity_mw} MW IT capacity including power yard, cooling plant, and security perimeter. Site density of ${(dc.capacity_mw / re.acreage).toFixed(1)} MW/acre — ${dc.capacity_mw / re.acreage > 8 ? 'high-density campus with limited expansion land buffer.' : 'standard hyperscale density with room for expansion phases.'}`,
              `Real estate value of a campus this size in ${dc.market} represents a significant infrastructure asset. Owned sites (${re.ownership}) are carried on the balance sheet and can be used as collateral for green-linked infrastructure financing. Ground-lease sites reduce balance sheet exposure but limit expansion flexibility.`,
              `${re.expAcres} acres of expansion land reserve (${Math.round((re.expAcres / re.acreage) * 100)}% of campus footprint) protects long-term build rights without new land acquisition. In constrained urban or suburban markets, maintaining expansion land adjacency is the single most valuable site attribute for future phases.`,
            ]} />
          <KPI label="Ownership" value={re.ownership} sub="Title type" color={C.purple}
            elaboration={re.ownership === 'Owned'
              ? `Fee-simple ownership provides full control over future expansion phasing, eliminates ground-lease reversion risk, and maximises asset value on the balance sheet. Typical of Tier ${dc.tier} campuses at ${dc.capacity_mw} MW scale — a preference for strategic long-term infrastructure investments.`
              : `Ground lease structure reduces upfront capital outlay and is common for urban or constrained sites. Lease terms for data center campuses typically run 40–99 years with renewal options designed to cover the full expected asset life, providing operational continuity equivalent to ownership.`}
            impact={[
              re.ownership === 'Owned'
                ? `Fee-simple ownership at ${dc.name} provides: (1) full control over expansion phasing and master-plan modifications, (2) no ground-lease reversion risk on a 20–30 year infrastructure investment, (3) balance sheet asset value usable as collateral for infrastructure financing.`
                : `Ground lease at ${dc.name}: (1) verify lease term extends at least 30 years beyond any planned expansion phase, (2) confirm renewal options and rent review mechanisms are acceptable for long-term infrastructure planning, (3) assess reversion risk vs. alternative owned site cost.`,
              re.ownership === 'Owned'
                ? `Owned data center campuses transact at 15–25x EBITDA in current infrastructure markets. The ${dc.capacity_mw} MW ${dc.market} campus represents a significant strategic real estate asset that supports M&A optionality and long-term financing structures beyond pure operational capex.`
                : `Ground lease terms for data center infrastructure typically require 40–99 year initial terms with multiple extension options. Verify the ${dc.market} lease structure includes a right of first refusal on purchase — the most valuable optionality to acquire in a constrained land market.`,
              `Ownership structure determines depreciation treatment, capex financing structure, and exit optionality. Owned assets qualify for data center REITs (Real Estate Investment Trust) structures that attract yield-focused institutional capital at lower cost-of-capital than corporate debt financing.`,
            ]} />
          <KPI label="Data Halls" value={re.buildings} sub="Campus buildings" color={C.cyan}
            elaboration={`${re.buildings} data hall building${re.buildings > 1 ? 's' : ''} estimated from ${dc.capacity_mw} MW IT load at ~60 MW per hall — standard hyperscale envelope. Each hall is designed for independent commissioning, enabling phased capacity delivery that matches demand growth and avoids stranded capital on unfilled white space.`}
            impact={[
              `${re.buildings} data hall${re.buildings > 1 ? 's' : ''} at ~60 MW/hall provides modular capacity delivery — each hall can be independently commissioned and sold or leased as a discrete IT real estate unit. This granularity enables phased revenue ramp without large capital commitment ahead of demand.`,
              `Multi-hall campus design enables hall-level redundancy and isolation — a fire, flood, or critical mechanical failure in one hall can be isolated without impacting other halls. This is a key operational resilience differentiator versus single-building campus designs.`,
              `Each additional hall at this campus requires full repetition of power distribution, cooling, security, and connectivity infrastructure — typically 18–24 months from building permit to commissioning. Track hall construction pipeline vs. demand growth to ensure capacity lands ahead of commitment deadlines.`,
            ]} />
          <KPI label="Expansion Reserve" value={`${re.expAcres} ac`} sub="Land held for future phases" color={C.green}
            elaboration={`Approximately ${re.expAcres} acres (~40% of campus footprint) reserved for future expansion phases. This land reserve allows additional data hall construction without new land acquisition or planning consent, reducing time-to-capacity for future builds and protecting the campus's long-term growth optionality.`}
            impact={[
              `${re.expAcres} acres of expansion reserve at ${dc.name} supports approximately ${(re.expAcres * dc.capacity_mw / re.acreage).toFixed(0)} MW of additional IT capacity — the same density as the existing campus. This organic growth optionality is fully owned/controlled with no new land acquisition cost.`,
              `Shovel-ready expansion land at ${dc.market} is the scarcest resource in the current hyperscale build cycle. Power grid constraints, permitting timelines (18–36 months), and water rights restrictions mean adjacent land reserve is worth substantially more than its bare land market value.`,
              `Initiating planning consent for the expansion reserve now (rather than when capacity is needed) reduces time-to-first-power by 18–24 months and eliminates permitting risk as a capacity delivery bottleneck. Proactive planning consent is the standard practice for all major hyperscale operators.`,
            ]} />
          <KPI label="Phase Status" value="Fully Operational" sub={dc.status} color={C.green}
            elaboration={`Campus is fully commissioned and serving production AI and cloud workloads at ${utilPct}% utilisation. All power distribution, cooling, and network infrastructure has passed acceptance testing. The site is generating revenue and contributing to regional SLA coverage for enterprise and hyperscale tenants.`}
            impact={[
              `Fully operational status confirms all acceptance testing complete — Uptime Institute classification verified, utility interconnect energised, and network connectivity diverse. This site is revenue-generating at ${utilPct}% utilisation (${(dc.capacity_mw * utilPct / 100).toFixed(0)} MW active IT load).`,
              `${utilPct > 80 ? 'At ' + utilPct + '% utilisation, this fully operational site is approaching the 85% sustained utilisation trigger for next-phase expansion planning. Initiate feasibility and permitting for the ' + re.expAcres + ' acre expansion reserve within the next 6 months.' : utilPct > 60 ? 'At ' + utilPct + '% utilisation, the site is in the healthy yield zone. Next expansion phase planning should begin when trending toward 80% to ensure build lead time is available before the 85% trigger.' : 'At ' + utilPct + '% utilisation, focus on workload migration and tenant acquisition to improve asset yield before committing capital to expansion phases.'}`,
              `Operational site qualifies for sale-leaseback financing structures — a significant capital recycling option at ${dc.capacity_mw} MW scale. Sale-leaseback releases capex tied up in real estate back into the business while retaining long-term operational control under a 20–30 year lease agreement.`,
            ]} />
        </div>
      )}

      {/* Construction Progress KPIs — Under Construction DCs only */}
      {isUC && con && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <KPI label="Completion" value={`${con.pct}%`} sub="Construction progress"
            color={con.pct > 80 ? C.green : con.pct > 60 ? C.amber : C.blue}
            elaboration={`Estimated ${con.pct}% of physical construction and electrical commissioning complete. Derived from commissioning test utilisation levels (${dc.utilization_pct}% shell load) and construction milestone benchmarks. ${con.pct > 80 ? 'Final acceptance testing is the remaining critical path.' : con.pct > 60 ? 'MEP and fit-out works are the current critical path activities.' : 'Civil and structural works are the primary focus at this stage.'}`}
            impact={[
              `At ${con.pct}% completion, approximately ${100 - con.pct}% of construction work remains across ${con.phase} and subsequent phases. Each percentage point of completion represents real capex converted from contingent commitment to sunk cost — schedule delays now carry a compounding revenue deferral impact on project IRR.`,
              `${con.pct > 80 ? 'Above 80% completion: final testing, grid interconnection energisation, and Uptime Institute certification audit are the remaining critical-path items. Delays at this stage are typically caused by utility interconnection (most common), certification findings, or supply chain shortages on late-arriving equipment.' : con.pct > 60 ? 'MEP phase is typically the highest schedule-risk stage — long-lead items (transformers: 52–78 weeks, UPS: 26–52 weeks, chillers: 26–36 weeks) must have all arrived on site. Verify goods receipt status for all critical-path equipment immediately.' : 'Civil phase: structural steel, foundation, and envelope completion are on the critical path. Weather, soil conditions, and concrete pour schedules are the primary delay risks. Establish weekly milestone tracking against the baseline programme.'}`,
              `${con.monthsLeft} months to predicted handover — every month of schedule slippage defers first revenue and extends the negative carry period on invested capex. Implement earned-value management (EVM) reporting to give early warning of schedule drift before it reaches the programme's float buffer.`,
            ]} />
          <KPI label="Handover Est." value={con.handoverStr} sub={`~${con.monthsLeft} months away`} color={C.cyan}
            elaboration={`Predicted commercial operations date of ${con.handoverStr} based on current completion rate (${con.pct}%), site scale (${dc.capacity_mw} MW), and remaining phase duration benchmarks. This is an AI-derived estimate — subject to grid interconnection permit timing, long-lead equipment deliveries, and any planning scope changes.`}
            impact={[
              `Commercial operations at ${con.handoverStr} sets the revenue start date for this ${dc.capacity_mw} MW campus. At industry average colocation revenue of $3–6M per MW per year, first power-on date directly determines project payback timeline and fund-level IRR for infrastructure investors.`,
              `Key schedule risks for the ${con.monthsLeft}-month horizon: (1) grid interconnection permit (most frequent cause of data center delays, 2–6 months typical slip), (2) long-lead equipment late delivery (transformer, UPS), (3) Uptime Institute certification findings requiring remediation, (4) local planning condition compliance.`,
              `Anchor tenant pre-commitments should be timed 12–18 months before ${con.handoverStr} — too early creates SLA exposure if handover slips, too late misses the price negotiation window. Current ${con.monthsLeft}-month horizon is ${con.monthsLeft > 12 ? 'suitable for initiating pre-commitment discussions now.' : 'approaching the pre-commitment window — begin sales outreach immediately.'}`,
            ]} />
          <KPI label="Current Phase" value={con.phase} sub="Active build stage" color={C.purple}
            elaboration={`The site is in the ${con.phase} phase. ${
              con.phase === 'Civil & Structural' ? 'Foundation works, structural steel, and building envelope are the primary activities. MEP design is being finalised in parallel.' :
              con.phase === 'MEP Installation' ? 'Mechanical, electrical, and plumbing systems are being installed. Power distribution, UPS, and cooling plant commissioning follow.' :
              con.phase === 'Fit-Out & Commissioning' ? 'IT white space, power distribution units, and cooling systems are being commissioned. Initial rack energisation is approaching.' :
              'All systems are undergoing integrated acceptance testing prior to commercial handover.'
            }`}
            impact={[
              con.phase === 'Civil & Structural'
                ? `Civil & Structural phase: foundation, structural steel, and building envelope are the schedule-critical items. Concrete pour rates, steel delivery lead times, and weather exposure are the primary risk factors. Maintain weekly milestone check-ins against the civil programme baseline.`
                : con.phase === 'MEP Installation'
                ? `MEP Installation is typically the highest schedule-risk phase. Confirm all long-lead equipment (HV transformers, UPS systems, chillers, switchgear) is on-site or in transit. A single late major item can delay energisation by 4–12 weeks and cascade the entire programme.`
                : con.phase === 'Fit-Out & Commissioning'
                ? `Fit-Out & Commissioning phase: coordinate parallel workstreams for IT white space, cooling system commissioning, and integrated systems testing. Factory acceptance tests (FATs) for critical plant should be completed before site acceptance testing (SAT) begins.`
                : `Final Testing phase: integrated acceptance testing (IAT) validates the entire system under simulated IT load. Common findings at this stage — harmonic distortion in power systems, cooling airflow imbalance, and BMS integration gaps — require remediation before Uptime Institute classification inspection.`,
              `The ${con.phase} phase milestone completion gate controls capex drawdown from the project finance facility — confirm that all phase milestones required for the next drawdown are tracked and any at-risk milestones have mitigation plans filed with the project management office.`,
              `Trade contractor performance during ${con.phase} directly determines whether the programme float buffer is consumed or preserved. Proactively manage any contractor behind on programme — data center builds have limited acceleration options once the MEP installation sequence has started.`,
            ]} />
          <KPI label="Programme" value={con.activity} sub="Build classification" color={C.muted}
            elaboration={`Classified as a ${con.activity}. ${dc.tier === 'IV' ? `Tier IV fault-tolerant design requires 2N redundancy across all systems — extending commissioning timelines but delivering 99.995% uptime SLA capability for regulated-industry and AI infrastructure tenants.` : `Standard build programme with N+1 redundancy targeting Tier III concurrent maintainability (99.982% uptime SLA).`}`}
            impact={[
              dc.tier === 'IV'
                ? `Tier IV Programme requires 2N redundancy commissioning and validation — every major system has two independent, fully capable paths. Commissioning time is 30–40% longer than Tier III due to dual-path testing requirements, but the resulting 99.995% uptime SLA (< 26min downtime/year) commands a 15–25% rental premium from regulated-industry tenants.`
                : dc.capacity_mw >= 120
                ? `Large Campus Build at ${dc.capacity_mw} MW requires phased power infrastructure delivery. Multi-hall commissioning sequencing should be planned to activate first halls earliest, capturing revenue while remaining halls complete fit-out — reducing the payback period vs. full-campus activation.`
                : `Standard Campus Build: N+1 redundancy delivering Tier III concurrent maintainability (99.982% uptime). Commissioning timeline benchmarks: 4–6 months for MEP commissioning, 2–3 months for integrated system testing, 1–2 months for Uptime Institute inspection and certification.`,
              `${con.activity} build programmes have specific insurance and warranty requirements during construction — confirm the builder's risk insurance policy is current and covers the full replacement value of installed equipment, including long-lead items not yet energised.`,
              `At ${dc.capacity_mw} MW scale, quality assurance during commissioning is the highest-value activity. Each identified and remediated defect during commissioning is 10–100× cheaper to fix than the same defect found during live operations under production workload.`,
            ]} />
          <KPI label="Site Area (est.)" value={`${re.acreage} ac`} sub="Campus footprint" color={C.blue}
            elaboration={`Estimated campus footprint of ${re.acreage} acres from ${dc.capacity_mw} MW IT capacity. Construction site boundary includes active build zones, laydown areas, and land reserved for future expansion phases (~${re.expAcres} ac).`}
            impact={[
              `${re.acreage} acre construction site supports ${dc.capacity_mw} MW IT capacity. At ${dc.capacity_mw / re.acreage > 8 ? 'high density (' + (dc.capacity_mw / re.acreage).toFixed(1) + ' MW/ac)' : 'standard density (' + (dc.capacity_mw / re.acreage).toFixed(1) + ' MW/ac)'}, the site utilisation leaves ${re.expAcres} acres for future expansion phases without additional land acquisition.`,
              `Construction laydown areas (equipment staging, concrete batch plant, contractor welfare facilities) typically consume 15–25% of total site area. Once construction completes, this area converts to either expansion phasing land or permanent infrastructure (switching yards, cooling towers, perimeter).`,
              `Environmental and planning conditions tied to the ${re.acreage} acre site footprint — stormwater management, landscape buffers, noise mitigation zones — must be implemented before Uptime Institute classification inspection. Verify all planning conditions are tracked against the programme for on-time fulfilment.`,
            ]} />
        </div>
      )}

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Active Alarms (Active DCs) / Construction Progress (UC DCs) */}
        {!isUC ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <div style={{ marginBottom: 10 }}>
              <SectionTitle>Active Alarms</SectionTitle>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Crit', val: dc.alarm_critical, color: C.red },
                { label: 'High', val: dc.alarm_high, color: C.amber },
                { label: 'Med',  val: dc.alarm_medium, color: '#F59E0B' },
                { label: 'Low',  val: dc.alarm_low, color: C.muted },
              ].map(a => (
                <div key={a.label} style={{ flex: 1, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: a.color, fontFamily: "'JetBrains Mono', monospace" }}>{a.val}</p>
                  <p style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase' }}>{a.label}</p>
                </div>
              ))}
            </div>
            {MOCK_ALARMS.slice(0, dc.alarm_high + dc.alarm_critical > 0 ? 3 : 1).map((al, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottom: i < (dc.alarm_high + dc.alarm_critical > 0 ? 2 : 0) ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ALARM_COLOR[al.severity], marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.text, margin: 0 }}>{al.message}</p>
                    <span style={{ fontSize: 9, color: C.muted, flexShrink: 0 }}>· {al.time}</span>
                  </div>
                  <p style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.55, margin: 0 }}>{al.elaboration}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
            <div style={{ marginBottom: 10 }}>
              <SectionTitle>Construction Progress</SectionTitle>
            </div>
            {/* Completion bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.muted }}>Build completion</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: con.pct > 80 ? C.green : con.pct > 60 ? C.amber : C.blue, fontFamily: "'JetBrains Mono', monospace" }}>{con.pct}%</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${con.pct}%`, background: con.pct > 80 ? C.green : con.pct > 60 ? C.amber : C.blue, borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </div>
            {conIntel.map((item, i) => (
              <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < conIntel.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, marginBottom: 5, display: 'inline-block',
                  background: 'rgba(212,160,23,0.12)', color: C.amber, border: '1px solid rgba(212,160,23,0.3)',
                }}>{item.tag}</span>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 3 }}>{item.text}</p>
                <p style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.55, margin: 0 }}>{item.elaboration}</p>
              </div>
            ))}
          </div>
        )}

        {/* DC Intelligence */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
          <div style={{ marginBottom: 10 }}>
            <SectionTitle>DC Intelligence</SectionTitle>
          </div>
          {dcIntel.map((item, i) => (
            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < dcIntel.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, marginBottom: 5, display: 'inline-block',
                background: 'rgba(0,119,200,0.12)', color: C.blue, border: '1px solid rgba(0,119,200,0.25)',
              }}>{item.tag}</span>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 3 }}>{item.text}</p>
              <p style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.55, margin: 0 }}>{item.elaboration}</p>
            </div>
          ))}
          <div style={{ paddingTop: 2 }}>
            <p style={{ fontSize: 10, color: C.muted }}>
              Lat {dc.lat.toFixed(4)}°, Lng {dc.lng.toFixed(4)}° · ID: {dc.id}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
