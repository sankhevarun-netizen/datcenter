// Plain constant, no leaflet import — safe to use from server-rendered
// components like MapLegend that sit outside the ssr:false WorldMap boundary.
export const HEALTH_COLORS = {
  healthy: '#00B0A0',
  warning: '#E87722',
  critical: '#C8102E',
  commissioning: '#94A3B8',
};
