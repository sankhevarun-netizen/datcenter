'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Cpu, Lightbulb, Info } from 'lucide-react';
import { DECISION_QUICK_STARTS, CARD_TYPE_MAPPING, ACCENT_BY_MODULE, MODULE_LABELS, shapeForCardType } from '@/data/decisionModules';
import { CHIP_PROFILES, COOLING_PROFILES } from '@/data/gpuChipProfiles';

import HeroCard from '@/components/decision-cockpit/cards/HeroCard';
import RankingCard from '@/components/decision-cockpit/cards/RankingCard';
import MetricCard from '@/components/decision-cockpit/cards/MetricCard';
import ScoreCard from '@/components/decision-cockpit/cards/ScoreCard';
import InsightCard from '@/components/decision-cockpit/cards/InsightCard';
import PlannerCard from '@/components/decision-cockpit/cards/PlannerCard';
import EvaluationSummaryCard from '@/components/decision-cockpit/cards/EvaluationSummaryCard';
import TradeoffTile from '@/components/decision-cockpit/cards/TradeoffTile';
import InsightStrip from '@/components/decision-cockpit/cards/InsightStrip';
import ExplanationPanel from '@/components/decision-cockpit/cards/ExplanationPanel';

const CARD_COMPONENTS = {
  ranking: RankingCard,
  metric: MetricCard,
  score: ScoreCard,
  insight: InsightCard,
  planner: PlannerCard,
};

