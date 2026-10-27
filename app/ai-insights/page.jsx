'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Sparkles, Loader2, AlertTriangle, Info, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { riskWatchlist } from '@/lib/nexus/predictive-engine';
import { getFacility } from '@/lib/nexus/data';
import { AS_OF } from '@/lib/nexus/time';
import { logEvent } from '@/lib/audit-client';

// Priority comes from the predictive engine; status colour always ships with its label.
const SEV_CONFIG = {
  high:   { label: 'High',   color: '#C8102E', bg: '#FEF2F2', border: '#FCA5A5', icon: AlertTriangle },
  medium: { label: 'Medium', color: '#B54708', bg: '#FFFBEB', border: '#FCD34D', icon: AlertTriangle },
  low:    { label: 'Low',    color: '#005EB8', bg: '#EFF6FF', border: '#93C5FD', icon: Info },
};

const SUGGESTIONS = [
  "What's the risk posture for Nexus Mumbai-1?",
  'Which tenants are exposed to the UPS battery issue?',
  'Summarise the open alerts',
  'Where is PUE drifting and what does it cost?',
  'What are the top 3 actions I should take today?',
];

const lakh = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })} lakh`;

// What to do, from the engine's own figures; no new numbers.
function suggestedAction(r) {
  if (r.kind === 'component' && r.cost?.scheduledInrLakh != null) {
    return `Schedule the ${r.failureMode.toLowerCase()} work on ${r.componentId} before ${r.actBy}: ${lakh(r.cost.scheduledInrLakh)} planned, against ${lakh(r.cost.emergencyInrLakh)} as an emergency.`;
  }
  if (r.kind === 'component') return `Act on ${r.componentId} before ${r.actBy}; an emergency repair has cost ${lakh(r.cost.emergencyInrLakh)}.`;
  if (r.kind === 'efficiency-drift') return `Investigate cooling efficiency: the drift is running at ${lakh(r.cost.annualRunRateInrLakh)} a year in extra energy.`;
  if (r.kind === 'capacity-trend') return 'Start the expansion or densification case now; capacity takes longer to add than the trend allows.';
  return 'Review in the predictive watchlist.';
}

const detailLink = (r) => (r.alert?.alertId ? `/incidents?alert=${r.alert.alertId}` : '/command-center/predictive');

function InsightCard({ insight, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [queued, setQueued] = useState(false);
  const sc = SEV_CONFIG[insight.priority] || SEV_CONFIG.low;
  const Icon = sc.icon;
  const facility = getFacility(insight.facilityId).name;

  const queue = () => {
    if (queued) return;
    logEvent('action', 'queue_risk', { facilityId: insight.facilityId, subject: insight.id, detail: { title: insight.title } });
    setQueued(true);
    showToast(`${insight.componentId ?? facility} added to the operations queue`);
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: sc.border }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sc.bg }}>
            <Icon size={14} style={{ color: sc.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
              {insight.since && <span className="text-[9px] text-[#9CA3AF]">Signal since {insight.since}</span>}
              {insight.actBy && <span className="text-[9px] font-semibold text-[#1A1F36] ml-auto">Act by {insight.actBy}</span>}
            </div>
            <h3 className="text-sm font-bold text-[#1A1F36] mb-0.5" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{insight.title}</h3>
            <p className="text-xs text-[#6B7280] mb-1.5">{facility}</p>
            <p className="flex items-center gap-1 text-[10px] text-[#64748B]">
              <FileText size={10} /> {insight.evidence.length} {insight.evidence.length === 1 ? 'record' : 'records'} of evidence
              {insight.pattern?.length > 0 && <> · seen {insight.pattern.length}× before</>}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <ul className="mt-3 mb-3 space-y-1.5">
                {insight.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-[#475569] leading-relaxed">
                    <span className="font-mono text-[9px] text-[#94A3B8] mr-1.5">{e.source}</span>{e.text}
                  </li>
                ))}
              </ul>
              <div className="bg-[#F8FAFC] border border-[#D8DCE3] rounded-xl p-3 mb-3">
                <p className="text-[10px] font-bold text-[#00338D] mb-0.5">Suggested action</p>
                <p className="text-xs text-[#1A1F36]">{suggestedAction(insight)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={queue} disabled={queued}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                  style={{ backgroundColor: queued ? '#00B0A0' : sc.color }}>
                  {queued ? '✓ Queued' : 'Add to operations queue'}
                </button>
                <Link href={detailLink(insight)} className="text-xs font-semibold text-[#005EB8] hover:underline">Open analysis →</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-[#1A1F36] transition-colors mt-2">
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Collapse' : 'View evidence'}
        </button>
      </div>
    </div>
  );
}

function ChatInterface() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "I'm K-Nexus AI Copilot with full portfolio context. Ask me anything about the Nexus facilities, active alerts, tenant capacity, sustainability metrics, or operational risks." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', text: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.content || data.error || 'No response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden flex flex-col" style={{ height: '50vh' }}>
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-[#00338D] to-[#005EB8] flex-shrink-0">
        <Sparkles size={15} className="text-white" />
        <span className="text-sm font-bold text-white" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>K-Nexus AI Copilot — Full Portfolio Context</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
          <span className="text-xs text-white/70">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F0F2F5]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[#00338D] text-white rounded-br-sm'
                : 'bg-white border border-[#D8DCE3] text-[#1A1F36] rounded-bl-sm shadow-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#D8DCE3] rounded-xl rounded-bl-sm px-3 py-2.5 shadow-sm">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] block"
                    animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i*0.2 }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 bg-white border-t border-[#D8DCE3] flex gap-1.5 overflow-x-auto flex-shrink-0">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => sendMessage(s)} disabled={loading}
            className="flex-shrink-0 px-2.5 py-1 bg-[#F0F2F5] hover:bg-[#D8DCE3] border border-[#D8DCE3] rounded-full text-[10px] text-[#6B7280] hover:text-[#1A1F36] transition-colors disabled:opacity-40">
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-2 px-3 py-3 border-t border-[#D8DCE3] bg-white flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about incidents, capacity, sustainability, tenants..."
          className="flex-1 text-xs text-[#1A1F36] placeholder:text-[#9CA3AF] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50 transition-colors" />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          className="w-8 h-8 rounded-lg bg-[#00338D] hover:bg-[#002A73] text-white flex items-center justify-center disabled:opacity-40 transition-colors flex-shrink-0">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function AIInsightsPage() {
  const insights = useMemo(() => riskWatchlist(), []);
  return (
    <CCLayout title="AI Insights">
      {({ showToast }) => (
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-[#00338D]" />
            <h2 className="text-base font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>AI Operations Intelligence</h2>
            <span className="text-xs bg-[#00338D]/10 text-[#00338D] px-2 py-0.5 rounded-full font-bold">{insights.length} insights</span>
            <span className="text-[10px] text-[#9CA3AF] ml-auto">From the operating record as of {AS_OF}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {insights.map((insight, i) => (
              <motion.div key={insight.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <InsightCard insight={insight} showToast={showToast} />
              </motion.div>
            ))}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#005EB8]" />
              <h2 className="text-base font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Conversational AI — Ask Anything</h2>
            </div>
            <ChatInterface />
          </div>
        </div>
      )}
    </CCLayout>
  );
}
