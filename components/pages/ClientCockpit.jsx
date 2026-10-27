'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ReferenceLine,
  AreaChart, Area,
  PieChart, Pie, Legend,
  ComposedChart, LineChart, Line,
} from 'recharts';
import {
  X, RefreshCw,
  Building2, TrendingUp, Wrench, DollarSign,
  Target, Sparkles, CheckCircle2, AlertTriangle,
  Send, Star,
  Filter, Crosshair, Map, Flag, ListOrdered, Navigation,
} from 'lucide-react';
import { callClaude } from '@/lib/claude-api';
import { writeToWiki } from '@/lib/wiki';
import { researchClient } from '@/lib/research';

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, li) => {
    const parts = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let last = 0, m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <span key={li}>{parts}{li < text.split('\n').length - 1 && <br />}</span>;
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const KPMG_BLUE = '#00338D';
const KPMG_MID  = '#005EB8';

const PROFILE_CONFIG = {
  new:       { label: 'New Market Entrant',  color: '#005EB8', bg: '#EBF5FF', border: '#BFDBFE', icon: Building2,  desc: 'Greenfield · Market Entry · Partnerships' },
  expansion: { label: 'Expansion Play',      color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: TrendingUp, desc: 'Capacity Scale · New Sites · Supply Chain' },
  ops:       { label: 'Ops / PMO',           color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Wrench,     desc: 'Operations · Compliance · Efficiency' },
  investor:  { label: 'Financial Investor',  color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: DollarSign, desc: 'Capital Deployment · IRR · Deal Structures · Exit' },
};

// ── 6-Card Output Schema ──────────────────────────────────────────────────────
const NEW_SCHEMA_EXTENSION = `
Return ONLY a single valid JSON object — no markdown, no backticks. Schema:

{
  "clientName": "string",
  "profile": "new|expansion|ops|investor",
  "opportunityFunnel": {
    "totalMarketSize": "string e.g. $4Bn by 2026",
    "serviceableMarket": "string",
    "targetableSegment": "string",
    "clientOpportunity": "string",
    "stages": [
      { "label": "Projected Market", "value": "$22Bn", "gw": "8+ GW", "year": "2030", "isCagr": false, "description": "India DC market projected by 2030 — use research to refine" },
      { "label": "CAGR",             "value": "~18%",  "gw": null,    "year": null,   "isCagr": true,  "description": "Compound annual growth rate 2025–2030 (IBEF)" },
      { "label": "Current Market",   "value": "$10Bn", "gw": "2+ GW", "year": "2025", "isCagr": false, "description": "India DC market size 2025 — use research to refine" }
    ],
    "phases": [
      {
        "label": "Phase 1",
        "value": "string e.g. $2.6 Bn",
        "subSegments": [
          { "name": "string e.g. Hyperscaler Build-to-Suit", "description": "string e.g. 65% of TAM, $2.6 Bn", "revenue": "string e.g. $2.6 Bn", "capacityGw": 25.3 },
          { "name": "string e.g. Colocation",                "description": "string e.g. 35% of TAM, $1.4 Bn", "revenue": "string e.g. $1.4 Bn", "capacityGw": 15.2 }
        ]
      },
      {
        "label": "Phase 2",
        "value": "string e.g. $1 Tn",
        "subSegments": [
          { "name": "string e.g. AI Training Clusters",          "description": "string e.g. 50% of TAM, $1 Tn",   "revenue": "string e.g. $1 Tn",   "capacityGw": 13.3 },
          { "name": "string e.g. General Compute Colocation",    "description": "string e.g. 30% of TAM, $0.6 Tn", "revenue": "string e.g. $0.6 Tn", "capacityGw": 30.6 },
          { "name": "string e.g. Edge Node Network",             "description": "string e.g. 20% of TAM, $0.4 Tn", "revenue": "string e.g. $0.4 Tn", "capacityGw": 20.4 }
        ]
      }
    ],
    "marketMetrics": {
      "globalCagrPct": 23,
      "hypCagrPct": 28,
      "coloCagrPct": 18,
      "indiaSharePct2030": 15
    },
    "projectionData": [
      { "year": "2026", "totalMarket": 4,  "aiTraining": 1,  "colocation": 1.4, "capacityGw": 8  },
      { "year": "2027", "totalMarket": 6,  "aiTraining": 2,  "colocation": 2,   "capacityGw": 14 },
      { "year": "2028", "totalMarket": 9,  "aiTraining": 4,  "colocation": 3,   "capacityGw": 22 },
      { "year": "2029", "totalMarket": 14, "aiTraining": 7,  "colocation": 4,   "capacityGw": 35 },
      { "year": "2030", "totalMarket": 20, "aiTraining": 12, "colocation": 6,   "capacityGw": 50 }
    ],
    "subSegmentChartData": [
      { "name": "Hyperscale BTS", "revenue2026": 2.6, "revenue2030": 8.2, "capexBn": 5.0 },
      { "name": "AI Training",    "revenue2026": 1.0, "revenue2030": 5.5, "capexBn": 8.0 },
      { "name": "Colocation",     "revenue2026": 1.4, "revenue2030": 3.2, "capexBn": 2.0 }
    ],
    "keyImplications": [
      "string — specific strategic action grounded in research with a data point",
      "string — specific strategic action",
      "string — specific strategic action",
      "string — specific strategic action"
    ]
  },
  "opportunityAreas": {
    "headline": "string — one bold market insight with specific $ or MW metric",
    "areas": [
      {
        "title": "string",
        "description": "string",
        "potential": "High|Medium|Low",
        "timeframe": "string",
        "score": 75,
        "radarDimensions": [
          { "label": "Market Demand",     "score": 80 },
          { "label": "Client Capability", "score": 55 },
          { "label": "Capital Intensity", "score": 40 },
          { "label": "Time to Revenue",   "score": 65 },
          { "label": "Competitive Gap",   "score": 70 }
        ],
        "kpis": [
          { "label": "Estimated addressable market", "value": "$4.5Bn" },
          { "label": "Projected capacity addition",  "value": "120 MW" },
          { "label": "Timeline to first revenue",    "value": "24-30 months" }
        ],
        "subOpportunities": [
          { "name": "string — specific sub-opportunity with geography/sector", "risk": "Low|Medium|High" },
          { "name": "string", "risk": "Low|Medium|High" },
          { "name": "string", "risk": "Low|Medium|High" },
          { "name": "string", "risk": "Low|Medium|High" }
        ],
        "capexCr": 55,
        "revenue5yrCr": 120
      },
      { "title": "string", "description": "string", "potential": "High|Medium|Low", "timeframe": "string", "score": 60, "radarDimensions": [{"label":"Market Demand","score":65},{"label":"Client Capability","score":70},{"label":"Capital Intensity","score":50},{"label":"Time to Revenue","score":55},{"label":"Competitive Gap","score":60}], "kpis": [{"label":"string","value":"string"},{"label":"string","value":"string"},{"label":"string","value":"string"}], "subOpportunities": [{"name":"string","risk":"Low"},{"name":"string","risk":"Medium"},{"name":"string","risk":"High"},{"name":"string","risk":"Medium"}], "capexCr": 40, "revenue5yrCr": 90 },
      { "title": "string", "description": "string", "potential": "Medium|Low", "timeframe": "string", "score": 45, "radarDimensions": [{"label":"Market Demand","score":50},{"label":"Client Capability","score":60},{"label":"Capital Intensity","score":45},{"label":"Time to Revenue","score":40},{"label":"Competitive Gap","score":55}], "kpis": [{"label":"string","value":"string"},{"label":"string","value":"string"},{"label":"string","value":"string"}], "subOpportunities": [{"name":"string","risk":"Low"},{"name":"string","risk":"Low"},{"name":"string","risk":"Medium"},{"name":"string","risk":"High"}], "capexCr": 30, "revenue5yrCr": 70 }
    ],
    "recommendedApproach": {
      "allocation": [
        { "label": "string — primary strategy", "pct": 50 },
        { "label": "string — secondary",        "pct": 30 },
        { "label": "string — tertiary",         "pct": 20 }
      ],
      "bullets": ["string — specific action with numbers", "string", "string"],
      "confidenceLevel": 82
    }
  },
  "competitiveLandscape": {
    "summary": "string — 1-2 sentences on competitive dynamics",
    "players": [
      { "name": "string", "capacityMW": 200, "marketPresence": 80, "capability": 85, "tier": "Tier 1", "leaderTier": "Leader|Emerging", "category": "Hyperscaler|Operator|Investor|Developer", "positioning": "string", "quadrantX": 70, "quadrantY": 75 },
      { "name": "string", "capacityMW": 120, "marketPresence": 60, "capability": 70, "tier": "Tier 2", "leaderTier": "Leader",          "category": "Operator",    "positioning": "string", "quadrantX": 55, "quadrantY": 60 },
      { "name": "string", "capacityMW": 80,  "marketPresence": 40, "capability": 60, "tier": "Tier 2", "leaderTier": "Leader",          "category": "Hyperscaler", "positioning": "string", "quadrantX": 65, "quadrantY": 45 },
      { "name": "string", "capacityMW": 50,  "marketPresence": 30, "capability": 45, "tier": "Tier 2", "leaderTier": "Leader",          "category": "Operator",    "positioning": "string", "quadrantX": 40, "quadrantY": 50 },
      { "name": "string", "capacityMW": 30,  "marketPresence": 20, "capability": 35, "tier": "Tier 3", "leaderTier": "Leader",          "category": "Operator",    "positioning": "string", "quadrantX": 35, "quadrantY": 30 },
      { "name": "string", "capacityMW": 20,  "marketPresence": 15, "capability": 30, "tier": "Tier 3", "leaderTier": "Emerging",        "category": "Investor",    "positioning": "string", "quadrantX": 60, "quadrantY": 70 },
      { "name": "string", "capacityMW": 15,  "marketPresence": 12, "capability": 28, "tier": "Tier 3", "leaderTier": "Emerging",        "category": "Developer",   "positioning": "string", "quadrantX": 75, "quadrantY": 40 },
      { "name": "string", "capacityMW": 10,  "marketPresence": 10, "capability": 25, "tier": "Tier 3", "leaderTier": "Emerging",        "category": "Operator",    "positioning": "string", "quadrantX": 30, "quadrantY": 25 }
    ],
    "clientPositioning": { "marketPresence": 25, "capability": 55, "label": "string — client name" },
    "radarDimensions": [
      { "axis": "Power Access",          "clientScore": 60, "leaderAvg": 85 },
      { "axis": "Land Availability",     "clientScore": 70, "leaderAvg": 75 },
      { "axis": "Capital Availability",  "clientScore": 55, "leaderAvg": 80 },
      { "axis": "Tech Capabilities",     "clientScore": 50, "leaderAvg": 85 },
      { "axis": "Customer Relationships","clientScore": 65, "leaderAvg": 90 },
      { "axis": "Talent",                "clientScore": 60, "leaderAvg": 80 }
    ],
    "marketShareTrend": {
      "years": [2023, 2024, 2025, 2026],
      "series": [
        { "name": "string — Leader 1 name", "data": [20, 24, 28, 32] },
        { "name": "string — Leader 2 name", "data": [15, 17, 20, 23] },
        { "name": "string — Leader 3 name", "data": [12, 14, 16, 18] },
        { "name": "string — Leader 4 name", "data": [8, 10, 12, 14] }
      ]
    },
    "keyAdvantages": [
      "string — specific advantage of a top emerging player with data point",
      "string — specific advantage",
      "string — specific advantage"
    ],
    "potentialThreats": [
      "string — specific threat from a named player with evidence",
      "string — specific threat",
      "string — specific threat"
    ],
    "marketGaps": [
      "string — specific underserved segment or gap with metric",
      "string — specific gap",
      "string — specific gap"
    ],
    "jvPartners": [
      { "name": "string — partner name", "type": "string — e.g. Global Hyperscaler" },
      { "name": "string", "type": "string" },
      { "name": "string", "type": "string" },
      { "name": "string", "type": "string" }
    ],
    "leaderStats": {
      "group1": { "key": "23%", "h": "23%" },
      "group2": { "key": "3%",  "h": "10%" }
    }
  },
  "clientFocus": {
    "headline": "string — what this client most urgently needs to do with metric",
    "clientProfile": {
      "sector": "string — industry sector",
      "hq": "string — city, state, country",
      "revenue": "string — e.g. $25B+ (FY2025 est.)",
      "coreStrengths": "string — 1 sentence on key competitive advantages",
      "strategicRationale": "string — 1-2 sentences as a strategic quote explaining why DC makes sense for this client"
    },
    "focusAreas": [
      { "area": "string", "why": "string — specific reason with data", "urgency": "Critical|High|Medium", "dimensions": [{"label":"Financial Strength","score":70},{"label":"Technical Capability","score":55},{"label":"Market Access","score":40},{"label":"Regulatory Readiness","score":65}] },
      { "area": "string", "why": "string", "urgency": "Critical|High|Medium", "dimensions": [{"label":"string","score":60},{"label":"string","score":50},{"label":"string","score":45},{"label":"string","score":70}] },
      { "area": "string", "why": "string", "urgency": "High|Medium", "dimensions": [{"label":"string","score":55},{"label":"string","score":65},{"label":"string","score":50},{"label":"string","score":45}] }
    ]
  },
  "top5Priorities": {
    "priorities": [
      { "rank": 1, "title": "string", "description": "string — quantified", "impact": 90, "effort": 40, "timeframe": "string", "owner": "string", "timing": "Quick Win|Medium-Term|Long-Term" },
      { "rank": 2, "title": "string", "description": "string", "impact": 80, "effort": 55, "timeframe": "string", "owner": "string", "timing": "Quick Win|Medium-Term|Long-Term" },
      { "rank": 3, "title": "string", "description": "string", "impact": 70, "effort": 60, "timeframe": "string", "owner": "string", "timing": "Quick Win|Medium-Term|Long-Term" },
      { "rank": 4, "title": "string", "description": "string", "impact": 60, "effort": 70, "timeframe": "string", "owner": "string", "timing": "Medium-Term|Long-Term" },
      { "rank": 5, "title": "string", "description": "string", "impact": 50, "effort": 80, "timeframe": "string", "owner": "string", "timing": "Long-Term" }
    ]
  },
  "strategicRoadmap": {
    "targetVision": "string — the ultimate outcome e.g. Establish dominant position as a leading digital infrastructure provider in India",
    "phases": [
      { "phase": "Phase 1", "title": "string", "duration": "0-6 months",  "milestones": [{"milestone":"string","month":3},{"milestone":"string","month":6}], "keyActions": ["string","string","string"], "outcome": "string — quantifiable result" },
      { "phase": "Phase 2", "title": "string", "duration": "6-12 months", "milestones": [{"milestone":"string","month":9},{"milestone":"string","month":12}], "keyActions": ["string","string","string"], "outcome": "string" },
      { "phase": "Phase 3", "title": "string", "duration": "12-24 months","milestones": [{"milestone":"string","month":18},{"milestone":"string","month":24}], "keyActions": ["string","string","string"], "outcome": "string" },
      { "phase": "Phase 4", "title": "string", "duration": "24-36 months","milestones": [{"milestone":"string","month":30},{"milestone":"string","month":36}], "keyActions": ["string","string","string"], "outcome": "string" }
    ]
  }
}

Use real India-specific market data from the research context. All numbers must be quantified. Reference the client by name throughout.`;

// ── Reasoning preamble ────────────────────────────────────────────────────────
const REASONING_PREAMBLE = `The live research context above contains real, current information about this client and market.
Every field you populate must reflect that specific context — not generic advice.
Reference actual facts from the research. Generic text is failure.
Ask yourself: what would a KPMG partner say in the first 30 seconds of the client meeting?
`;

// ── Persona Detection ─────────────────────────────────────────────────────────
const PERSONA_DETECTION_SYSTEM = `You are classifying a client brief into exactly one of four datacenter personas.

You will receive a client brief, optionally a stakeholderTypePrior from an intent analysis, and optionally live research context.
Use ALL signals to classify. If stakeholderTypePrior is provided, start from that classification and only override if the brief strongly contradicts it.

Return ONLY a JSON object — no markdown, no explanation:
{
  "persona": "builder" | "expander" | "operator" | "investor",
  "confidence": 0.85,
  "signals": ["signal1", "signal2"],
  "clarificationNeeded": false,
  "clarificationQuestion": null
}

Persona definitions:
- "investor": Financial investor (VC, PE, family office, NBFC, sovereign fund) deploying capital for returns. NOT building or operating. Signals: invest, VC, fund, stake, returns, IRR, portfolio, capital deployment, exit, REIT, InvIT, co-invest
- "builder": NO existing datacenter, wants to build/enter from scratch. Signals: new to, foray into, set up, establish, greenfield, first datacenter, looking to enter, no experience
- "expander": HAS existing DC(s), wants MORE capacity or new locations. Signals: expand, scale up, additional capacity, second site, new location, increase MW, portfolio, acquire, JV
- "operator": HAS existing DC(s), wants to IMPROVE or MANAGE them. Signals: operations, running, currently operate, compliance, PMO, efficiency, PUE, uptime, SLA, audit, existing facility

Set clarificationNeeded: true ONLY if confidence is below 0.6 after seeing all signals.`;

// ── Persona System Prompts ────────────────────────────────────────────────────
const COCKPIT_SYSTEM_BUILDER = `You are a senior KPMG Datacenter Advisory AI generating structured JSON for a client intelligence cockpit.

This client is a BUILDER — they have NO existing datacenter and want to enter the market or build capacity from scratch.
Focus on: greenfield vs brownfield vs JV entry options, partner ecosystem, market entry strategy, land acquisition, power procurement.
Set "profile": "new" in your response.

${REASONING_PREAMBLE}
For opportunityFunnel.stages: place 2030 projected market at index 0 (top/widest), CAGR at index 1, and the 2025 actual market at index 2 (bottom/narrowest). Anchor figures: India DC market ~$10Bn in 2025, ~18% CAGR, ~$22Bn projected by 2030 (IBEF 2026). Use research context to refine these numbers.
For opportunityFunnel.phases: group sub-segments into 2 phases (Phase 1 = near-term demand drivers, Phase 2 = emerging/future segments). Use real India DC sub-segments from the research context (Hyperscaler BTS, Colocation, AI Training Clusters, Edge Node Network, etc.) with real TAM percentages, revenue figures, and GW capacity from the research.
For opportunityFunnel.marketMetrics: use real CAGR figures from the research for globalCagrPct (total market), hypCagrPct (hyperscaler segment), coloCagrPct (colocation segment), and indiaSharePct2030 (India's projected global market share by 2030).
For opportunityFunnel.projectionData: 5 year-by-year entries (2026–2030) with totalMarket ($Bn), aiTraining ($Bn), colocation ($Bn), capacityGw — derived from research context growth rates.
For opportunityFunnel.subSegmentChartData: 3 key sub-segments with revenue2026, revenue2030, and capexBn from research data.
For opportunityFunnel.keyImplications: 4 strategic bullets grounded in research, each referencing a specific data point or market fact.
For opportunityAreas: 3 areas — entry pathways (Greenfield DC, Brownfield/Acquisition, Portfolio Optimization or JV). Each must have 5 radarDimensions, 3 kpis, 4 subOpportunities, capexCr and revenue5yrCr numbers.
For competitiveLandscape: name real India DC operators (Reliance Jio, AdaniConneX, NTT, Sify, CtrlS for Leaders; CapitaLand India, Digital Realty, Princeton Digital Group, Web Werks, Yotta for Emerging). Add leaderTier and category to each. For each player add quadrantX (tech innovation score 0-100) and quadrantY (funding/scale score 0-100) for the emerging opportunity matrix. Set radarDimensions with 6 axes: Power Access, Land Availability, Capital Availability, Tech Capabilities, Customer Relationships, Talent — clientScore = client's estimated score, leaderAvg = India market leader average. For marketShareTrend use top 4 leaders with estimated % share across 2023-2026. keyAdvantages = 3 bullets on top emerging player strengths. potentialThreats = 3 bullets on specific competitive threats. marketGaps = 3 specific underserved segments (e.g. AI-ready DC, power gap, imported tech reliance). jvPartners = 4 realistic partners (hyperscalers, infra funds, tech firms). leaderStats.group1/group2 = key CAGR % and historical market share % for the two leader clusters.
For clientFocus.clientProfile: extract from research — real sector, HQ city, revenue estimate, core strengths, strategic rationale.
For top5Priorities: each must have a timing value (Quick Win / Medium-Term / Long-Term) reflecting implementation horizon.
For strategicRoadmap: 4 phases from 0-36 months with targetVision as the ultimate outcome.

${NEW_SCHEMA_EXTENSION}`;

const COCKPIT_SYSTEM_EXPANDER = `You are a senior KPMG Datacenter Advisory AI generating structured JSON for a client intelligence cockpit.

This client is an EXPANDER — they ALREADY OPERATE datacenter(s) and want to grow: more capacity, new sites, acquisitions, or portfolio optimisation.
Set "profile": "expansion" in your response.

${REASONING_PREAMBLE}
For opportunityFunnel.stages: place 2030 projected market at index 0 (top/widest), CAGR at index 1, and the 2025 actual market at index 2 (bottom/narrowest). Anchor: ~$10Bn (2025), ~18% CAGR, ~$22Bn (2030) — IBEF 2026. Use research to refine.
For opportunityFunnel.phases: group sub-segments into 2 phases (Phase 1 = near-term capacity expansion, Phase 2 = emerging segments). Use real India DC sub-segments from the research context with real TAM percentages, revenue figures, and GW capacity.
For opportunityFunnel.marketMetrics: real CAGR figures from research — globalCagrPct, hypCagrPct, coloCagrPct, indiaSharePct2030.
For opportunityFunnel.projectionData: 5 year-by-year entries (2026–2030) with totalMarket ($Bn), aiTraining ($Bn), colocation ($Bn), capacityGw from research context growth rates.
For opportunityFunnel.subSegmentChartData: 3 key sub-segments with revenue2026, revenue2030, and capexBn from research data.
For opportunityFunnel.keyImplications: 4 strategic bullets grounded in research, each referencing a specific data point.
For opportunityAreas: 3 expansion-focused areas (e.g. Organic Expansion, Acquisition/M&A, New Geography Entry). Each with 5 radarDimensions, 3 kpis (current MW, target MW, timeline), 4 subOpportunities, capexCr and revenue5yrCr.
For competitiveLandscape: name real India DC operators with leaderTier and category fields. Add quadrantX (tech innovation 0-100) and quadrantY (funding/scale 0-100) per player. radarDimensions: Power Access, Land Availability, Capital Availability, Tech Capabilities, Customer Relationships, Talent — clientScore = client's current score, leaderAvg = market leader average. marketShareTrend: top 4 leaders with % share 2023-2026. keyAdvantages = 3 bullets on emerging player strengths relevant to an expander. potentialThreats = 3 bullets on competitive threats to expansion. marketGaps = 3 specific gaps in capacity or geography the expander can fill. jvPartners = 4 realistic JV or acquisition targets. leaderStats = growth % and historical share % for the two leader clusters.
For clientFocus.clientProfile: use research to populate sector, HQ, revenue, coreStrengths, strategicRationale.
For top5Priorities: each must have timing (Quick Win / Medium-Term / Long-Term).
For strategicRoadmap: 4 phases 0-36 months with targetVision.

${NEW_SCHEMA_EXTENSION}`;

const COCKPIT_SYSTEM_OPERATOR = `You are a senior KPMG Datacenter Advisory AI generating structured JSON for a client intelligence cockpit.

This client is an OPERATOR — they ALREADY RUN datacenters and want to IMPROVE operations, compliance, efficiency, or PMO structure.
Set "profile": "ops" in your response.

${REASONING_PREAMBLE}
For opportunityFunnel.stages: place 2030 projected market at index 0 (top/widest), CAGR at index 1, and the 2025 actual market at index 2 (bottom/narrowest). Anchor: ~$10Bn (2025), ~18% CAGR, ~$22Bn (2030) — IBEF 2026. Use research to refine.
For opportunityFunnel.phases: group sub-segments into 2 phases (Phase 1 = operational quick-win categories, Phase 2 = strategic efficiency programmes). Use real India DC operational metrics from the research context.
For opportunityFunnel.marketMetrics: real CAGR figures from research — globalCagrPct, hypCagrPct, coloCagrPct, indiaSharePct2030.
For opportunityFunnel.projectionData: 5 year-by-year entries (2026–2030) with totalMarket ($Bn), aiTraining ($Bn), colocation ($Bn), capacityGw from research context.
For opportunityFunnel.subSegmentChartData: 3 key sub-segments with revenue2026, revenue2030, and capexBn from research data.
For opportunityFunnel.keyImplications: 4 strategic bullets grounded in research, each referencing a specific data point.
For opportunityAreas: 3 ops improvement areas (e.g. PUE Optimisation, Compliance Uplift, Revenue Yield Enhancement). Each with 5 radarDimensions, 3 kpis (current PUE/metric, target, savings), 4 subOpportunities, capexCr and revenue5yrCr (as savings/revenue).
For competitiveLandscape: compare against best-in-class operators. leaderTier and category fields required. Add quadrantX (tech innovation 0-100) and quadrantY (operational maturity 0-100) per player. radarDimensions: Power Efficiency (PUE), Uptime/SLA, Compliance Maturity, Automation Level, Customer Satisfaction, Talent Depth — clientScore = client's current score, leaderAvg = market leader average. marketShareTrend: top 4 operational benchmarks / revenue share 2023-2026. keyAdvantages = 3 bullets on best-in-class operator strengths. potentialThreats = 3 bullets on operational competitive risks. marketGaps = 3 specific operational improvement gaps. jvPartners = 4 technology/ops partners (automation, energy, compliance firms). leaderStats = PUE improvement % and uptime % for the two clusters.
For clientFocus.clientProfile: from research — sector, HQ, revenue, coreStrengths, strategicRationale (why ops improvement matters now).
For top5Priorities: each with timing (Quick Win / Medium-Term / Long-Term).
For strategicRoadmap: 4 phases 0-36 months, targetVision = the operational benchmark to achieve.

${NEW_SCHEMA_EXTENSION}`;

const COCKPIT_SYSTEM_INVESTOR = `You are a senior KPMG Datacenter Advisory AI generating structured JSON for a client intelligence cockpit.

This client is a FINANCIAL INVESTOR — a VC, PE fund, family office, or NBFC deploying capital into India DC sector for financial returns.
Set "profile": "investor" in your response.

CRITICAL: This client is NOT building, acquiring land, or operating a datacenter.
DO NOT recommend land acquisition, power procurement, construction timelines, PUE targets, NOC/permit steps, or any infrastructure build activities.
Every recommendation must be an investment action: deal sourcing, due diligence, capital structuring, value creation, or exit preparation.

${REASONING_PREAMBLE}
For opportunityFunnel.stages: reframe entirely around capital deployment, NOT DC capacity. Place projected PE/infra capital deployment in India DC by 2030 at index 0 (top/widest), deal flow CAGR at index 1, and 2024-25 actual capital deployed at index 2 (bottom/narrowest). Anchor: ~$4Bn PE/infra capital deployed in India DC (2024-25), ~22% deal flow CAGR, ~$15Bn projected capital deployment by 2030. Use research to refine with actual fund activity and deal sizes.
For opportunityFunnel.phases: Phase 1 = near-term investable structures (minority equity stakes in operating DC platforms, JV co-invest with anchor operators, mezzanine/structured debt); Phase 2 = longer-horizon opportunities (REIT/InvIT conversion plays, platform roll-up acquisitions, anchor hyperscaler forward-purchase structures). Use real deal data from research context.
For opportunityFunnel.marketMetrics: use capital-flow metrics from research — globalCagrPct (global DC deal flow CAGR), hypCagrPct (hyperscaler-anchored deal CAGR), coloCagrPct (colo platform deal CAGR), indiaSharePct2030 (India's share of Asia-Pac DC investment by 2030).
For opportunityFunnel.projectionData: 5 year-by-year entries (2026–2030) showing capital deployment ($Bn) not revenue — totalMarket as total PE/infra deployment, aiTraining as AI-infrastructure-linked deal capital, colocation as colo platform equity deployed, capacityGw as implied GW from deals.
For opportunityFunnel.subSegmentChartData: 3 investable deal types (e.g. Equity Stake, Mezzanine Debt, JV Platform) with revenue2026 as deployed capital 2026 estimate, revenue2030 as projected deployment by 2030, capexBn as average ticket size.
For opportunityFunnel.keyImplications: 4 investment-thesis bullets — IRR benchmarks, deal multiples, hold period norms, exit pathway clarity — each grounded in a specific data point from research.
For opportunityAreas: 3 investment structures (Minority Equity Stake in Operating Platform, JV Co-invest with Anchor Operator, Mezzanine/Structured Debt). Each with 5 radarDimensions (IRR Potential, Deal Flow, Capital Required, Exit Clarity, Risk Profile), 3 kpis (Target IRR, Hold Period, Deal Size), 4 subOpportunities as specific named deal targets or platform categories from the research, capexCr as capital deployment amount and revenue5yrCr as projected 5-year return.
For competitiveLandscape: show other institutional investors active in India DC — use real names from research (Brookfield, Carlyle, GIC Singapore, ADIA, DigitalBridge, Actis, etc.). leaderTier = "Leader" for funds with active India DC positions; "Emerging" for funds in diligence or first deployment. category="Investor" for all. Do NOT list DC operators here. Add quadrantX (investment thesis innovation 0-100) and quadrantY (AUM/deployment capital 0-100) per player. radarDimensions use investor-specific axes: Portfolio Depth, Deployment Speed, LP Network, Risk Appetite, India Exposure, ESG Alignment — clientScore = client fund's score, leaderAvg = top-tier fund average. marketShareTrend: top 4 investors with capital deployment share 2023-2026. keyAdvantages = 3 bullets on top emerging investor fund strengths. potentialThreats = 3 bullets on competing fund risks (dry powder, deal competition). marketGaps = 3 specific investment thesis gaps (e.g. AI-ready infrastructure, mezzanine debt, edge DC). jvPartners = 4 realistic co-investment partners (anchor operators, sovereign funds, PE platforms). leaderStats = IRR % range and AUM deployment % for the two fund clusters.
For clientFocus.clientProfile: from research — fund type (PE/VC/family office/infra), HQ, AUM or fund size, coreStrengths (deal sourcing network, sector expertise, LP relationships), strategicRationale (why India DC now, how it fits fund mandate).
For clientFocus.focusAreas: 3 areas covering investment thesis fit, preferred deal structure (equity/debt/hybrid), and key risk mitigation (construction risk they don't control, FX exposure, regulatory/FDI limits). urgency and dimensions must reflect investor decision-making, not operational gaps.
For top5Priorities: each must be a deal-sourcing, IC approval, due diligence, term sheet, or exit preparation action. Timing = Quick Win / Medium-Term / Long-Term. Examples: "Identify top-3 anchor operator targets for minority stake", "Commission technical DD on shortlisted platforms", "Structure LP co-invest sleeve". NOT land, power, or construction steps.
For strategicRoadmap: 4 phases spanning market scan to exit. Phase 1 (0-3 months): Market scan & deal sourcing — mandate definition, advisor engagement, top-10 target list. Phase 2 (3-9 months): Due diligence & term sheet — technical DD, financial modelling, IC paper, LOI. Phase 3 (9-18 months): Investment close & value creation monitoring — SPA execution, board seat, operational KPI tracking. Phase 4 (18-36 months): Exit preparation — REIT/InvIT conversion readiness, strategic buyer outreach, secondary PE options. targetVision = target IRR achieved with clean exit at target multiple.

${NEW_SCHEMA_EXTENSION}`;

const PERSONA_SYSTEM_MAP = {
  builder:  COCKPIT_SYSTEM_BUILDER,
  expander: COCKPIT_SYSTEM_EXPANDER,
  operator: COCKPIT_SYSTEM_OPERATOR,
  investor: COCKPIT_SYSTEM_INVESTOR,
};

// ── Shared tooltip style ──────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  fontSize: 9,
  borderRadius: 8,
  border: '1px solid #D8DCE3',
  padding: '4px 8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  lineHeight: 1.4,
};
const TOOLTIP_ITEM_STYLE = { fontSize: 9, padding: '1px 0' };

