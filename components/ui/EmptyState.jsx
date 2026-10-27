'use client';
import { motion } from 'framer-motion';
import { Search, Server, FileText, AlertTriangle, Package, Activity } from 'lucide-react';

const PRESETS = {
  'no-data':       { icon: Server,         title: 'No data available',      body: 'Load a dataset via the Integration Hub to get started.' },
  'no-results':    { icon: Search,         title: 'No results found',       body: 'Try adjusting your search terms or filters.' },
  'no-incidents':  { icon: Activity,       title: 'No active incidents',    body: 'All systems are operating normally.' },
  'no-reports':    { icon: FileText,       title: 'No reports generated',   body: 'Use the Report Builder to generate your first report.' },
  'no-assets':     { icon: Package,        title: 'No assets found',        body: 'Expand your filters or load additional asset data.' },
  'no-facilities': { icon: Server,         title: 'No facilities match',    body: 'Try clearing your region or health filters.' },
};

/**
 * Consistent empty state for every EAI module.
 * Preset shortcuts: 'no-data' | 'no-results' | 'no-incidents' | 'no-reports' | 'no-assets' | 'no-facilities'
 */
export default function EmptyState({ preset, icon: CustomIcon, title, body, action, className = '' }) {
  const cfg   = preset ? PRESETS[preset] : null;
  const Icon  = CustomIcon ?? cfg?.icon ?? Search;
  const label = title ?? cfg?.title ?? 'Nothing here';
  const desc  = body  ?? cfg?.body  ?? '';

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.3 }}
      className={`flex flex-col items-center justify-center py-16 gap-3 text-center px-8 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
        <Icon size={24} className="text-white/25"/>
      </div>
      <p className="text-sm font-bold text-white/45" style={{ fontFamily:"'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
      {desc && <p className="text-[11px] text-white/25 max-w-xs leading-relaxed">{desc}</p>}
      {action && (
        <button onClick={action.onClick}
          className="mt-2 px-4 py-2 rounded-xl bg-[#005EB8]/20 border border-[#005EB8]/30 hover:bg-[#005EB8]/30 text-[10px] font-bold text-[#005EB8] transition-colors">
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
