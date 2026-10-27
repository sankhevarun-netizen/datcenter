'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Download, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, Target, BarChart3, FileText, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import useAppStore from '@/store/appStore';
import { callClaude } from '@/lib/claude-api';

const STAGE_NAMES = {
  'doc': 'Strategy Document',
  '01': 'Strategy',
  '02': 'Supply Chain Management',
  '03': 'Design and Build',
  '04': 'Regulatory and Compliance',
  '05': 'Operations',
  '06': 'Monetization',
};

// ── Mini bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, color = '#005EB8' }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-[#6B7280] font-mono">{d.value}{d.suffix || ''}</span>
          <motion.div
            className="w-full rounded-t-sm"
            style={{ backgroundColor: color, opacity: 0.85 }}
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / max) * 72}px` }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          />
          <span className="text-[9px] text-[#9CA3AF] text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Radial score ───────────────────────────────────────────────────────────
function ScoreRing({ score, label, color = '#005EB8' }) {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="#D8DCE3" strokeWidth={8} />
        <motion.circle
          cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
        <text x={45} y={49} textAnchor="middle" fontSize={18} fontWeight={700} fill={color} fontFamily="JetBrains Mono, monospace">{score}</text>
      </svg>
      <span className="text-xs text-[#6B7280] font-medium text-center">{label}</span>
    </div>
  );
}

// ── Gap item ───────────────────────────────────────────────────────────────
function GapItem({ text, severity }) {
  const cfg = {
    high:   { icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-100',   label: 'High' },
    medium: { icon: AlertTriangle,  color: 'text-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-100', label: 'Medium' },
    low:    { icon: CheckCircle2,   color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-100', label: 'Low' },
  }[severity] || { icon: AlertTriangle, color: 'text-[#6B7280]', bg: 'bg-[#F0F2F5]', border: 'border-[#D8DCE3]', label: 'Info' };
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <Icon size={16} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1A1F36] leading-relaxed">{text}</p>
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.color} ${cfg.bg} flex-shrink-0`}>{cfg.label}</span>
    </div>
  );
}

