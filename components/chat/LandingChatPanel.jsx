'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Send, ChevronRight, X, Paperclip, FileText, Maximize2, Minimize2,
  LayoutDashboard, FileSearch, Download, Zap, Building2,
  TrendingUp, Wrench, DollarSign, Package, Shield, Activity,
} from 'lucide-react';
import { LoadingDots } from '@/components/shared/LoadingDots';
import { callClaude } from '@/lib/claude-api';
import { writeToWiki } from '@/lib/wiki';
import { researchClientLight } from '@/lib/research';
import DecisionQuickStarts from '@/components/decision-cockpit/DecisionQuickStarts';
import TransitionOverlay from '@/components/cockpit/TransitionOverlay';
import { matchCockpit, isCockpitShortcut } from '@/lib/cockpit/trigger';
import { COCKPITS, DEFAULT_COCKPIT, cockpitPath } from '@/data/cockpit';

// ── Stage directory ──────────────────────────────────────────────────────────
const STAGE_DIRECTORY = [
  { num: '01', path: '/stage/01', label: 'Strategy',                keywords: ['strategy','market','region','invest','business case','opportunity'] },
  { num: '02', path: '/stage/02', label: 'Supply Chain Management', keywords: ['supply','procurement','vendor','hardware','sourcing','capex'] },
  { num: '03', path: '/stage/03', label: 'Design & Build',          keywords: ['design','build','construct','cooling','power','tier','pue','rack'] },
  { num: '04', path: '/stage/04', label: 'Compliance',              keywords: ['compliance','regulation','legal','gdpr','esg','audit','iso'] },
  { num: '05', path: '/stage/05', label: 'Operations',              keywords: ['operate','operations','dcim','monitoring','uptime','sla','efficiency'] },
  { num: '06', path: '/stage/06', label: 'Monetization',            keywords: ['monetize','revenue','colocation','pricing','ebitda','profit'] },
];

// ── Personas ─────────────────────────────────────────────────────────────────
const PERSONAS = [
  {
    key: 'builder',
    label: 'Builder',
    Icon: Building2,
    color: '#005EB8',
    bg: 'rgba(0,119,200,0.10)',
    border: 'rgba(0,119,200,0.25)',
    greeting: "Great — I'll help you build a compelling case for your new datacenter. Tell me about the market you're targeting, the capacity you have in mind, or any specific questions about the build journey.",
    systemSuffix: '\n\nClient context: This is a greenfield builder — they have no existing datacenter and want to build from scratch. Focus on market opportunity, site selection, power procurement, regulatory requirements, and build strategy.',
  },
  {
    key: 'expander',
    label: 'Expander',
    Icon: TrendingUp,
    color: '#059669',
    bg: 'rgba(5,150,105,0.10)',
    border: 'rgba(5,150,105,0.25)',
    greeting: "Looking to grow your footprint — let's explore the best path forward. Tell me about your existing capacity, the geography you're targeting, or whether you're considering organic growth, M&A, or new geographies.",
    systemSuffix: '\n\nClient context: This is an expander — they have existing datacenter capacity and want to grow. Focus on organic expansion, M&A opportunities, new geographies, financing structures, and capacity planning.',
  },
  {
    key: 'operator',
    label: 'Operator',
    Icon: Wrench,
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    border: 'rgba(124,58,237,0.25)',
    greeting: "Let's optimise your datacenter operations. Share your current challenges — whether it's PUE, compliance, staffing, DCIM, or SLA management — and I'll point you to the right tools.",
    systemSuffix: '\n\nClient context: This is an operator — they run existing datacenters and want to improve efficiency, compliance, and operational excellence. Focus on PUE optimisation, DCIM, staffing, regulatory compliance, and incident management.',
  },
  {
    key: 'investor',
    label: 'Investor',
    Icon: DollarSign,
    color: '#B45309',
    bg: 'rgba(180,83,9,0.10)',
    border: 'rgba(180,83,9,0.25)',
    greeting: "Welcome — I can help you evaluate datacenter investment opportunities. Tell me about your fund thesis, target returns, geographies of interest, or any specific deals you're assessing.",
    systemSuffix: '\n\nClient context: This is a financial investor (PE/VC/sovereign fund) evaluating datacenter investments. Focus on deal sourcing, IRR analysis, risk-adjusted returns, capital structures, exit strategies, and market timing.',
  },
];

