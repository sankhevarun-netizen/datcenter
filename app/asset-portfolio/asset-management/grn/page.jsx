'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { mockAssets, mockGRNs } from '@/data/mock/index';
import { PackageSearch, ArrowLeft, ChevronUp, ChevronDown, Plus } from 'lucide-react';

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
  Pending: C.amber,
  Verified: C.cyan,
  'Linked to FA': C.green,
};

const CLASS_OPTIONS = Array.from(new Set(mockAssets.map(a => a.class))).sort();
const SITE_OPTIONS = Array.from(new Set(mockAssets.map(a => a.dcName))).sort();

function uid(prefix, n) {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-white/50 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "text-xs rounded-lg px-2.5 py-2 outline-none text-white placeholder:text-white/30";
const inputStyle = { background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}` };

export default function AssetReceivingGRNPage() {
  const [records, setRecords] = useState(mockGRNs);
  const [sortKey, setSortKey] = useState('receivedDate');
  const [sortDir, setSortDir] = useState('desc');
  const [form, setForm] = useState({
    po: '', vendor: '', class: CLASS_OPTIONS[0] || '', make: '', model: '',
    qty: '', receivedDate: '', receivedBy: '', site: SITE_OPTIONS[0] || '',
    status: 'Pending', notes: '',
  });

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [records, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.po || !form.vendor || !form.qty || !form.receivedDate) return;
    setRecords(rs => [
      { grnId: uid('GRN', rs.length + 1), ...form, qty: Number(form.qty) },
      ...rs,
    ]);
    setForm({ po: '', vendor: '', class: CLASS_OPTIONS[0] || '', make: '', model: '', qty: '', receivedDate: '', receivedBy: '', site: SITE_OPTIONS[0] || '', status: 'Pending', notes: '' });
  };

  const COLUMNS = [
    { key: 'grnId', label: 'GRN ID' },
    { key: 'po', label: 'PO #' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'class', label: 'Class' },
    { key: 'make', label: 'Make / Model' },
    { key: 'qty', label: 'Qty' },
    { key: 'receivedDate', label: 'Received' },
    { key: 'receivedBy', label: 'Received By' },
    { key: 'site', label: 'Site' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px 36px' }}>
      <Link href="/asset-portfolio/asset-management" className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 mb-3 transition-colors">
        <ArrowLeft size={12} /> Back to Asset Lifecycle
      </Link>
      <div className="flex items-center gap-2.5 mb-1">
        <PackageSearch size={16} color={C.cyan} />
        <h1 className="text-lg font-extrabold text-white" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          Asset Receiving (GRN)
        </h1>
      </div>
      <p className="text-xs text-white/40 mb-6">Log incoming goods receipts against purchase orders, then track them through verification toward FA capitalization.</p>

      {/* Intake form */}
      <div className="rounded-xl p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <p className="text-xs font-semibold text-white/70 mb-3">New GRN Entry</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
          <Field label="PO Number">
            <input required value={form.po} onChange={e => setForm(f => ({ ...f, po: e.target.value }))} placeholder="PO-88301" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Vendor">
            <input required value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Class">
            <select value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} className={inputClass} style={inputStyle}>
              {CLASS_OPTIONS.map(o => <option key={o} value={o} style={{ background: C.card }}>{o}</option>)}
            </select>
          </Field>
          <Field label="Make">
            <input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="Make" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Model" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Quantity">
            <input required type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="1" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Received Date">
            <input required type="date" value={form.receivedDate} onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Received By">
            <input value={form.receivedBy} onChange={e => setForm(f => ({ ...f, receivedBy: e.target.value }))} placeholder="Name" className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Site / DC">
            <select value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} className={inputClass} style={inputStyle}>
              {SITE_OPTIONS.map(o => <option key={o} value={o} style={{ background: C.card }}>{o}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass} style={inputStyle}>
              {Object.keys(STATUS_COLORS).map(o => <option key={o} value={o} style={{ background: C.card }}>{o}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={inputClass} style={inputStyle} />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-4 py-2 w-full transition-colors" style={{ background: C.cyan, color: '#06222c' }}>
              <Plus size={13} /> Log GRN
            </button>
          </div>
        </form>
      </div>

      {/* GRN log table */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
              <tr>
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
              {sorted.map(r => (
                <tr key={r.grnId} className="border-t" style={{ borderColor: C.border }}>
                  <td className="px-3 py-2.5 font-mono text-white/80">{r.grnId}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.po}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.vendor}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.class}</td>
                  <td className="px-3 py-2.5 text-white/65">{[r.make, r.model].filter(Boolean).join(' ')}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.qty}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.receivedDate}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.receivedBy}</td>
                  <td className="px-3 py-2.5 text-white/65">{r.site}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[r.status] || 'rgba(255,255,255,0.4)' }} />
                      <span className="text-white/65">{r.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-white/30">No GRN records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