// ── Interactive Timeline ───────────────────────────────────────────────────
function InteractiveTimeline({ steps }) {
  const [hoveredStep, setHoveredStep] = useState(null);
  const [activeStep, setActiveStep] = useState(null);

  const timeframes = ['Week 1–2', 'Month 1', 'Month 2–3', 'Month 3–6', 'Month 6+'];
  const colors = ['#00338D', '#0055A4', '#005EB8', '#00B0A0', '#E87722'];

  return (
    <div className="w-full">
      {/* Timeline track */}
      <div className="relative">
        {/* Horizontal line */}
        <div className="absolute top-8 left-0 right-0 h-0.5 bg-[#D8DCE3]" />
        <motion.div
          className="absolute top-8 left-0 h-0.5 bg-gradient-to-r from-[#00338D] to-[#005EB8]"
          initial={{ width: 0 }}
          animate={{ width: `${((activeStep !== null ? activeStep + 1 : hoveredStep !== null ? hoveredStep + 1 : 0) / steps.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />

        {/* Step nodes */}
        <div className="flex justify-between relative">
          {steps.map((step, i) => {
            const isActive = activeStep === i;
            const isHovered = hoveredStep === i;
            const isPast = activeStep !== null && i < activeStep;
            const color = colors[i % colors.length];

            return (
              <div
                key={i}
                className="relative flex flex-col items-center cursor-pointer group"
                style={{ width: `${100 / steps.length}%` }}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => setActiveStep(activeStep === i ? null : i)}
              >
                {/* Node */}
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all relative z-10"
                  style={{
                    backgroundColor: isActive || isHovered ? color : isPast ? color + '30' : 'white',
                    borderColor: isActive || isPast ? color : isHovered ? color : '#D8DCE3',
                    boxShadow: isActive || isHovered ? `0 0 0 6px ${color}18` : 'none',
                  }}
                  animate={{ scale: isActive ? 1.15 : isHovered ? 1.08 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <span
                    className="font-bold text-lg"
                    style={{ color: isActive || isHovered ? 'white' : isPast ? color : '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {i + 1}
                  </span>
                </motion.div>

                {/* Timeframe label */}
                <div className="mt-2 text-center h-8">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isActive || isHovered ? color : '#9CA3AF' }}>
                    {timeframes[i] || `Step ${i + 1}`}
                  </p>
                </div>

                {/* Tooltip — anchored to this column via parent's position:relative */}
                {isHovered && !isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute z-30 bg-[#00338D] text-white rounded-xl p-3 shadow-2xl text-center pointer-events-none"
                    style={{ width: 180, top: '100%', marginTop: 8, left: '50%', transform: 'translateX(-50%)' }}
                  >
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00338D] rotate-45 rounded-sm" />
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: color === '#00338D' ? '#60A5FA' : color }}>
                      {timeframes[i] || `Step ${i + 1}`}
                    </div>
                    <p className="text-xs leading-relaxed text-white/85">{step}</p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active step detail card — shown below, no overlap with tooltip */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {activeStep !== null ? (
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="bg-gradient-to-r from-[#00338D]/5 to-[#005EB8]/5 rounded-xl border border-[#00338D]/15 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                  style={{ backgroundColor: colors[activeStep % colors.length] }}>
                  {activeStep + 1}
                </div>
                <div>
                  <p className="font-bold text-[#00338D] text-sm">{timeframes[activeStep] || `Step ${activeStep + 1}`}</p>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">Next Step</p>
                </div>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{steps[activeStep]}</p>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-[#9CA3AF] py-4"
            >
              Click any step to expand details
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, color = '#00338D', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-[#D8DCE3] hover:bg-[#F0F2F5] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
            <Icon size={16} style={{ color }} />
          </div>
          <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{title}</h2>
        </div>
        {open ? <ChevronUp size={16} className="text-[#9CA3AF]" /> : <ChevronDown size={16} className="text-[#9CA3AF]" />}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
}

// ── PDF export ─────────────────────────────────────────────────────────────
//
// Approach: measure → group → render each page separately.
//
// Why window.devicePixelRatio * 2:
//   devicePixelRatio is 1 on standard screens, 2 on Retina/HiDPI.
//   Doubling it ensures html2canvas captures at ≥2× CSS pixels so text
//   stays crisp when the PDF viewer renders at print resolution (150–300 DPI).
//   On a 1× screen → scale 2. On a 2× Retina → scale 4 (4× pixels, still
//   well within memory budget for a single A4 page at 794×1123px).
//
async function exportPDF(stageNum, stageName, analysis) {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  // A4 at 96 dpi: 794 × 1123 px
  const PAGE_W   = 794;
  const PAGE_H   = 1123;
  const PAD      = 48;
  // Usable vertical space per content page (top + bottom padding + page-number row)
  const USABLE_H = PAGE_H - PAD * 2 - 48;
  const scale    = window.devicePixelRatio * 2;
  const date     = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // Shared CSS injected into every page container
  const CONTENT_CSS = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,Helvetica,sans-serif;}
    .section{break-inside:avoid;margin-bottom:22px;}
    .h1{font-size:16px;font-weight:800;color:#00338D;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #D8DCE3;}
    .h2{font-size:14px;font-weight:700;color:#00338D;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #D8DCE3;}
    .h3{font-size:13px;font-weight:700;color:#1A1F36;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;}
    .para{font-size:12px;line-height:1.8;color:#374151;}
    .para strong{font-weight:700;color:#1A1F36;}
    .para em{font-style:italic;}
    .bullet-list{margin:0;padding-left:0;list-style:none;}
    .bullet-list li{font-size:12px;line-height:1.75;color:#374151;padding-left:16px;position:relative;margin-bottom:3px;}
    .bullet-list li::before{content:"•";position:absolute;left:2px;color:#005EB8;font-size:11px;}
    .num-list{margin:0;padding-left:0;list-style:none;counter-reset:num;}
    .num-list li{font-size:12px;line-height:1.75;color:#374151;padding-left:20px;position:relative;margin-bottom:3px;counter-increment:num;}
    .num-list li::before{content:counter(num)".";position:absolute;left:0;color:#00338D;font-weight:700;font-size:11px;}
    .badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;
      background:#E8F0FB;color:#00338D;display:inline-block;margin-bottom:16px;}
    .footer-row{padding-top:12px;border-top:1px solid #D8DCE3;display:flex;
      justify-content:space-between;font-size:10px;color:#9CA3AF;}
    .disclaimer{font-size:9px;color:#9CA3AF;margin-top:12px;line-height:1.6;}
    .page-num{position:absolute;bottom:24px;right:${PAD}px;font-size:10px;color:#CBD5E1;}
  `;

  // ── Markdown → HTML converter for PDF ──────────────────────────────────
  function inlineFormat(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="font-family:monospace;background:#F0F2F5;padding:0 3px;border-radius:3px;font-size:11px;">$1</code>');
  }

  function markdownToSections(md) {
    const lines = md.split('\n');
    const sections = [];
    let buffer = [];     // pending lines for current group
    let bufType = null;  // 'bullet' | 'num' | null

    const flushBuffer = () => {
      if (!buffer.length) return;
      if (bufType === 'bullet') {
        sections.push(`<div class="section"><ul class="bullet-list">${buffer.map(b => `<li>${inlineFormat(b)}</li>`).join('')}</ul></div>`);
      } else if (bufType === 'num') {
        sections.push(`<div class="section"><ol class="num-list">${buffer.map(b => `<li>${inlineFormat(b)}</li>`).join('')}</ol></div>`);
      }
      buffer = []; bufType = null;
    };

    for (const raw of lines) {
      const t = raw.trim();

      // Skip horizontal rules
      if (/^---+$/.test(t) || /^\*\*\*+$/.test(t)) continue;
      // Skip empty lines (flush any pending list)
      if (!t) { flushBuffer(); continue; }

      if (t.startsWith('### ')) {
        flushBuffer();
        sections.push(`<div class="section"><div class="h3">${inlineFormat(t.slice(4))}</div></div>`);
      } else if (t.startsWith('## ')) {
        flushBuffer();
        sections.push(`<div class="section"><div class="h2">${inlineFormat(t.slice(3))}</div></div>`);
      } else if (t.startsWith('# ')) {
        flushBuffer();
        sections.push(`<div class="section"><div class="h1">${inlineFormat(t.slice(2))}</div></div>`);
      } else if (/^[-*•]\s+/.test(t)) {
        if (bufType !== 'bullet') flushBuffer();
        bufType = 'bullet';
        buffer.push(t.replace(/^[-*•]\s+/, ''));
      } else if (/^\d+\.\s+/.test(t)) {
        if (bufType !== 'num') flushBuffer();
        bufType = 'num';
        buffer.push(t.replace(/^\d+\.\s+/, ''));
      } else {
        flushBuffer();
        sections.push(`<div class="section"><p class="para">${inlineFormat(t)}</p></div>`);
      }
    }
    flushBuffer();
    return sections;
  }

  // ── Build section HTML strings ──────────────────────────────────────────
  const badgeHtml = `<div class="section"><div class="badge">STAGE ${stageNum} · ${stageName.toUpperCase()}</div></div>`;

  const bodyHtmls = markdownToSections(analysis);

  const footerHtml = `
    <div class="section footer-row">
      <span>K-Nexus Intelligence Platform</span>
      <span>Stage ${stageNum}: ${stageName}</span>
      <span>${date}</span>
    </div>
    <div class="section disclaimer">
      This report has been generated by the K-Nexus AI Intelligence Engine for internal
      advisory purposes only. The analysis is based on available market data and
      AI-generated insights. This document is strictly confidential and intended solely
      for the recipient. All rights reserved.
    </div>`;

  const allSections = [badgeHtml, ...bodyHtmls, footerHtml];

  // ── STEP 1: Measure each section's rendered height ──────────────────────
  // Two rAF calls let the browser complete layout before we read getBoundingClientRect.
  const waitFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const measureEl = document.createElement('div');
  measureEl.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;
    background:white;z-index:-1;padding:${PAD}px;`;
  measureEl.innerHTML = `<style>${CONTENT_CSS}</style>${allSections.join('')}`;
  document.body.appendChild(measureEl);
  await waitFrame();

  const sectionEls = measureEl.querySelectorAll('.section');
  const heights = Array.from(sectionEls).map(el => el.getBoundingClientRect().height + 28);
  document.body.removeChild(measureEl);

  // ── STEP 2: Group sections into fixed-height pages ──────────────────────
  const pages = [];
  let currentPage = { htmls: [], height: 0 };

  allSections.forEach((html, i) => {
    const h = heights[i] ?? 0;
    if (currentPage.height + h > USABLE_H && currentPage.htmls.length > 0) {
      pages.push(currentPage);
      currentPage = { htmls: [], height: 0 };
    }
    currentPage.htmls.push(html);
    currentPage.height += h;
  });
  if (currentPage.htmls.length > 0) pages.push(currentPage);

  // ── STEP 3: Capture each .pdf-page container separately ────────────────
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const capture = async (innerHTML, bg = '#ffffff') => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;
      width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;
      background:${bg};z-index:-1;`;
    el.innerHTML = innerHTML;
    document.body.appendChild(el);
    await waitFrame();
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: bg,
      width: PAGE_W,
      height: PAGE_H,
      windowWidth: PAGE_W,
    });
    document.body.removeChild(el);
    return canvas;
  };

  // Cover page
  const coverInner = `
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;}</style>
    <div style="background:linear-gradient(135deg,#00338D 0%,#005EB8 100%);color:white;
      width:${PAGE_W}px;height:${PAGE_H}px;padding:60px ${PAD}px;position:relative;">
      <div style="font-size:32px;font-weight:900;letter-spacing:4px;margin-bottom:8px;">K-Nexus.AI</div>
      <div style="font-size:11px;letter-spacing:3px;opacity:0.6;text-transform:uppercase;margin-bottom:48px;">
        Datacenter Lifecycle Intelligence
      </div>
      <div style="font-size:36px;font-weight:800;line-height:1.2;margin-bottom:16px;">
        Stage ${stageNum}: ${stageName}<br/>Analysis Report
      </div>
      <div style="font-size:14px;opacity:0.75;">AI-generated intelligence briefing · Strictly Confidential</div>
      <div style="position:absolute;bottom:60px;left:${PAD}px;right:${PAD}px;
        display:flex;justify-content:space-between;font-size:11px;opacity:0.55;">
        <span>Generated: ${date}</span><span>Confidential</span>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.3);"></div>
    </div>`;

  const coverCanvas = await capture(coverInner, '#00338D');
  pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);

  // Content pages — each rendered as its own fixed-height container
  for (let i = 0; i < pages.length; i++) {
    pdf.addPage();
    const pageInner = `
      <style>${CONTENT_CSS}</style>
      <div style="position:relative;width:${PAGE_W}px;height:${PAGE_H}px;
        background:white;padding:${PAD}px;padding-bottom:80px;overflow:hidden;">
        ${pages[i].htmls.join('')}
        <div class="page-num">${i + 2}</div>
      </div>`;
    const canvas = await capture(pageInner);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);
  }

  pdf.save(`KNexus_Stage${stageNum}_${stageName.replace(/\s+/g, '_')}_Report.pdf`);
}

