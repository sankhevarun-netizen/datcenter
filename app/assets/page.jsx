'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, AlertTriangle, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockAssets } from '@/data/mock/index';

const STATUS_CONFIG = {
  healthy:  { label: 'Healthy',  color: '#00B0A0', bg: '#F0FDF4' },
  degraded: { label: 'Degraded', color: '#E87722', bg: '#FFFBEB' },
  critical: { label: 'Critical', color: '#C8102E', bg: '#FEF2F2' },
  warning:  { label: 'Warning',  color: '#D97706', bg: '#FFFBEB' },
  spare:    { label: 'Spare',    color: '#6B7280', bg: '#F0F2F5' },
};

const RISK_CONFIG = {
  None:   { color: '#00B0A0', bg: '#F0FDF4' },
  Low:    { color: '#005EB8', bg: '#EFF6FF' },
  Medium: { color: '#E87722', bg: '#FFFBEB' },
  High:   { color: '#C8102E', bg: '#FEF2F2' },
};

function AssetDetailModal({ asset, onClose, showToast }) {
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintDone, setMaintDone] = useState(false);
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagDone, setFlagDone] = useState(false);

  const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.healthy;
  const rc = RISK_CONFIG[asset.failureRisk] || RISK_CONFIG.None;

  const scheduleMaint = () => {
    setMaintLoading(true);
    setTimeout(() => { setMaintLoading(false); setMaintDone(true); showToast(`Maintenance request submitted for ${asset.id}`); }, 2000);
  };
  const flagReplacement = () => {
    setFlagLoading(true);
    setTimeout(() => { setFlagLoading(false); setFlagDone(true); showToast(`Asset ${asset.id} flagged for replacement review`); }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCE3]">
          <div>
            <p className="text-xs font-mono text-[#9CA3AF]">{asset.id}</p>
            <h3 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{asset.type} — {asset.dcName}</h3>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1F36] transition-colors"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status', value: sc.label, color: sc.color, bg: sc.bg },
              { label: 'Health', value: `${asset.healthPct}%`, color: asset.healthPct < 70 ? '#C8102E' : '#00B0A0' },
              { label: 'Utilization', value: `${asset.utilizationPct}%` },
              { label: 'Age', value: `${asset.ageYears} ${asset.ageYears === 1 ? 'year' : 'years'}` },
              { label: 'Failure Risk', value: asset.failureRisk, color: rc.color, bg: rc.bg },
              { label: 'Last Maintenance', value: asset.lastMaintenance || 'N/A' },
            ].map(item => (
              <div key={item.label} className="bg-[#F0F2F5] rounded-xl p-3">
                <p className="text-[10px] text-[#9CA3AF] font-medium mb-0.5">{item.label}</p>
                {item.bg ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: item.bg, color: item.color }}>{item.value}</span>
                ) : (
                  <p className="text-sm font-bold" style={{ color: item.color || '#1A1F36', fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</p>
                )}
              </div>
            ))}
          </div>
          <div className="bg-[#F0F2F5] rounded-xl p-3">
            <p className="text-[10px] text-[#9CA3AF] font-medium mb-1">Specifications</p>
            <p className="text-xs text-[#1A1F36]">{asset.specs}</p>
          </div>
          <div className="bg-[#F0F2F5] rounded-xl p-3">
            <p className="text-[10px] text-[#9CA3AF] font-medium mb-1">Location</p>
            <p className="text-xs text-[#1A1F36]">{asset.dcName} · {asset.location}</p>
          </div>
          {asset.maintHistory.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[#1A1F36] mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Maintenance History</p>
              <div className="space-y-2">
                {asset.maintHistory.map((h, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-[#9CA3AF] flex-shrink-0 font-mono">{h.date}</span>
                    <span className="text-[#6B7280]">{h.event}</span>
                    <span className="ml-auto text-[#9CA3AF] flex-shrink-0">{h.tech}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={scheduleMaint} disabled={maintLoading || maintDone}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${maintDone ? 'bg-[#00B0A0] text-white' : 'bg-[#00338D] hover:bg-[#002A73] text-white'}`}>
              {maintLoading ? <Loader2 size={12} className="animate-spin" /> : maintDone ? '✓ Submitted' : 'Schedule Maintenance'}
            </button>
            <button onClick={flagReplacement} disabled={flagLoading || flagDone}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${flagDone ? 'bg-[#C8102E] text-white border-[#C8102E]' : 'border-[#C8102E] text-[#C8102E] hover:bg-[#C8102E]/5'}`}>
              {flagLoading ? <Loader2 size={12} className="animate-spin" /> : flagDone ? '✓ Flagged' : 'Flag for Replacement'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function AssetsPage() {
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dcFilter, setDcFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [toast, setToast] = useState(null);

  const criticalAssets = mockAssets.filter(a => a.healthPct < 70 || a.failureRisk === 'High');
  const types = ['All', ...Array.from(new Set(mockAssets.map(a => a.type)))];
  const dcs = ['All', ...Array.from(new Set(mockAssets.map(a => a.dcName)))];

  const filtered = mockAssets.filter(a => {
    if (typeFilter !== 'All' && a.type !== typeFilter) return false;
    if (statusFilter !== 'All' && a.status !== statusFilter) return false;
    if (dcFilter !== 'All' && a.dcName !== dcFilter) return false;
    if (search && !a.id.toLowerCase().includes(search.toLowerCase()) && !a.type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <CCLayout title="Asset Intelligence">
      {({ showToast }) => (
        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Assets', value: mockAssets.length, color: '#005EB8' },
              { label: 'In Use', value: mockAssets.filter(a => a.status !== 'spare').length, color: '#00338D' },
              { label: 'Spare / Available', value: mockAssets.filter(a => a.status === 'spare').length, color: '#00B0A0' },
              { label: 'Require Attention', value: criticalAssets.length, color: '#C8102E' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-[#D8DCE3] p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</p>
                <p className="text-xs text-[#9CA3AF] font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Critical assets callout */}
          {criticalAssets.length > 0 && (
            <div className="bg-[#FEF2F2] border border-[#C8102E]/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-[#C8102E]" />
                <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Assets Requiring Attention</p>
              </div>
              <div className="space-y-2">
                {criticalAssets.map(a => {
                  const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.critical;
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-[#D8DCE3]">
                      <span className="text-xs font-mono font-bold text-[#1A1F36]">{a.id}</span>
                      <span className="text-xs text-[#6B7280]">{a.type} · {a.dcName} · {a.location}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: sc.bg, color: sc.color }}>{a.healthPct}% health</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#FEF2F2] text-[#C8102E]">{a.failureRisk} risk</span>
                      <button onClick={() => setSelectedAsset(a)} className="ml-auto text-xs font-bold text-[#005EB8] hover:text-[#00338D] transition-colors">Take Action →</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#D8DCE3] p-3 flex flex-wrap gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by asset ID or type..."
              className="flex-1 min-w-40 text-sm text-[#1A1F36] placeholder:text-[#9CA3AF] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#005EB8]/50" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="text-xs text-[#6B7280] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none">
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-xs text-[#6B7280] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none">
              {['All', 'healthy', 'degraded', 'critical', 'warning', 'spare'].map(s => <option key={s} className="capitalize">{s}</option>)}
            </select>
            <select value={dcFilter} onChange={e => setDcFilter(e.target.value)}
              className="text-xs text-[#6B7280] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none">
              {dcs.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D8DCE3] bg-[#F8FAFC]">
                  {['Asset ID', 'Type', 'Datacenter', 'Location', 'Status', 'Health', 'Util.', 'Age', 'Failure Risk', 'Last Maint.', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.healthy;
                  const rc = RISK_CONFIG[a.failureRisk] || RISK_CONFIG.None;
                  return (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-[#F0F2F5] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-[#1A1F36]">{a.id}</td>
                      <td className="px-3 py-2.5 text-xs text-[#6B7280]">{a.type}</td>
                      <td className="px-3 py-2.5 text-xs text-[#6B7280] max-w-32 truncate">{a.dcName}</td>
                      <td className="px-3 py-2.5 text-xs text-[#9CA3AF] max-w-28 truncate">{a.location}</td>
                      <td className="px-3 py-2.5"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${a.healthPct}%`, backgroundColor: a.healthPct < 70 ? '#C8102E' : a.healthPct < 85 ? '#E87722' : '#00B0A0' }} />
                          </div>
                          <span className="text-xs font-mono">{a.healthPct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono">{a.utilizationPct}%</td>
                      <td className="px-3 py-2.5 text-xs text-[#9CA3AF]">{a.ageYears}yr</td>
                      <td className="px-3 py-2.5"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: rc.bg, color: rc.color }}>{a.failureRisk}</span></td>
                      <td className="px-3 py-2.5 text-xs text-[#9CA3AF] whitespace-nowrap">{a.lastMaintenance || '—'}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setSelectedAsset(a)} className="text-xs font-bold text-[#005EB8] hover:text-[#00338D] transition-colors whitespace-nowrap">View Details</button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail Modal */}
          <AnimatePresence>
            {selectedAsset && (
              <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} showToast={showToast} />
            )}
          </AnimatePresence>
        </div>
      )}
    </CCLayout>
  );
}
