'use client';
// Presentation cockpit frame: navy top bar and sidebar around a light page.
//
// Designed at 1920×1080 and scaled to the viewport, so every screen (laptop,
// projector, 4K) shows the same composition. The longer axis gains design
// space, which the flexible layout absorbs; nothing is letterboxed.
import { useLayoutEffect, useState } from 'react';
import { Home, BarChart2, ShieldCheck, SearchCode, LineChart, FileText, ChevronDown } from 'lucide-react';
import { C, FONT } from './tokens';
import { KPMG_MARK } from './kpmg-mark';

export const NAV = [
  { id: 'overview', label: 'Cockpit View', Icon: Home },
  { id: 'market', label: 'Market Analysis', Icon: BarChart2 },
  { id: 'opportunities', label: 'Opportunities', Icon: ShieldCheck },
  { id: 'competitive', label: 'Competitive Intel', Icon: SearchCode },
  { id: 'roadmap', label: 'Strategic Roadmap', Icon: LineChart },
  { id: 'reports', label: 'Reports', Icon: FileText },
];

function IndiaFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden className="rounded-[2px] overflow-hidden flex-shrink-0">
      <rect width="24" height="5.34" fill="#FF9933" />
      <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
      <rect y="10.66" width="24" height="5.34" fill="#138808" />
      <circle cx="12" cy="8" r="2.1" fill="none" stroke="#000080" strokeWidth="0.6" />
    </svg>
  );
}

export const DESIGN = { width: 1920, height: 1080 };

function useFit() {
  const [fit, setFit] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const scale = Math.min(vw / DESIGN.width, vh / DESIGN.height);
      setFit({ scale, width: vw / scale, height: vh / scale });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return fit;
}

export default function CockpitShell({ client, active = 'overview', onNavigate, children }) {
  const fit = useFit();
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: C.shell }}>
    <div className="flex flex-col overflow-hidden origin-top-left"
      style={{ fontFamily: FONT, background: C.pageBg, visibility: fit ? 'visible' : 'hidden', width: fit?.width ?? DESIGN.width, height: fit?.height ?? DESIGN.height, transform: `scale(${fit?.scale ?? 1})` }}>
      {/* Top bar */}
      <div className="flex-shrink-0 h-16 flex items-center justify-between px-6" style={{ background: `linear-gradient(90deg, ${C.shellDeep} 0%, ${C.shell} 60%, #12325A 100%)`, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={KPMG_MARK} alt="KPMG" style={{ height: 31, width: 'auto' }} />
          <span className="w-px h-6" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ color: C.onDark, fontSize: 15, fontWeight: 600 }}>K-Nexus AI</span>
          <span className="w-px h-5" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ color: C.onDarkDim, fontSize: 13 }}>Live Client Intelligence</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-lg px-5 py-2" style={{ border: '1px solid rgba(255,255,255,0.45)', color: C.onDark, fontSize: 14, fontWeight: 500 }}>{client.persona}</span>
          <span className="flex items-center gap-3 rounded-lg px-4 py-2 w-[230px]" style={{ border: '1px solid rgba(255,255,255,0.35)', color: C.onDark, fontSize: 14 }}>
            <IndiaFlag /> {client.region}
            <ChevronDown size={16} className="ml-auto" style={{ color: C.onDarkDim }} />
          </span>
          <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.45)', color: C.onDark, fontSize: 15, fontWeight: 600 }}>{client.initial}</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <nav className="flex-shrink-0 w-[220px] flex flex-col justify-between py-5 px-3" style={{ background: `linear-gradient(180deg, ${C.shell} 0%, ${C.shellDeep} 100%)` }}>
          <ul className="space-y-1.5">
            {NAV.map(({ id, label, Icon }) => {
              const on = id === active;
              return (
                <li key={id}>
                  <button type="button" onClick={() => onNavigate?.(id)} aria-current={on ? 'page' : undefined}
                    className={`w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors ${on ? '' : 'hover:bg-white/5 hover:text-white'}`}
                    style={on ? { background: '#1D52A6', color: C.onDark, fontSize: 14, fontWeight: 500 } : { color: '#C3D4EA', fontSize: 14 }}>
                    <Icon size={18} strokeWidth={1.8} />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-3.5" style={{ color: C.muted, fontSize: 11, lineHeight: 1.4 }}>KPMG<br />Confidential</p>
        </nav>

        <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
      </div>
    </div>
    </div>
  );
}
