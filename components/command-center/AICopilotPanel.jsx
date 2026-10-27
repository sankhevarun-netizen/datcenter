'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const SUGGESTIONS = [
  "What's the risk posture for Nexus Mumbai-1?",
  "Which tenants carry the most SLA exposure?",
  "Summarize today's open alerts",
  "Top 3 actions I should take today",
];

export default function AICopilotPanel({ forceOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen ?? localOpen;
  const setOpen = (v) => { setLocalOpen(v); onOpenChange?.(v); };
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "I'm your K-Nexus AI Copilot. Ask me about incidents, capacity, sustainability, tenant risks, or any operational question across the Nexus portfolio." },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const nextMessages = [...messages, { role: 'user', text: msg }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.content || data.error || 'Unable to get response.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#00338D] shadow-lg shadow-[#00338D]/40 flex items-center justify-center text-white"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{ display: open ? 'none' : 'flex' }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-[#005EB8]/40"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        <Sparkles size={20} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-6 right-6 z-50 w-96 bg-white rounded-2xl border border-[#D8DCE3] shadow-2xl overflow-hidden flex flex-col"
            style={{ height: '60vh', minHeight: '400px' }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[#00338D] text-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={16} />
                <span className="font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>K-Nexus AI Copilot</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/ai-insights" onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors p-1" title="Open full chat">
                  <ExternalLink size={14} />
                </Link>
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F0F2F5]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
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
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] block"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {messages.length > 3 && (
                <div className="text-center">
                  <Link href="/ai-insights" onClick={() => setOpen(false)} className="text-[10px] text-[#005EB8] hover:underline font-medium">
                    Open full chat →
                  </Link>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 py-2 bg-white border-t border-[#D8DCE3] flex gap-1.5 overflow-x-auto flex-shrink-0">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                  className="flex-shrink-0 px-2.5 py-1 bg-[#F0F2F5] hover:bg-[#D8DCE3] border border-[#D8DCE3] rounded-full text-[10px] text-[#6B7280] hover:text-[#1A1F36] transition-colors disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-[#D8DCE3] bg-white flex-shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about your infrastructure..."
                className="flex-1 text-xs text-[#1A1F36] placeholder:text-[#9CA3AF] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50 transition-colors"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg bg-[#00338D] hover:bg-[#002A73] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
