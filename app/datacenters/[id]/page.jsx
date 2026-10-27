'use client';
import { useState, use, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Server, AlertTriangle, Zap, Thermometer, Network, Shield, Activity, Leaf, Users } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockDatacenters, mockIncidents, mockTenants, mockDCInfrastructure, mockSustainability, mockZoneHealth } from '@/data/mock/index';
import { nexusZoneHealth } from '@/lib/nexus/zone-health';
import { facilitySummary } from '@/lib/nexus/portfolio';

const DigitalTwinViewer = dynamic(() => import('@/components/datacenters/DigitalTwinViewer'), { ssr: false });
const LiveStatsDashboard = dynamic(() => import('@/components/datacenters/LiveStatsDashboard'), { ssr: false });

const STATUS_CONFIG = {
  healthy:  { label: 'Healthy',  color: '#00B0A0', bg: '#F0FDF4' },
  degraded: { label: 'Degraded', color: '#E87722', bg: '#FFFBEB' },
  critical: { label: 'Critical', color: '#C8102E', bg: '#FEF2F2' },
};

// Health from the operating record (lib/nexus/portfolio.js), worst open alert first.
const RECORD_HEALTH = {
  critical: { label: 'Critical', color: '#C8102E' },
  serious:  { label: 'Serious',  color: '#B54708' },
  warning:  { label: 'Warning',  color: '#E87722' },
  good:     { label: 'Good',     color: '#00B0A0' },
};

const SEV_CONFIG = {
  critical: { color: '#C8102E', bg: '#FEF2F2' },
  high:     { color: '#D97706', bg: '#FFFBEB' },
  medium:   { color: '#E87722', bg: '#FFFBEB' },
  low:      { color: '#005EB8', bg: '#EFF6FF' },
};

