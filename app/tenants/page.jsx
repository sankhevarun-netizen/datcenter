'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, TrendingUp, DollarSign, AlertTriangle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockTenants } from '@/data/mock/index';

function TierBadge({ tier }) {
  const cfg = { Platinum: { bg: '#00338D15', color: '#00338D' }, Gold: { bg: '#E8772215', color: '#B8860B' }, Silver: { bg: '#6B728015', color: '#4B5563' } };
  const c = cfg[tier] || cfg.Silver;
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: c.bg, color: c.color }}>{tier}</span>;
}

function UtilBar({ pct }) {
  const color = pct >= 90 ? '#C8102E' : pct >= 75 ? '#E87722' : '#00B0A0';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#D8DCE3] overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</span>
    </div>
  );
}

function TenantCard({ tenant, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalDone, setProposalDone] = useState(false);

  const handleProposal = () => {
    setProposalLoading(true);
    setTimeout(() => {
      setProposalLoading(false);
      setProposalDone(true);
      showToast(`Proposal template generated for ${tenant.name}`);
    }, 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-sm" style={{ backgroundColor: tenant.color }}>
            {tenant.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{tenant.name}</h3>
              <TierBadge tier={tenant.allocations[0]?.contractTier || 'Gold'} />
              {tenant.activeTickets > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 bg-[#FEF2F2] text-[#C8102E] rounded-full font-bold flex items-center gap-0.5">
                  <AlertTriangle size={8} /> {tenant.activeTickets} tickets
                </span>
              )}
              {tenant.upsellOpportunity?.exists && (
                <span className="text-[9px] px-1.5 py-0.5 bg-[#F0FDF4] text-[#00B0A0] rounded-full font-bold flex items-center gap-0.5">
                  <Sparkles size={8} /> Upsell
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#9CA3AF]">{tenant.industry}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-[#00B0A0]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{tenant.contractValue}</p>
            <p className="text-[10px] text-[#9CA3AF]">annual contract</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#F0F2F5] rounded-xl p-2.5">
            <p className="text-[10px] text-[#9CA3AF] mb-1">Total Racks</p>
            <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{tenant.totalRacks}</p>
            <UtilBar pct={tenant.totalUtilizationPercent} />
          </div>
          <div className="bg-[#F0F2F5] rounded-xl p-2.5">
            <p className="text-[10px] text-[#9CA3AF] mb-1">SLA Compliance</p>
            <p className="text-sm font-bold" style={{ color: tenant.slaCompliance >= 99.9 ? '#00B0A0' : '#E87722', fontFamily: "'JetBrains Mono', monospace" }}>{tenant.slaCompliance}%</p>
            <p className="text-[10px] text-[#9CA3AF]">{tenant.allocations.length} {tenant.allocations.length === 1 ? 'facility' : 'facilities'}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-3 flex-wrap">
          {tenant.allocations.map(a => (
            <span key={a.dcId} className="text-[9px] px-1.5 py-0.5 bg-[#00338D]/8 text-[#00338D] rounded-full font-medium">{a.dcName.split(' ').slice(0,2).join(' ')}</span>
          ))}
        </div>

        {tenant.upsellOpportunity?.exists && (
          <div className="bg-[#F0FDF4] border border-[#00B0A0]/20 rounded-lg p-2.5 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-[#00B0A0] mb-0.5">Upsell: {tenant.upsellOpportunity.type}</p>
                <p className="text-[10px] text-[#1A1F36]">{tenant.upsellOpportunity.reason}</p>
                <p className="text-[10px] font-bold text-[#00B0A0] mt-0.5">{tenant.upsellOpportunity.estimatedRevenue} opportunity</p>
              </div>
              <button onClick={handleProposal} disabled={proposalLoading || proposalDone}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${proposalDone ? 'bg-[#00B0A0] text-white' : 'bg-white border border-[#00B0A0] text-[#00B0A0] hover:bg-[#00B0A0]/5'}`}>
                {proposalLoading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 border-2 border-[#00B0A0] border-t-transparent rounded-full" /> : proposalDone ? '✓ Sent' : 'Create Proposal'}
              </button>
            </div>
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-[#005EB8] hover:text-[#00338D] transition-colors">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Hide' : 'Show'} per-facility breakdown
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#F0F2F5] overflow-hidden">
            <div className="p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#9CA3AF] text-[10px] border-b border-[#F0F2F5]">
                    {['Datacenter', 'Racks Alloc.', 'Racks Used', 'Power (kW)', 'Utilization', 'Contract Tier', 'Expires', 'Revenue/mo'].map(h => (
                      <th key={h} className="text-left py-1.5 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenant.allocations.map(a => {
                    const utilPct = Math.round(a.racksUsed / a.racksAllocated * 100);
                    return (
                      <tr key={a.dcId} className="border-b border-[#F0F2F5] last:border-0">
                        <td className="py-2 font-medium text-[#1A1F36]">{a.dcName}</td>
                        <td className="py-2 font-mono">{a.racksAllocated}</td>
                        <td className="py-2 font-mono">{a.racksUsed}</td>
                        <td className="py-2 font-mono">{a.powerUsedKW}/{a.powerAllocatedKW}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1 rounded-full bg-[#D8DCE3] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${utilPct}%`, backgroundColor: utilPct > 90 ? '#C8102E' : utilPct > 75 ? '#E87722' : '#00B0A0' }} />
                            </div>
                            <span className="font-mono">{utilPct}%</span>
                          </div>
                        </td>
                        <td className="py-2"><TierBadge tier={a.contractTier} /></td>
                        <td className="py-2 text-[#9CA3AF]">{a.contractEndDate}</td>
                        <td className="py-2 font-bold text-[#00B0A0] font-mono">{a.monthlyRevenue}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TenantsPage() {
  const [showToast, setShowToast] = useState(null);
  const upsellTenants = mockTenants.filter(t => t.upsellOpportunity?.exists);
  const totalRacks = mockTenants.reduce((s, t) => s + t.totalRacks, 0);
  const avgUtil = Math.round(mockTenants.reduce((s, t) => s + t.totalUtilizationPercent, 0) / mockTenants.length);
  const totalRevenue = mockTenants.reduce((s, t) => {
    const n = parseFloat(t.contractValue.replace(/[^0-9.]/g, ''));
    return s + n;
  }, 0).toFixed(1);

  return (
    <CCLayout title="Tenant Operations">
      {({ showToast: toast }) => (
        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Tenants', value: String(mockTenants.length), icon: Users, color: '#005EB8' },
              { label: 'Contracted Racks', value: totalRacks.toLocaleString(), icon: TrendingUp, color: '#00338D' },
              { label: 'Avg. Utilization', value: `${avgUtil}%`, icon: TrendingUp, color: '#00B0A0' },
              { label: 'Annual Revenue', value: `$${totalRevenue}M`, icon: DollarSign, color: '#7C3AED' },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.color + '15' }}>
                    <Icon size={18} style={{ color: kpi.color }} />
                  </div>
                  <div>
                    <p className="text-xs text-[#9CA3AF] font-medium">{kpi.label}</p>
                    <p className="text-xl font-bold text-[#1A1F36]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upsell banner */}
          {upsellTenants.length > 0 && (
            <div className="bg-gradient-to-r from-[#00B0A0]/10 to-[#005EB8]/10 border border-[#00B0A0]/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-[#00B0A0]" />
                <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Upsell Opportunities — {upsellTenants.length} identified</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {upsellTenants.map(t => (
                  <div key={t.id} className="bg-white rounded-xl p-3 border border-[#D8DCE3] flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-white text-xs" style={{ backgroundColor: t.color }}>{t.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1A1F36] truncate">{t.name} — {t.upsellOpportunity.type}</p>
                      <p className="text-[10px] text-[#6B7280] truncate">{t.upsellOpportunity.reason}</p>
                    </div>
                    <span className="text-xs font-bold text-[#00B0A0] flex-shrink-0">{t.upsellOpportunity.estimatedRevenue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tenant cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {mockTenants.map(t => (
              <TenantCard key={t.id} tenant={t} showToast={toast} />
            ))}
          </div>
        </div>
      )}
    </CCLayout>
  );
}
