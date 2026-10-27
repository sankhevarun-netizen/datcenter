// Design tokens for presentation cockpits (KPMG navy and blue on white).
import { BarChart3, TrendingUp, Zap, Leaf, Target, Star } from 'lucide-react';

export const C = {
  pageBg: '#F4F7FB',
  shell: '#0C2847',
  shellDeep: '#081F3A',
  panel: '#FFFFFF',
  navy: '#0F2D52',
  navyBlue: '#1E3A8A',
  blue: '#2563EB',
  accent: '#3B82F6',
  light: '#7DB4F0',
  pale: '#C7DCF5',
  tint: '#EFF5FD',
  green: '#10B981',
  greenDeep: '#059669',
  greenTint: '#ECFDF5',
  violet: '#7C6CF0',
  text: '#0F2D52',
  text2: '#5B7290',
  muted: '#8FA8C8',
  onDark: '#FFFFFF',
  onDarkDim: '#A8C4E0',
  border: '#E2E9F2',
};

export const ICONS = { bars: BarChart3, trend: TrendingUp, zap: Zap, leaf: Leaf, target: Target, star: Star };

export const TINTS = {
  blue: { bg: '#E3EDFC', fg: C.blue, card: C.tint },
  green: { bg: '#D9F5EA', fg: C.greenDeep, card: C.greenTint },
};

export const FONT = "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

// Entrance timing: KPI strip, then row 1, then row 2.
export const ENTER = { kpiStart: 0.15, kpiStep: 0.06, row1Start: 0.5, row1Step: 0.08, row2Start: 0.85, row2Step: 0.08 };
export const enter = (delay) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
});
