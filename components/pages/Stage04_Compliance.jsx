'use client';
import { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StageLayout from '@/components/stage-pages/StageLayout';
import { FormField, Select, MultiSelect, Toggle } from '@/components/stage-pages/FormComponents';
import { callClaude, buildContextualPrompt, buildRagQuery } from '@/lib/claude-api';

const STAGE_CONTEXT = `This stage covers the compliance, regulatory, tax, and certification requirements for datacenter operations across multiple jurisdictions.`;

const COMPLIANCE_FRAMEWORK = [
  {
    category: 'Data Protection & Privacy',
    items: [
      { id: 'gdpr', label: 'GDPR / UK GDPR', description: 'EU & UK data protection regulation', jurisdictions: ['Ireland', 'United Kingdom', 'European Union (CSRD/NIS2)'] },
      { id: 'dpdp', label: 'DPDP Act (India)', description: 'Digital Personal Data Protection Act', jurisdictions: ['India (DPDP Act)'] },
      { id: 'pdpa', label: 'PDPA (Singapore)', description: 'Personal Data Protection Act', jurisdictions: ['Singapore (PDPA)'] },
      { id: 'ccpa', label: 'US State Privacy Laws', description: 'CCPA, CPRA and state-level laws', jurisdictions: ['United States (State laws)'] },
    ],
  },
  {
    category: 'Infrastructure & Security',
    items: [
      { id: 'tia942', label: 'TIA-942', description: 'Datacenter infrastructure standard', jurisdictions: [] },
      { id: 'iso27001', label: 'ISO 27001', description: 'Information security management', jurisdictions: [] },
      { id: 'soc2', label: 'SOC 2 Type II', description: 'Security, availability & confidentiality', jurisdictions: [] },
      { id: 'pcidss', label: 'PCI DSS', description: 'Payment card industry data security', jurisdictions: [] },
      { id: 'uptime', label: 'Uptime Institute Tier', description: 'Tier I–IV certification', jurisdictions: [] },
    ],
  },
  {
    category: 'ESG & Sustainability',
    items: [
      { id: 'csrd', label: 'CSRD / ESG Reporting', description: 'EU Corporate Sustainability Reporting', jurisdictions: ['European Union (CSRD/NIS2)'] },
      { id: 'leed', label: 'LEED / BREEAM', description: 'Green building certification', jurisdictions: [] },
      { id: 'iso14001', label: 'ISO 14001', description: 'Environmental management systems', jurisdictions: [] },
    ],
  },
  {
    category: 'Cybersecurity',
    items: [
      { id: 'nis2', label: 'NIS2 Directive', description: 'EU network & information security', jurisdictions: ['European Union (CSRD/NIS2)'] },
      { id: 'cyberessentials', label: 'Cyber Essentials Plus (UK)', description: 'UK government cybersecurity scheme', jurisdictions: ['United Kingdom (UK GDPR)'] },
      { id: 'fedramp', label: 'FedRAMP', description: 'US federal cloud security standard', jurisdictions: ['United States (State laws)'] },
      { id: 'mtcs', label: 'MTCS (Singapore)', description: 'Multi-Tier Cloud Security', jurisdictions: ['Singapore (PDPA)'] },
    ],
  },
];

function ComplianceChecklist({ selectedJurisdictions = [] }) {
  const [checked, setChecked] = useState({});
  const [openCats, setOpenCats] = useState(['Data Protection & Privacy']);

  const toggle = id => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleCat = cat => setOpenCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const isRelevant = item =>
    item.jurisdictions.length === 0 ||
    item.jurisdictions.some(j => selectedJurisdictions.includes(j));

  const allItems = COMPLIANCE_FRAMEWORK.flatMap(c => c.items);
  const relevantItems = allItems.filter(isRelevant);
  const checkedCount = relevantItems.filter(i => checked[i.id]).length;
  const pct = relevantItems.length > 0 ? Math.round((checkedCount / relevantItems.length) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-[#D8DCE3] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-[#00338D]" />
          <h3 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Compliance Checklist</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-[#00338D]">{pct}%</div>
            <div className="text-[10px] text-[#9CA3AF]">{checkedCount}/{relevantItems.length} completed</div>
          </div>
          <div className="w-12 h-12 relative">
            <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
              <circle cx={22} cy={22} r={18} fill="none" stroke="#D8DCE3" strokeWidth={4} />
              <motion.circle cx={22} cy={22} r={18} fill="none" stroke="#00338D" strokeWidth={4}
                strokeLinecap="round" strokeDasharray={113}
                animate={{ strokeDashoffset: 113 - (pct / 100) * 113 }}
                transition={{ duration: 0.5 }} />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {COMPLIANCE_FRAMEWORK.map(cat => {
          const catItems = cat.items.filter(isRelevant);
          if (catItems.length === 0) return null;
          const catChecked = catItems.filter(i => checked[i.id]).length;
          const isOpen = openCats.includes(cat.category);

          return (
            <div key={cat.category} className="border border-[#D8DCE3] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCat(cat.category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#F0F2F5] hover:bg-[#EEF2F7] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#1A1F36]">{cat.category}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    catChecked === catItems.length ? 'bg-[#00B0A0]/15 text-[#00B0A0]' : 'bg-[#F0F2F5] text-[#6B7280]'
                  }`}>{catChecked}/{catItems.length}</span>
                </div>
                {isOpen ? <ChevronUp size={14} className="text-[#9CA3AF]" /> : <ChevronDown size={14} className="text-[#9CA3AF]" />}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="p-3 space-y-2">
                      {catItems.map(item => {
                        const done = checked[item.id];
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggle(item.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                              done ? 'bg-[#00B0A0]/5 border-[#00B0A0]/20' : 'bg-white border-[#D8DCE3] hover:bg-[#F0F2F5]'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                              done ? 'bg-[#00B0A0] border-[#00B0A0]' : 'border-[#CBD5E1]'
                            }`}>
                              {done && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-semibold ${done ? 'text-[#00B0A0]' : 'text-[#1A1F36]'}`}>{item.label}</div>
                              <div className="text-xs text-[#9CA3AF]">{item.description}</div>
                            </div>
                            {!done && <AlertTriangle size={14} className="text-[#E87722] flex-shrink-0" />}
                            {done && <CheckCircle2 size={14} className="text-[#00B0A0] flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-3 border-t border-[#D8DCE3] bg-[#F0F2F5] flex items-center gap-3">
        <div className="flex-1 h-2 bg-[#D8DCE3] rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ backgroundColor: pct === 100 ? '#00B0A0' : pct > 60 ? '#005EB8' : '#E87722' }}
            animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
        </div>
        <span className="text-xs text-[#6B7280] font-medium flex-shrink-0">
          {pct === 100 ? '✓ Fully compliant' : pct > 60 ? 'In progress' : 'Action required'}
        </span>
      </div>
    </div>
  );
}

function Fields({ formData, updateField }) {
  return (
    <>
      <FormField label="Operating Jurisdictions" hint="select all that apply">
        <MultiSelect value={formData.jurisdictions} onChange={v => updateField('jurisdictions', v)}
          options={['India (DPDP Act)', 'Singapore (PDPA)', 'Ireland (GDPR)', 'United Kingdom (UK GDPR)', 'United States (State laws)', 'European Union (CSRD/NIS2)', 'Australia (Privacy Act)', 'Japan (APPI)', 'UAE (PDPL)', 'Brazil (LGPD)', 'Canada (PIPEDA)', 'South Korea (PIPA)', 'China (PIPL)']} />
      </FormField>
      <FormField label="Compliance Frameworks Required" hint="select all applicable">
        <MultiSelect value={formData.frameworks} onChange={v => updateField('frameworks', v)}
          options={['DPDP Act (India)', 'GDPR', 'TIA-942', 'ISO 27001', 'SOC 2 Type II', 'PCI DSS', 'HIPAA', 'ESG/CSRD', 'Uptime Institute Tier', 'LEED/BREEAM', 'FedRAMP', 'MTCS (Singapore)', 'Cyber Essentials Plus (UK)', 'NIS2 Directive']} />
      </FormField>
      <FormField label="Data Sovereignty Requirements">
        <Select value={formData.sovereignty} onChange={v => updateField('sovereignty', v)}
          options={['Strict Local (data must not leave country)', 'Regional (within region/continent)', 'Flexible (cross-border permitted with controls)', 'Not Applicable']} placeholder="Select data sovereignty level..." />
      </FormField>
      <FormField label="Cybersecurity Maturity Level">
        <Select value={formData.cyberMaturity} onChange={v => updateField('cyberMaturity', v)}
          options={['Basic (firewall + antivirus)', 'Intermediate (SIEM + MFA)', 'Advanced (SOC + threat intelligence)', 'Zero Trust Architecture']} placeholder="Select cybersecurity level..." />
      </FormField>
      <FormField label="ESG Reporting Required">
        <Toggle checked={formData.esgReporting || false} onChange={v => updateField('esgReporting', v)} label="Mandatory ESG / Sustainability Reporting" />
      </FormField>
      <FormField label="Audit Readiness Timeline">
        <Select value={formData.auditTimeline} onChange={v => updateField('auditTimeline', v)}
          options={['Immediate (< 3 months)', '3–6 months', '6–12 months', '12–18 months', 'No specific deadline']} placeholder="Select audit timeline..." />
      </FormField>
    </>
  );
}

async function generateInsights(formData, sessionContext, stageOutputs, researchContext = null) {
  const basePrompt = buildContextualPrompt(
    'Stage 04: Compliance Checks (Tax, Regulatory, ESG, Cyber)',
    STAGE_CONTEXT,
    formData,
    sessionContext,
    stageOutputs,
    '04'
  );
  const researchBlock = researchContext ? `\n\n## LIVE RESEARCH CONTEXT\n${researchContext}` : '';
  const ragQuery = buildRagQuery('datacenter compliance regulatory GDPR DPDP ESG', { ...formData, ...sessionContext });
  return callClaude({ prompt: basePrompt + researchBlock, maxTokens: 8192, ragQuery });
}

export default function Stage04() {
  const [formData, setFormData] = useState({});

  return (
    <StageLayout
      stageNum="04"
      stageName="Regulatory and Compliance"
      stageDescription="Navigate the complex compliance landscape across datacenter jurisdictions."
      stageIcon={ShieldCheck}
      color="#1B3A5C"
      formFields={(props) => (
        <Fields
          formData={props.formData}
          updateField={(k, v) => {
            setFormData(prev => ({ ...prev, [k]: v }));
            props.updateField(k, v);
          }}
        />
      )}
      generateInsights={generateInsights}
      topContent={<ComplianceChecklist selectedJurisdictions={formData.jurisdictions || []} />}
    />
  );
}