// The one Live / Dataset / Roadmap badge, used by AI Stack and Services.
import { STATUS } from '@/lib/platform-registry';

export default function StatusBadge({ status, variant = 'pill', size = 'md' }) {
  const s = STATUS[status];
  const text = size === 'sm' ? 'text-[10.5px]' : 'text-[11.5px]';
  if (variant === 'dot') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold ${text}`} style={{ color: s.text }} title={s.note}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full px-2 py-0.5 ${text}`} style={{ color: s.text, background: s.bg }} title={s.note}>
      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}
    </span>
  );
}

/** "● 3 Live" style count line, in the badge colours. */
export function StatusCount({ status, count, size = 'md' }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-[11px]' : 'text-[12px]'} text-[#334155]`}>
      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{count} {s.countLabel}
    </span>
  );
}
