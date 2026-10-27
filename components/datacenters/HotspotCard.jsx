'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wind, Monitor, Shield, Server, Camera, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const ZONE_CONFIG = {
  power:    { label: 'Power Infrastructure', Icon: Zap,     color: '#F59E0B' },
  cooling:  { label: 'Cooling Systems',      Icon: Wind,    color: '#38BDF8' },
  noc:      { label: 'Network Ops Centre',   Icon: Monitor, color: '#A78BFA' },
  soc:      { label: 'Security Ops Centre',  Icon: Shield,  color: '#F87171' },
  racks:    { label: 'Server Rack Zone',     Icon: Server,  color: '#34D399' },
  security: { label: 'Physical Security',    Icon: Camera,  color: '#60A5FA' },
};

const STATUS_CONFIG = {
  operational: { label: 'Operational', Icon: CheckCircle, color: '#00B0A0' },
  warning:     { label: 'Warning',     Icon: AlertTriangle, color: '#E87722' },
  critical:    { label: 'Critical',    Icon: XCircle,    color: '#C8102E' },
  unmonitored: { label: 'Not monitored', Icon: CheckCircle, color: '#94A3B8' },
};

function getMetrics(zoneId, data) {
  // Record-based zones carry their own labelled metrics.
  if (data.metrics) return data.metrics.length ? data.metrics.map((m) => `${m.label}: ${m.value}`) : [data.note ?? 'Not monitored'];
  switch (zoneId) {
    case 'power':
      return [
        `Load: ${data.loadPct}%`,
        `UPS: ${data.upsOnline}/${data.upsTotal} online`,
        `Battery: ${data.batteryPct}%`,
      ];
    case 'cooling':
      return [
        `Load: ${data.loadPct}%`,
        `Chillers: ${data.chillerOnline}/${data.chillerTotal} online`,
        `Avg Temp: ${data.avgTempC}°C`,
      ];
    case 'noc':
      return [
        `Tickets: ${data.activeTickets} active`,
        `Staff on duty: ${data.staffOnDuty}`,
        `MTTR: ${data.mttrMin} min`,
      ];
    case 'soc':
      return [
        `Active alerts: ${data.activeAlerts}`,
        `Threats blocked: ${data.threatsBlocked}`,
        `Compliance: ${data.compliancePct}%`,
      ];
    case 'racks':
      return [
        `${data.usedRacks} / ${data.totalRacks} racks used`,
        `Avg utilisation: ${data.avgUtilPct}%`,
        `Hot racks: ${data.hotRacks}`,
      ];
    case 'security':
      return [
        `CCTV: ${data.camerasOnline}/${data.camerasTotal} online`,
        `Access points: ${data.accessPoints}`,
        `Incidents (24h): ${data.incidents24h}`,
      ];
    default:
      return [];
  }
}

export default function HotspotCard({ zoneId, zoneData, position, onClose, isGenerated }) {
  if (!zoneId || !zoneData) return null;

  const zone = ZONE_CONFIG[zoneId];
  const statusCfg = STATUS_CONFIG[zoneData.status] || STATUS_CONFIG.operational;
  const metrics = getMetrics(zoneId, zoneData);
  const alerts = zoneData.alerts || [];

  if (!zone) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={zoneId}
        initial={{ opacity: 0, scale: 0.88, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -110%)',
          zIndex: 50,
          pointerEvents: 'auto',
        }}
        className="w-64 rounded-xl border border-[#334466] bg-[#0a1628]/95 backdrop-blur-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#334466]"
          style={{ borderLeftWidth: 3, borderLeftColor: zone.color, borderLeftStyle: 'solid' }}>
          <div className="flex items-center gap-2 min-w-0">
            <zone.Icon size={14} style={{ color: zone.color }} className="flex-shrink-0" />
            <span className="text-xs font-semibold text-white tracking-wide truncate">{zone.label}</span>
            {isGenerated && (
              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-[#005EB8]/20 text-[#60a5fa] border border-[#005EB8]/40 flex-shrink-0">
                ✦ AI
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-white transition-colors text-xs leading-none"
          >
            ✕
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e3050]">
          <statusCfg.Icon size={13} style={{ color: statusCfg.color }} />
          <span className="text-xs font-medium" style={{ color: statusCfg.color }}>
            {statusCfg.label}
          </span>
        </div>

        {/* Metrics */}
        <div className="px-4 py-3 space-y-1.5">
          {metrics.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-[#334466] flex-shrink-0" />
              <span className="text-xs text-[#94a3b8] font-mono">{m}</span>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="border-t border-[#1e3050] px-4 py-2 space-y-1">
            {alerts.slice(0, 2).map((alert, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle size={10} className="text-[#E87722] flex-shrink-0 mt-0.5" />
                <span className="text-[10px] text-[#E87722] leading-tight">{alert}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
