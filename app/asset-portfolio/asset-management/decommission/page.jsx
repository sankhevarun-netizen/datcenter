'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ServerOff, ChevronUp, ChevronDown } from 'lucide-react';
import { mockAssets, mockDecommissions } from '@/data/mock/index';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4' };

const STATUS_COLORS = { Pending: C.amber, Approved: C.cyan, Disposed: C.green };
const STATUS_FLOW = { Pending: 'Approved', Approved: 'Disposed' };
const STATUS_ACTION_LABEL = { Pending: 'Approve', Approved: 'Mark Disposed' };
const REASON_OPTIONS = ['EOL', 'Damaged', 'Upgrade'];
const DISPOSAL_OPTIONS = ['Recycled', 'Resold', 'Donated', 'Scrapped'];

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

export default function DecommissionPage() {
  const [records, setRecords] = useState(mockDecommissions);
  const [sortKey, setSortKey] = useState('decommissionDate');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);
  const [approverInput, setApproverInput] = useState('');
  const [form, setForm] = useState({ assetId: '', reason: 'EOL', disposalMethod: 'Recycled' });

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
    pending: records.filter(r => r.status !== 'Disposed').length,
    disposed: records.filter(r => r.status === 'Disposed').length,
  }), [records]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.assetId) return;
    setRecords(rs => [
      {
        decomId: uid('DEC', rs.length + 1), assetId: form.assetId, reason: form.reason,
        decommissionDate: null, disposalMethod: form.disposalMethod, certificateNo: null, status: 'Pending',
        approvalLog: [{ action: 'Decommission Requested', by: 'Current User', date: new Date().toISOString().slice(0, 10), note: `Reason: ${form.reason}` }],
      },
      ...rs,
    ]);
    setForm({ assetId: '', reason: 'EOL', disposalMethod: 'Recycled' });
  };

  const advanceStatus = (decomId) => {
    if (!approverInput.trim()) return;
    setRecords(rs => rs.map(r => {
      if (r.decomId !== decomId) return r;
      const next = STATUS_FLOW[r.status];
      if (!next) return r;
      return {
        ...r, status: next,
        decommissionDate: next === 'Disposed' ? new Date().toISOString().slice(0, 10) : r.decommissionDate,
        certificateNo: next === 'Disposed' ? `CERT-${Math.floor(10000 + Math.random() * 89999)}` : r.certificateNo,
        approvalLog: [...r.approvalLog, { action: next, by: approverInput, date: new Date().toISOString().slice(0, 10), note: next === 'Disposed' ? 'Certificate issued by approved vendor.' : 'Approved for disposal.' }],
      };
    }));
    setApproverInput('');
  };

  return (
    <div style={{ background: C.bg, minHeight: 'calc(100vh - 49px)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/asset-portfolio/asset-management" style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </Link>
        <ServerOff size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Decommission & Disposal</h1>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Total Requests"><Mono color={C.blue}><span style={{ fontSize: 22 }}>{stats.total}</span></Mono></Field></Card>
        <Card><Field label="Pending"><Mono color={C.amber}><span style={{ fontSize: 22 }}>{stats.pending}</span></Mono></Field></Card>
        <Card><Field label="Disposed"><Mono color={C.green}><span style={{ fontSize: 22 }}>{stats.disposed}</span></Mono></Field></Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>New Decommission Request</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="Asset">
            <select className={inputClass} style={inputStyle} value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
              <option value="">Select asset</option>
              {ASSET_OPTIONS.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </Field>
          <Field label="Reason">
            <select className={inputClass} style={inputStyle} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
              {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Disposal Method">
            <select className={inputClass} style={inputStyle} value={form.disposalMethod} onChange={e => setForm(f => ({ ...f, disposalMethod: e.target.value }))}>
              {DISPOSAL_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={{ background: C.cyan, color: '#06222c', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Submit Request
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { key: 'decomId', label: 'Decom ID' },
                { key: 'assetId', label: 'Asset' },
                { key: 'reason', label: 'Reason' },
                { key: 'disposalMethod', label: 'Disposal Method' },
                { key: 'decommissionDate', label: 'Decommission Date' },
                { key: 'status', label: 'Status' },
              ].map(col => (
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
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No decommission records yet.</td></tr>
            ) : sorted.map(r => {
              const isOpen = expanded === r.decomId;
              return (
                <Fragment key={r.decomId}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.decomId)}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                  >
                    <td style={{ padding: '8px 10px' }}><Mono>{r.decomId}</Mono></td>
                    <td style={{ padding: '8px 10px' }}><Mono>{r.assetId}</Mono></td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.reason}</td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.disposalMethod}</td>
                    <td style={{ padding: '8px 10px' }}><Mono>{r.decommissionDate || '—'}</Mono></td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[r.status] }} />
                        <span style={{ color: STATUS_COLORS[r.status], fontWeight: 600 }}>{r.status}</span>
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${C.border}` }}>
                        {r.certificateNo && (
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Certificate No: </span>
                            <Mono>{r.certificateNo}</Mono>
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Approval Trail</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                          {r.approvalLog.map((log, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>
                              <Mono color="rgba(255,255,255,0.5)">{log.date}</Mono> — <strong>{log.action}</strong> by {log.by}{log.note ? ` — ${log.note}` : ''}
                            </li>
                          ))}
                        </ul>
                        {STATUS_FLOW[r.status] && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                            <input
                              style={{ ...inputStyle, width: 220 }}
                              placeholder="Your name (approver)"
                              value={approverInput}
                              onChange={e => setApproverInput(e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); advanceStatus(r.decomId); }}
                              style={{ background: C.cyan, color: '#06222c', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              {STATUS_ACTION_LABEL[r.status]}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
