'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Bell, Plug, Users, X, Loader2 } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockUsers } from '@/data/mock/index';

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-[#00338D]' : 'bg-[#D8DCE3]'}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}

function SaveButton({ onSave, label = 'Save Changes' }) {
  const [state, setState] = useState('idle');
  const handle = () => {
    setState('loading');
    setTimeout(() => { setState('done'); onSave(); setTimeout(() => setState('idle'), 2000); }, 1200);
  };
  return (
    <button onClick={handle} disabled={state === 'loading'}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors text-white ${state === 'done' ? 'bg-[#00B0A0]' : 'bg-[#00338D] hover:bg-[#002A73]'}`}>
      {state === 'loading' ? <Loader2 size={13} className="animate-spin" /> : state === 'done' ? '✓ Saved' : label}
    </button>
  );
}

function InviteModal({ onClose, showToast }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Viewer');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const handle = () => {
    if (!email) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); showToast(`Invitation sent to ${email}`); }, 1500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCE3]">
          <h3 className="text-sm font-bold text-[#1A1F36]">Invite User</h3>
          <button onClick={onClose}><X size={16} className="text-[#9CA3AF]" /></button>
        </div>
        <div className="p-5 space-y-3">
          {[{ label: 'Name', value: name, setter: setName, placeholder: 'Full name' },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'user@company.com' }].map(f => (
            <div key={f.label}>
              <label className="text-xs font-bold text-[#6B7280] block mb-1">{f.label}</label>
              <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
                className="w-full text-sm bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50" />
            </div>
          ))}
          <div>
            <label className="text-xs font-bold text-[#6B7280] block mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full text-sm bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none">
              {['Admin', 'Editor', 'Viewer'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <button onClick={handle} disabled={loading || done || !email}
            className={`w-full py-2 rounded-xl text-sm font-bold text-white transition-colors ${done ? 'bg-[#00B0A0]' : 'bg-[#00338D] hover:bg-[#002A73] disabled:opacity-40'}`}>
            {loading ? <Loader2 size={13} className="animate-spin mx-auto" /> : done ? '✓ Invitation Sent' : 'Send Invitation'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('general');
  const [showInvite, setShowInvite] = useState(false);
  const [notifications, setNotifications] = useState({ email: true, sms: false, slack: true, pagerduty: false });
  const [integrations, setIntegrations] = useState({ dcim: 'connected', itsm: 'connected', monitoring: 'connected', bms: 'disconnected', cmdb: 'disconnected' });

  return (
    <CCLayout title="Settings">
      {({ showToast }) => (
        <div className="p-6 max-w-3xl">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white border border-[#D8DCE3] rounded-xl p-1 w-fit">
            {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'integrations', label: 'Integrations', icon: Plug },
              { id: 'users', label: 'Users', icon: Users },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.id ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:bg-[#F0F2F5]'}`}>
                  <Icon size={12} /> {t.label}
                </button>
              );
            })}
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

            {/* General */}
            {tab === 'general' && (
              <div className="bg-white rounded-2xl border border-[#D8DCE3] p-5 space-y-4">
                {[
                  { label: 'Platform Name', type: 'text', defaultValue: 'K-Nexus Command Center' },
                  { label: 'Default Timezone', type: 'select', options: ['UTC+0 (London)', 'UTC+5:30 (IST)', 'UTC+8 (SGT)', 'UTC+4 (GST)', 'UTC-5 (EST)', 'UTC-3 (BRT)'], defaultValue: 'UTC+0 (London)' },
                  { label: 'Default Time Range', type: 'select', options: ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days'], defaultValue: 'Last 24 Hours' },
                  { label: 'Language', type: 'select', options: ['English'], defaultValue: 'English' },
                ].map(field => (
                  <div key={field.label}>
                    <label className="text-xs font-bold text-[#6B7280] block mb-1">{field.label}</label>
                    {field.type === 'select' ? (
                      <select defaultValue={field.defaultValue} className="w-full text-sm bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50">
                        {field.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" defaultValue={field.defaultValue} className="w-full text-sm bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50" />
                    )}
                  </div>
                ))}
                <div className="pt-2">
                  <SaveButton onSave={() => showToast('Settings saved successfully')} />
                </div>
              </div>
            )}

            {/* Notifications */}
            {tab === 'notifications' && (
              <div className="bg-white rounded-2xl border border-[#D8DCE3] p-5 space-y-5">
                <div>
                  <p className="text-sm font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Notification Channels</p>
                  <div className="space-y-3">
                    {[
                      { id: 'email', label: 'Email', sub: 'Incident alerts and daily summaries' },
                      { id: 'sms', label: 'SMS', sub: 'Critical incidents only' },
                      { id: 'slack', label: 'Slack', sub: '#ops-alerts channel' },
                      { id: 'pagerduty', label: 'PagerDuty', sub: 'On-call escalation routing' },
                    ].map(ch => (
                      <div key={ch.id} className="flex items-center justify-between py-2 border-b border-[#F0F2F5] last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1F36]">{ch.label}</p>
                          <p className="text-xs text-[#9CA3AF]">{ch.sub}</p>
                        </div>
                        <Toggle value={notifications[ch.id]} onChange={v => setNotifications(n => ({ ...n, [ch.id]: v }))} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1A1F36] mb-3" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Alert Thresholds</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#6B7280]">Critical incident notification</p>
                      <span className="text-xs font-bold text-[#00B0A0] bg-[#F0FDF4] px-2 py-0.5 rounded-full">Immediate (non-configurable)</span>
                    </div>
                    {[
                      { label: 'Health score below', defaultValue: '85', unit: 'pts' },
                      { label: 'PUE above', defaultValue: '1.60', unit: '' },
                      { label: 'Utilization above', defaultValue: '90', unit: '%' },
                    ].map(t => (
                      <div key={t.label} className="flex items-center justify-between">
                        <p className="text-sm text-[#6B7280]">{t.label}</p>
                        <div className="flex items-center gap-1">
                          <input type="text" defaultValue={t.defaultValue} className="w-16 text-sm text-center bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2 py-1 focus:outline-none focus:border-[#005EB8]/50" />
                          {t.unit && <span className="text-xs text-[#9CA3AF]">{t.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <SaveButton onSave={() => showToast('Notification settings saved')} />
              </div>
            )}

            {/* Integrations */}
            {tab === 'integrations' && (
              <div className="bg-white rounded-2xl border border-[#D8DCE3] p-5 space-y-3">
                {[
                  { id: 'dcim', label: 'DCIM', sub: 'Schneider EcoStruxure', detail: '14,200+ monitoring endpoints' },
                  { id: 'itsm', label: 'ITSM', sub: 'ServiceNow', detail: 'Incident and change management' },
                  { id: 'monitoring', label: 'Monitoring', sub: 'Datadog', detail: 'APM + infrastructure telemetry' },
                  { id: 'bms', label: 'BMS', sub: 'Honeywell Forge', detail: 'Building management integration' },
                  { id: 'cmdb', label: 'CMDB', sub: 'BMC Helix', detail: 'Configuration management database' },
                ].map(intg => {
                  const connected = integrations[intg.id] === 'connected';
                  return (
                    <div key={intg.id} className="flex items-center justify-between p-3 border border-[#D8DCE3] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connected ? 'bg-[#00B0A0]/10' : 'bg-[#F0F2F5]'}`}>
                          <Plug size={14} style={{ color: connected ? '#00B0A0' : '#9CA3AF' }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1A1F36]">{intg.label} — {intg.sub}</p>
                          <p className="text-xs text-[#9CA3AF]">{intg.detail}</p>
                        </div>
                      </div>
                      {connected ? (
                        <span className="text-xs font-bold px-2 py-0.5 bg-[#F0FDF4] text-[#00B0A0] rounded-full">Connected</span>
                      ) : (
                        <button onClick={() => showToast('Integration setup coming soon')}
                          className="text-xs font-bold px-3 py-1.5 bg-[#00338D] text-white rounded-lg hover:bg-[#002A73] transition-colors">Connect</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div className="bg-white rounded-2xl border border-[#D8DCE3] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#D8DCE3]">
                  <p className="text-sm font-bold text-[#1A1F36]">{mockUsers.length} Users</p>
                  <button onClick={() => setShowInvite(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00338D] text-white text-xs font-bold rounded-lg hover:bg-[#002A73] transition-colors">
                    <Users size={12} /> Invite User
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#D8DCE3] bg-[#F8FAFC]">
                      {['User', 'Role', 'Permission', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockUsers.map(u => (
                      <tr key={u.id} className="border-b border-[#F0F2F5] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#005EB8] to-[#00338D] flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[10px] font-bold">{u.initials}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#1A1F36]">{u.name}</p>
                              <p className="text-[10px] text-[#9CA3AF]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6B7280]">{u.role}</td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{
                            backgroundColor: u.permission === 'Admin' ? '#00338D15' : u.permission === 'Editor' ? '#005EB815' : '#F0F2F5',
                            color: u.permission === 'Admin' ? '#00338D' : u.permission === 'Editor' ? '#005EB8' : '#6B7280'
                          }}>{u.permission}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#00B0A0]">{u.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {showInvite && <InviteModal onClose={() => setShowInvite(false)} showToast={(msg) => { showToast?.(msg); setShowInvite(false); }} />}
          </AnimatePresence>
        </div>
      )}
    </CCLayout>
  );
}
