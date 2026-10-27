'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Loader2, X } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';

const REPORTS = [
  { id: 'executive', name: 'Executive Summary Report', description: 'Portfolio-wide health, incidents, KPI overview, and executive dashboard snapshot.', frequency: 'Daily', lastGenerated: '2026-05-18 06:00 UTC', color: '#00338D' },
  { id: 'incident', name: 'Incident Analysis Report', description: 'Detailed incident breakdown with root causes, resolution metrics, and trend analysis.', frequency: 'Weekly', lastGenerated: '2026-05-15 06:00 UTC', color: '#C8102E' },
  { id: 'capacity', name: 'Capacity Planning Report', description: 'Utilization trends, growth projections, capacity forecasts, and expansion recommendations.', frequency: 'Monthly', lastGenerated: '2026-05-01 06:00 UTC', color: '#005EB8' },
  { id: 'sustainability', name: 'Sustainability & ESG Report', description: 'PUE trends, carbon emissions, renewable energy metrics, and ESG score breakdown.', frequency: 'Quarterly', lastGenerated: '2026-04-01 06:00 UTC', color: '#00B0A0' },
  { id: 'tenant', name: 'Tenant Operations Report', description: 'Tenant utilization, SLA compliance, revenue analysis, and upsell opportunity summary.', frequency: 'Monthly', lastGenerated: '2026-05-01 06:00 UTC', color: '#7C3AED' },
  { id: 'maintenance', name: 'Maintenance & Asset Report', description: 'Maintenance schedule adherence, asset health scores, and predicted failure analysis.', frequency: 'Weekly', lastGenerated: '2026-05-15 06:00 UTC', color: '#E87722' },
];

function generatePDF(report, showToast, { dateFrom, dateTo } = {}) {
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = 210; const margin = 20;

    // Header bar
    doc.setFillColor(0, 51, 141);
    doc.rect(0, 0, w, 28, 'F');

    // Logo text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('K-NEXUS', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Datacenter Lifecycle Intelligence Platform', margin, 18);

    // Report title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(report.name.toUpperCase(), margin, 24);

    // Generation date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 220, 255);
    const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Generated: ${now} UTC`, w - margin, 24, { align: 'right' });

    let y = 40;

    // Executive summary box
    doc.setFillColor(244, 246, 249);
    doc.roundedRect(margin, y, w - margin*2, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(26, 31, 54);
    doc.text('Executive Summary', margin + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 90, 110);
    const summaryLines = [
      'Global Health Score: 94.2/100  |  Active Incidents: 5 (3 Critical)  |  SLA Compliance: 99.7%',
      'Portfolio: 12 facilities, 847 MW capacity, 73.4% utilized across APAC / EMEA / Americas',
      'Sustainability: PUE 1.38 avg, 64% renewable energy mix, ESG Score: 82/100 (A-)',
    ];
    summaryLines.forEach((line, i) => doc.text(line, margin + 5, y + 14 + i * 6));
    y += 38;

    // KPI Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(26, 31, 54);
    doc.text('Key Performance Indicators', margin, y + 7);
    y += 12;

    const kpis = [
      ['Metric', 'Value', 'Trend', 'Status'],
      ['Global Health Score', '94.2 pts', '+1.8 pts WoW', 'Healthy'],
      ['Active Critical Incidents', '3', '-2 vs yesterday', 'Warning'],
      ['SLA Compliance', '99.7%', '+0.1% MoM', 'Healthy'],
      ['Capacity Utilization', '73.4%', '+2.1% QoQ', 'Healthy'],
      ['Power Availability', '847 MW', '-12 MW', 'Healthy'],
      ['Cooling Efficiency', '91.8%', '-0.4% WoW', 'Warning'],
      ['Portfolio Avg PUE', '1.38', '-0.02 QoQ', 'Healthy'],
      ['Carbon Efficiency', '0.42 tCO₂/MWh', '-0.03 YoY', 'Healthy'],
    ];

    kpis.forEach((row, i) => {
      const isHeader = i === 0;
      if (isHeader) {
        doc.setFillColor(0, 51, 141);
        doc.rect(margin, y, w - margin*2, 7, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
        doc.rect(margin, y, w - margin*2, 7, 'F');
        doc.setTextColor(26, 31, 54);
      }
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(8);
      const colWidths = [65, 35, 45, 25];
      let x = margin + 3;
      row.forEach((cell, j) => { doc.text(cell, x, y + 5); x += colWidths[j]; });
      y += 7;
    });

    y += 8;

    // Active incidents section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(26, 31, 54);
    doc.text('Active Incidents', margin, y + 7);
    y += 12;

    const incidents = [
      ['ID', 'Severity', 'Site', 'Title', 'Status'],
      ['INC-2026-0847', 'Critical', 'Mumbai DC-2', 'UPS Battery Bank Degradation', 'Investigating'],
      ['INC-2026-0845', 'Critical', 'Mumbai DC-2', 'Cooling Loop Pressure Drop', 'Identified'],
      ['INC-2026-0843', 'High', 'Hong Kong DC-1', 'Network Latency Spike', 'Monitoring'],
      ['INC-2026-0841', 'Medium', 'Dubai Edge Node', 'Generator Fuel Below Threshold', 'Identified'],
      ['INC-2026-0839', 'Medium', 'London Docklands', 'CCTV System Offline Zone 4', 'Investigating'],
    ];

    incidents.forEach((row, i) => {
      const isHeader = i === 0;
      if (isHeader) {
        doc.setFillColor(0, 51, 141);
        doc.rect(margin, y, w - margin*2, 7, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        const sevColor = row[1] === 'Critical' ? [254, 242, 242] : row[1] === 'High' ? [255, 251, 235] : [244, 246, 249];
        doc.setFillColor(...sevColor);
        doc.rect(margin, y, w - margin*2, 7, 'F');
        doc.setTextColor(26, 31, 54);
      }
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      const colWidths = [30, 20, 35, 60, 25];
      let x = margin + 3;
      row.forEach((cell, j) => { doc.text(cell, x, y + 5); x += colWidths[j]; });
      y += 7;
    });

    // Footer
    doc.setFillColor(244, 246, 249);
    doc.rect(0, 280, w, 17, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 160, 175);
    doc.text('CONFIDENTIAL — K-Nexus Datacenter Intelligence Platform', margin, 288);
    doc.text('Powered by K-Nexus Intelligence Platform  |  kpmg.com/knexus', w - margin, 288, { align: 'right' });

    const fileName = `KNexus_${report.id}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(fileName);
    showToast('Report downloaded successfully');
    fetch('/api/user-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_type: report.id,
        report_name: report.name,
        file_name: fileName,
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
      }),
    }).catch(() => {});
  });
}

