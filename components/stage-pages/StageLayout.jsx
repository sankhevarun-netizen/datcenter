'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Sparkles, BarChart3, X } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { AIThinkingLoader } from '@/components/shared/LoadingDots';
import AIChatPanel from '@/components/ai-chat/AIChatPanel';
import useAppStore from '@/store/appStore';
import { writeToWiki } from '@/lib/wiki';
import { researchClient } from '@/lib/research';

const ALL_STAGES = [
  { num: '01', label: 'Strategy',     path: '/stage/01' },
  { num: '02', label: 'Sourcing',     path: '/stage/02' },
  { num: '03', label: 'Design',       path: '/stage/03' },
  { num: '04', label: 'Compliance',   path: '/stage/04' },
  { num: '05', label: 'Operations',   path: '/stage/05' },
  { num: '06', label: 'Monetization', path: '/stage/06' },
];



function StageProgress({ current }) {
  return (
    <div className="flex items-center gap-0">
      {ALL_STAGES.map((s, i) => {
        const isCurrent = s.num === current;
        const isPast = parseInt(s.num) < parseInt(current);
        return (
          <div key={s.num} className="flex items-center">
            <Link href={s.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isCurrent ? 'bg-[#00338D] text-white'
                : isPast ? 'bg-[#00B0A0]/10 text-[#00B0A0] hover:bg-[#00B0A0]/15'
                : 'bg-[#F0F2F5] text-[#9CA3AF] hover:bg-[#D8DCE3] hover:text-[#6B7280]'
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                isCurrent ? 'bg-white/20' : isPast ? 'bg-[#00B0A0]/20 text-[#00B0A0]' : 'bg-[#D8DCE3]'
              }`}>{isPast ? '✓' : s.num}</span>
              <span className="hidden sm:block">{s.label}</span>
            </Link>
            {i < ALL_STAGES.length - 1 && <ChevronRight size={14} className="text-[#CBD5E1] mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#1A1F36]">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function MarkdownOutput({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let bulletBuffer = [];

  const flushBullets = (key) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${key}`} className="space-y-1.5 mb-3 ml-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="text-[#005EB8] flex-shrink-0 mt-1.5 text-xs">•</span>
            <span className="text-sm text-[#374151] leading-relaxed">{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flushBullets(i); return; }

    if (t.startsWith('# ')) {
      flushBullets(i);
      elements.push(<h2 key={i} className="text-base font-extrabold text-[#00338D] mt-5 mb-2 pb-1.5 border-b border-[#D8DCE3]">{t.slice(2)}</h2>);
    } else if (t.startsWith('## ')) {
      flushBullets(i);
      elements.push(<h3 key={i} className="text-base font-bold text-[#00338D] mt-5 mb-2 pb-1.5 border-b border-[#D8DCE3]">{t.slice(3)}</h3>);
    } else if (t.startsWith('### ')) {
      flushBullets(i);
      elements.push(<h4 key={i} className="text-sm font-bold text-[#1A1F36] mt-4 mb-1.5">{t.slice(4)}</h4>);
    } else if (t.startsWith('---')) {
      flushBullets(i);
      elements.push(<hr key={i} className="border-[#D8DCE3] my-3" />);
    } else if (/^[-*•]\s+/.test(t)) {
      bulletBuffer.push(t.replace(/^[-*•]\s+/, ''));
    } else if (/^\d+\.\s+/.test(t)) {
      flushBullets(i);
      const num = t.match(/^(\d+)\./)[1];
      const content = t.replace(/^\d+\.\s+/, '');
      elements.push(
        <div key={i} className="flex gap-2.5 items-start mb-1.5">
          <span className="w-5 h-5 rounded-full bg-[#00338D]/10 text-[#00338D] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{num}</span>
          <span className="text-sm text-[#374151] leading-relaxed">{renderInline(content)}</span>
        </div>
      );
    } else {
      flushBullets(i);
      elements.push(<p key={i} className="text-sm text-[#374151] leading-relaxed mb-2">{renderInline(t)}</p>);
    }
  });
  flushBullets('end');
  return <div className="space-y-0.5">{elements}</div>;
}

// ── Context chip: read-only locked field ─────────────────────────────────
function ContextChip({ label, value }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#00338D]/6 border border-[#00338D]/15 rounded-lg text-xs">
      <span className="text-[#6B7280] font-medium">{label}:</span>
      <span className="text-[#1A1F36] font-semibold truncate max-w-[140px]">{value}</span>
    </div>
  );
}

// ── Session context strip (shown on stages 2–6) — read-only ──────────────
function SessionContextStrip({ sessionContext }) {
  if (!sessionContext) return null;

  const locationLabel = sessionContext.state
    ? `${sessionContext.state}, ${sessionContext.region}`
    : sessionContext.region;

  const chips = [
    locationLabel                    && { label: 'Location', value: locationLabel },
    sessionContext.budget            && { label: 'Budget', value: sessionContext.budget },
    sessionContext.capacity          && { label: 'Capacity', value: `${sessionContext.capacity} MW` },
    sessionContext.timeline          && { label: 'Timeline', value: sessionContext.timeline },
    sessionContext.workloads?.length && {
      label: 'Workloads',
      value: sessionContext.workloads.slice(0, 2).join(', ') +
        (sessionContext.workloads.length > 2 ? ` +${sessionContext.workloads.length - 2}` : ''),
    },
  ].filter(Boolean);

  return (
    <div className="bg-[#F0F4FF] border border-[#00338D]/12 rounded-xl px-4 py-2.5 flex items-center gap-2 flex-wrap mb-5">
      <span className="text-[10px] font-bold text-[#00338D] uppercase tracking-wider mr-1 flex-shrink-0">
        Session Context
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.map((chip, i) => (
          <ContextChip key={i} label={chip.label} value={chip.value} />
        ))}
      </div>
    </div>
  );
}

// ── Main StageLayout ──────────────────────────────────────────────────────
export default function StageLayout({
  stageNum, stageName, stageDescription, stageIcon: StageIcon,
  color = '#00338D', formFields, generateInsights, systemContext, topContent,
}) {
  const router = useRouter();
  const { stageOutputs, setStageOutput, markStageComplete, sessionContext, setSessionContext } = useAppStore();
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState(stageOutputs[stageNum] || '');
  const [error, setError] = useState(null);

  const isFirstStage = stageNum === '01';
  const updateField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    const handler = (e) => {
      const { sessionContext } = useAppStore.getState();
      if (sessionContext) {
        e.preventDefault();
        e.returnValue = 'Your session context will be lost if you refresh. Are you sure?';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch research with a 5s timeout — if it takes longer, continue without it
      const researchPromise = researchClient({
        clientName: sessionContext?.client || null,
        brief: JSON.stringify(formData),
        sector: sessionContext?.sector || null,
        eventType: 'stage',
      });
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 5000));
      const stageResearch = await Promise.race([researchPromise, timeoutPromise]);

      const result = await generateInsights(formData, sessionContext, stageOutputs, stageResearch);
      setOutput(result);
      setStageOutput(stageNum, result);
      markStageComplete(stageNum);

      // ── Wiki: fire-and-forget knowledge extraction ──────────────────────
      writeToWiki('stage-completion', result, {
        stage: stageNum,
        stageLabel: stageName,
        region: sessionContext?.region || formData.region || null,
        capacity: sessionContext?.capacity || formData.capacity || null,
        workloads: sessionContext?.workloads || formData.workloads || null,
      });
      // ───────────────────────────────────────────────────────────────────

      // Stage 01 locks in the session context for all subsequent stages
      if (isFirstStage) {
        setSessionContext({
          region:         formData.region        || null,
          state:          formData.state         || null,
          workloads:      formData.workloads      || [],
          capacity:       formData.capacity       || null,
          budget:         formData.budget         || null,
          timeline:       formData.timeline       || null,
          sustainability: formData.sustainability || null,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chatContext = output
    ? `Stage: ${stageName}\n\nUser Inputs:\n${Object.entries(formData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}\n\nAI Analysis:\n${output}`
    : `Stage: ${stageName}\n\nUser is working on datacenter ${stageName}.`;

  return (
    <div className="min-h-screen bg-[#F0F2F5] pt-16">
      {/* Header */}
      <div className="border-b border-[#D8DCE3] bg-white">
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1A1F36] transition-colors">
              <ArrowLeft size={16} />Back to Lifecycle
            </Link>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
                {StageIcon && <StageIcon size={24} style={{ color }} />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: color + '12', color }}>STAGE {stageNum}</span>
                  {!isFirstStage && sessionContext && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-[#00338D]/8 text-[#00338D] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00B0A0] inline-block" />
                      Context active
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-extrabold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{stageName}</h1>
              </div>
            </div>
            <StageProgress current={stageNum} />
          </div>
          {stageDescription && <p className="text-[#6B7280] text-sm mt-3 max-w-2xl leading-relaxed">{stageDescription}</p>}
        </div>
      </div>

      {topContent && (
        <div className="max-w-screen-xl mx-auto px-6 pt-6 pb-0">
          {topContent}
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#D8DCE3] flex items-center">
                <h2 className="text-[#1A1F36] font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Analysis Parameters</h2>
              </div>
              <div className="p-6 space-y-5">
                {!isFirstStage && (
                  <SessionContextStrip sessionContext={sessionContext} />
                )}
                {formFields({ formData, updateField })}
                <div className="pt-2">
                  <Button onClick={handleGenerate} disabled={loading} variant="primary" size="lg" className="w-full justify-center">
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                      : <><Sparkles size={16} />Generate Insights</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden flex-1">
              <div className="px-6 py-4 border-b border-[#D8DCE3] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                  <Sparkles size={14} style={{ color }} />
                </div>
                <h2 className="text-[#1A1F36] font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>AI-Generated Analysis</h2>
                {output && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#00B0A0]/10 text-[#00B0A0] font-semibold">Ready</span>
                    <button
                      onClick={() => router.push('/stage/analysis')}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[#00338D] text-white rounded-lg text-xs font-bold hover:bg-[#002A73] transition-colors shadow-sm"
                    >
                      <BarChart3 size={12} />Deep Dive
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 overflow-y-auto min-h-[300px] max-h-[560px]">
                {loading && <AIThinkingLoader />}
                {error && !loading && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                    <p className="font-semibold mb-1">Error generating analysis</p>
                    <p className="text-red-500 text-xs">{error}</p>
                  </div>
                )}
                {!loading && !output && !error && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: color + '10' }}>
                      <Sparkles size={28} style={{ color }} />
                    </div>
                    <h3 className="text-[#1A1F36] font-bold text-sm mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                      {!isFirstStage && !sessionContext
                        ? 'Complete Stage 01 first to activate context'
                        : 'Ready to generate insights'}
                    </h3>
                    <p className="text-[#9CA3AF] text-sm">
                      {!isFirstStage && !sessionContext
                        ? 'Stage 01 context feeds all subsequent agents.'
                        : 'Fill in the parameters and click Generate Insights.'}
                    </p>
                    {!isFirstStage && !sessionContext && (
                      <Link href="/stage/01" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#00338D] text-white text-xs font-bold rounded-lg hover:bg-[#002A73] transition-colors">
                        Go to Stage 01 <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                )}
                {!loading && output && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <MarkdownOutput text={output} />
                  </motion.div>
                )}
              </div>
            </div>

            <AIChatPanel context={chatContext} systemContext={systemContext} title={`${stageName} AI Advisor`} className="flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}