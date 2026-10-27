'use client';
import { DollarSign } from 'lucide-react';
import StageLayout from '@/components/stage-pages/StageLayout';
import { FormField, Select, MultiSelect, SliderField } from '@/components/stage-pages/FormComponents';
import { callClaude, buildContextualPrompt, buildRagQuery } from '@/lib/claude-api';

const STAGE_CONTEXT = `This stage covers datacenter monetization strategies — business model selection, pricing optimization, customer acquisition, and revenue diversification.`;

function Fields({ formData, updateField }) {
  return (
    <>
      <FormField label="Business Models" hint="select all applicable"><MultiSelect value={formData.businessModels} onChange={v => updateField('businessModels', v)} options={['Colocation (retail)', 'Colocation (wholesale)', 'Managed Services', 'Cloud On-Ramp', 'Build-to-Suit', 'GPU-as-a-Service', 'Edge/Micro DC', 'Carrier Hotel / IXP']} /></FormField>
      <FormField label="Target Customer Segments" hint="select primary targets"><MultiSelect value={formData.customerSegments} onChange={v => updateField('customerSegments', v)} options={['Hyperscalers (AWS/Azure/GCP)', 'Enterprise', 'SMB/Mid-Market', 'Government & Public Sector', 'AI/ML Companies', 'Financial Services', 'Media & Entertainment', 'Telecom']} /></FormField>
      <FormField label="Pricing Strategy"><Select value={formData.pricingStrategy} onChange={v => updateField('pricingStrategy', v)} options={['Per-Rack Unit (U)', 'Per-kW of power', 'Per-Circuit / per-breaker', 'Blended (rack + power + cross-connect)', 'Outcome-Based (uptime/SLA-linked)']} placeholder="Select pricing model..." /></FormField>
      <FormField label="Current Occupancy Rate"><SliderField value={formData.occupancy || 50} onChange={v => updateField('occupancy', v)} min={0} max={100} step={5} formatValue={v => `${v}%`} leftLabel="0% (Empty)" rightLabel="100% (Full)" /></FormField>
      <FormField label="Revenue Optimization Focus" hint="select priorities"><MultiSelect value={formData.revenueOptimization} onChange={v => updateField('revenueOptimization', v)} options={['Increase Utilization', 'Premium Pricing Strategy', 'New Service Lines', 'Geographic Expansion', 'Anchor Tenant Strategy', 'M&A / Portfolio Consolidation']} /></FormField>
      <FormField label="Target EBITDA Margin"><Select value={formData.ebitdaTarget} onChange={v => updateField('ebitdaTarget', v)} options={['< 25%', '25–35%', '35–45%', '45–55% (hyperscale-like)', '> 55%']} placeholder="Select EBITDA target..." /></FormField>
    </>
  );
}

async function generateInsights(formData, sessionContext, stageOutputs, researchContext = null) {
  const basePrompt = buildContextualPrompt(
    'Stage 06: DC Monetization & Revenue Strategy',
    STAGE_CONTEXT,
    formData,
    sessionContext,
    stageOutputs,
    '06'
  );
  const researchBlock = researchContext ? `\n\n## LIVE RESEARCH CONTEXT\n${researchContext}` : '';
  const ragQuery = buildRagQuery('datacenter monetization colocation pricing revenue 2025', { ...formData, ...sessionContext });
  return callClaude({ prompt: basePrompt + researchBlock, maxTokens: 8192, ragQuery });
}

export default function Stage06() {
  return <StageLayout stageNum="06" stageName="Monetization" stageDescription="Maximize revenue from your datacenter assets." stageIcon={DollarSign} color="#005EB8" formFields={Fields} generateInsights={generateInsights} />;
}