'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileBarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { mockAssets, mockGRNs, mockCapitalizations, mockDispatches, mockIMACs, mockTransfers } from '@/data/mock/index';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4', purple: '#7C3AED', muted: 'rgba(255,255,255,0.5)' };

const CLASS_COLORS = { Power: C.amber, Cooling: C.cyan, Compute: C.blue, Network: C.purple, Storage: C.green, Security: C.red };

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, ...style }}>{children}</div>;
}
function Mono({ children, color }) {
  return <span style={{ fontFamily: "'JetBrains Mono', monospace", color: color || 'rgba(255,255,255,0.8)' }}>{children}</span>;
}
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{children}</p>;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || '#fff', fontSize: 12, fontWeight: 600 }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

function fmtINR(n) { return `₹${(n / 100000).toFixed(1)}L`; }

export default function ReportsPage() {
  const stats = useMemo(() => {
    const capitalizedValue = mockCapitalizations.filter(c => c.status === 'Capitalized').reduce((s, c) => s + c.capitalizedValue, 0);
    const pendingCWIPValue = mockCapitalizations.filter(c => c.status !== 'Capitalized').reduce((s, c) => s + c.capitalizedValue, 0);
    const openIMACs = mockIMACs.filter(i => i.status !== 'Completed').length;
    return {
      totalAssets: mockAssets.length,
      capitalizedValue,
      pendingCWIPValue,
      openIMACs,
      pendingGRNs: mockGRNs.filter(g => g.status === 'Pending').length,
      transfersInTransit: mockTransfers.filter(t => t.status === 'In Transit').length,
      dispatchesInTransit: mockDispatches.filter(d => d.status === 'In Transit').length,
    };
  }, []);

  const classData = useMemo(() => {
    const counts = {};
    mockAssets.forEach(a => { const k = a.class || 'Unclassified'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([cls, count]) => ({ cls, count }));
  }, []);

  const statusData = useMemo(() => {
    const counts = {};
    mockAssets.forEach(a => { const k = a.status || 'Unknown'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, []);

  const siteData = useMemo(() => {
    const counts = {};
    mockAssets.forEach(a => { const k = a.dcName || a.location || 'Unassigned'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 49px)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/asset-portfolio/asset-management" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </Link>
        <FileBarChart2 size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>MIS & Reports</h1>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Total Assets"><Mono color={C.blue}><span style={{ fontSize: 22 }}>{stats.totalAssets}</span></Mono></Field></Card>
        <Card><Field label="Capitalized Value"><Mono color={C.green}><span style={{ fontSize: 22 }}>{fmtINR(stats.capitalizedValue)}</span></Mono></Field></Card>
        <Card><Field label="Pending CWIP Value"><Mono color={C.amber}><span style={{ fontSize: 22 }}>{fmtINR(stats.pendingCWIPValue)}</span></Mono></Field></Card>
        <Card><Field label="Open IMACs"><Mono color={C.cyan}><span style={{ fontSize: 22 }}>{stats.openIMACs}</span></Mono></Field></Card>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Pending GRNs"><Mono color={C.amber}><span style={{ fontSize: 18 }}>{stats.pendingGRNs}</span></Mono></Field></Card>
        <Card><Field label="Transfers In Transit"><Mono color={C.blue}><span style={{ fontSize: 18 }}>{stats.transfersInTransit}</span></Mono></Field></Card>
        <Card><Field label="Dispatches In Transit"><Mono color={C.blue}><span style={{ fontSize: 18 }}>{stats.dispatchesInTransit}</span></Mono></Field></Card>
      </div>

      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
        <Card>
          <SectionTitle>Assets by Class</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={classData} barSize={20}>
              <XAxis dataKey="cls" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {classData.map((d, i) => <Cell key={i} fill={CLASS_COLORS[d.cls] || C.blue} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Assets by Status</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} barSize={20}>
              <XAxis dataKey="status" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={C.cyan} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle>Asset Count by Site</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Site</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>Asset Count</th>
            </tr>
          </thead>
          <tbody>
            {siteData.map(([site, count]) => (
              <tr key={site} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{site}</td>
                <td style={{ padding: '8px 10px' }}><Mono>{count}</Mono></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