// ── Helper Badge Components ───────────────────────────────────────────────────
function PotentialBadge({ potential }) {
  const map = { High: { bg: '#DCFCE7', color: '#16A34A' }, Medium: { bg: '#FEF3C7', color: '#D97706' }, Low: { bg: '#F0F2F5', color: '#6B7280' } };
  const s = map[potential] || map.Low;
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>{potential}</span>;
}

function UrgencyBadge({ urgency }) {
  const map = { Critical: { bg: '#FEE2E2', color: '#C8102E' }, High: { bg: '#FEF3C7', color: '#D97706' }, Medium: { bg: '#EBF5FF', color: KPMG_BLUE } };
  const s = map[urgency] || map.Medium;
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>{urgency}</span>;
}

function TimingBadge({ timing }) {
  const map = { 'Quick Win': { bg: '#DCFCE7', color: '#16A34A' }, 'Medium-Term': { bg: '#EBF5FF', color: KPMG_MID }, 'Long-Term': { bg: '#F0F2F5', color: '#6B7280' } };
  const s = map[timing] || map['Long-Term'];
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0" style={{ background: s.bg, color: s.color }}>{timing}</span>;
}

function CategoryBadge({ category }) {
  const map = { Hyperscaler: KPMG_BLUE, Operator: '#059669', Investor: '#D97706', Developer: '#7C3AED' };
  const color = map[category] || '#6B7280';
  return <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: `${color}18`, color }}>{category}</span>;
}

