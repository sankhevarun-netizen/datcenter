'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, ChevronUp, ChevronDown } from 'lucide-react';
import { mockAssets, mockPVRecords } from '@/data/mock/index';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4' };

const STATUS_COLORS = { Scheduled: C.amber, 'In Progress': C.blue, Completed: C.green, 'Discrepancy Found': C.red };

const SITE_OPTIONS = Array.from(new Set(mockAssets.map(a => a.location || a.dcName).filter(Boolean))).sort();

function uid(prefix, n) { return `${prefix}-${String(n).padStart(4, '0')}`; }

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

const inputClass = 'w-full';
const inputStyle = {
  background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px',
  fontSize: 12, color: '#fff', outline: 'none', width: '100%',
};

const COLUMNS = [
  { key: 'pvId', label: 'PV ID' },
  { key: 'site', label: 'Site' },
  { key: 'scheduledDate', label: 'Scheduled' },
  { key: 'completedDate', label: 'Completed' },
  { key: 'assetsExpected', label: 'Expected' },
  { key: 'assetsFound', label: 'Found' },
  { key: 'discrepancies', label: 'Discrepancies' },
  { key: 'auditedBy', label: 'Audited By' },
  { key: 'status', label: 'Status' },
];

export default function PVPage() {
  const [records, setRecords] = useState(mockPVRecords);
  const [sortKey, setSortKey] = useState('scheduledDate');
  const [sortDir, setSortDir] = useState('desc');
  const [form, setForm] = useState({ site: '', scheduledDate: '', assetsExpected: '', auditedBy: '' });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [records, sortKey, sortDir]);

  const stats = useMemo(() => ({
    totalExpected: records.reduce((s, r) => s + (r.assetsExpected || 0), 0),
    totalFound: records.reduce((s, r) => s + (r.assetsFound || 0), 0),
    totalDiscrepancies: records.reduce((s, r) => s + (r.discrepancies || 0), 0),
  }), [records]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.site || !form.scheduledDate || !form.assetsExpected || !form.auditedBy) return;
    setRecords(rs => [
      {
        pvId: uid('PV', rs.length + 1), site: form.site, scheduledDate: form.scheduledDate,
        completedDate: null, assetsExpected: Number(form.assetsExpected), assetsFound: null,
        discrepancies: 0, auditedBy: form.auditedBy, status: 'Scheduled',
      },
      ...rs,
    ]);
    setForm({ site: '', scheduledDate: '', assetsExpected: '', auditedBy: '' });
  };

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 49px)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/asset-portfolio/asset-management" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </Link>
        <ClipboardCheck size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Physical Verification (PV)</h1>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Total Expected"><Mono color={C.blue}><span style={{ fontSize: 22 }}>{stats.totalExpected}</span></Mono></Field></Card>
        <Card><Field label="Total Found"><Mono color={C.green}><span style={{ fontSize: 22 }}>{stats.totalFound}</span></Mono></Field></Card>
        <Card><Field label="Discrepancies"><Mono color={stats.totalDiscrepancies > 0 ? C.red : C.green}><span style={{ fontSize: 22 }}>{stats.totalDiscrepancies}</span></Mono></Field></Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Schedule Verification</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="Site">
            <select className={inputClass} style={inputStyle} value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))}>
              <option value="">Select site</option>
              {SITE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Scheduled Date">
            <input type="date" className={inputClass} style={inputStyle} value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
          </Field>
          <Field label="Assets Expected">
            <input type="number" className={inputClass} style={inputStyle} value={form.assetsExpected} onChange={e => setForm(f => ({ ...f, assetsExpected: e.target.value }))} />
          </Field>
          <Field label="Audited By">
            <input className={inputClass} style={inputStyle} value={form.auditedBy} onChange={e => setForm(f => ({ ...f, auditedBy: e.target.value }))} />
          </Field>
          <div style={{ gridColumn: 'span 4' }}>
            <button type="submit" style={{ background: C.cyan, color: '#06222c', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Schedule PV
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{ textAlign: 'left', padding: '8px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, cursor: 'pointer', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No PV records yet.</td></tr>
            ) : sorted.map(r => (
              <tr key={r.pvId} style={{ borderBottom: `1px solid ${C.border}`, background: r.discrepancies > 0 ? 'rgba(220,38,38,0.06)' : 'transparent' }}>
                <td style={{ padding: '8px 10px' }}><Mono>{r.pvId}</Mono></td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.site}</td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.scheduledDate}</Mono></td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.completedDate || '—'}</Mono></td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.assetsExpected}</Mono></td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.assetsFound ?? '—'}</Mono></td>
                <td style={{ padding: '8px 10px' }}><Mono color={r.discrepancies > 0 ? C.red : undefined}>{r.discrepancies}</Mono></td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.auditedBy}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[r.status] }} />
                    <span style={{ color: STATUS_COLORS[r.status], fontWeight: 600 }}>{r.status}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
