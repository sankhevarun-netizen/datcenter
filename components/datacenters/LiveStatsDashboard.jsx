'use client';
import { Zap, Wind, Monitor, Shield, Server, Camera, AlertTriangle, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

const ZONE_CONFIG = {
  power: {
    label:   'Power',
    Icon:    Zap,
    color:   '#F59E0B',
    bg:      '#FFFBEB',
    border:  '#FDE68A',
    metrics: (d) => [
      { label: 'Load',          value: `${d.loadPct}%`,                          bar: d.loadPct },
      { label: 'UPS Online',    value: `${d.upsOnline}/${d.upsTotal}` },
      { label: 'Battery',       value: `${d.batteryPct}%`,                        bar: d.batteryPct },
      { label: 'Redundancy',    value: d.redundancy },
    ],
  },
  cooling: {
    label:   'Cooling',
    Icon:    Wind,
    color:   '#0284C7',
    bg:      '#F0F9FF',
    border:  '#BAE6FD',
    metrics: (d) => [
      { label: 'Load',          value: `${d.loadPct}%`,                          bar: d.loadPct },
      { label: 'Chillers',      value: `${d.chillerOnline}/${d.chillerTotal}` },
      { label: 'Avg Temp',      value: `${d.avgTempC}°C` },
      { label: 'PUE',           value: d.pue?.toFixed(2) },
    ],
  },
  noc: {
    label:   'NOC',
    Icon:    Monitor,
    color:   '#7C3AED',
    bg:      '#F5F3FF',
    border:  '#DDD6FE',
    metrics: (d) => [
      { label: 'Active Tickets', value: d.activeTickets },
      { label: 'Staff on Duty',  value: d.staffOnDuty },
      { label: 'MTTR',           value: `${d.mttrMin} min` },
      { label: 'SLA',            value: `${d.slaCompliance}%` },
    ],
  },
  soc: {
    label:   'SOC',
    Icon:    Shield,
    color:   '#C8102E',
    bg:      '#FFF1F2',
    border:  '#FECACA',
    metrics: (d) => [
      { label: 'Active Alerts',    value: d.activeAlerts },
      { label: 'Threats Blocked',  value: d.threatsBlocked },
      { label: 'Compliance',       value: `${d.compliancePct}%`,   bar: d.compliancePct },
      { label: 'CCTV Online',      value: d.cctvsOnline },
    ],
  },
  racks: {
    label:   'Racks',
    Icon:    Server,
    color:   '#059669',
    bg:      '#F0FDF4',
    border:  '#A7F3D0',
    metrics: (d) => [
      { label: 'Used',            value: `${d.usedRacks} / ${d.totalRacks}`,  bar: Math.round((d.usedRacks / d.totalRacks) * 100) },
      { label: 'Avg Utilisation', value: `${d.avgUtilPct}%`,                  bar: d.avgUtilPct },
      { label: 'Hot Racks',       value: d.hotRacks },
    ],
  },
  security: {
    label:   'Security',
    Icon:    Camera,
    color:   '#005EB8',
    bg:      '#EFF6FF',
    border:  '#BFDBFE',
    metrics: (d) => [
      { label: 'Cameras',         value: `${d.camerasOnline}/${d.camerasTotal}`, bar: Math.round((d.camerasOnline / d.camerasTotal) * 100) },
      { label: 'Access Points',   value: d.accessPoints },
      { label: 'Staff On-site',   value: d.staffOnSite },
      { label: 'Incidents (24h)', value: d.incidents24h },
    ],
  },
};

const STATUS_CONFIG = {
  operational: { Icon: CheckCircle,   color: '#00B0A0', label: 'Operational' },
  warning:     { Icon: AlertTriangle, color: '#E87722', label: 'Warning' },
  critical:    { Icon: XCircle,       color: '#C8102E', label: 'Critical' },
  unmonitored: { Icon: Shield,        color: '#94A3B8', label: 'Not monitored' },
};

function getOverallStatus(zoneHealth) {
  if (!zoneHealth) return 'operational';
  const statuses = Object.values(zoneHealth).map((z) => z?.status);
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'operational';
}

function MiniBar({ value, color }) {
  if (value === undefined || value === null) return null;
  const barColor = value > 85 ? '#C8102E' : value > 70 ? '#E87722' : color;
  return (
    <div className="mt-0.5 h-1 w-full bg-[#D8DCE3] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, value)}%`, background: barColor }}
      />
    </div>
  );
}

function ZoneCard({ zoneId, data, isActive, onClick }) {
  const cfg = ZONE_CONFIG[zoneId];
  const statusCfg = STATUS_CONFIG[data?.status] || STATUS_CONFIG.operational;
  if (!cfg || !data) return null;

  // Record-based zones carry their own labelled metrics.
  const metrics = data.metrics ?? cfg.metrics(data);
  const alerts = data.alerts || [];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
        isActive
          ? 'shadow-md scale-[1.01]'
          : 'hover:shadow-sm'
      }`}
      style={{
        background: isActive ? cfg.bg : '#F8FAFC',
        borderColor: isActive ? cfg.color : '#D8DCE3',
        boxShadow: isActive ? `0 0 12px ${cfg.color}33` : undefined,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <cfg.Icon size={13} style={{ color: cfg.color }} />
          <span className="text-xs font-bold text-[#1A1F36] tracking-wide">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {alerts.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#E87722] animate-pulse" />
          )}
          <statusCfg.Icon size={12} style={{ color: statusCfg.color }} />
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5">
        {metrics.length === 0 && data.note && <p className="text-[10px] text-[#94A3B8] leading-snug">{data.note}</p>}
        {metrics.slice(0, 3).map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6B7280]">{m.label}</span>
              <span className="text-[10px] font-mono font-semibold text-[#374151]">{m.value}</span>
            </div>
            {m.bar !== undefined && <MiniBar value={m.bar} color={cfg.color} />}
          </div>
        ))}
      </div>

      {/* Status badge */}
      <div className="mt-2 flex items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: statusCfg.color }}>
          {statusCfg.label}
        </span>
        {alerts.length > 0 && (
          <span className="text-[9px] text-[#E87722]">· {alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>
        )}
      </div>
    </button>
  );
}

function DetailPanel({ zoneId, zoneHealth }) {
  if (!zoneId || !zoneHealth?.[zoneId]) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-10 h-10 rounded-full border border-[#D8DCE3] flex items-center justify-center mb-3">
          <Server size={18} className="text-[#9CA3AF]" />
        </div>
        <p className="text-xs text-[#9CA3AF] leading-relaxed">
          Click any glowing marker in the 3D model to inspect that zone's details
        </p>
      </div>
    );
  }

  const cfg = ZONE_CONFIG[zoneId];
  const data = zoneHealth[zoneId];
  const statusCfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.operational;
  const metrics = data.metrics ?? cfg.metrics(data);
  const alerts = data.alerts || [];

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* Zone header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#D8DCE3]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <cfg.Icon size={16} style={{ color: cfg.color }} />
        </div>
        <div>
          <div className="text-sm font-bold text-[#1A1F36]">{cfg.label} Zone</div>
          <div className="flex items-center gap-1">
            <statusCfg.Icon size={11} style={{ color: statusCfg.color }} />
            <span className="text-[10px]" style={{ color: statusCfg.color }}>{statusCfg.label}</span>
          </div>
        </div>
      </div>

      {metrics.length === 0 && data.note && <p className="text-xs text-[#94A3B8] mb-4">{data.note}</p>}

      {/* All metrics */}
      <div className="space-y-2 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-[#F0F2F5] rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6B7280]">{m.label}</span>
              <span className="text-xs font-mono font-semibold text-[#1A1F36]">{m.value}</span>
            </div>
            {m.bar !== undefined && <MiniBar value={m.bar} color={cfg.color} />}
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-[#92400E] uppercase tracking-wider mb-2">
            Active Alerts ({alerts.length})
          </div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-2">
                <AlertTriangle size={11} className="text-[#E87722] flex-shrink-0 mt-0.5" />
                <span className="text-[10px] text-[#92400E] leading-tight">{alert}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveStatsDashboard({ dc, zoneHealth, activeZoneId, isGenerated }) {
  const overallStatus = getOverallStatus(zoneHealth);
  const overallCfg = STATUS_CONFIG[overallStatus];
  const zones = Object.keys(ZONE_CONFIG);

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#D8DCE3] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold text-[#1A1F36]">Live Status Dashboard</div>
            {isGenerated && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#EFF6FF] text-[#005EB8] border border-[#005EB8]/25">
                ✦ AI-Synthesised
              </span>
            )}
          </div>
          <div className="text-[10px] text-[#6B7280]">{dc?.city}, {dc?.country} · {dc?.tier}{zoneHealth?.asOf ? ` · operating record as of ${zoneHealth.asOf}` : ''}</div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
          style={{ borderColor: overallCfg.color + '44', background: overallCfg.color + '11' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: overallCfg.color }} />
          <span className="text-[10px] font-semibold" style={{ color: overallCfg.color }}>
            {overallCfg.label}
          </span>
        </div>
      </div>

      {/* KPI cards grid */}
      <div className="flex-shrink-0 p-3 grid grid-cols-2 gap-2 border-b border-[#D8DCE3]">
        {zones.filter((zoneId) => zoneHealth?.[zoneId]).map((zoneId) => (
          <ZoneCard
            key={zoneId}
            zoneId={zoneId}
            data={zoneHealth?.[zoneId]}
            isActive={activeZoneId === zoneId}
            onClick={() => {}}
          />
        ))}
      </div>

      {/* Selected zone detail */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 px-4 py-2 border-b border-[#D8DCE3] flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
            Selected Zone
          </span>
          {activeZoneId && (
            <span className="text-[10px] text-[#005EB8] flex items-center gap-0.5">
              {ZONE_CONFIG[activeZoneId]?.label} <ChevronRight size={10} />
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <DetailPanel zoneId={activeZoneId} zoneHealth={zoneHealth} />
        </div>
      </div>
    </div>
  );
}