function ReportCard({ report, showToast }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDownload = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      generatePDF(report, showToast);
      setTimeout(() => setDone(false), 3000);
    }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: report.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: report.color + '15' }}>
            <FileText size={16} style={{ color: report.color }} />
          </div>
          <div className="flex gap-1.5">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#6B7280]">PDF</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: report.color + '15', color: report.color }}>{report.frequency}</span>
          </div>
        </div>
        <h3 className="text-sm font-bold text-[#1A1F36] mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{report.name}</h3>
        <p className="text-xs text-[#6B7280] leading-relaxed mb-3">{report.description}</p>
        <p className="text-[10px] text-[#9CA3AF] mb-4">Last generated: {report.lastGenerated}</p>
        <button onClick={handleDownload} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-colors text-white"
          style={{ backgroundColor: done ? '#00B0A0' : report.color }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : done ? '✓ Downloaded' : <><Download size={12} /> Download Latest</>}
        </button>
      </div>
    </motion.div>
  );
}

function CustomReportModal({ onClose, showToast }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [type, setType] = useState('executive');
  const [dateFrom, setDateFrom] = useState('2026-04-01');
  const [dateTo, setDateTo] = useState('2026-05-18');

  const handleGenerate = () => {
    setLoading(true);
    const report = REPORTS.find(r => r.id === type) || REPORTS[0];
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      generatePDF(report, showToast, { dateFrom, dateTo });
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCE3]">
          <h3 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Generate Custom Report</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1F36]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-[#6B7280] block mb-1">Report Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full text-sm text-[#1A1F36] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50">
              {REPORTS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#6B7280] block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full text-sm text-[#1A1F36] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6B7280] block mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full text-sm text-[#1A1F36] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005EB8]/50" />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={loading || done}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: done ? '#00B0A0' : '#00338D' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : done ? '✓ Generated & Downloaded' : <><Download size={14} /> Generate Report</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ReportsPage() {
  const [showCustom, setShowCustom] = useState(false);
  return (
    <CCLayout title="Reports">
      {({ showToast }) => (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#00338D]" />
              <h2 className="text-base font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Available Reports</h2>
            </div>
            <button onClick={() => setShowCustom(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00338D] hover:bg-[#002A73] text-white text-xs font-bold rounded-xl transition-colors">
              <FileText size={12} /> Generate Custom Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {REPORTS.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <ReportCard report={r} showToast={showToast} />
              </motion.div>
            ))}
          </div>

          <AnimatePresence>
            {showCustom && <CustomReportModal onClose={() => setShowCustom(false)} showToast={showToast} />}
          </AnimatePresence>
        </div>
      )}
    </CCLayout>
  );
}
