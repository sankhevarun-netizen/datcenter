'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { TrendingUp, Package, Settings, ShieldCheck, Activity, DollarSign } from 'lucide-react';

const STAGES = [
  { title: 'Strategy', shortTitle: 'Strategy', description: 'Market scan & opportunity analysis', expectedOutput: 'Market opportunity report, site shortlist & investment thesis', icon: TrendingUp, path: '/stage/01', color: '#00338D', hoverColor: '#002A73' },
  { title: 'Supply Chain\nManagement', shortTitle: 'Supply Chain Management', description: 'Components, requirements & selection', expectedOutput: 'Vendor shortlist, BOM, cost estimates & supply agreements', icon: Package, path: '/stage/02', color: '#0055A4', hoverColor: '#0066c4' },
  { title: 'Design and\nBuild', shortTitle: 'Design and Build', description: 'Architecture & construction requirements', expectedOutput: 'Technical specs, construction milestones & commissioning plan', icon: Settings, path: '/stage/03', color: '#00529B', hoverColor: '#0063bb' },
  { title: 'Regulatory and\nCompliance', shortTitle: 'Regulatory and Compliance', description: 'Tax, regulatory, ESG & cyber', expectedOutput: 'Compliance matrix, tax structure, ESG rating & risk register', icon: ShieldCheck, path: '/stage/04', color: '#1B3A5C', hoverColor: '#234d7a' },
  { title: 'Operations', shortTitle: 'Operations', description: 'Efficiency, DCIM & uptime management', expectedOutput: 'SLA metrics, uptime reports, DCIM dashboard & O&M plan', icon: Activity, path: '/stage/05', color: '#003580', hoverColor: '#0044a0' },
  { title: 'Monetization', shortTitle: 'Monetization', description: 'Revenue models & market positioning', expectedOutput: 'Revenue model, pricing strategy, tenant agreements & ROI analysis', icon: DollarSign, path: '/stage/06', color: '#005EB8', hoverColor: '#0088e0' },
];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, outerR, innerR, startAngle, endAngle) {
  const s1 = polarToCartesian(cx, cy, outerR, startAngle);
  const e1 = polarToCartesian(cx, cy, outerR, endAngle);
  const s2 = polarToCartesian(cx, cy, innerR, endAngle);
  const e2 = polarToCartesian(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [`M ${s1.x} ${s1.y}`, `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`, `L ${s2.x} ${s2.y}`, `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y}`, 'Z'].join(' ');
}

export default function LifecycleWheel({ onCenterClick }) {
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [clickedIndex, setClickedIndex] = useState(null);

  const SIZE = 520, CX = 260, CY = 260, OUTER_R = 220, INNER_R = 100, GAP = 3;
  const sliceAngle = 360 / STAGES.length;

  const handleSliceClick = useCallback((stage, index) => {
    setClickedIndex(index);
    setTimeout(() => router.push(stage.path), 400);
  }, [router]);

  return (
    <div className="relative select-none" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="overflow-visible">
        <defs>
          {STAGES.map((s, i) => (
            <radialGradient key={i} id={`slice-grad-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={s.hoverColor} />
              <stop offset="100%" stopColor={s.color} />
            </radialGradient>
          ))}
          <filter id="glow"><feGaussianBlur stdDeviation="6" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="center-grad" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#005EB8" />
            <stop offset="100%" stopColor="#00338D" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={OUTER_R + 8} fill="none" stroke="rgba(0,119,200,0.12)" strokeWidth={16} />
        <circle cx={CX} cy={CY} r={OUTER_R + 2} fill="none" stroke="rgba(0,119,200,0.06)" strokeWidth={4} />

        {STAGES.map((stage, i) => {
          const startAngle = i * sliceAngle + GAP;
          const endAngle = (i + 1) * sliceAngle - GAP;
          const path = describeArc(CX, CY, OUTER_R, INNER_R, startAngle, endAngle);
          const isHovered = hoveredIndex === i;
          const isOtherHovered = hoveredIndex !== null && hoveredIndex !== i;
          const isClicked = clickedIndex === i;
          const midAngle = (startAngle + endAngle) / 2;
          const expandVec = polarToCartesian(0, 0, isClicked ? 18 : isHovered ? 10 : 0, midAngle);

          return (
            <motion.g
              key={i}
              className="wheel-slice"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: isOtherHovered ? 0.55 : 1 }}
              transition={{ delay: 2.2 + i * 0.15, duration: 0.5, type: 'spring', stiffness: 200, damping: 20, opacity: { duration: 0.2 } }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleSliceClick(stage, i)}
            >
              <motion.g animate={{ x: expandVec.x, y: expandVec.y }} transition={{ duration: 0.2 }}>
                <path d={path} fill={`url(#slice-grad-${i})`} stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} filter={isHovered || isClicked ? 'url(#glow)' : undefined} />
                {isHovered && <path d={path} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />}

                {(() => {
                  const titleAngle = midAngle;
                  const labelR = (OUTER_R + INNER_R) / 2;
                  const pos = polarToCartesian(CX, CY, labelR, titleAngle);
                  const lines = stage.title.split('\n');
                  return (
                    <g transform={`translate(${pos.x}, ${pos.y})`}>
                      {lines.map((line, li) => (
                        <text key={li} x={0} y={(li - (lines.length - 1) / 2) * 14} textAnchor="middle" fill="white"
                          strokeWidth="2.5" paintOrder="stroke fill" fontSize={isHovered ? '13' : '12'}
                          fontFamily="'Inter', 'Segoe UI', sans-serif" fontWeight="800" letterSpacing="0.2">
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                })()}
              </motion.g>
            </motion.g>
          );
        })}

        {/* Center */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6, type: 'spring', stiffness: 200 }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          className="cursor-pointer"
          onClick={onCenterClick}
        >
          <motion.circle cx={CX} cy={CY} r={INNER_R - 2} fill="none" stroke="rgba(0,119,200,0.4)" strokeWidth={2}
            animate={{ r: [INNER_R - 2, INNER_R + 6, INNER_R - 2], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
          <circle cx={CX} cy={CY} r={INNER_R - 4} fill="#0D1428" />
          <circle cx={CX} cy={CY} r={INNER_R - 8} fill="url(#center-grad)" />
          <image href="/kpmg-logo.png" x={CX - 60} y={CY - 65} width="120" height="100" preserveAspectRatio="xMidYMid meet" />
          <text x={CX} y={CY + 47} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="'Inter', 'Segoe UI', sans-serif" fontWeight="500" letterSpacing="1.5">DATACENTER INTELLIGENCE</text>
          <text x={CX} y={CY + 60} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="'Inter', 'Segoe UI', sans-serif" fontWeight="400" letterSpacing="1">Click to upload &amp; analyse</text>
        </motion.g>

        {STAGES.map((_, i) => {
          const angle = i * sliceAngle;
          const inner = polarToCartesian(CX, CY, INNER_R - 4, angle);
          const outer = polarToCartesian(CX, CY, OUTER_R + 1, angle);
          return (
            <motion.line key={`spoke-${i}`} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 + i * 0.1 }} />
          );
        })}
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredIndex !== null && (() => {
          const midAngle = hoveredIndex * (360 / STAGES.length) + (360 / STAGES.length) / 2;
          const rad = ((midAngle - 90) * Math.PI) / 180;
          const tooltipY = CY + ((OUTER_R + INNER_R) / 2) * Math.sin(rad);
          return (
            <motion.div
              key={hoveredIndex}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.18 }}
              className="absolute pointer-events-none"
              style={{ left: SIZE + 20, top: tooltipY, transform: 'translateY(-50%)' }}
            >
              <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderRight: '8px solid rgba(26,31,54,0.92)', borderTop: '8px solid transparent', borderBottom: '8px solid transparent' }} />
              <div className="glass-dark rounded-xl px-4 py-3 min-w-[240px] max-w-[280px]">
                <div className="text-white font-bold text-sm leading-snug" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{STAGES[hoveredIndex].shortTitle}</div>
                <div className="text-white/55 text-xs mt-1 leading-relaxed">{STAGES[hoveredIndex].description}</div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-[#005EB8] text-[10px] font-mono uppercase tracking-wider mb-1">Expected Output</div>
                  <div className="text-white/70 text-xs leading-relaxed">{STAGES[hoveredIndex].expectedOutput}</div>
                </div>
                <div className="text-[#005EB8] text-xs mt-2 font-medium">Click to explore →</div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