function RiskBadge({ risk }) {
  const map = { High: { bg: '#FEE2E2', color: '#C8102E' }, Medium: { bg: '#FEF3C7', color: '#D97706' }, Low: { bg: '#DCFCE7', color: '#16A34A' } };
  const s = map[risk] || map.Low;
  return <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: s.bg, color: s.color }}>{risk}</span>;
}

function PlayerRow({ player, rank }) {
  const catColors = { Hyperscaler: KPMG_BLUE, Operator: '#059669', Investor: '#D97706', Developer: '#7C3AED' };
  const color = catColors[player.category] || '#6B7280';
  const initials = (player.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {rank != null && <span className="text-[8px] font-black text-[#9CA3AF] w-3 flex-shrink-0">{rank}</span>}
      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white font-black" style={{ background: color, fontSize: 7 }}>{initials}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-bold text-[#1A1F36] truncate">{player.name}</p>
      </div>
      <CategoryBadge category={player.category} />
    </div>
  );
}

function RowLabel({ label }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0 py-0.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF] whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-[#D8DCE3]" />
    </div>
  );
}

function CockpitCard({ children, accentColor = KPMG_BLUE, onClick, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm h-full flex flex-col cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      style={{ border: '1px solid #D8DCE3', borderLeft: `4px solid ${accentColor}` }}
    >
      {children}
    </motion.div>
  );
}

// ── Card 1: Opportunity Funnel — SVG trapezoid ────────────────────────────────
function OpportunityFunnelCard({ data, onModal }) {
  const f = data.opportunityFunnel;
  if (!f) return null;
  const stages = (f.stages || []).slice(0, 3);

  const layerH = 30;
  const gap = 2;
  const viewW = 240;
  const topW = 220;
  const bottomW = 100;

  // Gradient colour pairs: [light, dark]
  const gradients = [
    ['#1E5FAD', '#00338D'],
    ['#005EB8', '#005B99'],
    ['#3A86D4', '#003080'],
  ];

  // Pick the most relevant headline KPI chip
  const kpiLabel = f.indiaSharePct2030
    ? { label: "India's 2030 global share", value: `${f.indiaSharePct2030}%` }
    : f.globalCagrPct
    ? { label: 'Global DC CAGR', value: `${f.globalCagrPct}%` }
    : null;

  return (
    <CockpitCard accentColor={KPMG_BLUE} onClick={() => onModal('opportunityFunnel', f)} delay={0.05}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${KPMG_BLUE}18` }}>
            <Filter size={11} style={{ color: KPMG_BLUE }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: KPMG_BLUE }}>Market Funnel</span>
        </div>

        {/* SVG trapezoid funnel with year labels */}
        <div className="flex-1 flex items-center relative" style={{ minHeight: 0 }}>
          {/* Year labels on left */}
          <div className="absolute left-0 flex flex-col justify-between h-full py-0" style={{ width: 32 }}>
            {stages.map((s, i) => s.year ? (
              <span
                key={i}
                className="text-[9px] font-bold text-[#9CA3AF]"
                style={{ position: 'absolute', top: `${(i / stages.length) * 100}%` }}
              >
                {s.year}
              </span>
            ) : null)}
          </div>

          {/* SVG */}
          <div className="flex-1 ml-8">
            <svg
              viewBox={`0 0 ${viewW} ${stages.length * layerH + (stages.length - 1) * gap}`}
              width="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ maxHeight: 140, filter: 'drop-shadow(0 3px 6px rgba(0,51,141,0.18))' }}
            >
              <defs>
                {gradients.map(([light, dark], i) => (
                  <linearGradient key={i} id={`funnelGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={light} />
                    <stop offset="100%" stopColor={dark} />
                  </linearGradient>
                ))}
              </defs>
              {stages.map((s, i) => {
                const t1 = i / stages.length;
                const t2 = (i + 1) / stages.length;
                const curTopW = topW - (topW - bottomW) * t1;
                const curBotW = topW - (topW - bottomW) * t2;
                const topX = (viewW - curTopW) / 2;
                const botX = (viewW - curBotW) / 2;
                const y = i * (layerH + gap);
                const points = `${topX},${y} ${topX + curTopW},${y} ${botX + curBotW},${y + layerH} ${botX},${y + layerH}`;

                return (
                  <g key={i}>
                    <polygon points={points} fill={`url(#funnelGrad${i})`} />
                    <text
                      x={viewW / 2}
                      y={y + layerH / 2 - (s.gw ? 4 : 0)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontWeight="700"
                      fontSize={s.isCagr ? 11 : 12}
                      letterSpacing="0.5"
                    >
                      {s.value}{s.isCagr ? ' CAGR ↑' : ''}
                    </text>
                    {s.gw && (
                      <text
                        x={viewW / 2}
                        y={y + layerH / 2 + 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="rgba(255,255,255,0.8)"
                        fontSize={9}
                        fontWeight="500"
                      >
                        {s.gw}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* KPI chip */}
        {kpiLabel && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg" style={{ background: `${KPMG_BLUE}0D` }}>
            <span className="text-[9px] font-semibold" style={{ color: KPMG_BLUE }}>{kpiLabel.value}</span>
            <span className="text-[8px] text-[#9CA3AF]">{kpiLabel.label}</span>
          </div>
        )}

        <p className="text-[8px] text-[#9CA3AF] mt-1.5 text-center">Click to expand</p>
      </div>
    </CockpitCard>
  );
}

// ── Card 2: Opportunity Areas — structured list ───────────────────────────────
function OpportunityAreasCard({ data, onModal }) {
  const oa = data.opportunityAreas;
  if (!oa) return null;
  const top3 = (oa.areas || []).slice(0, 3);
  const potDots = [{ label: 'High', color: '#059669' }, { label: 'Med', color: '#D97706' }, { label: 'Low', color: '#9CA3AF' }];

  return (
    <CockpitCard accentColor={KPMG_MID} onClick={() => onModal('opportunityAreas', oa)} delay={0.1}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${KPMG_MID}18` }}>
            <Map size={11} style={{ color: KPMG_MID }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: KPMG_MID }}>Opportunity Areas</span>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-1.5">
          {top3.map((a, i) => (
            <div key={i} className="flex items-start gap-2 pb-1.5 border-b border-[#F0F2F5] last:border-0">
              <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" style={{ color: '#059669' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#1A1F36] truncate">{a.title}</p>
                <p className="text-[8px] text-[#9CA3AF] truncate">{a.description}</p>
              </div>
              {i === 0 ? (
                <div className="flex gap-0.5 flex-shrink-0 items-center">
                  {potDots.map((d, j) => (
                    <div key={j} className="w-2 h-2 rounded-full" style={{ background: d.color }} title={d.label} />
                  ))}
                </div>
              ) : (
                <div className="flex-shrink-0 w-14">
                  <p className="text-[8px] text-[#9CA3AF] mb-0.5">Fit score</p>
                  <div className="h-1 bg-[#D8DCE3] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.score}%`, background: a.potential === 'High' ? '#059669' : a.potential === 'Medium' ? KPMG_MID : '#9CA3AF' }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[8px] text-[#9CA3AF] mt-2 text-center">Click to expand</p>
      </div>
    </CockpitCard>
  );
}

// ── Card 3: Competitive Landscape — two-column list ───────────────────────────
function CompetitiveLandscapeCard({ data, onModal }) {
  const cl = data.competitiveLandscape;
  if (!cl) return null;
  const leaders  = (cl.players || []).filter(p => p.leaderTier === 'Leader').slice(0, 5);
  const emerging = (cl.players || []).filter(p => p.leaderTier === 'Emerging').slice(0, 5);

  return (
    <CockpitCard accentColor={KPMG_BLUE} onClick={() => onModal('competitiveLandscape', { ...cl, profile: data.profile })} delay={0.15}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${KPMG_BLUE}18` }}>
            <Crosshair size={11} style={{ color: KPMG_BLUE }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: KPMG_BLUE }}>Competitive Landscape</span>
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
          <div>
            <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Top Leaders</p>
            <div className="space-y-0.5">
              {leaders.map((p, i) => <PlayerRow key={i} player={p} rank={i + 1} />)}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Emerging Players</p>
            <div className="space-y-0.5">
              {emerging.map((p, i) => <PlayerRow key={i} player={p} rank={null} />)}
            </div>
          </div>
        </div>

        <p className="text-[8px] text-[#9CA3AF] mt-2 text-center">Click to expand</p>
      </div>
    </CockpitCard>
  );
}

// ── Card 4: Client Focus — profile card ───────────────────────────────────────
function ClientFocusCard({ data, onModal }) {
  const cf = data.clientFocus;
  if (!cf) return null;
  const cp = cf.clientProfile || {};
  const pc = PROFILE_CONFIG[data.profile];
  const initials = (data.clientName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <CockpitCard accentColor={KPMG_BLUE} onClick={() => onModal('clientFocus', cf)} delay={0.2}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${KPMG_BLUE}18` }}>
            <Flag size={11} style={{ color: KPMG_BLUE }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: KPMG_BLUE }}>Client Focus</span>
        </div>

        {/* Client name + avatar */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-black" style={{ background: KPMG_BLUE, fontSize: 13 }}>
            {initials}
          </div>
          <div>
            <p className="font-black text-[13px] text-[#1A1F36] leading-tight" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{data.clientName}</p>
            {pc && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.color }}>{pc.label}</span>
            )}
          </div>
        </div>

        {/* Profile fields */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] mb-2 flex-1">
          <div><span className="text-[#9CA3AF]">Sector: </span><span className="text-[#374151] font-medium">{cp.sector}</span></div>
          <div><span className="text-[#9CA3AF]">HQ: </span><span className="text-[#374151] font-medium">{cp.hq}</span></div>
          <div><span className="text-[#9CA3AF]">Revenue: </span><span className="text-[#374151] font-medium">{cp.revenue}</span></div>
          {cp.coreStrengths && (
            <div className="col-span-2"><span className="text-[#9CA3AF]">Core Strengths: </span><span className="text-[#374151] font-medium">{cp.coreStrengths}</span></div>
          )}
        </div>

        {/* Strategic rationale */}
        {cp.strategicRationale && (
          <div className="border-l-2 pl-2 mt-auto" style={{ borderColor: KPMG_MID }}>
            <p className="text-[8px] text-[#6B7280] italic leading-snug line-clamp-2">"{cp.strategicRationale}"</p>
          </div>
        )}

        <p className="text-[8px] text-[#9CA3AF] mt-2 text-center">Click to expand</p>
      </div>
    </CockpitCard>
  );
}