// Compact param control bar for the ai_gpu_campus decision type only — the
// other four decision types arrive fully pre-configured via the URL and have
// no input UI. Here, changing chip generation/cooling live is the whole
// point, so params must be editable. Every change rewrites the URL
// searchParams (router.replace) rather than adding a parallel state path —
// the URL stays the single source of truth the rest of the cockpit reacts to.
function GpuCampusControlBar({ searchParams, mode }) {
  const router = useRouter();
  const [capacityDraft, setCapacityDraft] = useState(searchParams.get('capacity') || '');
  const [clientDraft, setClientDraft] = useState(searchParams.get('client_name') || '');
  const [locationDraft, setLocationDraft] = useState(searchParams.get('location') || '');

  useEffect(() => { setCapacityDraft(searchParams.get('capacity') || ''); }, [searchParams]);
  useEffect(() => { setClientDraft(searchParams.get('client_name') || ''); }, [searchParams]);
  useEffect(() => { setLocationDraft(searchParams.get('location') || ''); }, [searchParams]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`/decision-cockpit?${next.toString()}`, { scroll: false });
  };

  const selectClass = 'px-2 py-1 rounded-lg border border-grey-border bg-white text-[10.5px] font-semibold text-text-primary outline-none focus:border-accent/50';
  const inputClass = 'w-24 px-2 py-1 rounded-lg border border-grey-border bg-white text-[10.5px] font-semibold text-text-primary outline-none focus:border-accent/50';

  return (
    <div className="flex-shrink-0 bg-grey-bg/60 border-b border-grey-border px-5 py-2 flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-1.5">
        <span className="text-[9px] text-text-muted uppercase tracking-wide font-bold">Chip</span>
        <select
          className={selectClass}
          value={searchParams.get('chip_generation') || ''}
          onChange={e => updateParam('chip_generation', e.target.value)}
        >
          <option value="">Select…</option>
          {CHIP_PROFILES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-[9px] text-text-muted uppercase tracking-wide font-bold">Cooling</span>
        <select
          className={selectClass}
          value={searchParams.get('cooling_approach') || ''}
          onChange={e => updateParam('cooling_approach', e.target.value)}
        >
          <option value="">Select…</option>
          {COOLING_PROFILES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-[9px] text-text-muted uppercase tracking-wide font-bold">Capacity</span>
        <input
          type="number"
          min="1"
          className={inputClass}
          value={capacityDraft}
          onChange={e => setCapacityDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => updateParam('capacity', capacityDraft)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="MW"
        />
      </label>

      {mode === 'client_specific' && (
        <>
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-muted uppercase tracking-wide font-bold">Client</span>
            <input
              className={inputClass}
              value={clientDraft}
              onChange={e => setClientDraft(e.target.value)}
              onBlur={() => updateParam('client_name', clientDraft)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              placeholder="Client name"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-muted uppercase tracking-wide font-bold">Location</span>
            <input
              className={inputClass}
              value={locationDraft}
              onChange={e => setLocationDraft(e.target.value)}
              onBlur={() => updateParam('location', locationDraft)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              placeholder="Location"
            />
          </label>
        </>
      )}
    </div>
  );
}

export default function DecisionCockpitClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [explainKey, setExplainKey] = useState(null);

  const decisionType = searchParams.get('decision_type');
  const mode = searchParams.get('mode') || 'exploratory';
  const clientName = searchParams.get('client_name') || '';
  const location = searchParams.get('location') || '';
  const capacity = searchParams.get('capacity') || '';
  const chipGeneration = searchParams.get('chip_generation') || '';
  const coolingApproach = searchParams.get('cooling_approach') || '';

  useEffect(() => {
    if (!decisionType) { setError('No decision_type specified.'); return; }
    let cancelled = false;
    setResult(null);
    setError(null);
    fetch('/api/decision-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_type: decisionType, mode, client_name: clientName, location, capacity,
        chip_generation: chipGeneration, cooling_approach: coolingApproach,
      }),
    })
      .then(res => res.json())
      .then(data => { if (!cancelled) { if (data.error) setError(data.error); else setResult(data); } })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [decisionType, mode, clientName, location, capacity, chipGeneration, coolingApproach]);

  const quickStart = DECISION_QUICK_STARTS.find(qs => qs.decision_type === decisionType);
  const heroKey = 'final_recommendation';
  const supportingKeys = result?.priority_order?.filter(k => k !== heroKey) ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="flex-shrink-0 bg-white border-b border-grey-border px-5 py-3 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg border border-grey-border flex items-center justify-center hover:bg-grey-bg transition-colors flex-shrink-0"
          >
            <X size={14} className="text-text-secondary" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Cpu size={14} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-text-primary text-sm leading-tight truncate" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {quickStart?.title || 'Decision Cockpit'}
              </p>
              <p className="text-[9px] text-text-muted leading-tight">
                {mode === 'client_specific' ? `Client: ${clientName || '—'} · ${location || '—'}` : `Exploratory · ${location || '—'}`}
                {capacity ? ` · ${capacity}MW` : ''}
              </p>
            </div>
          </div>
        </div>
        {result && (
          <div className="px-2.5 py-1.5 bg-grey-bg border border-grey-border rounded-lg flex-shrink-0">
            <span className="text-[9px] text-text-secondary font-medium">{result.selected_modules.length} modules selected</span>
          </div>
        )}
      </motion.div>

      {decisionType === 'ai_gpu_campus' && (
        <GpuCampusControlBar searchParams={searchParams} mode={mode} />
      )}

      {decisionType === 'ai_gpu_campus' && result && (!chipGeneration || !coolingApproach) && (
        <div className="flex-shrink-0 bg-amber/10 border-b border-amber/20 px-5 py-1.5 flex items-center gap-1.5">
          <Info size={11} className="text-amber flex-shrink-0" />
          <p className="text-[10px] text-text-secondary">
            Showing the default chip + cooling combination (NVIDIA H100 SXM + Air containment) — nothing was selected above. Choose a chip and cooling approach to model this client's actual scenario.
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-danger font-medium">{error}</p>
          </div>
        )}
        {!error && !result && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-xs text-text-muted">Running decision engine…</p>
            </div>
          </div>
        )}
        {result && (
          <>
            <div className="grid grid-cols-4 gap-3 flex-shrink-0">
              <HeroCard
                data={result.modules[heroKey]}
                reason={result.reasoning[heroKey]?.summary}
                moduleCount={result.selected_modules.length}
                dataSourcesAnalyzed={result.data_sources_analyzed}
                onDoubleClick={() => setExplainKey(heroKey)}
              />
            </div>
            <div
              className="grid gap-3 flex-shrink-0"
              style={{ gridTemplateColumns: `repeat(${Math.max(supportingKeys.length, 1)}, minmax(0, 1fr))` }}
            >
              {supportingKeys.map(key => {
                const cardType = CARD_TYPE_MAPPING[key] || 'insight';
                const Comp = CARD_COMPONENTS[cardType];
                const shaped = shapeForCardType(key, result.modules[key]);
                if (!Comp || !shaped) return null;
                return (
                  <Comp
                    key={key}
                    title={MODULE_LABELS[key] || key}
                    shaped={shaped}
                    accent={ACCENT_BY_MODULE[key]}
                    reason={result.reasoning[key]?.summary}
                    onDoubleClick={() => setExplainKey(key)}
                  />
                );
              })}
            </div>
            <div className="grid gap-3 flex-shrink-0" style={{ gridTemplateColumns: 'minmax(280px, 1fr) 2fr' }}>
              <EvaluationSummaryCard evaluationSummary={result.evaluation_summary} />
              <div className="bg-white rounded-2xl border border-grey-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={13} className="text-amber" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Key Insights & Trade-offs</p>
                </div>
                <div className="grid grid-cols-3 gap-3 h-full">
                  {(result.tradeoffs || []).map((t, i) => (
                    <TradeoffTile key={i} tone={t.tone} title={t.title} body={t.body} />
                  ))}
                </div>
              </div>
            </div>
            <InsightStrip insights={result.insights} />
          </>
        )}
      </div>

      <ExplanationPanel
        moduleKey={explainKey}
        reasoning={explainKey ? result?.reasoning[explainKey] : null}
        onClose={() => setExplainKey(null)}
      />
    </div>
  );
}
