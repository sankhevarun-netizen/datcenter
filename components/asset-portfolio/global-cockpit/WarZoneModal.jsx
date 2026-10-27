'use client';
import { X, AlertTriangle, Wifi, Zap, Shield, Package } from 'lucide-react';
import { GOOGLE_DC_MASTER } from '@/data/googleDCMasterData';

const SEVERITY_CONFIG = {
  Critical: { color: '#C8102E', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.30)', label: 'CRITICAL' },
  High:     { color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', label: 'HIGH' },
  Medium:   { color: '#E87722', bg: 'rgba(212,160,23,0.12)', border: 'rgba(212,160,23,0.30)', label: 'MEDIUM' },
};

const RISK_ICONS = { 'Power Grid': Zap, 'Fiber Cables': Wifi, 'Cable Attacks': Wifi, 'Latency Spike': Wifi,
  'Bandwidth Loss': Wifi, 'Cyber Warfare': Shield, 'Supply Chain': Package, 'Semiconductor Supply': Package,
  'Forced Closure': AlertTriangle, 'Cable Severance': Wifi, 'Air Corridor Closure': Package,
  'Regional Spillover': AlertTriangle, 'Forced Shutdown': AlertTriangle, 'Hardware Delays': Package,
};

export default function WarZoneModal({ region, alerts, onDismiss }) {
  if (!alerts?.length) return null;

  const topSeverity = alerts.some(a => a.severity === 'Critical') ? 'Critical'
    : alerts.some(a => a.severity === 'High') ? 'High' : 'Medium';
  const cfg = SEVERITY_CONFIG[topSeverity];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 700, maxHeight: '88vh',
        background: '#0B1929', border: `1px solid ${cfg.border}`,
        borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 60px ${cfg.color}22`,
      }}>

        {/* Header */}
        <div style={{
          background: cfg.bg, borderBottom: `1px solid ${cfg.border}`,
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: cfg.bg,
              border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={18} color={cfg.color} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif", margin: 0 }}>
                War Zone Alert — {region} Region
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>
                {alerts.length} active conflict{alerts.length > 1 ? 's' : ''} detected affecting this region's data center operations
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
              background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, letterSpacing: '0.08em',
            }}>
              {cfg.label} THREAT
            </span>
            <button onClick={onDismiss} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {alerts.map(wz => {
            const scfg = SEVERITY_CONFIG[wz.severity];
            const affectedDCs = GOOGLE_DC_MASTER.filter(d =>
              d.region === region && wz.affected_countries.includes(d.country)
            );

            return (
              <div key={wz.id} style={{
                background: '#0d1f3c', border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                {/* Conflict header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: scfg.bg,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: scfg.bg, border: `1px solid ${scfg.border}`, color: scfg.color, letterSpacing: '0.08em',
                      }}>{wz.severity.toUpperCase()}</span>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                        {wz.name}
                      </p>
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
                      {wz.theatre} · Active since {wz.since}
                    </p>
                  </div>
                  {affectedDCs.length > 0 && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', color: '#C8102E',
                    }}>
                      {affectedDCs.length} DC{affectedDCs.length !== 1 ? 's' : ''} at risk
                    </div>
                  )}
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Headline */}
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
                    {wz.headline}
                  </p>

                  {/* Risks grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {wz.risks.map((r, i) => {
                      const Icon = RISK_ICONS[r.label] || AlertTriangle;
                      return (
                        <div key={i} style={{
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10,
                        }}>
                          <div style={{ flexShrink: 0, marginTop: 1 }}>
                            <Icon size={12} color={scfg.color} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: scfg.color, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {r.label}
                            </p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                              {r.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DC effect */}
                  <div style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${scfg.border}`,
                    borderRadius: 8, padding: '10px 12px',
                  }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: scfg.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>
                      Impact on Data Centers
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>
                      {wz.dc_effect}
                    </p>
                  </div>

                  {/* Affected DCs */}
                  {affectedDCs.length > 0 && (
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                        Affected campuses in {region}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {affectedDCs.map(d => (
                          <span key={d.id} style={{
                            fontSize: 10, padding: '3px 9px', borderRadius: 20,
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.6)',
                          }}>
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          background: 'rgba(0,0,0,0.2)',
        }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            Source: KPMG Geopolitical Risk Intelligence · Updated Jun 2025
          </p>
          <button
            onClick={onDismiss}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: cfg.color, border: 'none', color: '#fff',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
          >
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
