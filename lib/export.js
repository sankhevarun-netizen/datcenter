// lib/export.js
//
// Browser-side download helpers shared by the Nexus pages: a multi-sheet
// workbook, a CSV, and a one-page PDF snapshot of a rendered panel. Heavy
// libraries load on demand so they never weigh on first paint.

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** sheets: [{ name, rows: object[] }] → .xlsx */
export async function exportWorkbook(sheets, filename) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportCsv(rows, filename) {
  const XLSX = await import('xlsx');
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
  download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Snapshot a DOM element into a single-page PDF sized to the element. */
export async function exportPanelPdf(el, filename, { background = '#FFFFFF' } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: background });
  const pxToMm = 0.264583 / 2; // undo scale: 2 so the PDF matches on-screen size
  const w = canvas.width * pxToMm;
  const h = canvas.height * pxToMm;
  const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] });
  // JPEG keeps a full-page snapshot to about a megabyte; PNG runs to ten.
  doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
  doc.save(filename);
}