function StatCard({ label, value, sub, color = '#1A1F36' }) {
  return (
    <div className="bg-[#F0F2F5] rounded-xl p-3">
      <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-lg font-bold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
      {sub && <p className="text-[10px] text-[#9CA3AF] mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthBar({ pct, label }) {
  const color = pct >= 95 ? '#00B0A0' : pct >= 80 ? '#E87722' : '#C8102E';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-[#6B7280]">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function OverviewTab({ dc, infra }) {
  const recentActivity = [
    { time: '2h ago', event: `Utilization updated — ${dc.utilizationPercent}% of ${dc.totalCapacityMW}MW` },
    { time: '6h ago', event: 'Automated health check completed — all systems nominal' },
    { time: '1d ago', event: 'Monthly capacity report generated' },
    { time: '2d ago', event: 'Security access log audit completed' },
    { time: '3d ago', event: 'DCIM telemetry calibration performed' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Racks" value={dc.totalRacks.toLocaleString()} sub={`${dc.usedRacks} in use`} />
        <StatCard label="Utilization" value={`${dc.utilizationPercent}%`} color={dc.utilizationPercent > 85 ? '#C8102E' : '#005EB8'} sub="of total capacity" />
        <StatCard label="Total Power" value={`${dc.totalCapacityMW} MW`} sub={`${Math.round(dc.totalCapacityMW * dc.utilizationPercent / 100)} MW drawn`} />
        <StatCard label="PUE" value={dc.pue.toFixed(2)} color={dc.pue < 1.4 ? '#00B0A0' : dc.pue < 1.6 ? '#E87722' : '#C8102E'} sub="power usage effectiveness" />
        <StatCard label="Active Incidents" value={dc.activeIncidents} color={dc.activeIncidents > 0 ? '#C8102E' : '#00B0A0'} sub={dc.activeIncidents === 0 ? 'no issues' : 'require attention'} />
        <StatCard label="Tenants" value={dc.tenantCount} sub={`${dc.tier} facility`} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#D8DCE3]">
          <p className="text-xs font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Key Contacts</p>
          <div className="space-y-3">
            {[{ role: 'Facility Manager', name: dc.manager }, { role: 'NOC Lead', name: dc.nocLead }].map(c => (
              <div key={c.role} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#005EB8] to-[#00338D] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">{c.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1A1F36]">{c.name}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{c.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#D8DCE3]">
          <p className="text-xs font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Recent Activity</p>
          <div className="space-y-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] text-[#9CA3AF] flex-shrink-0 w-10">{a.time}</span>
                <span className="text-[10px] text-[#6B7280]">{a.event}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfraTab({ infra }) {
  if (!infra) return <p className="text-sm text-[#9CA3AF] p-4">No infrastructure data available.</p>;
  const sections = [
    { id: 'power', label: 'Power Systems', icon: Zap, color: '#F59E0B' },
    { id: 'cooling', label: 'Cooling Systems', icon: Thermometer, color: '#005EB8' },
    { id: 'network', label: 'Network Fabric', icon: Network, color: '#00B0A0' },
    { id: 'security', label: 'Physical Security', icon: Shield, color: '#7C3AED' },
  ];
  const [open, setOpen] = useState('power');

  return (
    <div className="space-y-2">
      {sections.map(s => {
        const Icon = s.icon;
        const data = infra[s.id];
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="bg-white rounded-xl border border-[#D8DCE3] overflow-hidden">
            <button onClick={() => setOpen(isOpen ? null : s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors text-left">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.color + '15' }}>
                <Icon size={14} style={{ color: s.color }} />
              </div>
              <span className="text-sm font-semibold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{s.label}</span>
              {data?.utilizationPct && <HealthBar pct={data.utilizationPct} label="" />}
              <span className="ml-auto text-[#9CA3AF] text-sm">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-[#F0F2F5] pt-3">
                {s.id === 'power' && data && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Total Capacity" value={`${data.totalCapacityMW} MW`} />
                      <StatCard label="Current Load" value={`${data.currentLoadMW} MW`} />
                      <StatCard label="Redundancy" value={data.redundancy} color="#00338D" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1F36] mb-2">UPS Units</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-[#9CA3AF] text-[10px]"><th className="text-left py-1">ID</th><th className="text-left py-1">Status</th><th className="text-left py-1">Load %</th><th className="text-left py-1">Battery</th></tr></thead>
                          <tbody>{data.ups.map(u => (
                            <tr key={u.id} className="border-t border-[#F0F2F5]">
                              <td className="py-1.5 font-mono text-[#1A1F36]">{u.id}</td>
                              <td className="py-1.5"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: STATUS_CONFIG[u.status]?.bg || '#F0FDF4', color: STATUS_CONFIG[u.status]?.color || '#00B0A0' }}>{u.status}</span></td>
                              <td className="py-1.5 font-mono">{u.loadPct}%</td>
                              <td className="py-1.5 font-mono" style={{ color: u.batteryHealth < 70 ? '#C8102E' : '#00B0A0' }}>{u.batteryHealth}%</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {s.id === 'cooling' && data && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Total Capacity" value={`${data.totalCapacityKW} kW`} />
                      <StatCard label="Current Load" value={`${data.currentLoadKW} kW`} />
                      <StatCard label="Redundancy" value={data.redundancy} color="#00338D" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1F36] mb-2">CRAH Units</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-[#9CA3AF] text-[10px]"><th className="text-left py-1">ID</th><th className="text-left py-1">Status</th><th className="text-left py-1">Return Temp</th><th className="text-left py-1">Supply Temp</th></tr></thead>
                          <tbody>{data.crahUnits.map(c => (
                            <tr key={c.id} className="border-t border-[#F0F2F5]">
                              <td className="py-1.5 font-mono text-[#1A1F36]">{c.id}</td>
                              <td className="py-1.5"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: STATUS_CONFIG[c.status]?.bg || '#F0FDF4', color: STATUS_CONFIG[c.status]?.color || '#00B0A0' }}>{c.status}</span></td>
                              <td className="py-1.5 font-mono" style={{ color: c.returnTempC > 30 ? '#C8102E' : '#1A1F36' }}>{c.returnTempC}°C</td>
                              <td className="py-1.5 font-mono">{c.supplyTempC}°C</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {s.id === 'network' && data && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Bandwidth" value={`${data.totalBandwidthGbps} Gbps`} />
                      <StatCard label="Throughput" value={`${data.currentThroughputGbps} Gbps`} />
                      <StatCard label="Latency" value={`${data.latencyMs}ms`} color={data.latencyMs > 1 ? '#C8102E' : '#00B0A0'} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1F36] mb-2">Core Switches</p>
                      <table className="w-full text-xs">
                        <thead><tr className="text-[#9CA3AF] text-[10px]"><th className="text-left py-1">ID</th><th className="text-left py-1">Status</th><th className="text-left py-1">Port Utilization</th></tr></thead>
                        <tbody>{data.coreSwitches.map(sw => (
                          <tr key={sw.id} className="border-t border-[#F0F2F5]">
                            <td className="py-1.5 font-mono text-[#1A1F36]">{sw.id}</td>
                            <td className="py-1.5"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: STATUS_CONFIG[sw.status]?.bg || '#F0FDF4', color: STATUS_CONFIG[sw.status]?.color || '#00B0A0' }}>{sw.status}</span></td>
                            <td className="py-1.5"><div className="flex items-center gap-2"><div className="w-20 h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden"><div className="h-full rounded-full bg-[#005EB8]" style={{ width: `${sw.portUtilization}%` }} /></div><span className="font-mono">{sw.portUtilization}%</span></div></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
                {s.id === 'security' && data && (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="CCTV Cameras" value={`${data.cctvOnline}/${data.cctvCameras}`} color={data.cctvOnline < data.cctvCameras ? '#C8102E' : '#00B0A0'} sub="online/total" />
                    <StatCard label="Access Points" value={data.accessControlPoints} sub="controlled zones" />
                    <StatCard label="Mantrap Entries" value={data.mantrapEntries} sub="dual-auth" />
                    <StatCard label="Security Staff" value={`${data.securityStaff24x7} staff`} sub="24×7 on-site" />
                    <StatCard label="Last Breach" value="None" color="#00B0A0" sub="recorded" />
                    <div className="bg-[#F0F2F5] rounded-xl p-3">
                      <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-1">Certifications</p>
                      <div className="flex flex-wrap gap-1">{data.complianceCerts.map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#00338D]/10 text-[#00338D] rounded-full font-bold">{c}</span>)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TenantsTab({ dcId }) {
  const dcTenants = mockTenants.filter(t => t.allocations.some(a => a.dcId === dcId));
  return (
    <div className="space-y-3">
      {dcTenants.length === 0 && <p className="text-sm text-[#9CA3AF]">No tenants found for this facility.</p>}
      {dcTenants.map(t => {
        const alloc = t.allocations.find(a => a.dcId === dcId);
        if (!alloc) return null;
        const utilPct = Math.round(alloc.racksUsed / alloc.racksAllocated * 100);
        return (
          <div key={t.id} className="bg-white rounded-xl border border-[#D8DCE3] p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-sm" style={{ backgroundColor: t.color }}>
              {t.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{t.name}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: alloc.contractTier === 'Platinum' ? '#00338D15' : alloc.contractTier === 'Gold' ? '#E8772215' : '#6B728015', color: alloc.contractTier === 'Platinum' ? '#00338D' : alloc.contractTier === 'Gold' ? '#E87722' : '#6B7280' }}>{alloc.contractTier}</span>
              </div>
              <p className="text-xs text-[#9CA3AF]">{t.industry} · Expires {alloc.contractEndDate}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{alloc.racksUsed}/{alloc.racksAllocated}</p>
              <p className="text-[10px] text-[#9CA3AF]">racks used</p>
            </div>
            <div className="text-center w-20">
              <div className="h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden mb-0.5">
                <div className="h-full rounded-full" style={{ width: `${utilPct}%`, backgroundColor: utilPct > 90 ? '#C8102E' : utilPct > 75 ? '#E87722' : '#00B0A0' }} />
              </div>
              <p className="text-[10px] font-bold text-[#1A1F36]">{utilPct}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-[#00B0A0]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{alloc.monthlyRevenue}</p>
              <p className="text-[10px] text-[#9CA3AF]">per month</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IncidentsTab({ dcId }) {
  const dcIncidents = mockIncidents.filter(i => i.siteId === dcId);
  return (
    <div className="space-y-3">
      {dcIncidents.length === 0 && <div className="bg-[#F0FDF4] border border-[#00B0A0]/20 rounded-xl p-4 text-sm text-[#00B0A0] font-semibold">No active incidents for this facility.</div>}
      {dcIncidents.map(inc => {
        const sc = SEV_CONFIG[inc.severity] || SEV_CONFIG.medium;
        return (
          <div key={inc.id} className="bg-white rounded-xl border border-[#D8DCE3] p-4">
            <div className="flex items-start gap-3 mb-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex-shrink-0" style={{ backgroundColor: sc.bg, color: sc.color }}>{inc.severity}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1A1F36]">{inc.title}</p>
                <p className="text-[10px] text-[#9CA3AF] font-mono">{inc.id} · {inc.timeSinceDetection} ago · {inc.resolutionOwner}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#F0F2F5] text-[#6B7280] text-[10px] rounded-full font-medium">{inc.status}</span>
            </div>
            <p className="text-xs text-[#6B7280] mb-2">{inc.rootCause}</p>
            <div className="bg-[#EFF6FF] border border-[#005EB8]/20 rounded-lg p-2.5">
              <p className="text-[10px] font-bold text-[#005EB8] mb-0.5">AI Recommendation</p>
              <p className="text-[10px] text-[#1A1F36] leading-relaxed">{inc.aiRecommendation}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SustainabilityTab({ dcId }) {
  const s = mockSustainability.find(s => s.dcId === dcId);
  if (!s) return <p className="text-sm text-[#9CA3AF]">No sustainability data available.</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="PUE" value={s.pue.toFixed(2)} color={s.pue < 1.4 ? '#00B0A0' : s.pue < 1.6 ? '#E87722' : '#C8102E'} sub="power usage effectiveness" />
        <StatCard label="Renewable Energy" value={`${s.renewablePct}%`} color="#00B0A0" sub="of total consumption" />
        <StatCard label="Carbon Intensity" value={`${s.carbonIntensity}`} sub="tCO₂/MWh" />
        <StatCard label="WUE" value={`${s.wue} L/kWh`} sub="water usage effectiveness" />
        <StatCard label="ESG Score" value={`${s.esgScore}/100`} color={s.esgScore >= 80 ? '#00B0A0' : '#E87722'} sub="environmental score" />
      </div>
      <div className="bg-white rounded-xl border border-[#D8DCE3] p-4">
        <p className="text-xs font-bold text-[#1A1F36] mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Green Certifications</p>
        {s.certifications.length > 0
          ? <div className="flex flex-wrap gap-1.5">{s.certifications.map(c => <span key={c} className="text-xs px-2.5 py-1 bg-[#00B0A0]/10 text-[#00B0A0] rounded-full font-bold">{c}</span>)}</div>
          : <p className="text-xs text-[#9CA3AF]">No certifications yet — roadmap in development.</p>}
      </div>
      <div className="bg-white rounded-xl border border-[#D8DCE3] p-4">
        <p className="text-xs font-bold text-[#1A1F36] mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Sustainability Measures</p>
        <ul className="space-y-1.5">{s.measures.map((m, i) => <li key={i} className="text-xs text-[#6B7280] flex gap-2"><span className="text-[#00B0A0] flex-shrink-0">✓</span>{m}</li>)}</ul>
      </div>
    </div>
  );
}

const RIGHT_TABS = [
  { id: 'stats',     label: 'Live Stats',  Icon: Activity },
  { id: 'overview',  label: 'Overview',    Icon: Server },
  { id: 'infra',     label: 'Infra',       Icon: Zap },
  { id: 'tenants',   label: 'Tenants',     Icon: Users },
  { id: 'incidents', label: 'Incidents',   Icon: AlertTriangle },
  { id: 'esg',       label: 'ESG',         Icon: Leaf },
];

export default function DatacenterDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const dc = mockDatacenters.find(d => d.id === id);
  const infra = mockDCInfrastructure[id];
  // Mumbai-1 is in the operating record; its status comes from there.
  const zoneHealth = useMemo(() => (id === 'mum-1' ? nexusZoneHealth('MUM-1') : mockZoneHealth[id]), [id]);
  const [activeZoneId, setActiveZoneId] = useState(null);
  const [rightTab, setRightTab] = useState('stats');

  const handleHotspotChange = useCallback((zoneId) => {
    setActiveZoneId(zoneId);
  }, []);

  // Auto-switch to Live Stats when a hotspot is clicked so detail panel is visible
  useEffect(() => {
    if (activeZoneId) setRightTab('stats');
  }, [activeZoneId]);

  if (!dc) return (
    <CCLayout title="Datacenters">
      <div className="p-6 text-[#9CA3AF]">Datacenter not found.</div>
    </CCLayout>
  );

  const recordHealth = id === 'mum-1' ? RECORD_HEALTH[facilitySummary('MUM-1').health] : null;
  const sc = recordHealth ?? STATUS_CONFIG[dc.status] ?? STATUS_CONFIG.healthy;

  return (
    <CCLayout title={dc.name}>
      <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Left: Digital Twin — 60% */}
        <div className="flex-shrink-0 relative border-r border-[#D8DCE3]" style={{ width: '60%' }}>
          {/* Back button + DC name strip */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border-b border-[#D8DCE3]">
            <button
              onClick={() => router.push('/datacenters')}
              className="flex items-center gap-1.5 text-[10px] text-[#6B7280] hover:text-[#005EB8] transition-colors"
            >
              <ArrowLeft size={11} /> Back
            </button>
            <div className="w-px h-3 bg-[#D8DCE3]" />
            <span className="text-[10px] font-semibold text-[#374151]">{dc.name}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: sc.color + '22', color: sc.color }}>
              {sc.label}
            </span>
            {!recordHealth && <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1 rounded-full bg-[#D8DCE3] w-16 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${dc.healthScore}%`, backgroundColor: dc.healthScore >= 90 ? '#00B0A0' : '#E87722' }} />
              </div>
              <span className="text-[10px] font-mono text-[#6B7280]">{dc.healthScore}</span>
            </div>}
          </div>

          {/* Twin canvas — full height minus the top strip (36px) */}
          <div className="absolute inset-0" style={{ top: 36 }}>
            <DigitalTwinViewer
              dc={dc}
              zoneHealth={zoneHealth}
              onHotspotChange={handleHotspotChange}
              nexusFacilityId={id === 'mum-1' ? 'MUM-1' : null}
            />
          </div>
        </div>

        {/* Right: Tabbed panel — 40% */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {/* Tab bar */}
          <div className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1.5 border-b border-[#D8DCE3] overflow-x-auto">
            {RIGHT_TABS.map((tab) => {
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    rightTab === tab.id
                      ? 'bg-[#EFF6FF] text-[#005EB8]'
                      : 'text-[#9CA3AF] hover:text-[#1A1F36] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'stats' && (
              <LiveStatsDashboard dc={dc} zoneHealth={zoneHealth} activeZoneId={activeZoneId} />
            )}
            {rightTab === 'overview' && (
              <div className="h-full overflow-y-auto p-4">
                <OverviewTab dc={dc} infra={infra} />
              </div>
            )}
            {rightTab === 'infra' && (
              <div className="h-full overflow-y-auto p-4">
                <InfraTab infra={infra} />
              </div>
            )}
            {rightTab === 'tenants' && (
              <div className="h-full overflow-y-auto p-4">
                <TenantsTab dcId={id} />
              </div>
            )}
            {rightTab === 'incidents' && (
              <div className="h-full overflow-y-auto p-4">
                <IncidentsTab dcId={id} />
              </div>
            )}
            {rightTab === 'esg' && (
              <div className="h-full overflow-y-auto p-4">
                <SustainabilityTab dcId={id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </CCLayout>
  );
}
