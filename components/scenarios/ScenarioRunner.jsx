'use client';
import { useState } from 'react';
import { mockDatacenters } from '@/data/mock/index';
import { mockScenarioResults } from '@/data/mock/scenarios';
import { Play, RotateCcw, AlertTriangle, CheckCircle, Zap, Thermometer, Network, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const OUTCOME_CONFIG = {
  no_impact:     { label: 'No Impact', color: '#00B0A0', bg: '#F0FDF4', icon: CheckCircle },
  partial_outage: { label: 'Partial Outage', color: '#D97706', bg: '#FFFBEB', icon: AlertTriangle },
  degraded:      { label: 'Degraded Service', color: '#D97706', bg: '#FFFBEB', icon: AlertTriangle },
  major_outage:  { label: 'Major Outage', color: '#C8102E', bg: '#FEF2F2', icon: AlertTriangle },
  blocked:       { label: 'Deployment Blocked', color: '#7C3AED', bg: '#F5F3FF', icon: AlertTriangle },
};

const SEV_COLORS = {
  critical: { color: '#C8102E', bg: '#FEF2F2' },
  warning:  { color: '#D97706', bg: '#FFFBEB' },
  info:     { color: '#005EB8', bg: '#EFF6FF' },
};

function ResilienceGauge({ score }) {
  const color = score >= 80 ? '#00B0A0' : score >= 60 ? '#D97706' : '#C8102E';
  const dashTotal = 2 * Math.PI * 28;
  const dashFill = (score / 100) * dashTotal;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#D8DCE3" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${dashFill} ${dashTotal - dashFill}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-[#9CA3AF] font-medium">Resilience Score</span>
    </div>
  );
}

export default function ScenarioRunner({ scenarioType }) {
  const [config, setConfig] = useState({});
  const [selectedDcId, setSelectedDcId] = useState('mum-1');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [visibleEvents, setVisibleEvents] = useState([]);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    setVisibleEvents([]);

    // Simulate progressive timeline reveal
    await new Promise(r => setTimeout(r, 600));

    const scenarioResults = mockScenarioResults[scenarioType.id];
    const dcResult = scenarioResults?.[selectedDcId] || Object.values(scenarioResults || {})[0];

    if (!dcResult) {
      setResult({ error: true });
      setIsRunning(false);
      return;
    }

    setResult(dcResult);

    // Reveal timeline events progressively
    for (let i = 0; i < dcResult.timeline.length; i++) {
      await new Promise(r => setTimeout(r, 250 + i * 80));
      setVisibleEvents(prev => [...prev, dcResult.timeline[i]]);
    }

    setIsRunning(false);
  };

  const handleReset = () => {
    setResult(null);
    setVisibleEvents([]);
    setConfig({});
  };

  const outcomeConfig = result ? (OUTCOME_CONFIG[result.outcome] || OUTCOME_CONFIG.degraded) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Config panel */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[#D8DCE3] bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: scenarioType.color }} />
            <h3 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              {scenarioType.label}
            </h3>
          </div>
          {result && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#D8DCE3] text-[#6B7280] hover:bg-[#F8FAFC] transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          {/* DC selector */}
          <div>
            <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">Target Datacenter</label>
            <select
              value={selectedDcId}
              onChange={e => { setSelectedDcId(e.target.value); handleReset(); }}
              className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#1A1F36] focus:outline-none focus:border-[#005EB8] bg-white"
              disabled={isRunning}
            >
              {mockDatacenters.map(dc => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
          </div>

          {/* Scenario params */}
          {scenarioType.params.map(param => (
            <div key={param.id}>
              <label className="block text-[10px] font-bold text-[#374151] uppercase tracking-wide mb-1">{param.label}</label>
              <select
                value={config[param.id] || param.options[0]}
                onChange={e => setConfig(c => ({ ...c, [param.id]: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-[#D8DCE3] text-xs text-[#1A1F36] focus:outline-none focus:border-[#005EB8] bg-white"
                disabled={isRunning}
              >
                {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: isRunning ? '#9CA3AF' : scenarioType.color }}
          >
            {isRunning ? (
              <><span className="animate-spin">⟳</span> Simulating...</>
            ) : (
              <><Play size={13} /> Run Simulation</>
            )}
          </button>
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto p-6">
        {!result && !isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: scenarioType.color + '15' }}>
              <Play size={24} style={{ color: scenarioType.color }} />
            </div>
            <p className="text-sm font-semibold text-[#374151]">Ready to simulate</p>
            <p className="text-xs text-[#9CA3AF] mt-1 max-w-xs">Configure the parameters above and click Run Simulation to see the impact timeline.</p>
          </div>
        )}

        {isRunning && visibleEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-3" style={{ borderColor: scenarioType.color, borderTopColor: 'transparent' }} />
            <p className="text-xs text-[#9CA3AF]">Running simulation...</p>
          </div>
        )}

        {result && !result.error && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Outcome summary */}
              <div className="flex items-center gap-6 p-5 rounded-2xl border" style={{ backgroundColor: outcomeConfig.bg, borderColor: outcomeConfig.color + '30' }}>
                <ResilienceGauge score={result.resilienceScore} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: outcomeConfig.color + '20', color: outcomeConfig.color }}>
                      {outcomeConfig.label}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF]">Redundancy: {result.redundancyLevel}</span>
                  </div>
                  {result.affectedRacks.length > 0 && (
                    <p className="text-xs text-[#374151] mt-1">
                      <strong>{result.affectedRacks.length}</strong> rack{result.affectedRacks.length > 1 ? 's' : ''} affected: {result.affectedRacks.slice(0, 4).join(', ')}{result.affectedRacks.length > 4 ? ` +${result.affectedRacks.length - 4} more` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={13} className="text-[#9CA3AF]" />
                  <h4 className="text-xs font-bold text-[#1A1F36] uppercase tracking-wide">Event Timeline</h4>
                </div>
                <div className="space-y-2">
                  {visibleEvents.map((event, i) => {
                    const sc = SEV_COLORS[event.severity] || SEV_COLORS.info;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-3"
                      >
                        <div className="flex-shrink-0 w-12 text-right">
                          <span className="text-[10px] font-mono font-bold" style={{ color: sc.color }}>T+{event.t}s</span>
                        </div>
                        <div className="w-2 flex-shrink-0 flex flex-col items-center mt-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                          {i < visibleEvents.length - 1 && <div className="w-px flex-1 mt-1" style={{ backgroundColor: sc.color + '30', minHeight: 12 }} />}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-xs text-[#374151] leading-relaxed">{event.event}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Cascade effects */}
              {result.cascadeEffects?.length > 0 && (
                <div className="bg-[#FFFBEB] border border-[#D97706]/20 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-[#D97706] mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Cascade Effects
                  </h4>
                  <ul className="space-y-1.5">
                    {result.cascadeEffects.map((effect, i) => (
                      <li key={i} className="text-xs text-[#92400E] flex gap-2">
                        <span className="flex-shrink-0">•</span>
                        {effect}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mitigations */}
              {result.mitigations?.length > 0 && (
                <div className="bg-[#EFF6FF] border border-[#005EB8]/20 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-[#005EB8] mb-2 flex items-center gap-1.5">
                    <CheckCircle size={12} />
                    AI-Recommended Mitigations
                  </h4>
                  <ul className="space-y-2">
                    {result.mitigations.map((m, i) => (
                      <li key={i} className="flex gap-2 items-start text-xs text-[#1e3a5f]">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#005EB8] text-white text-[9px] flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {result?.error && (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-sm text-[#9CA3AF]">No simulation data available for this datacenter + scenario combination.</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Try a different datacenter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
