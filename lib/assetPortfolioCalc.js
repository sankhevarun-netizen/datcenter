// Shared derived-data helpers for the Asset Portfolio module — used by the
// globe page, table view, and detail panel so KPI/risk logic isn't duplicated.

const PUE_BENCHMARK = 1.3;

export function worstIntelligenceByAsset(intelligenceRows) {
  const map = {};
  for (const row of intelligenceRows) {
    const cur = map[row.asset_id];
    if (!cur || row.severity > cur.severity) map[row.asset_id] = row;
  }
  return map;
}

// green / amber / red status for a single asset, combining live intelligence
// severity with structural risk signals (risk_flag, PUE vs benchmark).
export function assetStatus(asset, worstIntel) {
  const intel = worstIntel?.[asset.asset_id];
  if (intel?.severity >= 8 || asset.risk_flag === 'High') return 'red';
  if (intel?.severity >= 6 || asset.risk_flag === 'Medium' || (asset.pue && asset.pue > PUE_BENCHMARK)) return 'amber';
  return 'green';
}

export const STATUS_COLORS = { green: '#00B0A0', amber: '#E87722', red: '#C8102E' };

export function computeKPIs(assets) {
  const totalAssets = assets.length;
  const totalMW = assets.reduce((s, a) => s + (Number(a.total_it_capacity_mw) || 0), 0);
  const totalLeaseLiability = assets.reduce((s, a) => {
    if (!a.annual_rent_m || !a.lease_expiry_date) return s;
    const years = Math.max(0, (new Date(a.lease_expiry_date) - new Date()) / (1000 * 60 * 60 * 24 * 365));
    return s + Number(a.annual_rent_m) * years;
  }, 0);
  const capexCommitted = assets.reduce((s, a) => s + (Number(a.capex_remaining_m) || 0), 0);
  return { totalAssets, totalMW, totalLeaseLiability, capexCommitted };
}

export function assetsAtRisk(assets, worstIntel) {
  return assets.filter(a => assetStatus(a, worstIntel) !== 'green');
}

export function monthsUntil(dateStr) {
  if (!dateStr) return Infinity;
  const ms = new Date(dateStr) - new Date();
  return ms / (1000 * 60 * 60 * 24 * 30.44);
}

export function isWithinExpiryWindow(dateStr, windowMonths) {
  const m = monthsUntil(dateStr);
  return m >= 0 && m <= windowMonths;
}

// Minimal field-mapping adapter so an asset_register row can drive the
// existing DigitalTwinViewer (which only reads dc.id / dc.utilizationPercent
// internally; everything else is for the page chrome around it).
export function assetToDigitalTwinDC(asset) {
  const healthScore = Math.max(40, Math.min(100, Math.round(100 - (asset.pue ? (asset.pue - 1) * 80 : 10))));
  return {
    id: asset.asset_id,
    name: asset.asset_name,
    status: asset.risk_flag === 'High' ? 'critical' : asset.risk_flag === 'Medium' ? 'degraded' : 'healthy',
    healthScore,
    totalCapacityMW: Number(asset.total_it_capacity_mw) || 0,
    utilizationPercent: Number(asset.utilization_pct) || 70,
    pue: Number(asset.pue) || 1.3,
    tier: asset.tier_rating ? `Tier ${asset.tier_rating}` : 'Tier III',
    city: asset.city || '',
    country: asset.country || '',
  };
}

// Same adapter for GOOGLE_DC_MASTER campus records (Global Cockpit) — most of
// the 94 GDC entries have no matching row in the asset_register.
export function googleDCToDigitalTwinDC(dc) {
  const healthScore = Math.max(40, Math.min(100, Math.round(100 - (dc.pue ? (dc.pue - 1) * 80 : 10))));
  return {
    id: dc.id,
    name: dc.name,
    status: dc.risk_flag === 'High' ? 'critical' : dc.risk_flag === 'Medium' ? 'degraded' : 'healthy',
    healthScore,
    totalCapacityMW: Number(dc.capacity_mw) || 0,
    utilizationPercent: Number(dc.utilization_pct) || 70,
    pue: Number(dc.pue) || 1.3,
    tier: dc.tier ? `Tier ${dc.tier}` : 'Tier III',
    city: dc.market || dc.city || '',
    country: dc.country || '',
  };
}
