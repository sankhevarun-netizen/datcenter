// lib/cockpit/report-content.js — report text built from a cockpit's data file.
//
// One builder feeds both the on-screen preview and the PDF, so the two always
// match each other and the cockpit. Pure: no network, no clock, no randomness.

const cagr = (a, b, years) => Math.round(((b / a) ** (1 / years) - 1) * 100);

const SECTIONS = {
  market: (d) => ({
    heading: 'Market opportunity',
    lines: [d.market.headline, ...d.kpis.map((k) => `${k.value} — ${k.label}`)],
  }),
  segments: (d) => ({
    heading: 'Opportunity by segment (2030)',
    lines: d.segments.items.map((s) => `${s.name}: ${s.value} (${s.share}%)`),
  }),
  opportunities: (d) => ({
    heading: 'Top investment opportunities',
    lines: d.opportunities.rows.map((r, i) => `${i + 1}. ${r.name} — ${r.segment}, ${r.value}, ${r.timeline}, fit ${r.fit}/5`).concat(d.opportunities.note),
  }),
  roadmap: (d) => ({
    heading: 'Strategic roadmap',
    lines: d.roadmap.flatMap((p, i) => [`Phase ${i + 1} (${p.window}) — ${p.title}: ${p.detail}`, `  Stage gate: ${d.roadmapDetail.phases[i].gate}`]),
  }),
  capacity: (d) => {
    const m = d.marketAnalysis;
    return {
      heading: 'Datacentre capacity trajectory',
      lines: m.capacity.map((c) => `${c.year}: ${c.itGw} GW IT, ${Math.round(c.itGw * m.pue * 100) / 100} GW facility power at PUE ${m.pue}`),
    };
  },
  clusters: (d) => ({
    heading: 'Demand by cluster',
    lines: d.marketAnalysis.clusters.map((c) => `${c.city}: ${c.gw2026} GW (2026) → ${c.gw2030} GW (2030); grid ${c.grid.toLowerCase()}. ${c.note}.`),
  }),
  method: (d) => ({
    heading: 'Methodology and sources',
    lines: [...d.marketAnalysis.method, d.market.source],
  }),
  memos: (d) => ({
    heading: 'Opportunity investment memos',
    lines: d.opportunityDetails.flatMap((o, i) => {
      const r = d.opportunities.rows[i];
      return [
        `${i + 1}. ${o.name} — ${r.value} by 2030, ${r.timeline}, fit ${r.fit}/5`,
        `  Thesis: ${o.thesis}`,
        `  Tata Power edge: ${o.edge.join('; ')}.`,
        `  Risks: ${o.risks.join('; ')}.`,
        `  Next step: ${o.next}`,
      ];
    }),
  }),
  competitive: (d) => ({
    heading: 'Competitive landscape',
    lines: [
      ...d.competitive.advantages.map((a) => `${a.title}: ${a.text}`),
      ...d.competitive.profiles.map((p) => `${p.name} (${p.threat} threat): ${p.angle}`),
      d.competitive.note,
    ],
  }),
};

// The segment growth line is added to the segments section for the market report.
function segmentGrowth(d) {
  return d.marketAnalysis.segmentGrowth.map((s) => `${s.name}: $${s.y2026}Bn (2026) → $${s.y2030}Bn (2030), ${cagr(s.y2026, s.y2030, 4)}% CAGR`);
}

/** { title, subtitle, prepared, sections: [{ heading, lines[] }] } for one report. */
export function buildReport(data, reportId) {
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) throw new Error(`Unknown report ${reportId}`);
  const sections = report.sections.map((key) => {
    const s = SECTIONS[key](data);
    if (key === 'segments' && reportId === 'market') { s.heading = 'Segment growth, 2026 → 2030'; s.lines = segmentGrowth(data); }
    return s;
  });
  return { title: report.title, subtitle: `${data.client.cockpitTitle} · ${report.kind}`, prepared: report.prepared, status: report.status, sections };
}

export const REPORT_SECTION_KEYS = Object.keys(SECTIONS);
