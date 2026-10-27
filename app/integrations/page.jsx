'use client';
import { useState } from 'react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockIntegrations, integrationCategories } from '@/data/mock/integrations';
import { Globe, Newspaper, Search, Thermometer, Ticket, GitBranch, Database, Sun, Zap, Cloud, CheckCircle, Settings, X, Eye, EyeOff, TestTube } from 'lucide-react';

const ICONS = { Globe, Newspaper, Search, Thermometer, Ticket, GitBranch, Database, Sun, Zap, Cloud };

function IntegrationSetupModal({ integration, onClose }) {
  const [values, setValues] = useState({});
  const [shown, setShown] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1200));
    setTesting(false);
    setTestResult('success');
  };

  const Icon = ICONS[integration.logoIcon] || Settings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCE3]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: integration.color + '20' }}>
              <Icon size={16} style={{ color: integration.color }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{integration.name}</h2>
              <p className="text-[10px] text-[#9CA3AF]">{integration.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F0F2F5] text-[#9CA3AF] hover:text-[#1A1F36] transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[#6B7280] leading-relaxed">{integration.description}</p>

          <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#D8DCE3]">
            <p className="text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-2">What this integration syncs:</p>
            <div className="flex flex-wrap gap-1.5">
              {integration.dataPoints.map(dp => (
                <span key={dp} className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-[#D8DCE3] text-[#6B7280] bg-white">{dp}</span>
              ))}
            </div>
          </div>

          {integration.setupFields.length > 0 && (
            <div className="space-y-3">
              {integration.setupFields.map(field => (
                <div key={field.id}>
                  <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={values[field.id] || ''}
                      onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] bg-white"
                    >
                      <option value="">Select...</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type={field.type === 'password' && !shown[field.id] ? 'password' : 'text'}
                        value={values[field.id] || ''}
                        onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-[#D8DCE3] text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8] focus:ring-1 focus:ring-[#005EB8]/20 pr-8"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShown(s => ({ ...s, [field.id]: !s[field.id] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                        >
                          {shown[field.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {testResult === 'success' && (
            <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#00B0A0]/20 rounded-xl px-3 py-2">
              <CheckCircle size={12} className="text-[#00B0A0]" />
              <p className="text-xs font-semibold text-[#00B0A0]">Connection successful — integration ready to activate</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-[#D8DCE3] text-[#374151] hover:bg-[#F8FAFC] transition-colors disabled:opacity-60"
            >
              <TestTube size={12} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: integration.color }}
            >
              <CheckCircle size={12} />
              Save & Activate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({ integration, onConfigure }) {
  const Icon = ICONS[integration.logoIcon] || Settings;
  const isConnected = integration.status === 'connected';

  return (
    <div className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:shadow-md ${
      isConnected ? 'border-[#00B0A0]/30' : 'border-[#D8DCE3]'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: integration.color + '18' }}>
            <Icon size={18} style={{ color: integration.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{integration.name}</p>
            <p className="text-[10px] text-[#9CA3AF]">{integration.category}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isConnected ? 'bg-[#F0FDF4] text-[#00B0A0]' : 'bg-[#F0F2F5] text-[#9CA3AF]'
        }`}>
          {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#00B0A0] animate-pulse" />}
          {isConnected ? 'Connected' : 'Available'}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-[#6B7280] leading-relaxed">{integration.description}</p>

      {/* Data points */}
      <div className="flex flex-wrap gap-1">
        {integration.dataPoints.slice(0, 3).map(dp => (
          <span key={dp} className="px-1.5 py-0.5 rounded-md text-[9px] font-medium border border-[#D8DCE3] text-[#9CA3AF] bg-[#F8FAFC]">{dp}</span>
        ))}
        {integration.dataPoints.length > 3 && (
          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-medium border border-[#D8DCE3] text-[#9CA3AF] bg-[#F8FAFC]">+{integration.dataPoints.length - 3} more</span>
        )}
      </div>

      {/* Footer */}
      {isConnected ? (
        <div className="flex items-center justify-between pt-1 border-t border-[#F0F2F5]">
          <span className="text-[10px] text-[#9CA3AF]">
            {integration.metrics?.apiCallsToday != null ? `${integration.metrics.apiCallsToday} calls today` : 'On-demand'}
          </span>
          <span className="text-[10px] text-[#00B0A0] font-medium">Synced {integration.lastSynced}</span>
        </div>
      ) : (
        <button
          onClick={() => onConfigure(integration)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors border"
          style={{ color: integration.color, borderColor: integration.color + '40', backgroundColor: integration.color + '08' }}
        >
          <Settings size={11} />
          Configure
        </button>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const [category, setCategory] = useState('All');
  const [configuring, setConfiguring] = useState(null);

  const filtered = category === 'All'
    ? mockIntegrations
    : mockIntegrations.filter(i => i.category === category);

  const connectedCount = mockIntegrations.filter(i => i.status === 'connected').length;

  return (
    <CCLayout title="Integrations">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-[#D8DCE3] bg-white">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-lg font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                Integration Hub
              </h1>
              <p className="text-xs text-[#9CA3AF]">Connect K-Nexus to your existing datacenter tools and workflows</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F0FDF4] border border-[#00B0A0]/20 rounded-xl">
              <CheckCircle size={13} className="text-[#00B0A0]" />
              <span className="text-xs font-semibold text-[#00B0A0]">{connectedCount} active</span>
              <span className="text-xs text-[#9CA3AF]">of {mockIntegrations.length} integrations</span>
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex-shrink-0 px-6 py-2 border-b border-[#D8DCE3] bg-[#F8FAFC] overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {integrationCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  category === cat ? 'bg-[#005EB8] text-white shadow' : 'text-[#9CA3AF] hover:text-[#374151] hover:bg-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(integration => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConfigure={setConfiguring}
              />
            ))}
          </div>
        </div>
      </div>

      {configuring && (
        <IntegrationSetupModal
          integration={configuring}
          onClose={() => setConfiguring(null)}
        />
      )}
    </CCLayout>
  );
}
