'use client';
import { useState } from 'react';
import { X, Zap, AlertTriangle } from 'lucide-react';
import { mockDatacenters } from '@/data/mock/index';

export default function NewDeploymentForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    equipment: '',
    quantity: 1,
    dcId: 'mum-1',
    rackLabel: '',
    powerImpactKw: '',
    spaceImpactU: '',
    weightImpactKg: '',
    tenant: '',
    notes: '',
    priority: 'medium',
  });

  const capacityStatus = () => {
    const kw = parseFloat(form.powerImpactKw) || 0;
    const u = parseInt(form.spaceImpactU) || 0;
    if (kw > 30 || u > 30) return 'critical';
    if (kw > 15 || u > 20) return 'warning';
    return 'ok';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dc = mockDatacenters.find(d => d.id === form.dcId);
    onSubmit({
      id: `dep-${Date.now()}`,
      status: 'requested',
      equipment: `${form.quantity}× ${form.equipment}`,
      quantity: parseInt(form.quantity),
      dcId: form.dcId,
      dcName: dc?.name || form.dcId,
      targetRack: form.rackLabel ? `${form.dcId}-${form.rackLabel.replace('-', '')}` : null,
      rackLabel: form.rackLabel || 'TBD',
      powerImpactKw: parseFloat(form.powerImpactKw) || 0,
      spaceImpactU: parseInt(form.spaceImpactU) || 0,
      weightImpactKg: parseInt(form.weightImpactKg) || 0,
      portImpact: parseInt(form.quantity) * 2,
      capacityStatus: capacityStatus(),
      requestedBy: 'Current User',
      requestedAt: new Date().toISOString(),
      tenant: form.tenant || null,
      notes: form.notes,
      priority: form.priority,
    });
  };

  const cs = capacityStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCE3]">
          <div>
            <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>New Deployment Request</h2>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">Request equipment deployment to loading bay queue</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F0F2F5] text-[#9CA3AF] hover:text-[#1A1F36] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Equipment */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Equipment</label>
              <input
                required
                value={form.equipment}
                onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}
                placeholder="Dell PowerEdge R750"
                className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Quantity</label>
              <input
                type="number" min="1" max="100"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Target Datacenter</label>
              <select
                value={form.dcId}
                onChange={e => setForm(f => ({ ...f, dcId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] bg-white"
              >
                {mockDatacenters.map(dc => (
                  <option key={dc.id} value={dc.id}>{dc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Target Rack</label>
              <input
                value={form.rackLabel}
                onChange={e => setForm(f => ({ ...f, rackLabel: e.target.value }))}
                placeholder="A-01 (optional)"
                className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
              />
            </div>
          </div>

          {/* Capacity impact */}
          <div>
            <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Capacity Impact</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <input
                  type="number" step="0.1" min="0"
                  value={form.powerImpactKw}
                  onChange={e => setForm(f => ({ ...f, powerImpactKw: e.target.value }))}
                  placeholder="kW"
                  className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
                />
                <p className="text-[9px] text-[#9CA3AF] mt-0.5 text-center">Power (kW)</p>
              </div>
              <div>
                <input
                  type="number" min="0"
                  value={form.spaceImpactU}
                  onChange={e => setForm(f => ({ ...f, spaceImpactU: e.target.value }))}
                  placeholder="U"
                  className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
                />
                <p className="text-[9px] text-[#9CA3AF] mt-0.5 text-center">Space (U)</p>
              </div>
              <div>
                <input
                  type="number" min="0"
                  value={form.weightImpactKg}
                  onChange={e => setForm(f => ({ ...f, weightImpactKg: e.target.value }))}
                  placeholder="kg"
                  className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
                />
                <p className="text-[9px] text-[#9CA3AF] mt-0.5 text-center">Weight (kg)</p>
              </div>
            </div>
            {cs !== 'ok' && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                backgroundColor: cs === 'critical' ? '#FEF2F2' : '#FFFBEB',
                borderLeft: `3px solid ${cs === 'critical' ? '#C8102E' : '#E87722'}`,
              }}>
                <AlertTriangle size={11} style={{ color: cs === 'critical' ? '#C8102E' : '#E87722' }} />
                <span className="text-[10px] font-medium" style={{ color: cs === 'critical' ? '#C8102E' : '#E87722' }}>
                  {cs === 'critical' ? 'High capacity impact — requires capacity review before approval' : 'Elevated impact — approaching rack limits'}
                </span>
              </div>
            )}
          </div>

          {/* Priority + Tenant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] bg-white"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Tenant (optional)</label>
              <input
                value={form.tenant}
                onChange={e => setForm(f => ({ ...f, tenant: e.target.value }))}
                placeholder="Tenant name"
                className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Deployment context, special requirements..."
              className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[#D8DCE3] text-sm font-semibold text-[#6B7280] hover:bg-[#F8FAFC] transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors" style={{ backgroundColor: '#005EB8' }}>
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