// ── Parse AI output into structured sections ───────────────────────────────
function parseAnalysisIntoSections(rawText) {
  if (!rawText) return null;

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const sections = {
    summary: [],
    findings: [],
    gaps: [],
    recommendations: [],
    nextSteps: [],
    kpis: [],
    raw: rawText,
  };

  let current = 'summary';
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('executive summary') || lower.includes('overview')) { current = 'summary'; continue; }
    if (lower.includes('key finding') || lower.includes('market analysis') || lower.includes('findings')) { current = 'findings'; continue; }
    if (lower.includes('gap') || lower.includes('risk') || lower.includes('challenge')) { current = 'gaps'; continue; }
    if (lower.includes('recommendation') || lower.includes('action')) { current = 'recommendations'; continue; }
    if (lower.includes('next step') || lower.includes('roadmap') || lower.includes('implementation')) { current = 'nextSteps'; continue; }
    if (lower.includes('kpi') || lower.includes('metric') || lower.includes('benchmark')) { current = 'kpis'; continue; }

    const cleaned = line.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').replace(/#{1,3}\s*/g, '').trim();
    if (cleaned && sections[current] !== undefined) sections[current].push(cleaned);
  }

  return sections;
}

// ── KPI cards derived from text ────────────────────────────────────────────
function deriveKPIs(stageName, formData) {
  const kpis = [];
  if (formData.capacity) kpis.push({ label: 'Target Capacity', value: `${formData.capacity} MW`, color: '#005EB8' });
  if (formData.budget) kpis.push({ label: 'Investment Budget', value: formData.budget, color: '#E87722' });
  if (formData.targetPUE) kpis.push({ label: 'Target PUE', value: formData.targetPUE.toFixed ? formData.targetPUE.toFixed(2) : formData.targetPUE, color: '#00B0A0' });
  if (formData.timeline) kpis.push({ label: 'Timeline', value: formData.timeline, color: '#00338D' });
  if (formData.sla) kpis.push({ label: 'SLA Target', value: formData.sla?.split(' ')[0], color: '#0055A4' });
  if (formData.ebitdaTarget) kpis.push({ label: 'EBITDA Target', value: formData.ebitdaTarget, color: '#00B0A0' });
  return kpis.slice(0, 4);
}

