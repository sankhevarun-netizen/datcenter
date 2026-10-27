// Tata Power Investment Cockpit — every figure the cockpit shows.
//
// Static by design: the cockpit renders from this file alone, identically every
// time, with no network. To add a client, copy this file, change the values and
// register it in data/cockpit/index.js.
//
// The figures reconcile with each other:
//   • market size compounds at 24% from $5.9Bn (2026) to $14.0Bn (2030)
//   • near-term opportunity = 2026 + 2027 + 2028 = $22.3Bn
//   • segments sum to the 2030 total; opportunity rows partition the segments
//     (hybrid firming = $1.9Bn of renewable + $1.3Bn of storage)
//   • new capacity to power = 6.5 GW − 1.5 GW = 5 GW

export const tataPower = {
  slug: 'tata-power',

  client: {
    name: 'Tata Power',
    legalName: 'The Tata Power Company Limited',
    cockpitTitle: 'Tata Power Investment Cockpit',
    subtitle: 'India Datacentre Power & Clean Energy Infrastructure',
    description: 'AI-powered market intelligence to identify, evaluate and prioritise investment opportunities in datacentre power infrastructure.',
    persona: 'Integrated Utility',
    region: 'India',
    initial: 'T',
    relevance: 'Integrated utility with captive generation, distribution licence and storage capability — the full stack a hyperscale datacentre needs.',
  },

  // Matched by lib/cockpit/trigger.js. Fires when a required term is present,
  // at least one strong term, and two or more supporting terms.
  trigger: {
    required: ['tata power'],
    strong: ['datacentre', 'datacenter', 'data centre', 'data center', 'datacentres', 'datacenters', 'data centres', 'data centers', 'dc'],
    supporting: ['power', 'energy', 'investment', 'invest', 'infrastructure', 'renewable', 'renewables', 'storage', 'battery', 'grid', 'hyperscale', 'opportunity', 'india', 'captive', 'entry', 'evaluate', 'evaluating', 'market'],
    analysing: [
      'Client identified — Tata Power',
      'Scanning India datacentre power market',
      'Modelling investment opportunity',
      'Cockpit ready',
    ],
  },

  kpis: [
    { value: '$14Bn', label: 'Annual market size by 2030', icon: 'bars', tint: 'blue' },
    { value: '24%', label: 'Projected CAGR (2026–2030)', icon: 'trend', tint: 'green' },
    { value: '5 GW', label: 'New datacentre capacity to power by 2030', icon: 'zap', tint: 'blue' },
    { value: '$22Bn', label: 'Near-term opportunity (2026–2028)', icon: 'leaf', tint: 'green' },
    { value: '4', label: 'Priority investment themes', icon: 'target', tint: 'blue' },
  ],

  market: {
    headline: "India's datacentre power infrastructure market is projected to reach $14Bn a year by 2030, growing at 24% CAGR as capacity moves from 1.5 GW to 6.5 GW.",
    cagrLabel: '24% CAGR',
    finalLabel: '$14Bn',
    growth: [
      { year: '2026', sizeBn: 5.9 },
      { year: '2027', sizeBn: 7.3 },
      { year: '2028', sizeBn: 9.1 },
      { year: '2029', sizeBn: 11.3 },
      { year: '2030', sizeBn: 14.0 },
    ],
    source: 'Capacity: CEEW & SYSTEMIQ (Feb 2026), India DC capacity 4.5–6.5 GW by 2030; Indian power-sector reporting. Market size modelled from that trajectory at Indian power-infrastructure cost benchmarks.',
  },

  segments: {
    total: '$14Bn',
    items: [
      { name: 'Captive Renewable Power', value: '$5.6Bn', valueBn: 5.6, share: 40, color: '#1E3A8A' },
      { name: 'Battery Energy Storage', value: '$4.2Bn', valueBn: 4.2, share: 30, color: '#3B82F6' },
      { name: 'Grid & Substation Infrastructure', value: '$2.8Bn', valueBn: 2.8, share: 20, color: '#A8CBF3' },
      { name: 'Backup Generation', value: '$1.4Bn', valueBn: 1.4, share: 10, color: '#D8D2F6' },
    ],
  },

  geography: [
    { city: 'Mumbai', level: 'High', lat: 19.08, lon: 72.88, note: 'Largest cluster, about half of national capacity', label: 'left', primary: true },
    { city: 'Chennai', level: 'High', lat: 13.08, lon: 80.27, note: 'Submarine cable landing, water stressed', label: 'right' },
    { city: 'Hyderabad', level: 'High', lat: 17.39, lon: 78.49, note: 'Fastest hyperscale growth', label: 'right' },
    { city: 'Bengaluru', level: 'Medium', lat: 12.97, lon: 77.59, note: 'Karnataka DC policy 2026–31', label: 'left' },
    { city: 'Delhi NCR', level: 'Medium', lat: 28.61, lon: 77.21, note: 'Grid constrained', label: 'right' },
    { city: 'Pune', level: 'Emerging', lat: 18.52, lon: 73.86, note: 'Mumbai overflow corridor', label: 'below' },
  ],

  insights: [
    { title: 'Power is the binding constraint', text: 'Grid connection, not capital, sets datacentre timelines in Mumbai and Delhi NCR. Captive generation is the unlock.', icon: 'trend', tint: 'green' },
    { title: 'Captive renewable is the largest segment', text: '40% of the opportunity. Hyperscalers are contracting 24×7 carbon-free power, not annual-average renewable.', icon: 'bars', tint: 'blue' },
    { title: 'Storage is the differentiator', text: 'Firming intermittent renewable for a Tier III load needs BESS at scale. Few Indian players can do both.', icon: 'leaf', tint: 'green' },
    { title: 'Tata Power holds the full stack', text: 'Generation, distribution licence, renewables and rooftop solar — an integrated position that is rare and hard to assemble.', icon: 'star', tint: 'blue' },
  ],

  opportunities: {
    rows: [
      { name: 'Captive Renewable PPA Platform', segment: 'Renewable', value: '$3.7Bn', timeline: '2026–2030', fit: 5 },
      { name: 'BESS for Datacentre Firming', segment: 'Storage', value: '$2.9Bn', timeline: '2026–2029', fit: 5 },
      { name: 'Dedicated Substation Infrastructure', segment: 'Grid', value: '$2.8Bn', timeline: '2027–2030', fit: 4 },
      { name: 'Hybrid Solar–Storage Firming', segment: 'Hybrid', value: '$3.2Bn', timeline: '2026–2029', fit: 4 },
      { name: 'Backup Power & Operator Partnerships', segment: 'Backup', value: '$1.4Bn', timeline: '2026–2028', fit: 3 },
    ],
    note: '2030 annual opportunity; rows partition the $14Bn segment total.',
  },

  roadmap: [
    { window: '0–6 months', title: 'Market Scan & Site Identification', detail: 'Map hyperscale demand against our generation footprint; name anchor operators.' },
    { window: '6–15 months', title: 'Anchor PPA & Structuring', detail: 'Sign the first 24×7 carbon-free PPA; fix storage sizing and structure.' },
    { window: '15–30 months', title: 'Build & Grid Integration', detail: 'Build captive generation and BESS; commission dedicated substations.' },
    { window: '30–48 months', title: 'Platform Scale-Up', detail: 'Replicate across clusters; assess an InvIT for capital recycling.' },
  ],

  // One-line description under each tab's title.
  tabLedes: {
    market: 'Demand, segment growth and the cluster-level outlook for datacentre power in India.',
    opportunities: 'Five opportunities ranked by value and fit, with the case for each.',
    competitive: 'How Tata Power compares with the players competing to power India’s datacentres.',
    roadmap: 'From market scan to a platform in three clusters over 48 months.',
    reports: 'Briefings and analysis built from this cockpit, ready to share.',
  },

  // ── Market Analysis tab ─────────────────────────────────────────────────
  // Capacity reconciles with the overview: 1.5 GW (2026) → 6.5 GW (2030);
  // Mumbai holds about half throughout. Segment 2026 values sum to $5.9Bn and
  // 2030 values to $14.0Bn.
  marketAnalysis: {
    intro: 'Demand is set by hyperscale capacity additions; the power opportunity follows it, with storage growing fastest as buyers move from annual-average to 24×7 clean supply.',
    pue: 1.5,
    capacity: [
      { year: '2026', itGw: 1.5 },
      { year: '2027', itGw: 2.4 },
      { year: '2028', itGw: 3.5 },
      { year: '2029', itGw: 4.9 },
      { year: '2030', itGw: 6.5 },
    ],
    segmentGrowth: [
      { name: 'Captive Renewable Power', y2026: 2.9, y2030: 5.6, color: '#1E3A8A' },
      { name: 'Battery Energy Storage', y2026: 0.9, y2030: 4.2, color: '#3B82F6' },
      { name: 'Grid & Substation Infrastructure', y2026: 1.4, y2030: 2.8, color: '#7DB4F0' },
      { name: 'Backup Generation', y2026: 0.7, y2030: 1.4, color: '#B9AEF0' },
    ],
    clusters: [
      { city: 'Mumbai', gw2026: 0.75, gw2030: 3.0, grid: 'Tight', renewable: 'Open access via state grid', note: 'Tata Power holds the distribution licence' },
      { city: 'Chennai', gw2026: 0.25, gw2030: 1.1, grid: 'Moderate', renewable: 'Strong wind and solar', note: 'Cable landings; water stressed' },
      { city: 'Hyderabad', gw2026: 0.15, gw2030: 0.9, grid: 'Moderate', renewable: 'Strong solar', note: 'Fastest growth, about 6×' },
      { city: 'Delhi NCR', gw2026: 0.2, gw2030: 0.8, grid: 'Constrained', renewable: 'Imported via ISTS', note: 'Tata Power-DDL serves North Delhi' },
      { city: 'Bengaluru', gw2026: 0.1, gw2030: 0.45, grid: 'Moderate', renewable: 'Strong solar and wind', note: 'Karnataka DC policy 2026–31' },
      { city: 'Pune', gw2026: 0.05, gw2030: 0.25, grid: 'Available', renewable: 'Open access via state grid', note: 'Mumbai overflow corridor' },
    ],
    drivers: [
      { title: 'Hyperscale and AI build-out', text: 'Cloud regions and GPU campuses push rack densities and campus sizes up, concentrating demand in a few clusters.', icon: 'zap', tint: 'blue' },
      { title: '24×7 carbon-free procurement', text: 'Hyperscalers now contract hourly-matched clean power, which renewable alone cannot deliver without storage.', icon: 'leaf', tint: 'green' },
      { title: 'Grid connection lead times', text: 'In Mumbai and Delhi NCR, substation capacity rather than land or capital sets the commissioning date.', icon: 'trend', tint: 'blue' },
      { title: 'Data localisation', text: 'Data protection rules and sectoral localisation keep regulated workloads in India, sustaining domestic capacity growth.', icon: 'target', tint: 'green' },
    ],
    policy: [
      { name: 'Green Energy Open Access Rules, 2022', effect: 'Lowered the open-access threshold to 100 kW, opening green power procurement to campus-scale buyers.' },
      { name: 'ISTS charge waiver for renewables', effect: 'Full waiver for projects commissioned by June 2025, then phased out; timing now favours early movers.' },
      { name: 'Viability gap funding for BESS (2023)', effect: 'INR 3,760 crore for 4,000 MWh of battery storage, lowering the cost of firming.' },
      { name: 'State DC policies', effect: 'Tamil Nadu (2021) and Uttar Pradesh (2021) offer power incentives; Karnataka 2026–31 adds plant-wise efficiency targets.' },
    ],
    method: [
      'Capacity trajectory: CEEW & SYSTEMIQ (Feb 2026), upper case of 4.5–6.5 GW by 2030.',
      'Facility power = IT capacity × PUE 1.5.',
      'Segment value from Indian cost benchmarks for captive renewables, BESS, substations and backup generation, applied to annual additions and contracted supply.',
      'All values are annual, in nominal US dollars.',
    ],
  },

  // ── Opportunities tab ──────────────────────────────────────────────────
  // Criteria are scored 1–5 (higher is better, risk included); the fit shown on
  // the overview is their rounded mean.
  opportunityDetails: [
    {
      name: 'Captive Renewable PPA Platform',
      thesis: 'Supply hyperscale campuses with 24×7 carbon-free power through group-captive and open-access PPAs, anchored on one operator per cluster.',
      edge: ['Distribution licences in Mumbai and North Delhi, two of the three largest clusters', 'Own module and cell manufacturing (TP Solar)', 'Renewable development pipeline already in place'],
      risks: ['Open-access charges and banking rules vary by state', 'Tariff competition from pure-play developers'],
      next: 'Shortlist two anchor operators in Mumbai and open term-sheet discussions.',
      scores: { strategic: 5, capability: 5, timing: 5, risk: 4 },
    },
    {
      name: 'BESS for Datacentre Firming',
      thesis: 'Own and operate storage that converts intermittent renewables into firm supply for Tier III loads, sold as a firming service alongside the PPA.',
      edge: ['Can bundle storage with generation and distribution', 'Viability gap funding lowers early project cost'],
      risks: ['Cell prices and import dependence', 'Degradation and augmentation cost over contract life'],
      next: 'Size storage for the anchor campus load profile; run a cell-supply tender.',
      scores: { strategic: 5, capability: 4, timing: 5, risk: 5 },
    },
    {
      name: 'Dedicated Substation Infrastructure',
      thesis: 'Build and operate dedicated substations and feeders for campuses, cutting the connection lead time that most delays commissioning.',
      edge: ['Transmission and distribution engineering in-house', 'Existing right-of-way and utility relationships in Mumbai'],
      risks: ['Regulatory approval timelines', 'Utilisation risk if the anchor campus phases slowly'],
      next: 'Map substation headroom against announced campuses in Mumbai and Navi Mumbai.',
      scores: { strategic: 4, capability: 5, timing: 3, risk: 4 },
    },
    {
      name: 'Hybrid Solar–Storage Firming',
      thesis: 'Dedicated solar-plus-storage parks contracted to a single campus, giving a fixed tariff with hourly matching.',
      edge: ['Module supply from own manufacturing', 'Land and evacuation experience from utility-scale solar'],
      risks: ['Land acquisition near clusters', 'Evacuation capacity in high-solar states'],
      next: 'Identify two hybrid sites in Maharashtra within reach of the Mumbai cluster.',
      scores: { strategic: 4, capability: 4, timing: 4, risk: 3 },
    },
    {
      name: 'Backup Power & Operator Partnerships',
      thesis: 'Replace diesel backup with gas and storage alternatives and co-develop powered shells with operators.',
      edge: ['Operator relationships formed through the PPA platform'],
      risks: ['Diesel remains the cheapest backup today', 'Low margins without a platform position'],
      next: 'Pilot one storage-based backup design with an anchor operator.',
      scores: { strategic: 3, capability: 4, timing: 3, risk: 2 },
    },
  ],

  // ── Competitive Intel tab ──────────────────────────────────────────────
  // Capability levels: 3 strong, 2 partial, 1 limited. Assessment from public
  // disclosures; qualitative by design.
  competitive: {
    capabilities: ['Utility-scale renewables', 'Firm / 24×7 supply', 'Battery storage', 'Distribution in DC clusters', 'Transmission', 'Module manufacturing', 'DC operator ties'],
    players: [
      { name: 'Tata Power', self: true, levels: [3, 2, 2, 3, 3, 3, 2] },
      { name: 'Adani Green / AdaniConneX', levels: [3, 2, 2, 2, 3, 3, 3] },
      { name: 'ReNew', levels: [3, 3, 2, 1, 1, 3, 2] },
      { name: 'JSW Energy', levels: [3, 2, 3, 1, 1, 1, 1] },
      { name: 'NTPC Green Energy', levels: [3, 2, 2, 1, 1, 1, 1] },
      { name: 'CleanMax', levels: [2, 2, 1, 1, 1, 1, 3] },
    ],
    profiles: [
      { name: 'Adani Green / AdaniConneX', threat: 'High', angle: 'Group datacentre joint venture creates captive demand for its own renewables; strongest vertical integration.' },
      { name: 'ReNew', threat: 'High', angle: 'Track record in round-the-clock renewable tenders and corporate PPAs; credible on firm supply.' },
      { name: 'JSW Energy', threat: 'Medium', angle: 'Storage and pumped-hydro ambitions give a firming story; limited presence in datacentre clusters.' },
      { name: 'NTPC Green Energy', threat: 'Medium', angle: 'Scale and cost of capital; less focused on bespoke corporate contracts.' },
      { name: 'CleanMax', threat: 'Medium', angle: 'Specialist in corporate renewable supply with datacentre customers; smaller balance sheet.' },
      { name: 'Torrent Power', threat: 'Low', angle: 'Distribution franchises in Gujarat and Bhiwandi; limited exposure to the main datacentre clusters.' },
    ],
    advantages: [
      { title: 'Distribution where the demand is', text: 'Tata Power distributes in Mumbai and, through Tata Power-DDL, North Delhi — the clusters with the tightest grid. No pure-play developer can offer that.', icon: 'target', tint: 'blue' },
      { title: 'Full stack in one counterparty', text: 'Generation, storage, transmission and the last-mile connection under one contract shortens the operator’s path to power.', icon: 'star', tint: 'green' },
      { title: 'Where to close the gap', text: 'Operator relationships and firm-supply track record trail Adani and ReNew. An anchor PPA in Mumbai closes both.', icon: 'trend', tint: 'blue' },
    ],
    note: 'KPMG assessment from public disclosures; levels are relative, not ratings.',
  },

  // ── Strategic Roadmap tab ──────────────────────────────────────────────
  roadmapDetail: {
    months: 48,
    workstreams: [
      { name: 'Market scan & anchor origination', start: 0, end: 6, phase: 1 },
      { name: 'Site & interconnection studies', start: 3, end: 12, phase: 1 },
      { name: 'PPA negotiation & structuring', start: 6, end: 15, phase: 2 },
      { name: 'Captive renewable build', start: 12, end: 30, phase: 3 },
      { name: 'BESS procurement & build', start: 15, end: 30, phase: 3 },
      { name: 'Substation & grid integration', start: 15, end: 30, phase: 3 },
      { name: 'Cluster replication', start: 30, end: 48, phase: 4 },
      { name: 'InvIT structuring', start: 36, end: 48, phase: 4 },
    ],
    milestones: [
      { month: 6, label: 'Anchor operator LOI' },
      { month: 15, label: 'First 24×7 PPA signed' },
      { month: 30, label: 'First campus on firm clean power' },
      { month: 48, label: 'Platform live in three clusters' },
    ],
    phases: [
      { gate: 'Proceed if one anchor operator signs an LOI in Mumbai.', kpis: ['Anchor LOI signed', 'Interconnection study for the first site'] },
      { gate: 'Commit capital when the PPA tariff clears the hurdle rate with storage included.', kpis: ['First PPA executed', 'Storage sized and cell supply tendered'] },
      { gate: 'Release the second cluster once the first campus runs at contracted availability.', kpis: ['Generation and BESS commissioned', 'Dedicated substation energised'] },
      { gate: 'Recycle capital once three campuses are operating.', kpis: ['Three clusters contracted', 'InvIT structure approved'] },
    ],
  },

  // ── Reports tab ────────────────────────────────────────────────────────
  reports: [
    { id: 'briefing', title: 'Executive Briefing', kind: 'Board pack', status: 'Ready', prepared: 'Oct 2026', description: 'Market size, opportunity ranking and the recommended entry path in one briefing.', sections: ['market', 'segments', 'opportunities', 'roadmap'] },
    { id: 'market', title: 'Market Sizing & Methodology', kind: 'Analysis', status: 'Ready', prepared: 'Oct 2026', description: 'Capacity trajectory, segment growth, cluster demand and the assumptions behind them.', sections: ['market', 'capacity', 'segments', 'clusters', 'method'] },
    { id: 'memos', title: 'Opportunity Investment Memos', kind: 'Five memos', status: 'Ready', prepared: 'Oct 2026', description: 'Thesis, Tata Power edge, risks and next step for each of the five opportunities.', sections: ['memos'] },
    { id: 'competitive', title: 'Competitive Landscape', kind: 'Assessment', status: 'Ready', prepared: 'Oct 2026', description: 'Capability comparison against six players and where Tata Power leads or trails.', sections: ['competitive'] },
    { id: 'roadmap', title: '48-Month Implementation Roadmap', kind: 'Plan', status: 'Draft', prepared: 'Oct 2026', description: 'Workstreams, milestones and stage gates from market scan to platform scale-up.', sections: ['roadmap'] },
  ],
};
