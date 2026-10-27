'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, ChevronUp, ChevronDown } from 'lucide-react';
import { mockAssets, mockDispatches } from '@/data/mock/index';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4' };

const STATUS_COLORS = { Pending: C.amber, 'In Transit': C.blue, Delivered: C.green };

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
  { key: 'dispatchId', label: 'Dispatch ID' },
  { key: 'assetIds', label: 'Assets' },
  { key: 'fromSite', label: 'From Site' },
  { key: 'toSite', label: 'To Site' },
  { key: 'dispatchDate', label: 'Dispatch Date' },
  { key: 'carrier', label: 'Carrier' },
  { key: 'trackingNo', label: 'Tracking No.' },
  { key: 'status', label: 'Status' },
];

export default function DispatchPage() {
  const [records, setRecords] = useState(mockDispatches);
  const [sortKey, setSortKey] = useState('dispatchDate');
  const [sortDir, setSortDir] = useState('desc');
  const [form, setForm] = useState({
    assetIds: '', fromSite: '', toSite: '', dispatchDate: '', carrier: '', trackingNo: '', dispatchedBy: '', notes: '',
  });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (Array.isArray(av)) av = av.join(',');
      if (Array.isArray(bv)) bv = bv.join(',');
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
    inTransit: records.filter(r => r.status === 'In Transit').length,
    delivered: records.filter(r => r.status === 'Delivered').length,
  }), [records]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fromSite || !form.toSite || !form.dispatchDate || !form.carrier) return;
    setRecords(rs => [
      {
        dispatchId: uid('DSP', rs.length + 1),
        assetIds: form.assetIds ? form.assetIds.split(',').map(s => s.trim()).filter(Boolean) : [],
        fromSite: form.fromSite, toSite: form.toSite, dispatchDate: form.dispatchDate,
        carrier: form.carrier, trackingNo: form.trackingNo, status: 'Pending',
        dispatchedBy: form.dispatchedBy, notes: form.notes,
      },
      ...rs,
    ]);
    setForm({ assetIds: '', fromSite: '', toSite: '', dispatchDate: '', carrier: '', trackingNo: '', dispatchedBy: '', notes: '' });
  };

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 49px)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/asset-portfolio/asset-management" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </Link>
        <Send size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Asset Dispatch</h1>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Total Dispatches"><Mono color={C.blue}><span style={{ fontSize: 22 }}>{stats.total}</span></Mono></Field></Card>
        <Card><Field label="In Transit"><Mono color={C.amber}><span style={{ fontSize: 22 }}>{stats.inTransit}</span></Mono></Field></Card>
        <Card><Field label="Delivered"><Mono color={C.green}><span style={{ fontSize: 22 }}>{stats.delivered}</span></Mono></Field></Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>New Dispatch</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="Asset IDs (comma-separated)">
            <input className={inputClass} style={inputStyle} value={form.assetIds} onChange={e => setForm(f => ({ ...f, assetIds: e.target.value }))} placeholder="AST-001, AST-002" />
          </Field>
          <Field label="From Site">
            <select className={inputClass} style={inputStyle} value={form.fromSite} onChange={e => setForm(f => ({ ...f, fromSite: e.target.value }))}>
              <option value="">Select site</option>
              {SITE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="To Site">
            <select className={inputClass} style={inputStyle} value={form.toSite} onChange={e => setForm(f => ({ ...f, toSite: e.target.value }))}>
              <option value="">Select site</option>
              {SITE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Dispatch Date">
            <input type="date" className={inputClass} style={inputStyle} value={form.dispatchDate} onChange={e => setForm(f => ({ ...f, dispatchDate: e.target.value }))} />
          </Field>
          <Field label="Carrier">
            <input className={inputClass} style={inputStyle} value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="e.g. FedEx Freight" />
          </Field>
          <Field label="Tracking No.">
            <input className={inputClass} style={inputStyle} value={form.trackingNo} onChange={e => setForm(f => ({ ...f, trackingNo: e.target.value }))} />
          </Field>
          <Field label="Dispatched By">
            <input className={inputClass} style={inputStyle} value={form.dispatchedBy} onChange={e => setForm(f => ({ ...f, dispatchedBy: e.target.value }))} />
          </Field>
          <Field label="Notes">
            <input className={inputClass} style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <div style={{ gridColumn: 'span 4' }}>
            <button type="submit" style={{ background: C.cyan, color: '#06222c', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Create Dispatch
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
              <tr><td colSpan={COLUMNS.length} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No dispatch records yet.</td></tr>
            ) : sorted.map(r => (
              <tr key={r.dispatchId} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px' }}><Mono>{r.dispatchId}</Mono></td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.assetIds.join(', ') || '—'}</td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.fromSite}</td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.toSite}</td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.dispatchDate}</Mono></td>
                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.carrier}</td>
                <td style={{ padding: '8px 10px' }}><Mono>{r.trackingNo || '—'}</Mono></td>
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
