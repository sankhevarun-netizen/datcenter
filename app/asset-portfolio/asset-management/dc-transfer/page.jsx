'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, ChevronUp, ChevronDown } from 'lucide-react';
import { mockAssets, mockTransfers } from '@/data/mock/index';
import { GOOGLE_DC_MASTER } from '@/data/googleDCMasterData';

const C = { bg: '#0B1929', card: '#0d1f3c', card2: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.09)', green: '#00B0A0', amber: '#E87722', red: '#C8102E', blue: '#005EB8', cyan: '#06B6D4' };

const STATUS_COLORS = { Initiated: C.amber, 'In Transit': C.blue, Received: C.green };
const STATUS_FLOW = { Initiated: 'In Transit', 'In Transit': 'Received' };
const STATUS_ACTION_LABEL = { Initiated: 'Mark In Transit', 'In Transit': 'Mark Received' };

const ASSET_OPTIONS = mockAssets.map(a => a.id);
const DC_OPTIONS = GOOGLE_DC_MASTER.map(d => d.name).sort();

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

export default function DCTransferPage() {
  const [records, setRecords] = useState(mockTransfers);
  const [sortKey, setSortKey] = useState('transferDate');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);
  const [approverInput, setApproverInput] = useState('');
  const [form, setForm] = useState({
    assetId: '', fromDC: '', toDC: '', reason: '', transferDate: '', logisticsPartner: '',
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
    inTransit: records.filter(r => r.status === 'In Transit').length,
    received: records.filter(r => r.status === 'Received').length,
  }), [records]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.assetId || !form.fromDC || !form.toDC || !form.transferDate) return;
    setRecords(rs => [
      {
        transferId: uid('XFR', rs.length + 1),
        assetId: form.assetId, fromDC: form.fromDC, toDC: form.toDC,
        reason: form.reason, transferDate: form.transferDate, logisticsPartner: form.logisticsPartner,
        status: 'Initiated',
        approvalLog: [{ action: 'Transfer Initiated', by: 'Current User', date: form.transferDate, note: form.reason || 'Transfer created.' }],
      },
      ...rs,
    ]);
    setForm({ assetId: '', fromDC: '', toDC: '', reason: '', transferDate: '', logisticsPartner: '' });
  };

  const advanceStatus = (transferId) => {
    if (!approverInput.trim()) return;
    setRecords(rs => rs.map(r => {
      if (r.transferId !== transferId) return r;
      const next = STATUS_FLOW[r.status];
      if (!next) return r;
      return {
        ...r, status: next,
        approvalLog: [...r.approvalLog, { action: next === 'Received' ? 'Received' : 'In Transit', by: approverInput, date: new Date().toISOString().slice(0, 10), note: next === 'Received' ? 'Asset verified on arrival.' : 'Picked up by logistics partner.' }],
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
        <Building2 size={18} color={C.blue} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>DC-to-DC Transfer</h1>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 20 }}>
        <Card><Field label="Total Transfers"><Mono color={C.blue}><span style={{ fontSize: 22 }}>{stats.total}</span></Mono></Field></Card>
        <Card><Field label="In Transit"><Mono color={C.amber}><span style={{ fontSize: 22 }}>{stats.inTransit}</span></Mono></Field></Card>
        <Card><Field label="Received"><Mono color={C.green}><span style={{ fontSize: 22 }}>{stats.received}</span></Mono></Field></Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>New Transfer</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="Asset">
            <select className={inputClass} style={inputStyle} value={form.assetId} onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}>
              <option value="">Select asset</option>
              {ASSET_OPTIONS.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </Field>
          <Field label="From DC">
            <select className={inputClass} style={inputStyle} value={form.fromDC} onChange={e => setForm(f => ({ ...f, fromDC: e.target.value }))}>
              <option value="">Select DC</option>
              {DC_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="To DC">
            <select className={inputClass} style={inputStyle} value={form.toDC} onChange={e => setForm(f => ({ ...f, toDC: e.target.value }))}>
              <option value="">Select DC</option>
              {DC_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Transfer Date">
            <input type="date" className={inputClass} style={inputStyle} value={form.transferDate} onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))} />
          </Field>
          <Field label="Logistics Partner">
            <input className={inputClass} style={inputStyle} value={form.logisticsPartner} onChange={e => setForm(f => ({ ...f, logisticsPartner: e.target.value }))} />
          </Field>
          <div style={{ gridColumn: 'span 3' }}>
            <Field label="Reason">
              <input className={inputClass} style={inputStyle} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why is this asset being transferred?" />
            </Field>
          </div>
          <div style={{ gridColumn: 'span 4' }}>
            <button type="submit" style={{ background: C.cyan, color: '#06222c', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Create Transfer
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { key: 'transferId', label: 'Transfer ID' },
                { key: 'assetId', label: 'Asset' },
                { key: 'fromDC', label: 'From DC' },
                { key: 'toDC', label: 'To DC' },
                { key: 'transferDate', label: 'Date' },
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
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No transfer records yet.</td></tr>
            ) : sorted.map(r => {
              const isOpen = expanded === r.transferId;
              return (
                <Fragment key={r.transferId}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.transferId)}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                  >
                    <td style={{ padding: '8px 10px' }}><Mono>{r.transferId}</Mono></td>
                    <td style={{ padding: '8px 10px' }}><Mono>{r.assetId}</Mono></td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.fromDC}</td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.7)' }}>{r.toDC}</td>
                    <td style={{ padding: '8px 10px' }}><Mono>{r.transferDate}</Mono></td>
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
                        <div style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Reason: </span>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{r.reason || '—'}</span>
                          {r.logisticsPartner && (
                            <>
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 16 }}>Logistics: </span>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{r.logisticsPartner}</span>
                            </>
                          )}
                        </div>
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
                              onClick={(e) => { e.stopPropagation(); advanceStatus(r.transferId); }}
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
