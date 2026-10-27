'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { mockAssets } from '@/data/mock/index';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4', muted: 'rgba(255,255,255,0.5)' };

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, ...style }}>{children}</div>;
}
function Mono({ children, color }) {
  return <span style={{ fontFamily: "'JetBrains Mono', monospace", color: color || 'rgba(255,255,255,0.8)' }}>{children}</span>;
}
function SectionTitle({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{children}</p>;
}

const APPROVAL_THRESHOLDS = [
  { scope: 'GRN Verification', threshold: 'Any quantity', approver: 'Site NOC Manager' },
  { scope: 'Capitalization', threshold: '> ₹50,00,000', approver: 'Regional Finance VP' },
  { scope: 'DC-to-DC Transfer', threshold: 'Cross-region only', approver: 'Regional Facilities Manager' },
  { scope: 'Decommission & Disposal', threshold: 'Any asset class "Critical"', approver: 'Facility Director' },
];

const ROLE_PERMISSIONS = [
  { role: 'Admin', access: 'Full read/write across all 9 lifecycle steps' },
  { role: 'Site Manager', access: 'Read/write on GRN, Dispatch, IMAC, PV for own site' },
  { role: 'Auditor', access: 'Read-only on all steps, write on PV records' },
  { role: 'Viewer', access: 'Read-only across all steps' },
];

const NOTIFICATION_ROWS = [
  { label: 'GRN received at site', enabled: true },
  { label: 'Capitalization approval pending > 7 days', enabled: true },
  { label: 'DC-to-DC transfer in transit > 5 days', enabled: false },
  { label: 'Physical Verification discrepancy found', enabled: true },
  { label: 'Decommission certificate issued', enabled: false },
];

export default function AdminPage() {
  const [notifications, setNotifications] = useState(NOTIFICATION_ROWS);

  const classTypes = useMemo(() => {
    const map = {};
    mockAssets.forEach(a => {
      const cls = a.class || 'Unclassified';
      if (!map[cls]) map[cls] = new Set();
      if (a.type) map[cls].add(a.type);
    });
    return Object.entries(map).map(([cls, types]) => ({ cls, types: Array.from(types) }));
  }, []);

  const toggleNotification = (idx) => {
    setNotifications(rows => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  };

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 49px)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/asset-portfolio/asset-management" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </Link>
        <Settings2 size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Config & Admin</h1>
      </div>

      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
        <Card>
          <SectionTitle>Asset Classes & Types</SectionTitle>
          {classTypes.map(({ cls, types }) => (
            <div key={cls} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{cls}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {types.length === 0 ? (
                  <span style={{ fontSize: 11, color: C.muted }}>No types recorded</span>
                ) : types.map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: C.card2, border: `1px solid ${C.border}`, color: 'rgba(255,255,255,0.7)' }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <SectionTitle>Approval Thresholds</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Scope</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Threshold</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Approver</th>
              </tr>
            </thead>
            <tbody>
              {APPROVAL_THRESHOLDS.map(row => (
                <tr key={row.scope} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.8)' }}>{row.scope}</td>
                  <td style={{ padding: '6px 8px' }}><Mono color={C.amber}>{row.threshold}</Mono></td>
                  <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.7)' }}>{row.approver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle>User Roles & Permissions</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Role</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Access</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_PERMISSIONS.map(row => (
                <tr key={row.role} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '6px 8px' }}><Mono color={C.cyan}>{row.role}</Mono></td>
                  <td style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.7)' }}>{row.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionTitle>Notification Settings</SectionTitle>
          {notifications.map((row, idx) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < notifications.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{row.label}</span>
              <button
                onClick={() => toggleNotification(idx)}
                style={{
                  width: 36, height: 20, borderRadius: 20, border: 'none', cursor: 'pointer', position: 'relative',
                  background: row.enabled ? C.green : 'rgba(255,255,255,0.15)', transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: row.enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s',
                }} />
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
