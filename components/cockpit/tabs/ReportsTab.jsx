'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FileText, Eye, Download, X, BookOpen } from 'lucide-react';
import Panel from '../Panel';
import { C } from '../tokens';
import { buildReport } from '@/lib/cockpit/report-content';

const STATUS = { Ready: { fg: '#047857', bg: '#E7F7EF' }, Draft: { fg: '#B54708', bg: '#FEF3E2' } };

// jsPDF's built-in fonts cover Windows-1252 only; arrows are spelt out.
const pdfSafe = (t) => t.replace(/ → /g, ' to ').replace(/→/g, '->');

// The PDF is drawn in the browser from the same content as the preview.
async function downloadPdf(data, id) {
  const { jsPDF } = await import('jspdf');
  const r = buildReport(data, id);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const footer = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(143, 168, 200);
    doc.text('KPMG Confidential', M, H - 24);
    doc.text(`Page ${doc.getNumberOfPages()}`, W - M, H - 24, { align: 'right' });
  };
  doc.setFillColor(12, 40, 71); doc.rect(0, 0, W, 110, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(pdfSafe(r.title), M, 56);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(168, 196, 224);
  doc.text(pdfSafe(`${r.subtitle} · Prepared ${r.prepared}${r.status === 'Draft' ? ' · Draft' : ''}`), M, 80);
  let y = 145;
  for (const s of r.sections) {
    if (y > H - 110) { footer(); doc.addPage(); y = 64; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 45, 82);
    doc.text(pdfSafe(s.heading), M, y); y += 8;
    doc.setDrawColor(37, 99, 235); doc.setLineWidth(1.5); doc.line(M, y, M + 40, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 80, 105);
    for (const line of s.lines) {
      const indent = line.startsWith('  ') ? 14 : 0;
      for (const l of doc.splitTextToSize(pdfSafe(line.trim()), W - 2 * M - indent)) {
        if (y > H - 60) { footer(); doc.addPage(); y = 64; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 80, 105); }
        doc.text(l, M + indent, y); y += 14;
      }
      y += 3;
    }
    y += 14;
  }
  footer();
  doc.save(`${data.slug}-${id}.pdf`);
}

function Preview({ data, id, onClose }) {
  const r = buildReport(data, id);
  return createPortal(
    <div className="fixed inset-0 z-[900] flex items-center justify-center" style={{ background: 'rgba(12,40,71,0.55)' }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-xl overflow-hidden flex flex-col" style={{ width: 'min(760px, 90vw)', maxHeight: '85vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label={r.title}>
        <div className="flex items-start justify-between px-6 py-5" style={{ background: C.shell }}>
          <div>
            <p style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700 }}>{r.title}</p>
            <p style={{ color: C.onDarkDim, fontSize: 13, marginTop: 4 }}>{r.subtitle} · Prepared {r.prepared}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-white/10"><X size={18} color="#FFFFFF" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {r.sections.map((s) => (
            <section key={s.heading}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.heading}</h3>
              <ul className="mt-2 space-y-1.5">
                {s.lines.map((l, i) => <li key={i} style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, paddingLeft: l.startsWith('  ') ? 16 : 0 }}>{l.trim()}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button type="button" onClick={() => downloadPdf(data, id)} className="flex items-center gap-2 rounded-lg px-4 py-2" style={{ background: C.blue, color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
            <Download size={15} /> Download PDF
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

export default function ReportsTab({ data, delay = 0 }) {
  const [preview, setPreview] = useState(null);
  return (
    <div className="h-full grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
      <div className="grid grid-cols-2 gap-4 min-h-0" style={{ gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
        {data.reports.map((rep, i) => {
          const st = STATUS[rep.status];
          const r = buildReport(data, rep.id);
          return (
            <Panel key={rep.id} title={rep.title} action={null} delay={delay + i * 0.06} className={i === 0 ? 'col-span-2' : ''}>
              <div className="flex items-center gap-3 -mt-1" style={{ fontSize: 12.5, color: C.text2 }}>
                <span className="rounded-full px-2.5 py-0.5" style={{ fontSize: 11.5, fontWeight: 600, color: st.fg, background: st.bg }}>{rep.status}</span>
                <span>{rep.kind}</span>·<span>Prepared {rep.prepared}</span>·<span>{r.sections.length} {r.sections.length === 1 ? 'section' : 'sections'}</span>
              </div>
              <p className="mt-2" style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>{rep.description}</p>
              <p className="mt-1.5" style={{ fontSize: 12, color: C.text2 }}>{r.sections.map((s) => s.heading).join(' · ')}</p>
              {i === 0 && (
                <div className="grid grid-cols-5 gap-3 mt-4">
                  {data.kpis.map((k) => (
                    <div key={k.label} className="rounded-lg" style={{ background: C.tint, padding: '10px 12px' }}>
                      <p style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{k.value}</p>
                      <p style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.3, marginTop: 2 }}>{k.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-auto pt-3 flex gap-2">
                <button type="button" onClick={() => setPreview(rep.id)} className="flex items-center gap-2 rounded-lg px-3.5 py-2" style={{ border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 600 }}>
                  <Eye size={15} /> Preview
                </button>
                <button type="button" onClick={() => downloadPdf(data, rep.id)} className="flex items-center gap-2 rounded-lg px-3.5 py-2" style={{ background: C.blue, color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
                  <Download size={15} /> Download PDF
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel title="Sources & Basis" icon={BookOpen} action={null} delay={delay + 0.3}>
        <ul className="space-y-3">
          {data.marketAnalysis.method.map((t, i) => (
            <li key={i} className="flex gap-2.5" style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5 }}>
              <FileText size={15} className="flex-shrink-0 mt-[2px]" style={{ color: C.blue }} />{t}
            </li>
          ))}
        </ul>
        <div className="mt-auto rounded-lg" style={{ background: C.tint, padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>How to read these figures</p>
          <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5, marginTop: 4 }}>Market values are modelled from public capacity projections and cost benchmarks; competitor levels are a relative assessment. Every figure reconciles across the cockpit and the reports.</p>
        </div>
      </Panel>
      {preview && <Preview data={data} id={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
