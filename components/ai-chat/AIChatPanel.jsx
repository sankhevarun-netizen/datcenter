'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Minimize2, Maximize2 } from 'lucide-react';
import { callClaude } from '@/lib/claude-api';
import { parseMarkdown } from '@/utils/helpers';
import { LoadingDots } from '@/components/shared/LoadingDots';

export default function AIChatPanel({ context = '', systemContext = '', title = 'AI Assistant', className = '', defaultExpanded = false, quickPrompts = null, suggestionChips = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(!defaultExpanded);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const conversationHistory = messages
        .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
        .join('\n\n');

      const prompt = `${context ? `Context:\n${context}\n\n` : ''}${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}User: ${userMsg}

Please respond as the KPMG Datacenter Intelligence Engine. Be specific, data-driven, and concise (3-5 paragraphs max for chat responses).`;

      // RAG: derive a search query from the user's message for live grounding
      const ragQuery = `datacenter ${userMsg.slice(0, 80)}`;

      const response = await callClaude({
        prompt,
        systemOverride: systemContext || undefined,
        maxTokens: 1024,
        ragQuery,
      });

      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `I encountered an issue: ${err.message}`,
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const SUGGESTIONS = quickPrompts ?? [
    'What are the key risks to consider?',
    'How does this compare to industry benchmarks?',
    'What should be the priority next steps?',
  ];

  return (
    <div className={`flex flex-col border border-[#D8DCE3] rounded-2xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#00338D] to-[#005EB8] cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{title}</div>
            <div className="text-white/60 text-xs">KPMG Datacenter Intelligence Engine</div>
          </div>
        </div>
        <button className="text-white/70 hover:text-white transition-colors p-1">
          {minimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
        </button>
      </div>

      <AnimatePresence>
        {!minimized && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="flex flex-col flex-1 overflow-hidden"
            style={{ maxHeight: 420 }}
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[180px]">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-full bg-[#00338D]/8 flex items-center justify-center mx-auto mb-3">
                    <Bot size={20} className="text-[#00338D]" />
                  </div>
                  <p className="text-sm text-[#6B7280] mb-4">
                    Ask me anything about this stage — responses are grounded with live market intelligence.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-xs px-3 py-1.5 bg-[#F0F2F5] hover:bg-[#D8DCE3] text-[#1A1F36] rounded-full border border-[#D8DCE3] transition-colors font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-[#00338D] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={12} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-[#00338D] text-white rounded-br-sm'
                      : msg.isError
                      ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                      : 'bg-[#F0F2F5] text-[#1A1F36] rounded-bl-sm'
                  }`}>
                    {msg.role === 'ai'
                      ? <div className="ai-output text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                      : <p className="leading-relaxed text-xs">{msg.content}</p>
                    }
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-[#6B7280]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={12} className="text-[#6B7280]" />
                    </div>
                  )}
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#00338D] flex items-center justify-center flex-shrink-0">
                    <Bot size={12} className="text-white" />
                  </div>
                  <div className="bg-[#F0F2F5] rounded-2xl rounded-bl-sm px-4 py-3">
                    <LoadingDots />
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[#D8DCE3] p-3">
              <div className="flex items-end gap-2 bg-[#F0F2F5] rounded-xl border border-[#D8DCE3] focus-within:border-[#005EB8]/50 focus-within:bg-white transition-all px-3 py-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-[#1A1F36] placeholder:text-[#9CA3AF] resize-none focus:outline-none leading-5 py-0.5"
                  style={{ maxHeight: 80, minHeight: 20 }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-7 h-7 rounded-lg bg-[#00338D] text-white flex items-center justify-center hover:bg-[#002A73] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
              {suggestionChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                  {suggestionChips.map((chip, i) => (
                    <button key={i} onClick={() => sendMessage(chip)}
                      className="text-xs px-2.5 py-1 bg-[#00338D]/10 hover:bg-[#00338D]/20 text-[#005EB8] rounded-full border border-[#005EB8]/25 transition-colors">
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
