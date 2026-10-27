// lib/realEstateAggregates.js
// Rolls up stats from leaf nodes up to any ancestor level in the RE hierarchy.

import { RE_NODES, getRackNodesForRoom } from '@/data/realEstateHierarchy';

/** Returns a stats object for any node in the hierarchy, rolling up from children. */
export function getNodeStats(nodeId) {
  const node = RE_NODES[nodeId];
  if (!node) return null;

  // Racks are generated on-demand; return their own stats directly
  if (node.type === 'rack') {
    return {
      capacityMw:    node.capacityMw,
      itCapacityMw:  node.itCapacityMw,
      utilizationPct: node.utilizationPct,
      areaSqft:      node.areaSqft,
      occupancyPct:  node.occupancyPct,
      avgTempC:      node.avgTempC,
      pue:           node.pue,
      status:        node.status,
      rackCount:     1,
      name:          node.name,
      type:          node.type,
    };
  }

  // Rooms: if it's a datacenter-floor room, aggregate from generated racks
  if (node.type === 'room' && node.roomType === 'datacenter-floor') {
    const racks = getRackNodesForRoom(nodeId);
    if (racks.length > 0) return aggregateNodes(racks, node);
    // Fall through to own stats if no racks
    return ownStats(node);
  }

  // For everything else: recurse into children
  if (node.children && node.children.length > 0) {
    const childStats = node.children.map(cid => getNodeStats(cid)).filter(Boolean);
    if (childStats.length > 0) return aggregateStats(childStats, node);
  }

  return ownStats(node);
}

function ownStats(node) {
  return {
    capacityMw:    node.capacityMw,
    itCapacityMw:  node.itCapacityMw,
    utilizationPct: node.utilizationPct,
    areaSqft:      node.areaSqft,
    occupancyPct:  node.occupancyPct,
    avgTempC:      node.avgTempC,
    pue:           node.pue,
    status:        node.status,
    rackCount:     node.rackCount ?? 0,
    name:          node.name,
    type:          node.type,
  };
}

function aggregateNodes(nodes, parent) {
  const stats = nodes.map(n => ownStats(n));
  return aggregateStats(stats, parent);
}

function aggregateStats(statsList, parent) {
  const total = statsList.reduce((acc, s) => {
    acc.capacityMw   += s.capacityMw   ?? 0;
    acc.itCapacityMw += s.itCapacityMw ?? 0;
    acc.areaSqft     += s.areaSqft     ?? 0;
    acc.rackCount    += s.rackCount    ?? 0;
    acc.tempSum      += s.avgTempC     ?? 0;
    acc.pueSum       += s.pue          ?? 0;
    acc.occSum       += s.occupancyPct ?? 0;
    acc.utilSum      += s.utilizationPct ?? 0;
    acc.count        += 1;
    if (s.status === 'critical')    acc.nCrit++;
    else if (s.status === 'maintenance') acc.nWarn++;
    return acc;
  }, { capacityMw: 0, itCapacityMw: 0, areaSqft: 0, rackCount: 0, tempSum: 0, pueSum: 0, occSum: 0, utilSum: 0, count: 0, nCrit: 0, nWarn: 0 });

  const n = total.count || 1;
  return {
    capacityMw:    +total.capacityMw.toFixed(2),
    itCapacityMw:  +total.itCapacityMw.toFixed(2),
    utilizationPct: Math.round(total.itCapacityMw / (total.capacityMw || 1) * 100),
    areaSqft:      Math.round(total.areaSqft),
    occupancyPct:  Math.round(total.occSum / n),
    avgTempC:      +(total.tempSum / n).toFixed(1),
    pue:           +(total.pueSum / n).toFixed(2),
    status:        total.nCrit > 0 ? 'critical' : total.nWarn > 0 ? 'maintenance' : 'operational',
    rackCount:     total.rackCount,
    name:          parent?.name ?? '',
    type:          parent?.type ?? '',
  };
}

/** Build KPI card props for a given node from its rolled-up stats */
export function buildKpiCards(nodeId) {
  const stats = getNodeStats(nodeId);
  const node  = RE_NODES[nodeId];
  if (!stats || !node) return [];

  return [
    { key: 'cap',  label: 'Total Capacity',   value: stats.capacityMw.toFixed(1),  unit: 'MW',  sublabel: 'IT Power',          delta: '+0.8%', up: true,  iconKey: 'zap',        color: '#005EB8', bg: 'rgba(0,119,200,0.15)', seed: 1 },
    { key: 'it',   label: 'IT Capacity',      value: stats.itCapacityMw.toFixed(1),unit: 'MW',  sublabel: 'In Use',             delta: '+1.2%', up: true,  iconKey: 'activity',   color: '#7C3AED', bg: 'rgba(124,58,237,0.15)', seed: 2 },
    { key: 'util', label: 'Utilization',      value: stats.utilizationPct,         unit: '%',   sublabel: 'Power draw',         delta: '-0.5%', up: false, iconKey: 'timer',      color: '#00B0A0', bg: 'rgba(0,163,108,0.15)', seed: 3 },
    { key: 'rack', label: 'Racks',            value: stats.rackCount,              unit: '',    sublabel: 'Total installed',    delta: '+4',    up: true,  iconKey: 'layers',     color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', seed: 4 },
    { key: 'occ',  label: 'Occupancy',        value: stats.occupancyPct,           unit: '%',   sublabel: 'Space filled',       delta: '+1.3%', up: true,  iconKey: 'building',   color: '#EC4899', bg: 'rgba(236,72,153,0.15)', seed: 5 },
    { key: 'temp', label: 'Avg Temperature',  value: stats.avgTempC.toFixed(1),    unit: '°C',  sublabel: 'Inlet air',          delta: '-0.2°', up: false, iconKey: 'droplets',   color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', seed: 6 },
    { key: 'pue',  label: 'PUE',              value: stats.pue.toFixed(2),         unit: '',    sublabel: 'Power eff.',         delta: '-0.02', up: false, iconKey: 'leaf',       color: '#34D399', bg: 'rgba(52,211,153,0.15)', seed: 7 },
    { key: 'sta',  label: 'Status',           value: stats.status === 'operational' ? 'Good' : stats.status === 'maintenance' ? 'Warn' : 'Alert',
                                              unit: '',   sublabel: node.name,               delta: '',      up: true,  iconKey: 'shieldAlert', color: '#00B0A0', bg: 'rgba(0,163,108,0.15)', seed: 8 },
  ];
}
