// Colour for every twin state, shared by the 3D view and the React legends.
export const BACKGROUND = '#070d18';

export const STATE_STYLE = {
  neutral: { color: '#4b6a8f' },
  free: { color: '#1e2d42' },
  blocked: { color: '#5b2a2a' },
  selected: { color: '#60a5fa', pulse: 'soft' },
  dimmed: { color: '#4b6a8f', dim: true },
  ok: { color: '#22c55e' },
  tight: { color: '#f59e0b', pulse: 'soft' },
  exceeded: { color: '#ef4444', pulse: 'strong' },
  redundancy_lost: { color: '#a855f7', outline: true },
  failed: { color: '#7f1d1d', outline: true },
  changed: { color: '#e2e8f0', pulse: 'soft' },
  deployable: { color: '#22c55e' },
  available: { color: '#f59e0b' },
  'occupied-eligible': { color: '#64748b' },
  'stranded-cooling': { color: '#f97316' },
  'stranded-space': { color: '#e11d48' },
  planned: { color: '#38bdf8' },
  'band-green': { color: '#22c55e' },
  'band-amber': { color: '#f59e0b' },
  'band-red': { color: '#ef4444' },
  alert: { color: '#ef4444', pulse: 'strong', outline: true },
  // Estimated inlet temperature, on the twin's heat ramp (lib/nexus/twin-overlay.js).
  'thermal-0': { color: '#1E6FD9' },
  'thermal-1': { color: '#22C9D6' },
  'thermal-2': { color: '#3FD67A' },
  'thermal-3': { color: '#F2873C', pulse: 'soft' },
  'thermal-4': { color: '#E63946', pulse: 'strong' },
};

export const COMPONENT_BASE = { electrical: '#5b7fa6', thermal: '#3f8f98', load: '#4b6a8f' };

export const LABEL_TONE = {
  exceeded: '#fca5a5', failed: '#fca5a5', redundancy_lost: '#d8b4fe', tight: '#fcd34d', ok: '#86efac',
  changed: '#f1f5f9', deployable: '#86efac', planned: '#7dd3fc', 'stranded-cooling': '#fdba74', 'stranded-space': '#fda4af',
  'band-green': '#86efac', 'band-amber': '#fcd34d', 'band-red': '#fca5a5', zone: '#64748b',
};

export const legendColor = (state) => (STATE_STYLE[state]?.dim ? '#334155' : STATE_STYLE[state]?.color ?? '#64748b');

// ── Lit twin materials ──────────────────────────────────────────────────────
// Rack bodies are dark metal; the emissive strip on each rack front carries
// its state, so the model reads at a glance and only the strips bloom.
export const RACK_BODY = '#2C4A78';
export const STRIP_COLOR = {
  neutral: '#3FA9F5', free: '#2A3545', blocked: '#5B6472', dimmed: '#1A2434',
  selected: '#7CC4FF', changed: '#F1F5F9', planned: '#38BDF8',
  ok: '#22D3A7', deployable: '#22D3A7', 'band-green': '#22D3A7',
  tight: '#F5A623', available: '#F5A623', 'band-amber': '#F5A623',
  exceeded: '#FF4D4D', 'band-red': '#FF4D4D', alert: '#FF4D4D', failed: '#FF4D4D',
  redundancy_lost: '#B57BFF', 'occupied-eligible': '#5B6472',
  'stranded-cooling': '#F2873C', 'stranded-space': '#E63946',
  'thermal-0': '#1E6FD9', 'thermal-1': '#22C9D6', 'thermal-2': '#3FD67A', 'thermal-3': '#F2873C', 'thermal-4': '#E63946',
};
// Brightness of the strip per state: healthy racks glow, free and dimmed ones barely do.
export const STRIP_GAIN = { free: 0.45, dimmed: 0.35, blocked: 0.6, 'occupied-eligible': 0.6 };
export const SCENE = {
  backdrop: 'radial-gradient(ellipse at 50% 30%, #143563 0%, #0B1D3A 42%, #050B17 100%)',
  ground: '#0D1626', site: '#16243A', road: '#1F2E46', hallFloor: '#C9D4E2', plantFloor: '#2A3A52', yardFloor: '#1E3047',
  wall: '#9AA7B8', edge: '#4A90E2', plant: '#B8C2CE',
};
