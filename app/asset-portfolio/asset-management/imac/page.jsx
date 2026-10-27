'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Repeat2, ChevronUp, ChevronDown } from 'lucide-react';
import { mockAssets, mockIMACs } from '@/data/mock/index';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4', purple: '#7C3AED' };

const STATUS_COLORS = { Requested: C.amber, Scheduled: C.cyan, 'In Progress': C.blue, Completed: C.green };
const TYPE_COLORS = { Install: C.green, Move: C.blue, Add: C.cyan, Change: C.purple };

const ASSET_OPTIONS = mockAssets.map(a => a.id);

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
  { key: 'imacId', label: 'IMAC ID' },
  { key: 'assetId', label: 'Asset' },
  { key: 'type', label: 'Type' },
  { key: 'fromLocation', label: 'From' },
  { key: 'toLocation', label: 'To' },
  { key: 'requestedBy', label: 'Requested By' },
  { key: 'scheduledDate', label: 'Scheduled' },
  { key: 'status', label: 'Status' },
];

export default function IMACPage() {
  const [records, setRecords] = useState(mockIMACs);
  const [sortKey, setSortKey] = useState('requestedDate');
  const [sortDir, setSortDir] = useState('desc');
  const [form, setForm] = useState({
    assetId: '', type: 'Install', fromLocation: '', toLocation: '', requestedBy: '', scheduledDate: '',
  });

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
    total: records.length,
    open: records.filter(r => r.status !== 'Completed').length,
    completed: records.filter(r => r.status === 'Completed').length,
  }), [records]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.assetId || !form.requestedBy) return;
    setRecords(rs => [
      {
        imacId: uid('IMAC', rs.length + 1),
        assetId: form.assetId, type: form.type,
        fromLocation: form.fromLocation || null, toLocation: form.toLocation || null,
        requestedBy: form.requestedBy, requestedDate: new Date().toISOString().slice(0, 10),
        scheduledDate: form.scheduledDate || null, completedDate: null, status: 'Requested',
      },
      ...rs,
    ]);
    setForm({ assetId: '', type: 'Install', fromLocation: '', toLocation: '', requestedBy: '', scheduledDate: '' });
  };

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 49px)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/asset-portfolio/asset-management" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </Link>
        <Repeat2 size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>IMAC — Install / Move / Add / Change</h1>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Total Requests"><Mono color={C.blue}><span style={{ fontSize: 22 }}>{stats.total}</span></Mono></Field></Card>
        <Card><Field label="Open"><Mono color={C.amber}><span style={{ fontSize: 22 }}>{stats.open}</span></Mono></Field></Card>
        <Card><Field label="Completed"><Mono color={C.green}><span style={{ fontSize: 22 }}>{stats.completed}</span></Mono></Field></Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>New IMAC Request</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="Asset">
            <select className={inputClass} style={inputStyle} value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
              <option value="">Select asset</option>
              {ASSET_OPTIONS.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className={inputClass} style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="From Location">
            <input className={inputClass} style={inputStyle} value={form.fromLocation} onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))} placeholder="e.g. Hall A, Rack 12" />
          </Field>
          <Field label="To Location">
            <input className={inputClass} style={inputStyle} value={form.toLocation} onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))} placeholder="e.g. Hall B, Rack 04" />
          </Field>
          <Field label="Requested By">
            <input className={inputClass} style={inputStyle} value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} />
          </Field>
          <Field label="Scheduled Date">
            <input type="date" className={inputClass} style={inputStyle} value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
          </Field>
          <div style={{ gridColumn: 'span 4' }}>
            <button type="submit" style={{ background: C.cyan, color: '#06222c', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Create Request
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
              <tr><td colSpan={COLUMNS.length} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No IMAC records yet.</td></tr>
            ) : sorted.map(r => (
              <tr key={r.imacId} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px' }}><Mono>{r.imacId}</Mono></td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.assetId}</Mono></td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: `${TYPE_COLORS[r.type]}22`, color: TYPE_COLORS[r.type], border: `1px solid ${TYPE_COLORS[r.type]}44`,
                  }}>{r.type}</span>
                </td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.fromLocation || '—'}</td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.toLocation || '—'}</td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.requestedBy}</td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.scheduledDate || '—'}</Mono></td>
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