// ── Card 5: Top 5 Priorities — clean numbered list ────────────────────────────
function Top5PrioritiesCard({ data, onModal }) {
  const tp = data.top5Priorities;
  if (!tp) return null;
  const priorities = tp.priorities || [];

  return (
    <CockpitCard accentColor='#059669' onClick={() => onModal('top5Priorities', tp)} delay={0.25}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#05966918' }}>
            <ListOrdered size={11} style={{ color: '#059669' }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#059669' }}>Top 5 Priorities</span>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-1">
          {priorities.map((p, i) => (
            <div key={i} className="flex items-center gap-2 pb-1 border-b border-[#F0F2F5] last:border-0">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
                style={{ background: KPMG_BLUE, opacity: 1 - i * 0.15, fontSize: 9 }}
              >
                {p.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#1A1F36] truncate">{p.title}</p>
                <p className="text-[8px] text-[#9CA3AF] truncate">{p.description}</p>
              </div>
              <TimingBadge timing={p.timing} />
            </div>
          ))}
        </div>

        <p className="text-[8px] text-[#9CA3AF] mt-2 text-center">Click to expand</p>
      </div>
    </CockpitCard>
  );
}

// ── Card 6: Strategic Roadmap — 2×2 grid + target vision banner ───────────────
function StrategicRoadmapCard({ data, onModal }) {
  const sr = data.strategicRoadmap;
  if (!sr) return null;
  const phases = sr.phases || [];
  const phaseColors = [
    { bg: '#E8EEF8', border: '#B3C6E0', label: '#00338D', dot: '#00338D' },
    { bg: '#d3eeff', border: '#9ed8ff', label: '#0b9bfc', dot: '#0c91ea'},
    { bg: '#D6E8F4', border: '#7DAECF', label: '#005EB8', dot: '#005EB8' },
    { bg: '#F5F3FF', border: '#DDD6FE', label: '#6D28D9', dot: '#7C3AED' },
  ];

  return (
    <CockpitCard accentColor='#D97706' onClick={() => onModal('strategicRoadmap', sr)} delay={0.3}>
      <div className="p-3 flex flex-col h-full gap-2">
        {/* Header */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#D9770618' }}>
            <Navigation size={11} style={{ color: '#D97706' }} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#D97706' }}>Strategic Roadmap</span>
        </div>

        {/* 2×2 Phase grid */}
        <div className="grid grid-cols-2 gap-1.5 flex-1 min-h-0">
          {phases.slice(0, 4).map((ph, i) => {
            const c = phaseColors[i];
            return (
              <div
                key={i}
                className="rounded-lg p-2.5 flex flex-col justify-center min-h-0"
                style={{ background: c.bg, border: `1px solid ${c.border}` }}
              >
                <span className="font-black text-[8px] leading-none mb-1" style={{ color: c.label }}>{ph.phase}</span>
                <p className="font-bold text-[10px] leading-snug" style={{ color: c.label }}>{ph.title || ph.phase}</p>
                <span className="text-[8px] font-semibold mt-1" style={{ color: c.dot }}>{ph.duration}</span>
              </div>
            );
          })}
        </div>

        {/* Target Vision banner — compact single line */}
        <div
          className="flex-shrink-0 rounded-md px-2 py-1 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(90deg, #D9770612 0%, #D9770608 100%)', border: '1px solid #D9770630' }}
        >
          <Star size={8} style={{ color: '#D97706', flexShrink: 0 }} />
          <p className="text-[7px] leading-snug min-w-0" style={{ color: '#374151' }}>
            <span className="font-black uppercase tracking-wide" style={{ color: '#D97706' }}>Vision · </span>
            {sr.targetVision}
          </p>
        </div>

        <p className="text-[8px] text-[#9CA3AF] text-center flex-shrink-0">Click to expand</p>
      </div>
    </CockpitCard>
  );
}

// ── Modal: Opportunity Funnel ─────────────────────────────────────────────────

function FunnelModalContent({ payload: f, clientName }) {
  const phases    = f.phases    || [];
  const metrics   = f.marketMetrics || {};
  const projData  = f.projectionData || [];
  const segChart  = f.subSegmentChartData || [];
  const implics   = f.keyImplications || [];

  const funnelRows = phases.flatMap(ph =>
    ph.subSegments?.map(ss => ({ ...ss, phaseLabel: ph.label, phaseValue: ph.value })) || []
  );
  const totalRows   = funnelRows.length || 1;
  const PH          = 28;   // phase header row height
  const ROW_H       = 52;   // data row height
  const COL_H       = 28;   // column header height (spacer above funnel/connector)
  const phase1Count = phases[0]?.subSegments?.length || 0;
  // funnel + connector body height = full table body height (phase headers included)
  const BODY_H      = Math.max(phases.length * PH + totalRows * ROW_H, 100);
  const SVG_H       = BODY_H;
  const segH        = BODY_H / totalRows;   // each funnel segment fills evenly

  // Y-center of flat row i inside the connector/table body (below the column header)
  const rowY = (i) => i < phase1Count
    ? PH + i * ROW_H + ROW_H / 2
    : PH + phase1Count * ROW_H + PH + (i - phase1Count) * ROW_H + ROW_H / 2;

  const metricCards = [
    { label: 'Global Market CAGR (Total)',      value: metrics.globalCagrPct    != null ? `${metrics.globalCagrPct}%`    : '—', up: true },
    { label: 'Hyperscaler Segment CAGR',        value: metrics.hypCagrPct       != null ? `e.g. ${metrics.hypCagrPct}%`  : '—', up: true },
    { label: 'Colocation Segment CAGR',         value: metrics.coloCagrPct      != null ? `e.g. ${metrics.coloCagrPct}%` : '—', up: true },
    { label: 'Projected Indian Market Share',   value: metrics.indiaSharePct2030 != null ? `${metrics.indiaSharePct2030}% (2030)` : '—', up: false },
  ];

  return (
    <div className="flex gap-5" style={{ minHeight: 520 }}>

      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div className="flex-[3] flex flex-col gap-4 min-w-0">

        {/* Funnel SVG + connector arrows + sub-segment table */}
        <div className="flex items-start" style={{ gap: 0 }}>

          {/* SVG funnel — height fills full table body including phase headers */}
          <div className="flex-shrink-0" style={{ width: 280 }}>
            <div style={{ height: COL_H }} className="flex items-center">
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                Total Addressable Market (TAM)
              </p>
            </div>
            <div className="relative">
              {/* Year labels */}
              <div className="absolute left-0 top-0" style={{ height: BODY_H }}>
                {phases.map((ph, pi) => {
                  const rowsBefore = phases.slice(0, pi).reduce((a, p) => a + (p.subSegments?.length || 0), 0);
                  const rowsThis   = ph.subSegments?.length || 1;
                  const yCenter    = (rowsBefore + rowsThis / 2) * segH;
                  return (
                    <div key={pi} style={{ position: 'absolute', top: yCenter - 8 }}>
                      <span className="text-[9px] font-bold text-[#9CA3AF]">
                        {pi === 0 ? '2026' : '2030'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <svg viewBox={`0 0 220 ${BODY_H}`} width="100%" height={BODY_H} style={{ marginLeft: 28 }}>
                {funnelRows.map((_, i) => {
                  const maxW = 196;
                  const minW = maxW * 0.35;
                  const topW = maxW - i * ((maxW - minW) / Math.max(totalRows - 1, 1));
                  const botW = maxW - (i + 1) * ((maxW - minW) / Math.max(totalRows - 1, 1));
                  const topX = (220 - topW) / 2;
                  const botX = (220 - botW) / 2;
                  const y    = i * segH;
                  const pts  = `${topX},${y + 1} ${topX + topW},${y + 1} ${botX + botW},${y + segH - 1} ${botX},${y + segH - 1}`;
                  const isPhase1 = i < phase1Count;
                  return (
                    <g key={i}>
                      <polygon points={pts} fill={isPhase1 ? KPMG_BLUE : KPMG_MID} opacity={1 - i * 0.07} />
                    </g>
                  );
                })}
                {phases.map((ph, pi) => {
                  const rowsBefore = phases.slice(0, pi).reduce((a, p) => a + (p.subSegments?.length || 0), 0);
                  const rowsThis   = ph.subSegments?.length || 1;
                  const yCenter    = (rowsBefore + rowsThis / 2) * segH;
                  return (
                    <text key={`ph-${pi}`} x="110" y={yCenter + 7} textAnchor="middle"
                      fill="white" fontWeight="900" fontSize={16}
                      stroke={pi === 0 ? KPMG_BLUE : KPMG_MID}
                      strokeWidth="10" strokeLinejoin="round"
                      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", paintOrder: 'stroke' }}>
                      {ph.value}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Connector arrows — Y positions account for phase header rows */}
          <div className="flex-shrink-0" style={{ width: 28 }}>
            <div style={{ height: COL_H }} />
            <svg width="28" height={BODY_H} style={{ overflow: 'visible' }}>
              <defs>
                <marker id="seg-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <polygon points="0 0, 5 2.5, 0 5" fill={KPMG_BLUE} />
                </marker>
              </defs>
              {funnelRows.map((_, i) => (
                <line key={i}
                  x1="0" y1={rowY(i)}
                  x2="24" y2={rowY(i)}
                  stroke={KPMG_BLUE}
                  strokeWidth="0.5"
                  opacity="0.4"
                  markerEnd="url(#seg-arrow)"
                />
              ))}
            </svg>
          </div>

          {/* Sub-segment table — phase headers restored, data rows at ROW_H */}
          <div className="flex-1 min-w-0 overflow-hidden rounded-xl border border-[#D8DCE3]">
            {/* Column header */}
            <div className="grid text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wide bg-[#F8FAFD] border-b border-[#D8DCE3] items-center"
              style={{ gridTemplateColumns: '1fr auto auto', height: COL_H }}>
              <span className="px-3">Sub-segment (TAM, 2026)</span>
              <span className="px-2 text-right">Revenue</span>
              <span className="px-3 text-right">Cap. (GW)</span>
            </div>
            {phases.map((ph, pi) => (
              <div key={pi}>
                {/* Phase group header */}
                <div className="px-3 flex items-center text-[9px] font-bold uppercase tracking-widest"
                  style={{ height: PH, background: pi === 0 ? `${KPMG_BLUE}12` : `${KPMG_MID}10`, color: pi === 0 ? KPMG_BLUE : KPMG_MID }}>
                  {ph.label}
                </div>
                {/* Data rows */}
                {(ph.subSegments || []).map((ss, si) => (
                  <div key={si} className="grid items-center border-b border-[#F0F4F8] last:border-0"
                    style={{ gridTemplateColumns: '1fr auto auto', height: ROW_H, background: si % 2 === 0 ? 'white' : '#FAFBFD' }}>
                    <div className="px-3">
                      <p className="text-[10px] font-semibold text-[#1A1F36] leading-tight">{ss.name}</p>
                      <p className="text-[9px] text-[#9CA3AF]">{ss.description}</p>
                    </div>
                    <span className="px-2 text-[10px] font-bold text-right" style={{ color: KPMG_BLUE }}>{ss.revenue}</span>
                    <span className="px-3 text-[10px] font-semibold text-[#6B7280] text-right whitespace-nowrap">{ss.capacityGw} GW</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Sub-segment revenue vs CapEx chart */}
        {segChart.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">
              Sub-Segment Revenue vs. Capital Intensity
            </p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={segChart} margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickFormatter={v => `$${v}B`} width={36} />
                  <YAxis yAxisId="capex" orientation="right" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickFormatter={v => `$${v}B`} width={36} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE}
                    formatter={(val, name) => [`$${val}B`, name === 'revenue2026' ? 'Rev 2026' : name === 'revenue2030' ? 'Rev 2030' : 'CapEx']}
                  />
                  <Bar yAxisId="rev" dataKey="revenue2026" name="Revenue 2026" fill={KPMG_BLUE} radius={[3,3,0,0]} barSize={18} />
                  <Bar yAxisId="rev" dataKey="revenue2030" name="Revenue 2030" fill={KPMG_MID}  radius={[3,3,0,0]} barSize={18} />
                  <Line yAxisId="capex" type="monotone" dataKey="capexBn" name="CapEx" stroke="#D97706" strokeWidth={2} dot={{ r: 4, fill: '#D97706' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-1 justify-center">
              {[
                { color: KPMG_BLUE, label: 'Revenue 2026' },
                { color: KPMG_MID,  label: 'Revenue 2030' },
                { color: '#D97706', label: 'CapEx (each)',  line: true },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {l.line
                    ? <svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke={l.color} strokeWidth="2" /><circle cx="7" cy="4" r="2.5" fill={l.color} /></svg>
                    : <div className="w-3 h-2.5 rounded-sm" style={{ background: l.color }} />}
                  <span className="text-[9px] text-[#6B7280]">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────── */}
      <div className="flex-[2] flex flex-col gap-4 min-w-0">

        {/* CAGR metric cards */}
        <div className="grid grid-cols-1 gap-2">
          {metricCards.map((m, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: `${KPMG_BLUE}06`, border: `1px solid ${KPMG_BLUE}15` }}>
              <span className="text-[10px] text-[#6B7280]">{m.label}</span>
              <span className="text-[12px] font-extrabold flex items-center gap-0.5" style={{ color: KPMG_BLUE, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {m.value}
                {m.up && <span className="text-green-500 text-[11px]">↑</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Market size projections chart */}
        {projData.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">
              Market Size Projections (2026-2030)
            </p>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projData} margin={{ top: 4, right: 36, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#9CA3AF' }} />
                  <YAxis yAxisId="mkt" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickFormatter={v => `$${v}B`} width={32} />
                  <YAxis yAxisId="gw" orientation="right" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickFormatter={v => `${v} Tn`} width={32} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  <Line yAxisId="mkt" type="monotone" dataKey="totalMarket" name="Total market ($)" stroke={KPMG_BLUE}  strokeWidth={2} dot={false} />
                  <Line yAxisId="mkt" type="monotone" dataKey="aiTraining"  name="AI Training"      stroke="#059669"   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line yAxisId="mkt" type="monotone" dataKey="colocation"  name="Colocation"       stroke={KPMG_MID}  strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line yAxisId="gw"  type="monotone" dataKey="capacityGw"  name="Capacity (GW)"    stroke="#D97706"   strokeWidth={1.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
              {[
                { color: KPMG_BLUE, label: 'Total market ($)' },
                { color: '#059669', label: 'AI Training' },
                { color: KPMG_MID,  label: 'Colocation' },
                { color: '#D97706', label: 'Capacity' },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded" style={{ background: l.color }} />
                  <span className="text-[8px] text-[#9CA3AF]">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key strategic implications */}
        {implics.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: `${KPMG_BLUE}06`, border: `1px solid ${KPMG_BLUE}15` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: KPMG_BLUE }}>
              Key Strategic Implications
            </p>
            <ul className="space-y-1.5">
              {implics.map((imp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: KPMG_BLUE }} />
                  <span className="text-[10px] text-[#374151] leading-snug">{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal: Opportunity Areas — rich 3-column layout ───────────────────────────
function OpportunityAreasModalContent({ payload: oa, clientName }) {
  const areas = oa.areas || [];
  const ra = oa.recommendedApproach;
  const raColors = [KPMG_BLUE, KPMG_MID, '#8BC6F0'];

  const donutData = (ra?.allocation || []).map((a, i) => ({
    name: a.label, value: a.pct, fill: raColors[i] || '#9CA3AF',
  }));

  const barData = areas.map(a => ({
    name: a.title?.slice(0, 16) || '',
    capex: a.capexCr || 0,
    revenue: a.revenue5yrCr || 0,
  }));

  return (
    <div className="space-y-5">
      {/* Header subtitle */}
      <p className="text-[10px] text-[#9CA3AF]">
        India Data Centre Market · Addressable opportunity analysis for {clientName || 'client'} · As of {new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
      </p>

      {/* 3-column per-area section */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(areas.length, 3)}, 1fr)` }}>
        {areas.slice(0, 3).map((a, i) => {
          const radarData = (a.radarDimensions || []).map(d => ({ subject: d.label, score: d.score, fullMark: 100 }));
          return (
            <div key={i} className="border border-[#D8DCE3] rounded-xl overflow-hidden">
              {/* Area header */}
              <div className="px-3 py-2 flex items-start gap-2" style={{ background: `${KPMG_BLUE}06` }}>
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: a.potential === 'High' ? '#059669' : a.potential === 'Medium' ? '#D97706' : '#9CA3AF' }} />
                <div>
                  <p className="text-[11px] font-bold text-[#1A1F36]">{a.title}</p>
                  <p className="text-[9px] text-[#6B7280]">{a.description}</p>
                </div>
              </div>

              {/* Radar chart */}
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                    <PolarGrid stroke="#D8DCE3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#6B7280' }} />
                    <Radar dataKey="score" stroke={KPMG_MID} fill={KPMG_MID} fillOpacity={0.2} />
                    <Tooltip formatter={(v) => [`${v}/100`]} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* KPI tiles */}
              <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                {(a.kpis || []).map((kpi, j) => (
                  <div key={j} className="rounded-lg p-1.5 text-center" style={{ background: `${KPMG_BLUE}08` }}>
                    <p className="text-[7px] text-[#9CA3AF] leading-tight mb-0.5">{kpi.label}</p>
                    <p className="text-[9px] font-black text-[#1A1F36]">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Sub-opportunities */}
              <div className="px-2 pb-2">
                <p className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Top sub-opportunities</p>
                {(a.subOpportunities || []).map((sub, j) => (
                  <div key={j} className="flex items-center gap-1.5 mb-1">
                    <div className="flex-1 h-1 bg-[#D8DCE3] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${j === 0 ? 80 : j === 1 ? 60 : j === 2 ? 45 : 35}%`, background: KPMG_MID }} />
                    </div>
                    <RiskBadge risk={sub.risk} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom section: investment comparison + recommended approach */}
      <div className="flex gap-4">
        {/* Investment vs Return bar chart */}
        <div className="flex-[3]">
          <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Investment vs. Return Comparison</p>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm" style={{ background: KPMG_BLUE }} /><span className="text-[9px] text-[#6B7280]">Estimated Capex (₹ Cr)</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm" style={{ background: KPMG_MID }} /><span className="text-[9px] text-[#6B7280]">Projected 5-Year Revenue (₹ Cr)</span></div>
          </div>
          <div style={{ height: areas.length * 52 + 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Bar dataKey="capex"   name="Capex"   fill={KPMG_BLUE} radius={3} barSize={12} />
                <Bar dataKey="revenue" name="Revenue" fill={KPMG_MID}  radius={3} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recommended Approach */}
        {ra && (
          <div className="flex-[2] rounded-xl p-4" style={{ background: '#F8FAFD', border: '1px solid #D8DCE3' }}>
            <p className="text-[11px] font-bold text-[#1A1F36] mb-3">Recommended Approach</p>
            {/* Donut */}
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}%`]} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Bullets */}
            <ul className="space-y-1 mb-3">
              {(ra.bullets || []).map((b, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: KPMG_BLUE }} />
                  <span className="text-[9px] text-[#374151]">{b}</span>
                </li>
              ))}
            </ul>
            {/* Confidence level */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-[#9CA3AF]">Confidence Level</span>
                <span className="text-[10px] font-bold" style={{ color: KPMG_BLUE }}>{ra.confidenceLevel}%</span>
              </div>
              <div className="h-1.5 bg-[#D8DCE3] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${ra.confidenceLevel}%`, background: KPMG_BLUE }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Competitive Landscape Helpers ─────────────────────────────────────────────
function getPanelTitles(profile) {
  const map = {
    new: {
      leadersMap:     'Top 5 Leaders – Market Leader Map',
      emergingMatrix: 'Emerging Players – Opportunity Matrix',
      radar:          'Group Synergy & Relative Positioning',
      trend:          'Leader Market Share Trend (2023–2026)',
      gaps:           'Market Segment Gaps & Opportunities',
      jv:             'Potential Joint Ventures & Partners',
    },
    expansion: {
      leadersMap:     'Top 5 Leaders – Expansion Leader Map',
      emergingMatrix: 'Emerging Targets – Acquisition Matrix',
      radar:          'Expansion Synergy & Relative Positioning',
      trend:          'Expansion Activity Trend (2023–2026)',
      gaps:           'Expansion Gaps & Opportunities',
      jv:             'Potential Acquisition & JV Targets',
    },
    investor: {
      leadersMap:     'Top 5 Investors – Capital Deployment Map',
      emergingMatrix: 'Emerging Themes – Investment Matrix',
      radar:          'Portfolio Synergy & Relative Positioning',
      trend:          'Capital Deployment Trend (2023–2026)',
      gaps:           'Investment Gaps & Alpha Opportunities',
      jv:             'Co-investment Partners',
    },
    ops: {
      leadersMap:     'Top 5 Operators – Operational Leader Map',
      emergingMatrix: 'Emerging Benchmarks – Ops Matrix',
      radar:          'Operational Synergy & Relative Positioning',
      trend:          'Operational Benchmark Trend (2023–2026)',
      gaps:           'Operational Gaps & Improvement Areas',
      jv:             'Technology & Ops Partners',
    },
  };
  return map[profile] || map.new;
}

function EmergingQuadrantPanel({ players, profile }) {
  const W = 240;
  const H = 190;
  const PAD = { top: 18, right: 12, bottom: 20, left: 20 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const midX = PAD.left + innerW / 2;
  const midY = PAD.top + innerH / 2;

  const isInvestor = profile === 'investor';
  const axisY = isInvestor ? 'AUM / Capital' : 'Funding';
  const axisX = isInvestor ? 'Thesis Innovation →' : 'Tech Innovation →';
  const qLabels = ['Disruptor', 'Niche Player', 'Consolidator', 'Consolidator'];

  // Quadrant center anchors [qx, qy] — used for fallback spread
  const quadCenters = [
    [30, 72], [70, 72],
    [30, 28], [70, 28],
  ];
  const detJitter = (seed, range) => ((seed * 37 + 13) % range) - range / 2;

  // Check if all players cluster in same quadrant (all X same side AND all Y same side)
  const withRaw = players.map((p, i) => ({
    ...p,
    rawX: typeof p.quadrantX === 'number' ? p.quadrantX : null,
    rawY: typeof p.quadrantY === 'number' ? p.quadrantY : null,
    idx: i,
  }));
  const hasCoords = withRaw.filter(p => p.rawX !== null && p.rawY !== null);
  const allClustered = hasCoords.length > 1 && hasCoords.every(p =>
    (p.rawX > 50) === (hasCoords[0].rawX > 50) &&
    (p.rawY > 50) === (hasCoords[0].rawY > 50)
  );

  const positioned = withRaw.map((p, i) => {
    if (allClustered || p.rawX === null || p.rawY === null) {
      const [cx, cy] = quadCenters[i % 4];
      return { ...p, qx: cx + detJitter(i, 18), qy: cy + detJitter(i + 5, 18) };
    }
    return { ...p, qx: p.rawX, qy: p.rawY };
  });

  // Abbreviate name: first word + first char of last word if multi-word, max 12 chars
  const abbrevName = (name = '') => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    const first = words[0];
    if (words.length === 1) return first.slice(0, 12);
    const last = words[words.length - 1];
    const candidate = `${first} ${last[0]}.`;
    return candidate.length <= 13 ? candidate : first.slice(0, 12);
  };

  const dotColors = { Leader: KPMG_BLUE, Emerging: KPMG_MID };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 190 }}>
      {/* Quadrant backgrounds */}
      <rect x={PAD.left} y={PAD.top} width={innerW / 2} height={innerH / 2} fill="#EBF5FF" opacity={0.6} rx={2} />
      <rect x={midX} y={PAD.top} width={innerW / 2} height={innerH / 2} fill="#ECFDF5" opacity={0.6} rx={2} />
      <rect x={PAD.left} y={midY} width={innerW / 2} height={innerH / 2} fill="#F8FAFD" opacity={0.6} rx={2} />
      <rect x={midX} y={midY} width={innerW / 2} height={innerH / 2} fill="#FFF7ED" opacity={0.6} rx={2} />

      {/* Grid */}
      <line x1={PAD.left} y1={midY} x2={PAD.left + innerW} y2={midY} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={midX} y1={PAD.top} x2={midX} y2={PAD.top + innerH} stroke="#D1D5DB" strokeWidth={1} strokeDasharray="3 3" />
      <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="none" stroke="#D8DCE3" strokeWidth={1} rx={2} />

      {/* Quadrant labels */}
      <text x={PAD.left + 5} y={PAD.top + 9} fontSize={6} fontWeight="700" fill="#374151">{qLabels[0]}</text>
      <text x={PAD.left + innerW - 5} y={PAD.top + 9} fontSize={6} fontWeight="700" fill="#374151" textAnchor="end">{qLabels[1]}</text>
      <text x={PAD.left + 5} y={PAD.top + innerH - 4} fontSize={6} fontWeight="700" fill="#9CA3AF">{qLabels[2]}</text>
      <text x={PAD.left + innerW - 5} y={PAD.top + innerH - 4} fontSize={6} fontWeight="700" fill="#9CA3AF" textAnchor="end">{qLabels[3]}</text>

      {/* Axis labels */}
      <text x={PAD.left + innerW / 2} y={H - 4} fontSize={7} fill="#9CA3AF" textAnchor="middle">{axisX}</text>
      <text x={8} y={PAD.top + innerH / 2} fontSize={7} fill="#9CA3AF" textAnchor="middle" transform={`rotate(-90, 8, ${PAD.top + innerH / 2})`}>{axisY}</text>

      {/* Player dots with abbreviated names */}
      {positioned.map((p, i) => {
        const dotX = PAD.left + (p.qx / 100) * innerW;
        const dotY = PAD.top + (1 - p.qy / 100) * innerH;
        const label = abbrevName(p.name);
        const fill = dotColors[p.leaderTier] || KPMG_MID;
        // Alternate label above/below to reduce overlap
        const labelAbove = i % 2 === 0;
        const labelY = labelAbove ? dotY - 6 : dotY + 13;
        return (
          <g key={i}>
            <circle cx={dotX} cy={dotY} r={4} fill={fill} opacity={0.85} />
            <text
              x={dotX} y={labelY}
              fontSize={6} fill="#1A1F36"
              textAnchor="middle" fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Modal: Competitive Landscape ─────────────────────────────────────────────
function CompetitiveLandscapeModalContent({ payload: cl, profile, clientName }) {
  const players  = cl.players || [];
  const leaders  = players.filter(p => p.leaderTier === 'Leader');
  const emerging = players.filter(p => p.leaderTier === 'Emerging');
  const client   = cl.clientPositioning;
  const titles   = getPanelTitles(profile);
  const tierColors = { 'Tier 1': KPMG_BLUE, 'Tier 2': KPMG_MID, 'Tier 3': '#8BC6F0' };
  const trendPalette = [KPMG_BLUE, KPMG_MID, '#8BC6F0', '#059669'];

  const leaderDots = [
    ...leaders.map(p => ({ x: p.marketPresence || 0, y: p.capability || 0, name: p.name, fill: tierColors[p.tier] || '#9CA3AF', mw: p.capacityMW, isClient: false })),
    ...(client ? [{ x: client.marketPresence || 50, y: client.capability || 50, name: client.label || clientName || 'Client', fill: '#C8102E', mw: 0, isClient: true }] : []),
  ];

  const LeaderDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const words = (payload.name || '?').trim().split(/\s+/).filter(Boolean);
    const initials = words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : (words[0] || '?').slice(0, 2).toUpperCase();
    const r = payload.isClient ? 10 : 8;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={payload.fill} opacity={0.9} />
        {payload.isClient && <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#C8102E" strokeWidth={1.5} strokeDasharray="3 2" />}
        <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={6.5} fill="white" fontWeight="900">{initials}</text>
      </g>
    );
  };

  const radarData = (cl.radarDimensions || []).map(d => ({
    subject: d.axis, client: d.clientScore || 0, leader: d.leaderAvg || 0, fullMark: 100,
  }));

  const trend = cl.marketShareTrend || { years: [], series: [] };
  const trendData = trend.years.map((yr, i) => {
    const entry = { year: String(yr) };
    (trend.series || []).forEach(s => { entry[s.name] = s.data?.[i] || 0; });
    return entry;
  });

  const leaderStats = cl.leaderStats || {};

  const PanelHeader = ({ title, subtitle }) => (
    <div className="mb-2">
      <p className="text-[8.5px] font-black uppercase tracking-widest leading-tight" style={{ color: KPMG_BLUE }}>{title}</p>
      {subtitle && <p className="text-[8px] text-[#9CA3AF] mt-0.5">{subtitle}</p>}
    </div>
  );

  return (
    <div>
      {cl.summary && <p className="text-[11px] text-[#374151] leading-relaxed mb-3 pb-3 border-b border-[#D8DCE3]">{cl.summary}</p>}
      <div className="grid grid-cols-3 gap-3">

        {/* Panel 1 – Leaders Scatter Map */}
        <div className="bg-[#F8FAFD] rounded-xl p-3 border border-[#D8DCE3]">
          <PanelHeader
            title={titles.leadersMap}
            subtitle={`${clientName || 'Client'} from ${leaders.length} Group`}
          />
          <div style={{ height: 170 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 14, right: 10, bottom: 22, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis type="number" dataKey="x" domain={[0, 100]} label={{ value: 'Digital Capabilities →', position: 'insideBottom', offset: -12, fontSize: 7.5, fill: '#9CA3AF' }} tick={{ fontSize: 7 }} />
                <YAxis type="number" dataKey="y" domain={[0, 100]} label={{ value: 'Market Presence', angle: -90, position: 'insideLeft', offset: 10, fontSize: 7.5, fill: '#9CA3AF' }} tick={{ fontSize: 7 }} />
                <ReferenceLine x={50} stroke="#D8DCE3" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="#D8DCE3" strokeDasharray="4 4" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-[#D8DCE3] rounded-lg p-1.5 shadow-lg">
                      <p className="text-[10px] font-bold text-[#1A1F36]">{d?.name}</p>
                      {d?.mw > 0 && <p className="text-[9px] text-[#6B7280]">{d.mw} MW</p>}
                    </div>
                  );
                }} />
                <Scatter data={leaderDots} shape={<LeaderDot />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {leaderStats.group1 && leaderStats.group2 && (
            <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-[#D8DCE3]">
              <div className="text-[8px]">
                <span className="font-black" style={{ color: '#16A34A' }}>↑ Key {leaderStats.group1.key}</span>
                <span className="text-[#9CA3AF] ml-1">H. - {leaderStats.group1.h}</span>
              </div>
              <div className="text-[8px]">
                <span className="font-black" style={{ color: '#D97706' }}>↑ Key {leaderStats.group2.key}</span>
                <span className="text-[#9CA3AF] ml-1">H. - {leaderStats.group2.h}</span>
              </div>
            </div>
          )}
        </div>

        {/* Panel 2 – Emerging Quadrant Matrix */}
        <div className="bg-[#F8FAFD] rounded-xl p-3 border border-[#D8DCE3]">
          <PanelHeader
            title={titles.emergingMatrix}
            subtitle={`${players.length} Players across ${4} Quadrants`}
          />
          <EmergingQuadrantPanel players={players} profile={profile} />
        </div>

        {/* Panel 3 – Radar */}
        <div className="bg-[#F8FAFD] rounded-xl p-3 border border-[#D8DCE3]">
          <PanelHeader
            title={titles.radar}
            subtitle={`${clientName || 'Client'} vs. Market-Wide Capabilities`}
          />
          {radarData.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
                  <PolarGrid stroke="#D8DCE3" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 7.5, fill: '#6B7280' }} />
                  <Radar name={clientName || 'Client'} dataKey="client" stroke="#0E9F8A" fill="#0E9F8A" fillOpacity={0.25} strokeWidth={1.5} dot={{ r: 2, fill: '#0E9F8A' }} />
                  <Radar name="Leader Average" dataKey="leader" stroke={KPMG_BLUE} fill={KPMG_BLUE} fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2, fill: KPMG_BLUE }} />
                  <Legend wrapperStyle={{ fontSize: 8, paddingTop: 4 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[9px] text-[#9CA3AF] mt-4 text-center">Radar data loading…</p>
          )}
        </div>

        {/* Panel 4 – Market Share Trend */}
        <div className="bg-[#F8FAFD] rounded-xl p-3 border border-[#D8DCE3]">
          <PanelHeader title={titles.trend} />
          {trendData.length > 0 ? (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} stackOffset="expand" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="year" tick={{ fontSize: 8 }} />
                  <YAxis tickFormatter={v => `${Math.round(v * 100)}%`} tick={{ fontSize: 8 }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background: 'white', border: '1px solid #D8DCE3', borderRadius: 8, padding: '5px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', maxWidth: 160 }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#1A1F36', marginBottom: 3 }}>{label}</p>
                        {payload.map((entry, i) => {
                          const short = (entry.name || '').replace(/\(.*?\)/g, '').trim().split(/[\s+]/)[0].slice(0, 14);
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 8, color: '#6B7280', flex: 1 }}>{short}</span>
                              <span style={{ fontSize: 8, fontWeight: 700, color: '#1A1F36' }}>{(entry.value * 100).toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }} />
                  {(trend.series || []).map((s, i) => (
                    <Area key={s.name} type="monotone" dataKey={s.name} stackId="1"
                      stroke={trendPalette[i % trendPalette.length]}
                      fill={trendPalette[i % trendPalette.length]}
                      fillOpacity={0.75} strokeWidth={1} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 7.5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[9px] text-[#9CA3AF] mt-4 text-center">Trend data loading…</p>
          )}
        </div>

        {/* Panel 5 – Key Advantages + Potential Threats */}
        <div className="bg-[#F8FAFD] rounded-xl p-3 border border-[#D8DCE3] flex flex-col gap-2.5">
          <div>
            <p className="text-[8.5px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#16A34A' }}>Key Advantages</p>
            <ul className="space-y-1.5">
              {(cl.keyAdvantages || []).map((adv, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: '#16A34A' }} />
                  <span className="text-[9px] text-[#374151] leading-snug">{adv}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-[#D8DCE3] pt-2.5">
            <p className="text-[8.5px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#C8102E' }}>Potential Threats</p>
            <ul className="space-y-1.5">
              {(cl.potentialThreats || []).map((thr, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: '#C8102E' }} />
                  <span className="text-[9px] text-[#374151] leading-snug">{thr}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Panel 6 – Market Gaps + JV Partners */}
        <div className="bg-[#F8FAFD] rounded-xl p-3 border border-[#D8DCE3] flex flex-col gap-2.5">
          <div>
            <p className="text-[8.5px] font-black uppercase tracking-widest mb-1.5" style={{ color: KPMG_BLUE }}>{titles.gaps}</p>
            <ul className="space-y-1.5">
              {(cl.marketGaps || []).map((gap, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: KPMG_MID }} />
                  <span className="text-[9px] text-[#374151] leading-snug">{gap}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-[#D8DCE3] pt-2.5">
            <p className="text-[8.5px] font-black uppercase tracking-widest mb-1.5" style={{ color: KPMG_BLUE }}>{titles.jv}</p>
            <div className="flex flex-wrap gap-1.5">
              {(cl.jvPartners || []).map((p, i) => {
                const initials = (p.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const colors = [KPMG_BLUE, '#059669', '#D97706', '#7C3AED', '#0E9F8A'];
                return (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-[#D8DCE3] bg-white">
                    <div className="w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: colors[i % colors.length], fontSize: 7, fontWeight: 900 }}>{initials}</div>
                    <div>
                      <p className="text-[8px] font-bold text-[#1A1F36] leading-tight">{p.name}</p>
                      <p className="text-[7px] text-[#9CA3AF] leading-tight">{p.type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Modal: Client Focus ───────────────────────────────────────────────────────
function ClientFocusModalContent({ payload: cf, clientName, profile }) {
  const areas = cf.focusAreas || [];
  const cp = cf.clientProfile || {};
  const pc = PROFILE_CONFIG[profile];
  const initials = (clientName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Client profile section */}
      <div className="p-4 rounded-xl border border-[#D8DCE3] bg-[#F8FAFD]">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0" style={{ background: KPMG_BLUE }}>
            {initials}
          </div>
          <div>
            <p className="font-black text-base text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{clientName}</p>
            {pc && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pc.bg, color: pc.color }}>{pc.label}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-3">
          <div><span className="text-[#9CA3AF]">Sector: </span><span className="font-medium text-[#374151]">{cp.sector}</span></div>
          <div><span className="text-[#9CA3AF]">HQ: </span><span className="font-medium text-[#374151]">{cp.hq}</span></div>
          <div><span className="text-[#9CA3AF]">Revenue: </span><span className="font-medium text-[#374151]">{cp.revenue}</span></div>
          <div className="col-span-2"><span className="text-[#9CA3AF]">Core Strengths: </span><span className="font-medium text-[#374151]">{cp.coreStrengths}</span></div>
        </div>
        {cp.strategicRationale && (
          <div className="border-l-2 pl-3 italic" style={{ borderColor: KPMG_MID }}>
            <p className="text-[10px] text-[#6B7280]">"{cp.strategicRationale}"</p>
          </div>
        )}
      </div>

      {/* Focus areas with radars */}
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Focus Areas</p>
        <p className="text-sm font-bold text-[#1A1F36]">{cf.headline}</p>
      </div>
      {areas.map((area, i) => {
        const radarData = (area.dimensions || []).map(d => ({ subject: d.label, score: d.score || 0, fullMark: 100 }));
        return (
          <div key={i} className="border border-[#D8DCE3] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: `${KPMG_BLUE}06` }}>
              <div className="flex-1 mr-4">
                <p className="text-[12px] font-bold text-[#1A1F36]">{area.area}</p>
                <p className="text-[10px] text-[#6B7280] mt-0.5">{area.why}</p>
              </div>
              <UrgencyBadge urgency={area.urgency} />
            </div>
            <div className="p-4" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#D8DCE3" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar dataKey="score" stroke={KPMG_MID} fill={KPMG_MID} fillOpacity={0.25} />
                  <Tooltip formatter={(v) => [`${v}/100`]} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal: Top 5 Priorities ───────────────────────────────────────────────────
function PrioritiesModalContent({ payload: tp }) {
  const priorities = tp.priorities || [];
  const scatterData = priorities.map(p => ({ x: p.effort || 50, y: p.impact || 50, rank: p.rank, name: p.title }));

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={14} fill={payload.rank === 1 ? KPMG_BLUE : KPMG_MID} opacity={1 - (payload.rank - 1) * 0.12} />
        <text x={cx} y={cy + 4} fontSize={10} fill="white" textAnchor="middle" fontWeight="bold">{payload.rank}</text>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Impact vs Effort Matrix</p>
        <p className="text-[10px] text-[#9CA3AF] mb-3">High impact, low effort priorities should be done first</p>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 32, left: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis type="number" dataKey="x" domain={[0, 100]} label={{ value: 'Effort →', position: 'insideBottom', offset: -14, fontSize: 10, fill: '#9CA3AF' }} tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="y" domain={[0, 100]} label={{ value: '← Impact', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9CA3AF' }} tick={{ fontSize: 10 }} />
              <ReferenceLine x={50} stroke="#D8DCE3" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="#D8DCE3" strokeDasharray="4 4" />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div style={{ background: 'white', border: '1px solid #D8DCE3', borderRadius: 8, padding: '5px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: '#1A1F36', marginBottom: 2 }}>#{d?.rank} {d?.name}</p>
                    <p style={{ fontSize: 8, color: '#6B7280' }}>Impact {d?.y} · Effort {d?.x}</p>
                  </div>
                );
              }} />
              <Scatter data={scatterData} shape={<CustomDot />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="space-y-3">
        {priorities.map((p, i) => (
          <div key={i} className="p-4 rounded-2xl border border-[#D8DCE3]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm text-white"
                style={{ background: i === 0 ? KPMG_BLUE : KPMG_MID, opacity: 1 - i * 0.1 }}>
                {p.rank}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[12px] font-bold text-[#1A1F36]">{p.title}</p>
                  <TimingBadge timing={p.timing} />
                </div>
                <p className="text-[10px] text-[#6B7280] mb-2">{p.description}</p>
                <div className="flex gap-3 mb-1">
                  <div className="flex-1">
                    <p className="text-[9px] text-[#9CA3AF] mb-1">Impact</p>
                    <div className="h-1.5 bg-[#D8DCE3] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#059669]" style={{ width: `${p.impact}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] text-[#9CA3AF] mb-1">Effort</p>
                    <div className="h-1.5 bg-[#D8DCE3] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#D97706]" style={{ width: `${p.effort}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-[#9CA3AF]">
                  <span>By {p.timeframe}</span><span>·</span><span>{p.owner}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal: Strategic Roadmap ──────────────────────────────────────────────────
function RoadmapModalContent({ payload: sr }) {
  const phases = sr.phases || [];
  const phaseColors = [KPMG_BLUE, KPMG_MID, '#1A5FAD', '#0055A4'];

  const parseDuration = (d) => {
    const m = (d || '').match(/(\d+)[^\d]+(\d+)/);
    return m ? { start: parseInt(m[1]), end: parseInt(m[2]) } : { start: 0, end: 6 };
  };
  const allEnds = phases.map(p => parseDuration(p.duration).end);
  const totalMonths = Math.max(...allEnds, 36);

  return (
    <div className="space-y-6">
      {/* Target Vision */}
      {sr.targetVision && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: `${KPMG_BLUE}08`, border: `1px solid ${KPMG_BLUE}20` }}>
          <Star size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Target Vision</p>
            <p className="text-sm font-bold text-[#1A1F36]">{sr.targetVision}</p>
          </div>
        </div>
      )}

      {/* Gantt */}
      <div>
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">Project Timeline</p>
        <div className="space-y-4">
          {phases.map((ph, i) => {
            const { start, end } = parseDuration(ph.duration);
            const leftPct  = (start / totalMonths) * 100;
            const widthPct = Math.max(((end - start) / totalMonths) * 100, 8);
            const color = phaseColors[i] || KPMG_BLUE;
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold w-16 flex-shrink-0" style={{ color }}>{ph.phase}</span>
                  <span className="text-[10px] text-[#6B7280]">{ph.title}</span>
                  <span className="text-[9px] text-[#9CA3AF] ml-auto flex-shrink-0">{ph.duration}</span>
                </div>
                {/* Diamond milestone markers — own row above the bar, tooltip on hover */}
                {(ph.milestones || []).length > 0 && (
                  <div className="relative h-4 mb-1">
                    {(ph.milestones || []).map((ms, j) => {
                      const msLeft = (ms.month / totalMonths) * 100;
                      return (
                        <div
                          key={j}
                          className="absolute group"
                          style={{ left: `calc(${msLeft}% - 5px)`, top: 0 }}
                        >
                          <div
                            className="w-2.5 h-2.5 rotate-45 border-2 border-white cursor-pointer"
                            style={{ background: color }}
                          />
                          {/* Hover tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                            <div
                              className="px-2 py-1 rounded-md shadow-lg whitespace-nowrap text-white"
                              style={{ background: color, fontSize: 9 }}
                            >
                              <span className="font-bold">M{ms.month}:</span> {ms.milestone}
                            </div>
                            <div className="w-1.5 h-1.5 rotate-45 -mt-1" style={{ background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Gantt bar — outcome text only */}
                <div className="relative h-7 bg-[#F0F2F5] rounded-lg overflow-hidden">
                  <div className="absolute top-0 bottom-0 rounded-lg flex items-center px-2"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color, minWidth: 40 }}>
                    <span className="text-white font-bold truncate" style={{ fontSize: 9 }}>{(ph.outcome || '').slice(0, 35)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="relative h-4">
            {[0, 6, 12, 18, 24, 30, 36].filter(m => m <= totalMonths).map(m => (
              <span key={m} className="absolute text-[8px] text-[#CBD5E1] -translate-x-1/2"
                style={{ left: `${(m / totalMonths) * 100}%` }}>M{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Phase details */}
      <div className="space-y-4">
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Phase Details</p>
        {phases.map((ph, i) => (
          <div key={i} className="border border-[#D8DCE3] rounded-2xl overflow-hidden">
            <div className="px-4 py-3" style={{ background: phaseColors[i] || KPMG_BLUE }}>
              <p className="text-white font-bold text-[12px]">{ph.phase}: {ph.title}</p>
              <p className="text-white/70 text-[10px]">{ph.duration}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Key Actions</p>
              <ul className="space-y-1 mb-3">
                {(ph.keyActions || []).map((action, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: phaseColors[i] || KPMG_BLUE }} />
                    <span className="text-[10px] text-[#374151]">{action}</span>
                  </li>
                ))}
              </ul>
              <div className="p-2 rounded-lg" style={{ background: `${phaseColors[i] || KPMG_BLUE}10` }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: phaseColors[i] || KPMG_BLUE }}>Outcome</p>
                <p className="text-[10px] text-[#374151]">{ph.outcome}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CockpitModal ──────────────────────────────────────────────────────────────
function CockpitModal({ modal, onClose, data, onRegenerate }) {
  if (!modal) return null;
  const titles = {
    opportunityFunnel:    { label: 'Market Funnel — Addressable Segment Analysis', color: KPMG_BLUE, wide: true  },
    opportunityAreas:     { label: 'Opportunity Areas',                            color: KPMG_MID,  wide: true  },
    competitiveLandscape: { label: 'Competitive Landscape',                        color: KPMG_BLUE, wide: true  },
    clientFocus:          { label: 'Client Focus',                                 color: '#7C3AED', wide: false },
    top5Priorities:       { label: 'Top 5 Priorities',                             color: '#059669', wide: false },
    strategicRoadmap:     { label: 'Strategic Roadmap',                            color: '#D97706', wide: false },
  };
  const meta = titles[modal.type] || { label: 'Detail View', color: KPMG_BLUE, wide: false };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,51,141,0.35)', backdropFilter: 'blur(2px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={`bg-white rounded-2xl shadow-2xl w-full ${meta.wide ? 'max-w-6xl' : 'max-w-3xl'} max-h-[90vh] flex flex-col overflow-hidden`}
          initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCE3] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 rounded-full" style={{ background: meta.color }} />
              <p className="text-[14px] font-extrabold text-[#1A1F36] uppercase tracking-wide" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {meta.label}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#F0F2F5] hover:bg-[#D8DCE3] flex items-center justify-center transition-colors">
              <X size={14} className="text-[#6B7280]" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {modal.type === 'opportunityFunnel'    && <FunnelModalContent payload={modal.payload} clientName={data?.clientName} />}
            {modal.type === 'opportunityAreas'     && <OpportunityAreasModalContent payload={modal.payload} clientName={data?.clientName} />}
            {modal.type === 'competitiveLandscape' && <CompetitiveLandscapeModalContent payload={modal.payload} profile={modal.payload?.profile || data?.profile} clientName={data?.clientName} />}
            {modal.type === 'clientFocus'          && <ClientFocusModalContent payload={modal.payload} clientName={data?.clientName} profile={data?.profile} />}
            {modal.type === 'top5Priorities'       && <PrioritiesModalContent payload={modal.payload} />}
            {modal.type === 'strategicRoadmap'     && <RoadmapModalContent payload={modal.payload} />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Persistent Cockpit Chat ───────────────────────────────────────────────────
function CockpitChat({ data, activeModal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Hi! I'm your KPMG Co-Pilot for the ${data?.clientName || 'client'} engagement. Ask me anything about the intelligence on screen.`,
  }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || thinking) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setThinking(true);
    try {
      const cockpitSummary = data ? `
Cockpit data for ${data.clientName}:
- Profile: ${data.profile} (${PROFILE_CONFIG[data.profile]?.label || ''})
- Market opportunity: ${data.opportunityFunnel?.totalMarketSize} total → ${data.opportunityFunnel?.clientOpportunity} client opportunity
- Top opportunity area: ${data.opportunityAreas?.headline}
- Competitive summary: ${data.competitiveLandscape?.summary}
- Client focus: ${data.clientFocus?.headline}
- Top priority: ${data.top5Priorities?.priorities?.[0]?.title} (${data.top5Priorities?.priorities?.[0]?.timing})
- Roadmap: ${data.strategicRoadmap?.phases?.map(p => p.title).join(' → ')}
- Target vision: ${data.strategicRoadmap?.targetVision}
${activeModal ? `\nUser is currently viewing: ${activeModal.type} modal` : ''}` : '';

      const systemPrompt = `You are a KPMG datacenter advisory co-pilot embedded in the K-Nexus platform.
You are assisting a KPMG advisor viewing a client intelligence cockpit${data ? ` for ${data.clientName}` : ''}.
Answer concisely, referencing specific numbers and data points from the cockpit.
Keep responses under 3 sentences unless detail is explicitly requested.
Be direct and quantitative — avoid generic advice.

${cockpitSummary}`;

      const reply = await callClaude({ prompt: userMsg, systemOverride: systemPrompt, maxTokens: 400 });
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('[ClientCockpit] chat request failed:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I hit an error: ${err.message}` }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.18 }}
            className="fixed bottom-20 right-6 z-[60] w-80 bg-white rounded-2xl shadow-2xl border border-[#D8DCE3] overflow-hidden flex flex-col"
            style={{ height: '440px' }}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0" style={{ background: KPMG_BLUE }}>
              <img src="/kpmg-logo.png" alt="KPMG" className="h-4 object-contain" onError={e => { e.target.style.display = 'none'; }} />
              <span className="text-white font-bold text-[12px]">Co-Pilot</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <button onClick={() => setIsOpen(false)} className="w-5 h-5 rounded hover:bg-white/20 flex items-center justify-center transition-colors">
                  <X size={11} className="text-white" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${msg.role === 'user' ? 'rounded-br-sm' : 'bg-[#F0F2F5] text-[#374151] rounded-bl-sm'}`}
                    style={msg.role === 'user' ? { background: '#EBF5FF', color: '#1A1F36' } : {}}>
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="px-3 py-2.5 bg-[#F0F2F5] rounded-xl rounded-bl-sm flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: KPMG_BLUE }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="flex-shrink-0 border-t border-[#D8DCE3] p-3 flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about this cockpit…"
                className="flex-1 text-[11px] bg-[#F0F2F5] rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#00338D] text-[#374151] placeholder:text-[#9CA3AF]" />
              <button onClick={sendMessage} disabled={!input.trim() || thinking}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:brightness-90"
                style={{ background: KPMG_BLUE }}>
                <Send size={13} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center overflow-hidden"
        style={{ background: KPMG_BLUE }} title="KPMG Co-Pilot">
        <AnimatePresence mode="wait">
          {isOpen
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={18} className="text-white" /></motion.div>
            : <motion.div key="k" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <img src="/kpmg-logo.png" alt="K" className="h-6 w-auto object-contain brightness-0 invert"
                  onError={e => { e.target.outerHTML = '<span class="text-white font-black text-base">K</span>'; }} />
              </motion.div>
          }
        </AnimatePresence>
      </motion.button>
    </>
  );
}

// ── Loading State (percentage-based) ─────────────────────────────────────────
const STEP4_SUB_MESSAGES = [
  'Analysing market context & sizing…',
  'Mapping competitive landscape…',
  'Identifying addressable opportunities…',
  'Structuring strategic advisory brief…',
  'Profiling key players & differentiators…',
  'Building KPMG viewpoint & roadmap…',
  'Calibrating risk & opportunity signals…',
  'Finalising cockpit intelligence schema…',
];

function LoadingState({ clientName, progressStep = 0, progressPct = 0 }) {
  const [subMsgIdx, setSubMsgIdx] = useState(0);

  useEffect(() => {
    if (progressStep !== 4) return;
    setSubMsgIdx(0);
    const timer = setInterval(() => setSubMsgIdx(i => (i + 1) % STEP4_SUB_MESSAGES.length), 8000);
    return () => clearInterval(timer);
  }, [progressStep]);

  const steps = [
    'Analysing client intent…',
    'Researching client & market…',
    'Classifying engagement type…',
    'Building advisory brief…',
    'Generating cockpit intelligence…',
    'Finalising & saving…',
  ];
  const currentLabel = progressStep === 4
    ? STEP4_SUB_MESSAGES[subMsgIdx]
    : steps[Math.min(progressStep, steps.length - 1)];

  const displayPct = Math.round(progressPct);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: `${KPMG_BLUE}12` }}>
          <Sparkles size={32} style={{ color: KPMG_BLUE }} />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 border-2 border-t-[#005EB8] border-[#D8DCE3] rounded-full animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-lg font-extrabold text-[#1A1F36] mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          Building Client Cockpit
        </p>
        <p className="text-sm text-[#6B7280]">{clientName || 'Analysing client brief'}…</p>
      </div>
      <div className="w-72">
        <div className="flex justify-between items-center mb-1.5">
          <AnimatePresence mode="wait">
            <motion.span key={currentLabel}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35 }}
              className="text-[10px] text-[#9CA3AF] truncate flex-1 mr-2">
              {currentLabel}
            </motion.span>
          </AnimatePresence>
          <span className="text-[13px] font-black flex-shrink-0" style={{ color: KPMG_BLUE }}>{displayPct}%</span>
        </div>
        <div className="h-2 bg-[#D8DCE3] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: KPMG_BLUE, transition: 'width 0.8s ease-out' }} />
        </div>
        {progressStep === 4 && (
          <p className="text-[9px] text-[#CBD5E1] mt-1.5 text-center">This step typically takes 60–90 seconds — almost there</p>
        )}
      </div>
      <div className="flex flex-col gap-2 w-72">
        {steps.map((s, i) => (
          <motion.div key={i} className="flex items-center gap-2.5"
            initial={{ opacity: 0.2 }} animate={{ opacity: i <= progressStep ? 1 : 0.2 }}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${i < progressStep ? 'bg-green-100' : i === progressStep ? 'bg-[#EBF5FF]' : 'bg-[#F0F2F5]'}`}>
              {i < progressStep
                ? <CheckCircle2 size={10} className="text-green-600" />
                : i === progressStep
                ? <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: KPMG_BLUE }} />
                : <div className="w-2 h-2 rounded-full bg-[#CBD5E1]" />}
            </div>
            <span className="text-[11px]" style={{ color: i <= progressStep ? '#374151' : '#CBD5E1' }}>{s}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: KPMG_BLUE }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </div>
  );
}

// ── Main Cockpit Component ────────────────────────────────────────────────────
export default function ClientCockpit() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brief = searchParams.get('brief') || '';
  const clientNameParam = searchParams.get('client') || '';
  const personaParam = searchParams.get('persona') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [persona, setPersona] = useState(personaParam || null);
  const [clarification, setClarification] = useState(null);
  const [researchContext, setResearchContext] = useState(null);
  const [modal, setModal] = useState(null);
  const [progressStep, setProgressStep] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  const openModal  = (type, payload) => setModal({ type, payload });
  const closeModal = () => setModal(null);

  useEffect(() => {
    if (!brief) {
      setError('No client brief provided. Return to the landing page and use the Guide Bot.');
      setLoading(false);
      return;
    }
    generateCockpit();
  }, [brief]);

  const generateCockpit = async (overridePersona = null) => {
    setLoading(true);
    setError(null);
    setData(null);
    setClarification(null);
    setResearchContext(null);
    setModal(null);
    setProgressStep(0);
    setProgressPct(0);

    try {
      setProgressStep(0); setProgressPct(5);
      let intentData = null;
      try {
        const intentRes = await fetch('/api/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: clientNameParam || '', brief }),
        });
        if (intentRes.ok) {
          const { intent } = await intentRes.json();
          intentData = intent;
        }
      } catch { /* non-fatal */ }
      setProgressPct(15);

      setProgressStep(1); setProgressPct(18);
      const ctx = await researchClient({
        clientName: clientNameParam || '',
        brief,
        sector: null,
        eventType: 'cockpit',
        researchTopics: intentData?.researchTopics || null,
      });
      setResearchContext(ctx);
      setProgressPct(45);

      setProgressStep(2); setProgressPct(48);
      let resolvedPersona = overridePersona || personaParam;
      if (!resolvedPersona) {
        try {
          const stakeholderTypePrior = intentData?.stakeholderType || null;
          const detectionPrompt = `Client brief:\n${brief}\n\n${stakeholderTypePrior ? `Intent analysis suggests stakeholderTypePrior: "${stakeholderTypePrior}"\n\n` : ''}Live research about this company:\n${ctx || 'No research available.'}`;
          const raw = await callClaude({ prompt: detectionPrompt, systemOverride: PERSONA_DETECTION_SYSTEM, maxTokens: 200 });
          const detected = JSON.parse(raw.replace(/```json|```/gi, '').trim());
          if (detected.clarificationNeeded) {
            setClarification({ question: detected.clarificationQuestion, researchContext: ctx });
            setLoading(false);
            return;
          }
          resolvedPersona = detected.persona;
        } catch {
          resolvedPersona = intentData?.stakeholderType || 'builder';
        }
      }
      setPersona(resolvedPersona);
      setProgressPct(55);

      setProgressStep(3); setProgressPct(58);
      const systemPrompt = PERSONA_SYSTEM_MAP[resolvedPersona] || COCKPIT_SYSTEM_BUILDER;
      const enrichedSystem = ctx
        ? `${systemPrompt}\n\n## LIVE RESEARCH CONTEXT (retrieved ${new Date().toISOString()})\n${ctx}\n\nIMPORTANT: If the research context contains very recent announcements, flag these prominently.`
        : systemPrompt;
      setProgressPct(65);

      setProgressStep(4); setProgressPct(68);
      // Micro-increment during the long Claude generation step (68 → cap 89)
      const microTimer = setInterval(() => {
        setProgressPct(prev => (prev < 89 ? parseFloat((prev + 0.25).toFixed(2)) : prev));
      }, 1000);
      let raw;
      try {
        raw = await callClaude({
          prompt: `Generate the client cockpit dashboard JSON for this client brief:\n\n${brief}\n\nClient name hint: ${clientNameParam || 'extract from brief'}`,
          systemOverride: enrichedSystem,
        });
      } finally {
        clearInterval(microTimer);
      }
      const _cleaned = raw.replace(/```json|```/gi, '').trim();
      const _jsonStart = _cleaned.indexOf('{');
      const _jsonEnd   = _cleaned.lastIndexOf('}');
      const parsed = JSON.parse(_cleaned.slice(_jsonStart, _jsonEnd + 1));
      setData(parsed);
      setProgressPct(90);

      setProgressStep(5); setProgressPct(95);
      writeToWiki('cockpit', brief, {
        client:      parsed.clientName,
        profile:     parsed.profile,
        topPriority: parsed.top5Priorities?.priorities?.[0]?.title,
        funnelSize:  parsed.opportunityFunnel?.totalMarketSize,
      });

    } catch (err) {
      setError(`Failed to generate cockpit: ${err.message}`);
    } finally {
      setProgressPct(100);
      setLoading(false);
    }
  };

  const pc = data ? PROFILE_CONFIG[data.profile] : null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#D8DCE3] px-6 py-3 flex items-center justify-between" style={{ background: KPMG_BLUE }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center">
            <X size={16} className="text-white" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <img src="/kpmg-logo.png" alt="KPMG" className="h-5 object-contain brightness-0 invert opacity-80"
                onError={e => { e.target.style.display = 'none'; }} />
              <span className="text-white font-extrabold text-base" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {data?.clientName || clientNameParam || 'Client'} — Cockpit View
              </span>
              {pc && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                  {pc.label}
                </span>
              )}
            </div>
            <p className="text-white/50 text-[10px]">K-Nexus AI · Live Client Intelligence · Strictly Confidential</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={() => generateCockpit(persona)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold rounded-lg transition-colors">
              <RefreshCw size={12} /> Regenerate
            </button>
          )}
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold rounded-lg transition-colors">
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* Sub-header */}
      {data && (
        <div className="flex-shrink-0 px-6 py-2 border-b border-[#D8DCE3] bg-[#F8FAFD] flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-[#6B7280]">Live AI Intelligence</span>
          </div>
          <span className="text-[#D8DCE3]">·</span>
          <span className="text-[10px] text-[#9CA3AF]">
            Powered by K-Nexus · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          {data.opportunityFunnel?.totalMarketSize && (
            <>
              <span className="text-[#D8DCE3]">·</span>
              <span className="text-[10px] font-semibold text-[#059669]">Market Opportunity: {data.opportunityFunnel.totalMarketSize}</span>
            </>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden bg-[#F8FAFD]">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <LoadingState clientName={clientNameParam} progressStep={progressStep} progressPct={progressPct} />
          </div>
        )}

        {clarification && !loading && !data && (
          <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${KPMG_BLUE}12` }}>
              <Target size={28} style={{ color: KPMG_BLUE }} />
            </div>
            <div className="text-center max-w-md">
              <p className="text-lg font-extrabold text-[#1A1F36] mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>One quick question</p>
              <p className="text-sm text-[#6B7280] leading-relaxed">{clarification.question || 'What is the primary goal for this engagement?'}</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {[
                { key: 'builder',  label: 'Build New DC',       Icon: Building2 },
                { key: 'expander', label: 'Expand Existing',    Icon: TrendingUp },
                { key: 'operator', label: 'Improve Operations', Icon: Wrench },
                { key: 'investor', label: 'Invest Capital',     Icon: DollarSign },
              ].map(({ key, label, Icon }) => (
                <button key={key} onClick={() => generateCockpit(key)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 font-bold text-sm transition-all hover:shadow-md"
                  style={{ borderColor: KPMG_BLUE, color: KPMG_BLUE, background: 'white' }}>
                  <Icon size={16} />{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && !loading && !clarification && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <AlertTriangle size={40} className="text-[#C8102E]" />
            <div className="text-center">
              <p className="font-bold text-[#1A1F36] mb-1">Could not generate cockpit</p>
              <p className="text-sm text-[#6B7280] max-w-md">{error}</p>
            </div>
            <button onClick={() => router.back()} className="px-4 py-2 text-white text-sm font-bold rounded-xl" style={{ background: KPMG_BLUE }}>
              Go Back
            </button>
          </div>
        )}

        {data && !loading && (
          <div className="p-4 h-full flex flex-col gap-2">
            <RowLabel label="Market Perspective" />
            <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
              <OpportunityFunnelCard    data={data} onModal={openModal} />
              <OpportunityAreasCard     data={data} onModal={openModal} />
              <CompetitiveLandscapeCard data={data} onModal={openModal} />
            </div>
            <RowLabel label="KPMG Viewpoint" />
            <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
              <ClientFocusCard      data={data} onModal={openModal} />
              <Top5PrioritiesCard   data={data} onModal={openModal} />
              <StrategicRoadmapCard data={data} onModal={openModal} />
            </div>
          </div>
        )}
      </div>

      {/* Overlays */}
      <CockpitModal modal={modal} onClose={closeModal} data={data} onRegenerate={() => generateCockpit(persona)} />
      {data && <CockpitChat data={data} activeModal={modal} />}
    </div>
  );
}