// ── Inline bold renderer ───────────────────────────────────────────────────
function renderInlineAnalysis(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#1A1F36]">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ── Full analysis markdown renderer (richer heading hierarchy) ─────────────
function FullAnalysisRenderer({ text }) {
  if (!text) return <p className="text-[#9CA3AF] text-sm italic">No analysis available.</p>;
  const lines = text.split('\n');
  const elements = [];
  let bulletBuffer = [];

  const flushBullets = (key) => {
    if (!bulletBuffer.length) return;
    elements.push(
      <ul key={`ul-${key}`} className="space-y-2 mb-4 ml-2">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-2.5 items-start">
            <span className="text-[#005EB8] flex-shrink-0 mt-1.5 text-xs">•</span>
            <span className="text-sm text-[#374151] leading-relaxed">{renderInlineAnalysis(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flushBullets(i); return; }

    if (t.startsWith('# ')) {
      flushBullets(i);
      elements.push(
        <h2 key={i} className="text-xl font-extrabold text-[#00338D] mt-6 mb-3 pb-2 border-b-2 border-[#00338D]/20" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          {t.slice(2)}
        </h2>
      );
    } else if (t.startsWith('## ')) {
      flushBullets(i);
      elements.push(
        <h3 key={i} className="text-base font-bold text-[#00338D] mt-5 mb-2 pb-1.5 border-b border-[#D8DCE3]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          {t.slice(3)}
        </h3>
      );
    } else if (t.startsWith('### ')) {
      flushBullets(i);
      elements.push(
        <h4 key={i} className="text-sm font-bold text-[#1A1F36] mt-4 mb-2 uppercase tracking-wide" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
          {t.slice(4)}
        </h4>
      );
    } else if (t.startsWith('---')) {
      flushBullets(i);
      elements.push(<hr key={i} className="border-[#D8DCE3] my-4" />);
    } else if (/^[-*•]\s+/.test(t)) {
      bulletBuffer.push(t.replace(/^[-*•]\s+/, ''));
    } else if (/^\d+\.\s+/.test(t)) {
      flushBullets(i);
      const num = t.match(/^(\d+)\./)[1];
      const content = t.replace(/^\d+\.\s+/, '');
      elements.push(
        <div key={i} className="flex gap-3 items-start mb-2">
          <span className="w-6 h-6 rounded-full bg-[#00338D] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{num}</span>
          <span className="text-sm text-[#374151] leading-relaxed">{renderInlineAnalysis(content)}</span>
        </div>
      );
    } else {
      flushBullets(i);
      elements.push(
        <p key={i} className="text-sm text-[#374151] leading-relaxed mb-2">
          {renderInlineAnalysis(t)}
        </p>
      );
    }
  });
  flushBullets('end');
  return <div className="space-y-0.5 max-w-none">{elements}</div>;
}

function DownloadButton({ stageNum, stageName, rawOutput }) {
  const [loading, setLoading] = useState(false);
  const handleClick = () => {
    setLoading(true);
    exportPDF(stageNum, stageName, rawOutput).finally(() => setLoading(false));
  };
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-[#00338D] text-white rounded-xl text-sm font-bold hover:bg-[#002A73] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading
        ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating…</>
        : <><Download size={15} />Download Report</>}
    </button>
  );
}

export default function AnalysisDashboard() {
  const { stageOutputs, completedStages, uploadedDocAnalysis, uploadedDocName } = useAppStore();
  const [selectedStage, setSelectedStage] = useState(null);
  const [sections, setSections] = useState(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveData, setDeepDiveData] = useState(null);
  const printRef = useRef(null);

  const allStages = uploadedDocAnalysis ? ['doc', ...completedStages] : completedStages;

  // Pick uploaded doc or first completed stage by default
  useEffect(() => {
    if (!selectedStage) {
      if (uploadedDocAnalysis) setSelectedStage('doc');
      else if (completedStages.length > 0) setSelectedStage(completedStages[0]);
    }
  }, [completedStages, uploadedDocAnalysis]);

  const getRaw = (stage) => stage === 'doc' ? uploadedDocAnalysis : stageOutputs[stage];

  useEffect(() => {
    if (!selectedStage) return;
    const raw = getRaw(selectedStage);
    if (raw) setSections(parseAnalysisIntoSections(raw));
  }, [selectedStage, stageOutputs, uploadedDocAnalysis]);

  // Generate structured deep-dive from the raw output
  useEffect(() => {
    const raw = getRaw(selectedStage);
    if (!selectedStage || !raw) return;
    setDeepDiveLoading(true);
    setDeepDiveData(null);

    const prompt = `Based on this datacenter analysis, extract structured data in JSON format.

Analysis text:
${raw}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "readinessScore": <0-100 number>,
  "riskScore": <0-100 number>,
  "opportunityScore": <0-100 number>,
  "gaps": [
    {"text": "gap description", "severity": "high|medium|low"},
    ...max 5 gaps
  ],
  "recommendations": ["rec 1", "rec 2", "rec 3", "rec 4", "rec 5"],
  "nextSteps": ["step 1", "step 2", "step 3"],
  "keyInsight": "one sentence key takeaway"
}`;

    callClaude({ prompt, maxTokens: 8192 })
      .then(text => {
        try {
          const clean = text.replace(/```json|```/g, '').trim();
          setDeepDiveData(JSON.parse(clean));
        } catch { setDeepDiveData(null); }
      })
      .catch(() => setDeepDiveData(null))
      .finally(() => setDeepDiveLoading(false));
  }, [selectedStage]);

  if (allStages.length === 0) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] pt-16 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[#00338D]/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={28} className="text-[#00338D]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1F36] mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>No Analysis Available</h2>
          <p className="text-[#6B7280] text-sm mb-6">Upload a strategy document or generate insights in at least one lifecycle stage.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00338D] text-white rounded-xl text-sm font-bold hover:bg-[#002A73] transition-colors">
            Go to Platform
          </Link>
        </div>
      </div>
    );
  }

  const stageName = selectedStage === 'doc'
    ? (uploadedDocName ? uploadedDocName.replace(/\.[^.]+$/, '') : 'Strategy Document')
    : (STAGE_NAMES[selectedStage] || `Stage ${selectedStage}`);
  const rawOutput = getRaw(selectedStage) || '';

  return (
    <div className="min-h-screen bg-[#F0F2F5] pt-16">
      {/* Header */}
      <div className="bg-white border-b border-[#D8DCE3]">
        <div className="max-w-screen-xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href={selectedStage === 'doc' ? '/' : `/stage/${selectedStage}`} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1A1F36] transition-colors">
              <ArrowLeft size={16} />{selectedStage === 'doc' ? 'Back to Platform' : 'Back to Stage'}
            </Link>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#00338D]/10 text-[#00338D]">
                  {selectedStage === 'doc' ? 'DOCUMENT ANALYSIS' : 'DEEP DIVE ANALYSIS'}
                </span>
                {selectedStage === 'doc' && uploadedDocName && (
                  <span className="text-xs text-[#6B7280] truncate max-w-[200px]">{uploadedDocName}</span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                {stageName} — Intelligence Report
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Stage selector */}
              <div className="flex gap-1.5">
                {allStages.map(s => (
                  <button key={s} onClick={() => setSelectedStage(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedStage === s ? 'bg-[#00338D] text-white' : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'}`}>
                    {s === 'doc' ? 'DOC' : s}
                  </button>
                ))}
              </div>
              {/* Download */}
              <DownloadButton stageNum={selectedStage === 'doc' ? 'DOC' : selectedStage} stageName={stageName} rawOutput={rawOutput} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6" ref={printRef}>

        {/* Score rings row */}
        {deepDiveLoading ? (
          <div className="bg-white rounded-2xl border border-[#D8DCE3] p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-[#00338D]/30 border-t-[#00338D] rounded-full animate-spin" />
            <span className="text-[#6B7280] text-sm">Generating deep analysis...</span>
          </div>
        ) : deepDiveData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={16} className="text-[#00338D]" />
              <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Assessment Scores</h2>
            </div>
            <div className="flex items-center justify-around flex-wrap gap-6">
              <ScoreRing score={deepDiveData.readinessScore} label="Readiness" color="#00B0A0" />
              <ScoreRing score={100 - deepDiveData.riskScore} label="Risk Profile" color="#E87722" />
              <ScoreRing score={deepDiveData.opportunityScore} label="Opportunity" color="#005EB8" />
            </div>
            {deepDiveData.keyInsight && (
              <p className="mt-5 text-center text-sm text-[#6B7280] italic border-t border-[#D8DCE3] pt-4">
                "{deepDiveData.keyInsight}"
              </p>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gaps & Risks */}
          <SectionCard title="Gaps Analysed" icon={AlertTriangle} color="#E87722">
            {deepDiveLoading ? (
              <p className="text-[#9CA3AF] text-sm">Analysing gaps...</p>
            ) : deepDiveData?.gaps?.length ? (
              <div className="space-y-2">
                {deepDiveData.gaps.map((g, i) => <GapItem key={i} text={g.text} severity={g.severity} />)}
              </div>
            ) : sections?.gaps?.length ? (
              <div className="space-y-2">
                {sections.gaps.slice(0, 5).map((g, i) => <GapItem key={i} text={g} severity={i === 0 ? 'high' : i < 3 ? 'medium' : 'low'} />)}
              </div>
            ) : <p className="text-[#9CA3AF] text-sm italic">No gaps identified.</p>}
          </SectionCard>

          {/* Recommendations */}
          <SectionCard title="Actions & Recommendations" icon={Target} color="#00338D">
            {deepDiveLoading ? (
              <p className="text-[#9CA3AF] text-sm">Building recommendations...</p>
            ) : (
              <div className="space-y-2.5">
                {(deepDiveData?.recommendations || sections?.recommendations || []).slice(0, 5).map((r, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-[#F0F2F5] rounded-xl border border-[#D8DCE3]">
                    <div className="w-6 h-6 rounded-full bg-[#00338D] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">{i + 1}</div>
                    <p className="text-sm text-[#1A1F36] leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Key Findings */}
        <SectionCard title="Key Findings" icon={TrendingUp} color="#005EB8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(sections?.findings || sections?.summary || []).slice(0, 6).map((f, i) => (
              <div key={i} className="flex gap-2.5 items-start p-3 bg-[#F0F2F5] rounded-xl border border-[#D8DCE3]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#005EB8] flex-shrink-0 mt-2" />
                <p className="text-sm text-[#374151] leading-relaxed">{f}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Next Steps — Interactive Timeline */}
        {(deepDiveData?.nextSteps || sections?.nextSteps || []).length > 0 && (
          <SectionCard title="Outcomes & Next Steps" icon={CheckCircle2} color="#00B0A0">
            <InteractiveTimeline steps={deepDiveData?.nextSteps || sections?.nextSteps || []} />
          </SectionCard>
        )}

        {/* Full Analysis */}
        <SectionCard title="Full Analysis" icon={FileText} color="#6B7280" defaultOpen={false}>
          <FullAnalysisRenderer text={rawOutput} />
        </SectionCard>

        <div className="text-center pb-4">
          <p className="text-[#CBD5E1] text-xs">© KPMG 2026 · K-Nexus Intelligence Platform · Strictly Confidential</p>
        </div>
      </div>
    </div>
  );
}