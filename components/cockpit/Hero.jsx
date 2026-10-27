'use client';
import { motion } from 'framer-motion';
import { C } from './tokens';

const OVERLAY = 'linear-gradient(90deg, rgba(12,40,71,0.97) 0%, rgba(12,40,71,0.88) 45%, rgba(12,40,71,0.25) 100%)';

// Drawn energy-infrastructure scene for when no photograph is supplied:
// transmission pylons, wind turbines and a solar array against a dusk sky.
function EnergyScene() {
  const pylon = (x, s) => (
    <g key={x} transform={`translate(${x} ${200 - 150 * s}) scale(${s})`} stroke="#8DB6E8" strokeWidth={1.4 / s} fill="none" opacity={0.75}>
      <path d="M-14 150 L0 0 L14 150 M-10 110 L10 110 M-7 75 L7 75 M-4 40 L4 40 M-14 150 L7 75 M14 150 L-7 75 M-10 110 L4 40 M10 110 L-4 40" />
      <path d="M-30 30 L30 30 M-24 52 L24 52 M-30 30 L0 0 L30 30" />
      <path d="M-30 30 l0 8 M30 30 l0 8 M-24 52 l0 8 M24 52 l0 8" strokeWidth={1 / s} />
    </g>
  );
  const turbine = (x, h, a) => (
    <g key={x} transform={`translate(${x} ${200 - h})`} stroke="#B9D3F2" fill="none" opacity={0.7}>
      <path d={`M0 0 L0 ${h}`} strokeWidth="2.2" />
      <g transform={`rotate(${a})`} strokeWidth="1.6">
        <path d="M0 0 L0 -40 M0 0 L34.6 20 M0 0 L-34.6 20" />
      </g>
      <circle r="2.5" fill="#B9D3F2" />
    </g>
  );
  return (
    <svg className="absolute right-0 bottom-0 h-full" viewBox="0 0 900 200" preserveAspectRatio="xMaxYMax slice" style={{ width: '62%' }} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#123E6E" />
          <stop offset="0.7" stopColor="#1F5C93" />
          <stop offset="1" stopColor="#3C7DB8" />
        </linearGradient>
        <radialGradient id="glow" cx="0.72" cy="1" r="0.6">
          <stop offset="0" stopColor="#F6C177" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F6C177" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0 L0 0 0 24" fill="none" stroke="#FFFFFF" strokeOpacity="0.05" />
        </pattern>
      </defs>
      <rect width="900" height="200" fill="url(#sky)" />
      <rect width="900" height="200" fill="url(#glow)" />
      <rect width="900" height="200" fill="url(#grid)" />
      {/* wires */}
      <path d="M140 70 Q 300 95 470 62 Q 640 92 790 58" stroke="#8DB6E8" strokeOpacity="0.55" fill="none" />
      <path d="M140 92 Q 300 117 470 84 Q 640 114 790 80" stroke="#8DB6E8" strokeOpacity="0.45" fill="none" />
      {pylon(140, 0.86)}
      {pylon(470, 0.94)}
      {pylon(790, 1)}
      {turbine(300, 120, 12)}
      {turbine(380, 95, 47)}
      {turbine(620, 130, 78)}
      {/* solar array */}
      <g opacity="0.85">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${520 + i * 42} 196 l12 -18 l36 0 l-12 18 Z`} fill="#2B6CB0" stroke="#9CC3EE" strokeWidth="0.8" />
        ))}
      </g>
      <rect y="194" width="900" height="6" fill="#0E2E52" />
    </svg>
  );
}

/** Full hero on the overview; a compact band (tab title over the cockpit name) on the other tabs. */
export default function Hero({ client, image = null, tab = null }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      className="relative overflow-hidden flex-shrink-0" style={{ height: tab ? 108 : 160, background: C.shell }}
    >
      {image
        ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
        : <EnergyScene />}
      <div className="absolute inset-0" style={{ background: OVERLAY }} />
      {tab ? (
        <div className="relative h-full flex flex-col justify-center px-6" style={{ maxWidth: '62%' }}>
          <p style={{ color: C.onDarkDim, fontSize: 13, fontWeight: 500 }}>{client.cockpitTitle}</p>
          <h1 style={{ color: C.onDark, fontSize: 28, fontWeight: 700, lineHeight: 1.15, marginTop: 2, fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif" }}>{tab.title}</h1>
          <p style={{ color: C.onDark, opacity: 0.8, fontSize: 14, marginTop: 4 }}>{tab.lede}</p>
        </div>
      ) : (
      <div className="relative h-full flex flex-col justify-center px-6" style={{ maxWidth: '58%' }}>
        <h1 style={{ color: C.onDark, fontSize: 34, fontWeight: 700, lineHeight: 1.12, fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif" }}>{client.cockpitTitle}</h1>
        <p style={{ color: C.onDark, fontSize: 20, fontWeight: 500, marginTop: 4 }}>{client.subtitle}</p>
        <p style={{ color: C.onDark, opacity: 0.8, fontSize: 14, marginTop: 8, lineHeight: 1.45, maxWidth: 560 }}>{client.description}</p>
      </div>
      )}
    </motion.div>
  );
}