const BASE_SYSTEM = `You are the K-Nexus Guide — a friendly, concise AI assistant on the KPMG K-Nexus Datacenter Intelligence Platform.

Your job: understand what the user wants to accomplish, then recommend the most relevant stage(s) to start with.

The 6 stages are:
01 - Strategy: Market opportunity, region selection, demand analysis, investment thesis
02 - Supply Chain Management: Procurement strategy, vendors, components, CapEx planning
03 - Design & Build: Technical architecture, cooling, power, tier rating, construction approach
04 - Compliance: Regulatory requirements, data sovereignty, ESG, certifications
05 - Operations: Day-to-day running, DCIM, staffing, PUE optimization, SLAs
06 - Monetization: Revenue models, pricing, colocation, customer segments

RULES:
- Be warm, concise, and direct. 1 sentence intro max, then bullet points using "- " prefix.
- Use bullet points for any list of stages or recommendations. Never write long paragraphs.
- Never use ** or any markdown bold. Plain text only.
- Always end with a raw JSON block in this exact format:
  {"stage": "01", "label": "Strategy", "reason": "one short sentence", "isComplex": false}
- Set "isComplex": true if the query involves multiple stages, unclear preferences, new market entry, partnership questions, or a named company/client with specific requirements.
- The JSON must be the very last thing in your response. No text after it.
- If the user is clearly asking about multiple stages, pick the best starting point.
- If the message is a greeting or too vague, ask one clarifying question and do NOT include the JSON block yet.
- Never make up features — only reference the 6 stages above.`;

const QUICK_REPORT_SYSTEM = `You are a senior KPMG Datacenter Advisory Partner generating a concise client assessment report.
Generate with EXACT sections: # Executive Summary / # Client Overview / # Strategic Options (3: A, B, C) / # Recommended Lifecycle Stages / # Key Risks & Watch-outs / # Immediate Next Steps for KPMG
RULES: Plain text only. No **. Specific and quantitative. Confident, senior advisory tone.`;

const DETAILED_REPORT_SYSTEM = `You are a senior KPMG Datacenter Advisory Partner generating a comprehensive lifecycle assessment.
Generate with EXACT sections: # Executive Summary / # Client Deep-Dive / # Market Context / # Strategic Options Analysis (3 paths) / # Stage-by-Stage Lifecycle Roadmap (all 6) / # Partnership & Structuring Options / # Regulatory & Compliance Snapshot / # Financial Framework / # Risk Matrix (8-10 risks) / # KPMG Engagement Roadmap / # KPIs & Success Metrics
RULES: Plain text only. No **. Highly specific. Quantitative benchmarks. Authoritative tone.`;

