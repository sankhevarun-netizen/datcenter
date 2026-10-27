'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { mockGRNs, mockCapitalizations } from '@/data/mock/index';
import { Landmark, ArrowLeft, ChevronUp, ChevronDown, ChevronRight, Plus } from 'lucide-react';

const C = {
  bg:     '#0B1929',
  card:   '#0d1f3c',
  card2:  'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.09)',
  green:  '#00B0A0',
  amber:  '#E87722',
  red:    '#C8102E',
  blue:   '#005EB8',
  cyan:   '#06B6D4',
};

const STATUS_COLORS = {
  CWIP: C.amber,
  'Pending Approval': C.cyan,
  Capitalized: C.green,
};

const STATUS_FLOW = { CWIP: 'Pending Approval', 'Pending Approval': 'Capitalized' };
const STATUS_ACTION_LABEL = { CWIP: 'Submit for Approval', 'Pending Approval': 'Approve & Capitalize' };

function uid(prefix, n) {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function fmtINR(n) {
  return `₹${(n / 100000).toFixed(1)}L`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function Mono({ children, color = 'white', size = 'text-xl' }) {
  return <span className={`font-bold ${size}`} style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{children}</span>;
}

const inputClass = "text-xs rounded-lg px-2.5 py-2 outline-none text-white placeholder:text-white/30";
const inputStyle = { background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}` };

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-white/50 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

export default function FACapitalizationPage() {
  const [records, setRecords] = useState(mockCapitalizations);
  const [sortKey, setSortKey] = useState('cwipDate');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);
  const [approverInput, setApproverInput] = useState('');
  const [form, setForm] = useState({ grnId: '', assetDescription: '', capitalizedValue: '', cwipDate: '' });

  const linkableGRNs = useMemo(
    () => mockGRNs.filter(g => g.status !== 'Pending' && !records.some(r => r.grnId === g.grnId)),
    [records]
  );

  const stats = useMemo(() => {
    const totalCapitalised = records.filter(r => r.status === 'Capitalized').reduce((s, r) => s + r.capitalizedValue, 0);
    const cwipValue = records.filter(r => r.status !== 'Capitalized').reduce((s, r) => s + r.capitalizedValue, 0);
    const capitalizedWithGRN = records.filter(r => r.status === 'Capitalized' && r.capitalizationDate && mockGRNs.find(g => g.grnId === r.grnId));
    const avgDays = capitalizedWithGRN.length
      ? Math.round(capitalizedWithGRN.reduce((s, r) => s + daysBetween(mockGRNs.find(g => g.grnId === r.grnId).receivedDate, r.capitalizationDate), 0) / capitalizedWithGRN.length)
      : 0;
    return { totalCapitalised, cwipValue, avgDays };
  }, [records]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      if (typeof av === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [records, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleGRNSelect = (grnId) => {
    const grn = mockGRNs.find(g => g.grnId === grnId);
    setForm(f => ({
      ...f,
      grnId,
      assetDescription: grn ? `${grn.make} ${grn.model} (x${grn.qty})` : '',
      cwipDate: f.cwipDate || new Date().toISOString().slice(0, 10),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.grnId || !form.assetDescription || !form.capitalizedValue || !form.cwipDate) return;
    const today = new Date().toISOString().slice(0, 10);
    setRecords(rs => [
      {
        capId: uid('CAP', rs.length + 1),
        grnId: form.grnId,
        assetDescription: form.assetDescription,
        capitalizedValue: Number(form.capitalizedValue),
        cwipDate: form.cwipDate,
        capitalizationDate: null,
        status: 'CWIP',
        approvalLog: [{ action: 'CWIP Opened', by: 'You', date: today, note: `Linked to ${form.grnId}.` }],
      },
      ...rs,
    ]);
    setForm({ grnId: '', assetDescription: '', capitalizedValue: '', cwipDate: '' });
  };

  const advanceStatus = (capId) => {
    if (!approverInput.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    setRecords(rs => rs.map(r => {
      if (r.capId !== capId) return r;
      const nextStatus = STATUS_FLOW[r.status];
      if (!nextStatus) return r;
      const action = nextStatus === 'Capitalized' ? 'Approved & Capitalized' : 'Submitted for Approval';
      return {
        ...r,
        status: nextStatus,
        capitalizationDate: nextStatus === 'Capitalized' ? today : r.capitalizationDate,
        approvalLog: [...r.approvalLog, { action, by: approverInput.trim(), date: today, note: '' }],
      };
    }));
    setApproverInput('');
  };

  const COLUMNS = [
    { key: 'capId', label: 'CAP ID' },
    { key: 'grnId', label: 'GRN ID' },
    { key: 'assetDescription', label: 'Asset Description' },
    { key: 'capitalizedValue', label: 'Value' },
    { key: 'cwipDate', label: 'CWIP Opened' },
    { key: 'capitalizationDate', label: 'Capitalized' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px 36px' }}>
      <Link href="/asset-portfolio/asset-management" className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 mb-3 transition-colors">
        <ArrowLeft size={12} /> Back to Asset Lifecycle
      </Link>
      <div className="flex items-center gap-2.5 mb-1">
        <Landmark size={16} color={C.cyan} />
        <h1 className="text-lg font-extrabold text-white" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          FA Capitalization
        </h1>
      </div>
      <p className="text-xs text-white/40 mb-6">Move verified GRN receipts through CWIP → Pending Approval → Capitalized, with a full approval audit trail.</p>

      {/* Stat tiles — scoped to this module only, not the enterprise Dashboards figures */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Total Capitalised (this module)</p>
          <Mono size="text-2xl" color={C.green}>{fmtINR(stats.totalCapitalised)}</Mono>
        </Card>
        <Card>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">CWIP / Pending (this module)</p>
          <Mono size="text-2xl" color={C.amber}>{fmtINR(stats.cwipValue)}</Mono>
        </Card>
        <Card>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Avg GRN→FA (Days)</p>
          <Mono size="text-2xl" color={C.cyan}>{stats.avgDays || '—'}</Mono>
        </Card>
      </div>

      {/* Intake form */}
      <div className="rounded-xl p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <p className="text-xs font-semibold text-white/70 mb-3">Open New CWIP Entry</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="Linked GRN">
            <select value={form.grnId} onChange={e => handleGRNSelect(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="" style={{ background: C.card }}>Select a verified GRN…</option>
              {linkableGRNs.map(g => (
                <option key={g.grnId} value={g.grnId} style={{ background: C.card }}>
                  {g.grnId} — {g.vendor} ({g.make} {g.model})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asset Description">
            <input value={form.assetDescription} onChange={e => setForm(f => ({ ...f, assetDescription: e.target.value }))} placeholder="Auto-filled from GRN" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Capitalized Value (₹)">
            <input required type="number" min="0" value={form.capitalizedValue} onChange={e => setForm(f => ({ ...f, capitalizedValue: e.target.value }))} placeholder="0" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="CWIP Open Date">
            <input required type="date" value={form.cwipDate} onChange={e => setForm(f => ({ ...f, cwipDate: e.target.value }))} className={inputClass} style={inputStyle} />
          </Field>
          <div className="flex items-end col-span-4">
            <button type="submit" disabled={!form.grnId} className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40" style={{ background: C.cyan, color: '#06222c' }}>
              <Plus size={13} /> Open CWIP Entry
            </button>
          </div>
        </form>
        {linkableGRNs.length === 0 && (
          <p className="text-[11px] text-white/30 mt-2">No unlinked verified GRNs available — every verified receipt already has a CWIP entry.</p>
        )}
      </div>

      {/* Capitalization log table */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
              <tr>
                <th className="px-3 py-2.5" style={{ width: 24 }} />
                {COLUMNS.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="px-3 py-2.5 text-left font-semibold text-white/45 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-white/70"
                    style={{ fontSize: 10 }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const isOpen = expanded === r.capId;
                const nextStatus = STATUS_FLOW[r.status];
                return (
                  <Fragment key={r.capId}>
                    <tr className="border-t cursor-pointer hover:bg-white/[0.02]" style={{ borderColor: C.border }} onClick={() => { setExpanded(isOpen ? null : r.capId); setApproverInput(''); }}>
                      <td className="px-3 py-2.5 text-white/40">
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-white/80">{r.capId}</td>
                      <td className="px-3 py-2.5 text-white/65 font-mono">{r.grnId}</td>
                      <td className="px-3 py-2.5 text-white/65">{r.assetDescription}</td>
                      <td className="px-3 py-2.5 text-white/65">{fmtINR(r.capitalizedValue)}</td>
                      <td className="px-3 py-2.5 text-white/65">{r.cwipDate}</td>
                      <td className="px-3 py-2.5 text-white/65">{r.capitalizationDate || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[r.status] }} />
                          <span className="text-white/65">{r.status}</span>
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ borderTop: 'none' }}>
                        <td colSpan={COLUMNS.length + 1} className="px-3 pb-4" style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <div className="pl-6 pt-2">
                            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Approval Audit Trail</p>
                            <div className="flex flex-col gap-1.5 mb-3">
                              {r.approvalLog.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <span className="w-1 h-1 rounded-full bg-white/30" />
                                  <span className="font-semibold text-white/70">{entry.action}</span>
                                  <span className="text-white/40">by {entry.by} on {entry.date}</span>
                                  {entry.note && <span className="text-white/30">— {entry.note}</span>}
                                </div>
                              ))}
                            </div>
                            {nextStatus && (
                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <input
                                  value={approverInput}
                                  onChange={e => setApproverInput(e.target.value)}
                                  placeholder="Approver name"
                                  className={inputClass}
                                  style={{ ...inputStyle, width: 180 }}
                                />
                                <button
                                  onClick={() => advanceStatus(r.capId)}
                                  disabled={!approverInput.trim()}
                                  className="text-[11px] font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
                                  style={{ background: STATUS_COLORS[nextStatus], color: '#06222c' }}
                                >
                                  {STATUS_ACTION_LABEL[r.status]}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-white/30">No capitalization records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
