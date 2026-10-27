// lib/nexus/pdf-pack.js
//
// The disclosure pack as a multi-page A4 PDF: cover band, executive summary,
// framework line items, by-site figures, methodology (the formula behind each
// figure) and a source appendix naming the workbook sheets and fields. Built
// with jsPDF's standard fonts, so text is reduced to their character set.
import { fmtNumber, fmtUpTo } from './format.js';
import { monthLabel, timeLabel, AS_OF } from './time.js';

const NAVY = [0, 51, 141];
const INK = [26, 31, 54];
const MUTED = [100, 116, 139];
const STRIPE = [246, 248, 251];

/** Standard PDF fonts cover WinAnsi only. */
export function pdfSafe(text) {
  return String(text)
    .replace(/₹/g, 'Rs ')
    .replace(/CO₂/g, 'CO2').replace(/₂/g, '2')
    .replace(/Σ\s*/g, 'sum of ')
    .replace(/[≥]/g, '>=').replace(/[≤]/g, '<=')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/→/g, '->');
}

// Ratios (no unit, or a per-unit unit such as L/kWh) keep three decimals; quantities keep one.
const isRatio = (unit) => unit === '' || unit.includes('/');
const valueText = (l) => (l.value === null ? (/^No metered data/.test(l.gap) ? 'Pending' : 'Not in dataset') : `${isRatio(l.unit) ? fmtUpTo(l.value, 3) : fmtNumber(l.value, Number.isInteger(l.value) ? 0 : 1)}${l.unit ? ` ${l.unit}` : ''}`);

export async function buildDisclosurePdf(d, summary) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18;
  let y = 0;
  let page = 1;

  const footer = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(pdfSafe(`K-NEXUS · Nexus Data Infrastructure · ${d.framework.name} · data as of ${timeLabel(AS_OF)} 2026`), M, H - 8);
    doc.text(`Page ${page}`, W - M, H - 8, { align: 'right' });
  };
  const ensure = (h) => {
    if (y + h <= H - 16) return;
    footer(); doc.addPage(); page += 1; y = M;
  };
  const heading = (text) => {
    ensure(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(pdfSafe(text), M, y + 6); y += 10;
  };
  const para = (text, size = 9, color = INK) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfSafe(text), W - 2 * M);
    for (const line of lines) { ensure(5); doc.text(line, M, y + 4); y += size * 0.5; }
    y += 2;
  };
  const table = (cols, rows) => {
    const rowH = 6.5;
    const draw = (cells, header, stripe) => {
      // Wrap each cell, then size the row to its tallest cell.
      doc.setFontSize(8);
      const wrapped = cells.map((c, i) => doc.splitTextToSize(pdfSafe(c ?? ''), cols[i].w - 3));
      const h = Math.max(rowH, ...wrapped.map((w) => w.length * 3.6 + 2.8));
      ensure(h);
      doc.setFontSize(8); // a page break draws the footer at 7 pt
      if (header) doc.setFillColor(...NAVY); else doc.setFillColor(...(stripe ? STRIPE : [255, 255, 255]));
      doc.rect(M, y, W - 2 * M, h, 'F');
      doc.setFont('helvetica', header ? 'bold' : 'normal');
      doc.setTextColor(...(header ? [255, 255, 255] : INK));
      let x = M + 1.5;
      wrapped.forEach((w, i) => {
        const align = cols[i].align === 'right' ? 'right' : 'left';
        doc.text(w, align === 'right' ? x + cols[i].w - 3 : x, y + 4.3, { align });
        x += cols[i].w;
      });
      y += h;
    };
    draw(cols.map((c) => c.label), true, false);
    rows.forEach((r, i) => draw(r, false, i % 2 === 1));
    y += 4;
  };

  // Cover band
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('K-NEXUS', M, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Nexus Data Infrastructure · Sustainability disclosure pack', M, 19);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(pdfSafe(d.framework.name), M, 28);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 220, 255);
  doc.text(pdfSafe(`${monthLabel(d.period.from)} to ${monthLabel(d.period.to)}`), W - M, 28, { align: 'right' });
  y = 42;

  heading('Executive summary');
  para(summary);

  heading('Scope');
  para(`Sites in scope: ${d.facilities.map((f) => `${f.name}${f.metered ? '' : ' (no metered data)'}`).join(', ')}.${d.policy ? ` Obligation: ${d.policy.policy} — ${d.policy.obligation} (effective ${timeLabel(d.policy.effectiveFrom)}).` : ''}`, 8.5, MUTED);

  heading('Disclosure line items');
  para(`Readiness: ${d.readinessScore}% of the items this framework requires can be disclosed from operating data.`, 8.5, MUTED);
  table(
    [{ label: 'Ref', w: 22 }, { label: 'Item', w: 92 }, { label: 'Value', w: 60, align: 'right' }],
    d.lines.map((l) => [l.ref, l.item, valueText(l)]),
  );
  if (d.gaps.length) para(`Not disclosed from operating data: ${d.gaps.map((g) => `${g.item} — ${g.why}`).join(' ')}`, 8, MUTED);
  if (d.pending.length) para(`Pending: ${d.pending.map((p) => `${p.name} — ${p.reason}`).join(' ')}`, 8, MUTED);

  if (d.byFacility.length) {
    heading('By site');
    table(
      [{ label: 'Site', w: 38 }, { label: 'Energy MWh', w: 26, align: 'right' }, { label: 'PUE', w: 18, align: 'right' }, { label: 'REF', w: 18, align: 'right' }, { label: 'Water kL', w: 26, align: 'right' }, { label: 'WUE', w: 18, align: 'right' }, { label: 'Scope 2 tCO2e', w: 30, align: 'right' }],
      d.byFacility.map((f) => [f.name, fmtNumber(f.figures.totalEnergyMwh.value, 1), fmtUpTo(f.figures.pue.value, 3), fmtUpTo(f.figures.ref.value, 3), fmtNumber(f.figures.waterWithdrawnKl.value), fmtUpTo(f.figures.wue.value, 3), fmtNumber(f.figures.scope2Tco2.value, 1)]),
    );
  }

  heading('Methodology');
  const methods = d.lines.filter((l) => l.formula);
  table(
    [{ label: 'Item', w: 54 }, { label: 'Formula', w: 82 }, { label: 'Basis', w: 38 }],
    methods.map((l) => [l.item, l.formula, l.confidence]),
  );
  para('Ratios are computed from period totals (sum over sum), never averaged across months or sites. IT energy is facility energy divided by the measured PUE for each month. Grid carbon intensity is the Indian national grid average recorded in the ledger.', 8, MUTED);

  heading('Sources');
  const seen = new Map();
  for (const l of methods) {
    const k = `${l.source.sheet}:${l.source.fields.join(',')}`;
    if (!seen.has(k)) seen.set(k, l.source);
  }
  table(
    [{ label: 'Workbook sheet', w: 26 }, { label: 'Fields', w: 56 }, { label: 'Sites', w: 52 }, { label: 'Rows', w: 40 }],
    [...seen.values()].map((s) => [s.sheet, s.fields.join(', '), s.facilities.join(', '), s.rowRanges]),
  );
  para('Source: the Nexus operating workbook. Every figure above can be recomputed from the listed sheets and fields.', 8, MUTED);

  footer();
  return doc;
}