const PERSONA_DETECTION_SYSTEM = `Classify into one of four datacenter personas. Return ONLY JSON:
{"persona": "builder"|"expander"|"operator"|"investor", "confidence": number, "clarificationNeeded": boolean, "clarificationQuestion": "string or null"}`;

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportAssessmentPDF(clientName, reportType, reportContent) {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');
  const PAGE_W = 794, PAGE_H = 1123, PAD = 48;
  const USABLE_H = PAGE_H - PAD * 2 - 48;
  const scale = window.devicePixelRatio * 2;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const reportLabel = reportType === 'quick' ? 'Quick Assessment' : 'Detailed Lifecycle Assessment';

  const CONTENT_CSS = `*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;}
    .section{break-inside:avoid;margin-bottom:22px;}
    .h1{font-size:16px;font-weight:800;color:#00338D;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #D8DCE3;}
    .h2{font-size:14px;font-weight:700;color:#00338D;margin-bottom:5px;border-bottom:1px solid #D8DCE3;padding-bottom:5px;}
    .para{font-size:12px;line-height:1.8;color:#374151;}
    .bullet-list{margin:0;padding-left:0;list-style:none;}
    .bullet-list li{font-size:12px;line-height:1.75;color:#374151;padding-left:16px;position:relative;margin-bottom:3px;}
    .bullet-list li::before{content:"•";position:absolute;left:2px;color:#005EB8;font-size:11px;}
    .badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:#E8F0FB;color:#00338D;display:inline-block;margin-bottom:16px;}
    .footer-row{padding-top:12px;border-top:1px solid #D8DCE3;display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF;}
    .page-num{position:absolute;bottom:24px;right:${PAD}px;font-size:10px;color:#CBD5E1;}`;

  function inlineFormat(t) { return t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>'); }
  function markdownToSections(md) {
    const lines = md.split('\n'); const sections = []; let buf = []; let bufType = null;
    const flush = () => { if (!buf.length) return; sections.push(`<div class="section"><ul class="bullet-list">${buf.map(b=>`<li>${inlineFormat(b)}</li>`).join('')}</ul></div>`); buf=[]; bufType=null; };
    for (const raw of lines) {
      const t = raw.trim();
      if (!t) { flush(); continue; }
      if (t.startsWith('# '))       { flush(); sections.push(`<div class="section"><div class="h1">${inlineFormat(t.slice(2))}</div></div>`); }
      else if (t.startsWith('## ')) { flush(); sections.push(`<div class="section"><div class="h2">${inlineFormat(t.slice(3))}</div></div>`); }
      else if (/^[-*•]\s+/.test(t)) { bufType='bullet'; buf.push(t.replace(/^[-*•]\s+/,'')); }
      else { flush(); sections.push(`<div class="section"><p class="para">${inlineFormat(t)}</p></div>`); }
    }
    flush(); return sections;
  }

  const allSections = [`<div class="section"><div class="badge">K-NEXUS · ${reportLabel.toUpperCase()}</div></div>`, ...markdownToSections(reportContent),
    `<div class="section footer-row"><span>K-Nexus Intelligence Platform</span><span>${clientName} — ${reportLabel}</span><span>${date}</span></div>`];
  const waitFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const measureEl = document.createElement('div');
  measureEl.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;background:white;z-index:-1;padding:${PAD}px;`;
  measureEl.innerHTML = `<style>${CONTENT_CSS}</style>${allSections.join('')}`;
  document.body.appendChild(measureEl);
  await waitFrame();
  const heights = Array.from(measureEl.querySelectorAll('.section')).map(el => el.getBoundingClientRect().height + 28);
  document.body.removeChild(measureEl);

  const pages = []; let cp = { htmls: [], height: 0 };
  allSections.forEach((html, i) => {
    const h = heights[i] ?? 0;
    if (cp.height + h > USABLE_H && cp.htmls.length > 0) { pages.push(cp); cp = { htmls: [], height: 0 }; }
    cp.htmls.push(html); cp.height += h;
  });
  if (cp.htmls.length > 0) pages.push(cp);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth(), pdfH = pdf.internal.pageSize.getHeight();
  const capture = async (innerHTML, bg = '#ffffff') => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:${bg};z-index:-1;`;
    el.innerHTML = innerHTML; document.body.appendChild(el); await waitFrame();
    const canvas = await html2canvas(el, { scale, useCORS: true, backgroundColor: bg, width: PAGE_W, height: PAGE_H });
    document.body.removeChild(el); return canvas;
  };

  const coverCanvas = await capture(`<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;}</style>
    <div style="background:linear-gradient(135deg,#00338D 0%,#005EB8 100%);color:white;width:${PAGE_W}px;height:${PAGE_H}px;padding:60px ${PAD}px;">
      <div style="font-size:32px;font-weight:900;letter-spacing:4px;margin-bottom:8px;">K-Nexus.AI</div>
      <div style="font-size:11px;letter-spacing:3px;opacity:0.6;text-transform:uppercase;margin-bottom:48px;">Datacenter Lifecycle Intelligence</div>
      <div style="font-size:36px;font-weight:800;margin-bottom:16px;">${clientName}</div>
      <div style="font-size:16px;opacity:0.75;margin-bottom:8px;">${reportLabel}</div>
      <div style="font-size:13px;opacity:0.5;">AI-generated briefing · Strictly Confidential</div>
      <div style="position:absolute;bottom:60px;left:${PAD}px;right:${PAD}px;display:flex;justify-content:space-between;font-size:11px;opacity:0.55;">
        <span>Generated: ${date}</span><span>KPMG Advisory · Confidential</span></div></div>`, '#00338D');
  pdf.addImage(coverCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);
  for (let i = 0; i < pages.length; i++) {
    pdf.addPage();
    const canvas = await capture(`<style>${CONTENT_CSS}</style><div style="position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:white;padding:${PAD}px;padding-bottom:80px;">${pages[i].htmls.join('')}<div class="page-num">${i+2}</div></div>`);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, pdfH);
  }
  pdf.save(`KNexus_${clientName.replace(/[^a-zA-Z0-9]/g,'_')}_${reportType === 'quick' ? 'Quick' : 'Detailed'}_Assessment.pdf`);
}

