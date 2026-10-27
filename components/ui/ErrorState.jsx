'use client';
import { motion } from 'framer-motion';
import { AlertTriangle, WifiOff, ShieldOff, RefreshCw } from 'lucide-react';

const PRESETS = {
  network:     { icon: WifiOff,       title: 'Network Error',         body: 'Unable to reach the platform services. Check your connection.' },
  import:      { icon: AlertTriangle, title: 'Import Failed',          body: 'The dataset could not be validated. Review the error log below.' },
  validation:  { icon: AlertTriangle, title: 'Validation Failed',      body: 'One or more required fields are missing or invalid.' },
  unavailable: { icon: WifiOff,       title: 'Service Unavailable',    body: 'The backend service is temporarily unavailable. Please try again.' },
  permission:  { icon: ShieldOff,     title: 'Permission Denied',      body: 'You do not have access to this resource. Contact your administrator.' },
};

export default function ErrorState({ preset, icon:CustomIcon, title, body, errors = [], onRetry, className = '' }) {
  const cfg   = preset ? PRESETS[preset] : null;
  const Icon  = CustomIcon ?? cfg?.icon ?? AlertTriangle;
  const label = title ?? cfg?.title ?? 'An error occurred';
  const desc  = body  ?? cfg?.body  ?? '';

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
      className={`flex flex-col items-center justify-center py-12 gap-3 text-center px-8 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-[#C8102E]/10 border border-[#C8102E]/25 flex items-center justify-center">
        <Icon size={24} className="text-[#C8102E]"/>
      </div>
      <p className="text-sm font-bold text-white/70" style={{ fontFamily:"'Inter', 'Segoe UI', sans-serif" }}>{label}</p>
      {desc && <p className="text-[11px] text-white/35 max-w-xs leading-relaxed">{desc}</p>}
      {errors.length > 0 && (
        <div className="mt-2 w-full max-w-sm bg-[#C8102E]/8 border border-[#C8102E]/20 rounded-xl p-3 text-left">
          {errors.slice(0,5).map((e,i) => <p key={i} className="text-[9px] text-white/50 leading-relaxed">{e}</p>)}
          {errors.length > 5 && <p className="text-[9px] text-white/30 mt-1">+{errors.length-5} more errors</p>}
        </div>
      )}
      {onRetry && (
        <button onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.07] border border-white/[0.12] hover:bg-white/[0.12] text-[10px] font-bold text-white/60 hover:text-white transition-colors mt-1">
          <RefreshCw size={12}/> Retry
        </button>
      )}
    </motion.div>
  );
}
