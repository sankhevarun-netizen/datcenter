'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X, HelpCircle, Activity, ArrowRight } from 'lucide-react';
import { MODULE_LABELS } from '@/data/decisionModules';

// Splits a "- bullet\n- bullet" style string (same convention used by
// LandingChatPanel's renderBotText) into individual bullet lines. Falls
// back to treating the whole string as one bullet if there's no "- " prefix.
function toBullets(text) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(l => /^[-•]\s+/.test(l));
  if (bulletLines.length) return bulletLines.map(l => l.replace(/^[-•]\s+/, ''));
  return [text];
}

function Section({ icon: Icon, label, text }) {
  const bullets = toBullets(text);
  if (!bullets.length) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={11} className="text-accent" />
        <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      </div>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-1.5 text-[11.5px] text-text-primary leading-snug">
            <span className="text-accent flex-shrink-0">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ExplanationPanel({ moduleKey, reasoning, onClose }) {
  return (
    <AnimatePresence>
      {moduleKey && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(26,31,54,0.45)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-5 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-extrabold text-text-primary text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {MODULE_LABELS[moduleKey] || moduleKey}
              </p>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-grey-bg flex items-center justify-center text-text-secondary">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              <Section icon={HelpCircle} label="Why this matters" text={reasoning?.why_it_matters} />
              <Section icon={Activity} label="Why this score / value" text={reasoning?.why_this_value} />
              <Section icon={ArrowRight} label="Decision impact" text={reasoning?.decision_impact} />
            </div>

            <p className="text-[9.5px] text-text-muted italic mt-5 pt-3 border-t border-grey-border">
              Based on KPMG Data Center Advisory Framework
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