// ── Text renderer ─────────────────────────────────────────────────────────────
function renderBotText(text) {
  const clean = text.replace(/```json[\s\S]*?```/gi, '').replace(/```/g, '').trim();
  return clean.split('\n').filter(l => l.trim()).map((line, i) => {
    const t = line.trim();
    if (/^[-•*]\s+/.test(t)) return (
      <div key={i} className="flex gap-1.5 items-start">
        <span className="text-[#005EB8] flex-shrink-0 mt-0.5">•</span>
        <span>{t.replace(/^[-•*]\s+/, '')}</span>
      </div>
    );
    if (/^\d+\.\s+/.test(t)) {
      const num = t.match(/^(\d+)\./)[1];
      return (
        <div key={i} className="flex gap-1.5 items-start">
          <span className="text-[#005EB8] font-bold flex-shrink-0">{num}.</span>
          <span>{t.replace(/^\d+\.\s+/, '')}</span>
        </div>
      );
    }
    return <p key={i} className="leading-relaxed">{t}</p>;
  });
}

// ── File handling ─────────────────────────────────────────────────────────────
const ACCEPT = '.pdf,.xlsx,.xls,.csv,.tsv';
const PARSEABLE_EXTS = ['.csv', '.tsv'];

async function readFileText(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!PARSEABLE_EXTS.includes(ext)) return null;
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result?.slice(0, 4000) ?? null);
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

function buildFileContext(files, fileTexts) {
  if (!files.length) return '';
  return '\n\n[Uploaded files:\n' + files.map((f, i) => {
    const text = fileTexts[i];
    return text ? `File: ${f.name}\n---\n${text}\n---` : `File attached (content not extracted): ${f.name}`;
  }).join('\n\n') + ']';
}

// ── Idle state panel ──────────────────────────────────────────────────────────
function IdleStatePanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.3 }}
      className="mt-3 space-y-4"
    >
      <DecisionQuickStarts />
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingChatPanel({ onToggleExpand, expanded = false }) {
  const router = useRouter();

  const [selectedPersona, setSelectedPersona] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your K-Nexus Guide. Select a persona above to get a tailored experience, or just describe what you're trying to accomplish." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirect, setRedirect] = useState(null);
  const [botPhase, setBotPhase] = useState('chat');
  const [clientContext, setClientContext] = useState('');
  const [clientName, setClientName] = useState('Client');
  const [reportContent, setReportContent] = useState('');
  const [reportType, setReportType] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [detectedPersona, setDetectedPersona] = useState(null);
  const [personaClarificationQ, setPersonaClarificationQ] = useState(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [fileTexts, setFileTexts] = useState([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldScrollRef = useRef(false);
  // Presentation cockpit launched from the Guide (static, no model call).
  const [cockpitLaunch, setCockpitLaunch] = useState(null);
  // Prefetch the route so launching makes no requests.
  useEffect(() => { router.prefetch(cockpitPath(DEFAULT_COCKPIT)); }, [router]);

  const isIdle = messages.length <= 1 && botPhase === 'chat' && !loading;

  useEffect(() => {
    if (!shouldScrollRef.current) return;
    shouldScrollRef.current = false;
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handlePersonaSelect = (p) => {
    if (selectedPersona?.key === p.key) return;
    setSelectedPersona(p);
    setMessages([{ role: 'assistant', text: p.greeting }]);
    setRedirect(null);
    setBotPhase('chat');
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const addFiles = async (newFiles) => {
    const limited = [...newFiles].slice(0, 5 - attachedFiles.length);
    if (!limited.length) return;
    const texts = await Promise.all(limited.map(readFileText));
    setAttachedFiles(prev => [...prev, ...limited]);
    setFileTexts(prev => [...prev, ...texts]);
  };

  const removeFile = (idx) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    setFileTexts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    addFiles(e.dataTransfer.files);
  };

  const extractClientName = (query) => {
    const patterns = [
      /(?:client|company)[,\s]+([A-Z][a-zA-Z\s]+?)(?:\s+is|\s+are|\s+wants|\s*,)/i,
      /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:Group|Ltd|Limited|Inc|Corp|Pvt)/i,
      /^([A-Z][a-zA-Z\s]+?)(?:\s+is|\s+are|\s+wants|\s*,|\s+looking)/,
    ];
    for (const p of patterns) { const m = query.match(p); if (m) return m[1].trim(); }
    return 'Client';
  };

  const parseResponse = (text) => {
    const jsonMatch = text.match(/\{[\s\S]*?"stage"\s*:\s*"([^"]*)"[\s\S]*?\}/);
    let stageData = null;
    if (jsonMatch) { try { stageData = JSON.parse(jsonMatch[0]); } catch {} }
    const cleanText = text
      .replace(/```json[\s\S]*?```/gi,'').replace(/```[\s\S]*?```/g,'')
      .replace(/\{[\s\S]*?"stage"\s*:\s*"[^"]*"[\s\S]*?\}/g,'').replace(/`{1,3}/g,'').trim();
    return { cleanText, stageData };
  };

  const runPersonaDetection = async (brief, researchContext) => {
    setPersonaLoading(true);
    try {
      const raw = await callClaude({ prompt: `Client brief: ${brief}\nResearch: ${researchContext || 'None.'}`, systemOverride: PERSONA_DETECTION_SYSTEM, maxTokens: 200 });
      const data = JSON.parse(raw.replace(/```json|```/gi,'').trim());
      if (data.clarificationNeeded) setPersonaClarificationQ(data.clarificationQuestion || 'Are you looking to build, expand, improve operations, or invest?');
      else setDetectedPersona(data.persona);
    } catch { /* fail silently */ }
    finally { setPersonaLoading(false); }
  };

  // sendMessage accepts optional overrideText (from quick-start chips)
  const sendMessage = async (overrideText) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || loading || cockpitLaunch) return;

    // Presentation cockpits answer before any model call: '/cockpit' goes straight
    // there; a matching client brief plays the analysing beat, then routes.
    if (isCockpitShortcut(trimmed)) { setInput(''); router.push(cockpitPath(DEFAULT_COCKPIT), { scroll: false }); return; }
    const cockpit = matchCockpit(trimmed);
    if (cockpit) {
      shouldScrollRef.current = true;
      setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
      setInput('');
      setCockpitLaunch(cockpit);
      return;
    }

    const fileContext = buildFileContext(attachedFiles, fileTexts);
    const userMsg = { role: 'user', text: trimmed + (attachedFiles.length ? ` [${attachedFiles.length} file(s) attached]` : '') };
    shouldScrollRef.current = true;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFiles([]);
    setFileTexts([]);
    setLoading(true);
    setRedirect(null);

    const name = extractClientName(trimmed);
    if (name !== 'Client') setClientName(name);
    setClientContext(trimmed + fileContext);

    const researchPromise = trimmed.length > 80 ? researchClientLight({ clientName: name, brief: trimmed }) : Promise.resolve(null);
    const history = [...messages, userMsg].map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n\n');
    const researchResult = await researchPromise;
    const personaSuffix = selectedPersona?.systemSuffix ?? '';
    const enrichedHistory = [researchResult ? `[Research: ${researchResult}]` : '', fileContext ? `[Documents:${fileContext}]` : '', history].filter(Boolean).join('\n\n');

    try {
      const response = await callClaude({
        prompt: enrichedHistory,
        systemOverride: BASE_SYSTEM + personaSuffix,
        maxTokens: 500,
        ragQuery: trimmed.length > 50 ? `${name} company datacenter India` : null,
      });
      const { cleanText, stageData } = parseResponse(response);
      shouldScrollRef.current = true;
      setMessages(prev => [...prev, { role: 'assistant', text: cleanText }]);

      if (stageData?.stage) {
        const match = STAGE_DIRECTORY.find(s => s.num === stageData.stage);
        if (match) {
          setRedirect({ stage: match.num, label: match.label, path: match.path, reason: stageData.reason || '' });
          if (stageData.isComplex) { setBotPhase('assessment-offer'); runPersonaDetection(trimmed, researchResult); }
        }
      }
    } catch (err) {
      console.error('[K-Nexus Guide] chat request failed:', err);
      shouldScrollRef.current = true;
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, I hit an error: ${err.message}` }]);
    } finally { setLoading(false); }
  };

  const handleGenerateReport = async (type) => {
    setReportType(type);
    setBotPhase('generating');
    const label = type === 'quick' ? 'Quick Assessment (2-3 pages)' : 'Detailed Lifecycle Assessment';
    setMessages(prev => [...prev, { role: 'assistant', text: `Generating your ${label} for ${clientName}. Researching background and analysing all lifecycle stages...` }]);
    try {
      const content = await callClaude({
        prompt: `Generate a ${label} for:\n\n${clientContext}\n\nClient name: ${clientName}`,
        systemOverride: type === 'quick' ? QUICK_REPORT_SYSTEM : DETAILED_REPORT_SYSTEM,
        maxTokens: type === 'quick' ? 4000 : 12000,
        ragQuery: `${clientName} company profile business India datacenter`,
      });
      setReportContent(content);
      setBotPhase('done');
      setMessages(prev => [...prev, { role: 'assistant', text: `Your ${label} for ${clientName} is ready. Click below to download the PDF.` }]);
    } catch (err) {
      setBotPhase('assessment-offer');
      setMessages(prev => [...prev, { role: 'assistant', text: `Sorry, I couldn't generate the report: ${err.message}` }]);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try { await exportAssessmentPDF(clientName, reportType, reportContent); }
    catch (err) { setMessages(prev => [...prev, { role: 'assistant', text: `PDF export failed: ${err.message}` }]); }
    finally { setPdfLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div
      className="flex flex-col h-full relative"
      style={{ background: 'rgba(255,255,255,0.98)' }}
      onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleFileDrop}
    >
      {cockpitLaunch && (
        <TransitionOverlay
          lines={COCKPITS[cockpitLaunch].trigger.analysing}
          onDone={() => router.push(cockpitPath(cockpitLaunch), { scroll: false })}
        />
      )}
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-[#F0F2F5] flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#EEF3FD] flex items-center justify-center flex-shrink-0">
            <Sparkles size={17} className="text-[#2F5EA8]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#17233F] font-bold text-[15px] leading-none" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              K-Nexus Guide
            </p>
            <p className="text-[#8B95A9] text-[12px] mt-1">Datacenter lifecycle advisor</p>
          </div>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              aria-label={expanded ? 'Collapse guide' : 'Expand guide'}
              className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-[#9BAAC6] hover:text-[#2F5EA8] hover:bg-[#F2F6FD] transition-colors flex-shrink-0"
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
        </div>

        {/* Persona selector */}
        <p className="text-[#9BA6BC] text-[10px] font-bold uppercase tracking-[1.3px] mb-2">Who are you?</p>
        <div className="grid grid-cols-4 gap-2">
          {PERSONAS.map(p => {
            const active = selectedPersona?.key === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handlePersonaSelect(p)}
                className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-center transition-all duration-150 hover:border-[#BBD0EE]"
                style={{
                  background: active ? '#EEF3FD' : '#FFFFFF',
                  border: `1px solid ${active ? '#9EBDEA' : '#E7ECF5'}`,
                }}
              >
                <p.Icon size={16} style={{ color: active ? '#2F5EA8' : '#97A3B8' }} strokeWidth={1.9} />
                <span className="text-[11.5px] font-semibold leading-none" style={{ color: active ? '#1D3E80' : '#6C788F' }}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Messages area (flex-1 = takes remaining height, internal scroll) ── */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {!isIdle && messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs space-y-1 ${
              msg.role === 'user' ? 'bg-[#00338D] text-white rounded-br-sm' : 'bg-[#F0F2F5] text-[#374151] rounded-bl-sm'
            }`}>
              {msg.role === 'user' ? msg.text : renderBotText(msg.text)}
            </div>
          </div>
        ))}

        {/* ── Idle state — fills space before first user message ── */}
        <AnimatePresence>
          {isIdle && <IdleStatePanel />}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#F0F2F5] px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </div>
        )}

        {/* Stage routing card */}
        {redirect && botPhase !== 'generating' && botPhase !== 'done' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#F0F4FF] border border-[#00338D]/15 rounded-2xl p-3.5">
            <p className="text-[10px] text-[#6B7280] mb-2">Recommended starting stage</p>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-xs font-bold text-[#00338D]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
                  Stage {redirect.stage} — {redirect.label}
                </p>
                {redirect.reason && <p className="text-[10px] text-[#6B7280] mt-0.5">{redirect.reason}</p>}
              </div>
              <button onClick={() => router.push(redirect.path)}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#00338D] text-white text-[10px] font-bold rounded-lg hover:bg-[#002A73] transition-colors">
                Go <ChevronRight size={10} />
              </button>
            </div>

            {botPhase === 'assessment-offer' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-[#00338D]/10 pt-3 space-y-2">
                <p className="text-[10px] text-[#6B7280] font-medium">Complex requirement detected. How would you like to proceed?</p>
                {personaClarificationQ && !detectedPersona && (
                  <div className="mb-2">
                    <p className="text-[10px] text-[#374151] mb-2">{personaClarificationQ}</p>
                    <div className="flex flex-col gap-1.5">
                      {[{key:'builder',label:'Build New DC',Icon:Building2},{key:'expander',label:'Expand Existing',Icon:TrendingUp},{key:'operator',label:'Improve Operations',Icon:Wrench},{key:'investor',label:'Financial Investor',Icon:DollarSign}].map(({key,label,Icon}) => (
                        <button key={key} onClick={() => { setDetectedPersona(key); setPersonaClarificationQ(null); }}
                          className="flex items-center gap-2 px-3 py-2 bg-white border border-[#00338D]/20 text-[#00338D] text-[10px] font-bold rounded-lg hover:bg-[#00338D]/5 transition-colors">
                          <Icon size={11} />{label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {personaLoading && !personaClarificationQ && !detectedPersona && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-3 h-3 border-2 border-[#005EB8]/30 border-t-[#005EB8] rounded-full animate-spin flex-shrink-0" />
                    <span className="text-[9px] text-[#9CA3AF]">Analysing client profile...</span>
                  </div>
                )}
                <button onClick={() => {
                  const params = new URLSearchParams({ brief: clientContext, client: clientName !== 'Client' ? clientName : '', ...(detectedPersona ? { persona: detectedPersona } : {}) });
                  router.push(`/client-cockpit?${params.toString()}`);
                }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-white text-[10px] font-bold rounded-xl transition-colors"
                  style={{ background: 'linear-gradient(135deg, #00338D 0%, #005EB8 100%)' }}>
                  <LayoutDashboard size={11} /> Client Cockpit — Live Dashboard
                </button>
                <button onClick={() => setBotPhase('report-type')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#00338D]/20 text-[#00338D] text-[10px] font-bold rounded-xl hover:bg-[#00338D]/5 transition-colors">
                  <FileSearch size={11} /> Generate Assessment Report
                </button>
              </motion.div>
            )}

            {botPhase === 'report-type' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-[#00338D]/10 pt-3 space-y-2">
                <p className="text-[10px] text-[#6B7280] font-medium">Choose your report type:</p>
                {[{type:'quick',Icon:Zap,label:'Quick Report — 2-3 Pages',desc:'High-impact with strategic options'},{type:'detailed',Icon:FileText,label:'Detailed Report — Full Lifecycle',desc:'End-to-end analysis across all 6 stages'}].map(({type,Icon,label,desc}) => (
                  <button key={type} onClick={() => handleGenerateReport(type)}
                    className="w-full text-left px-3 py-2.5 bg-white border border-[#00338D]/20 rounded-xl hover:border-[#00338D] hover:bg-[#00338D]/5 transition-all">
                    <div className="flex items-center gap-2">
                      <Icon size={12} className="text-[#005EB8] flex-shrink-0" />
                      <div><p className="text-[10px] font-bold text-[#00338D]">{label}</p><p className="text-[9px] text-[#9CA3AF]">{desc}</p></div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {botPhase === 'generating' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#F0F4FF] border border-[#00338D]/15 rounded-2xl p-4 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-[#00338D]/10 flex items-center justify-center"><Sparkles size={18} className="text-[#005EB8]" /></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-2 border-[#005EB8]/40 border-t-[#005EB8] rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-[#00338D]">Generating assessment...</p>
              <p className="text-[9px] text-[#9CA3AF] mt-0.5">Researching {clientName} & analysing lifecycle</p>
            </div>
            <LoadingDots color="#005EB8" size={6} />
          </motion.div>
        )}

        {botPhase === 'done' && reportContent && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#F0FFF8] border border-[#00B0A0]/20 rounded-2xl p-3.5">
            <p className="text-[10px] text-[#6B7280] mb-2">
              {reportType === 'quick' ? 'Quick Assessment' : 'Detailed Report'} ready for {clientName}
            </p>
            <button onClick={handleDownloadPDF} disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#00338D] text-white text-[10px] font-bold rounded-xl hover:bg-[#002A73] transition-colors disabled:opacity-60">
              {pdfLoading ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Preparing PDF...</> : <><Download size={11} />Download PDF Report</>}
            </button>
            <button onClick={() => { setBotPhase('report-type'); setReportContent(''); }}
              className="w-full mt-1.5 text-[9px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors py-1">
              Generate different report type
            </button>
          </motion.div>
        )}

      </div>

      {/* ── Attached file chips ── */}
      {attachedFiles.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-[#F0F4FF] border border-[#00338D]/15 rounded-lg px-2.5 py-1.5 text-[10px] text-[#00338D] font-medium">
              <FileText size={10} />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-[#9CA3AF] hover:text-red-400 transition-colors ml-0.5"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Drag overlay ── */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: 'rgba(0,51,141,0.07)', border: '2px dashed rgba(0,51,141,0.3)' }}>
            <div className="text-center">
              <Paperclip size={28} className="text-[#00338D] mx-auto mb-2" />
              <p className="text-[#00338D] font-bold text-sm">Drop files to attach</p>
              <p className="text-[#6B7280] text-xs mt-0.5">PDF · Excel · CSV · TSV</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      {(botPhase === 'chat' || botPhase === 'assessment-offer') && (
        <div className="px-4 pb-4 pt-2 border-t border-[#F0F2F5] flex-shrink-0">
          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={attachedFiles.length >= 5}
              className="w-8 h-8 rounded-xl bg-[#F0F2F5] flex items-center justify-center text-[#9CA3AF] hover:text-[#00338D] hover:bg-[#F0F4FF] transition-colors flex-shrink-0 mb-0.5 disabled:opacity-40"
              title="Attach file (PDF, Excel, CSV, TSV)"
            >
              <Paperclip size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept={ACCEPT} multiple className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />

            <div
              className="flex-1 rounded-2xl pl-3.5 pr-2 py-2 flex items-end gap-2.5"
              style={{ background: '#F7F9FD', border: '1px solid #E7ECF5' }}
            >
              <Sparkles size={15} className="text-[#9BAAC6] flex-shrink-0 mb-2" />
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!!cockpitLaunch}
                placeholder="Ask K-Nexus anything…"
                rows={1}
                className="flex-1 bg-transparent text-[13px] text-[#1A1F36] placeholder-[#9BA6BC] outline-none resize-none leading-6 py-1"
                style={{ maxHeight: '80px', overflowY: 'auto' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
              />
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-full bg-[#2F5EA8] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1D3E80] transition-colors flex-shrink-0">
                <Send size={14} />
              </button>
            </div>
          </div>
          {attachedFiles.length > 0 && (
            <p className="text-[9px] text-[#9CA3AF] mt-1.5 pl-10">{attachedFiles.length} file(s) will be sent with your next message</p>
          )}
        </div>
      )}
    </div>
  );
}
