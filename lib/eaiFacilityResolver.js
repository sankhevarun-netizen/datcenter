// Resolves a thin EAI Global Portfolio facility record (data/eaiMockData.js
// `eaiFacilities`) into the richer "dc" shape components/pages/
// DatacenterDetailPanel.jsx expects, by matching it against the curated
// master datacenter dataset (lib/datacenter-data.js).
//
// The EAI operational fields (status, capacity, region) always win over the
// master record so the numbers shown on the globe stay truthful to what the
// rest of the EAI platform reports; anything the master dataset doesn't have
// (pue, connectivity, certifications, ...) is simply left undefined — the
// panel already guards every optional section and hides them gracefully.

import { loadDatacenters } from '@/lib/datacenter-data';

function stripEaiSuffix(name = '') {
  const campusIdx = name.search(/\s+Campus\b/i);
  if (campusIdx !== -1) return name.slice(0, campusIdx).trim();
  return name.replace(/\s+DC$/i, '').trim();
}

/**
 * @param {object} eaiFac - an entry from data/eaiMockData.js `eaiFacilities`
 * @returns {Promise<object>} a dc-shaped object for DatacenterDetailPanel
 */
export async function resolveEaiFacilityToDatacenter(eaiFac) {
  let master = null;
  try {
    const { datacenters } = await loadDatacenters();
    const cityNorm = eaiFac.city?.toLowerCase().trim();
    const countryNorm = eaiFac.country?.toLowerCase().trim();

    master = datacenters.find(dc =>
      dc.city?.toLowerCase().trim() === cityNorm && dc.country?.toLowerCase().trim() === countryNorm
    ) ?? null;

    if (!master) {
      const namePrefix = stripEaiSuffix(eaiFac.name).toLowerCase();
      if (namePrefix.length > 2) {
        master = datacenters.find(dc => dc.name?.toLowerCase().startsWith(namePrefix)) ?? null;
      }
    }
  } catch {
    // Master dataset unavailable (offline, fetch failure, etc.) — fall
    // through and render from the EAI fields alone.
    master = null;
  }

  const base = master ?? {};
  return {
    ...base,
    id: eaiFac.id,
    name: eaiFac.name,
    city: eaiFac.city,
    country: eaiFac.country,
    status: eaiFac.status,
    capacity_mw: base.capacity_mw ?? eaiFac.capacityMW,
    operator: base.operator ?? eaiFac.region,
    // EAI operational metrics, carried through for display + AI context.
    utilizationPct: eaiFac.utilizationPct,
    healthScore: eaiFac.healthScore,
    region: eaiFac.region,
  };
}
