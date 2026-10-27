'use client';
import { useState } from 'react';
import CCLayout from '@/components/command-center/CCLayout';
import LoadingBayBoard from '@/components/deployments/LoadingBayBoard';
import NewDeploymentForm from '@/components/deployments/NewDeploymentForm';
import { mockDeployments, deploymentColumns } from '@/data/mock/deployments';
import { Plus, Package, CheckCircle, Clock, Truck, AlertTriangle } from 'lucide-react';

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState(mockDeployments);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');

  const handleStatusChange = (id, newStatus) => {
    setDeployments(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  const handleNewDeployment = (dep) => {
    setDeployments(prev => [dep, ...prev]);
    setShowForm(false);
  };

  const filtered = filter === 'all' ? deployments : deployments.filter(d => d.priority === filter);

  const counts = {
    requested:  deployments.filter(d => d.status === 'requested').length,
    approved:   deployments.filter(d => d.status === 'approved').length,
    in_transit: deployments.filter(d => d.status === 'in_transit').length,
    installed:  deployments.filter(d => d.status === 'installed').length,
  };

  const criticalCount = deployments.filter(d => d.capacityStatus === 'critical' && d.status !== 'installed').length;

  return (
    <CCLayout title="Virtual Loading Bay">
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#D8DCE3] bg-white">
          <div>
            <h1 className="text-lg font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              Virtual Loading Bay
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Track equipment deployments from request to installation</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Priority filter */}
            <div className="flex items-center gap-1 p-0.5 bg-[#F0F2F5] rounded-lg border border-[#D8DCE3]">
              {['all', 'critical', 'high', 'medium'].map(p => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                    filter === p ? 'bg-white text-[#1A1F36] shadow' : 'text-[#9CA3AF] hover:text-[#6B7280]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#005EB8' }}
            >
              <Plus size={14} />
              New Deployment
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 bg-[#F8FAFC] border-b border-[#D8DCE3]">
          {[
            { label: 'Requested', count: counts.requested, icon: Clock, color: '#6366f1' },
            { label: 'Approved', count: counts.approved, icon: CheckCircle, color: '#f59e0b' },
            { label: 'In Transit', count: counts.in_transit, icon: Truck, color: '#3b82f6' },
            { label: 'Installed', count: counts.installed, icon: Package, color: '#10b981' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '20' }}>
                  <Icon size={13} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF]">{s.label}</div>
                  <div className="text-sm font-bold text-[#1A1F36] font-mono">{s.count}</div>
                </div>
              </div>
            );
          })}
          {criticalCount > 0 && (
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-[#FEF2F2] border border-[#C8102E30] rounded-lg">
              <AlertTriangle size={12} className="text-[#C8102E]" />
              <span className="text-xs font-semibold text-[#C8102E]">{criticalCount} deployment{criticalCount > 1 ? 's' : ''} with capacity issues</span>
            </div>
          )}
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-hidden">
          <LoadingBayBoard
            deployments={filtered}
            columns={deploymentColumns}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      {/* New deployment modal */}
      {showForm && (
        <NewDeploymentForm
          onSubmit={handleNewDeployment}
          onClose={() => setShowForm(false)}
        />
      )}
    </CCLayout>
  );
}
