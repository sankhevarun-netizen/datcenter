'use client';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { Droplets, Factory, Sun } from 'lucide-react';
import { fmtNumber } from '@/lib/nexus/format';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#00338D] border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
        <p className="text-white/50 mb-0.5">{label}</p>
        <p className="font-bold text-[#60a5fa]">PUE {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

function Stat({ icon: Icon, label, value, unit, note, noteColor = '#6B7280' }) {
  return (
    <div className="bg-[#F0F2F5] rounded-xl p-3">
      <p className="flex items-center gap-1 text-[10px] text-[#9CA3AF] mb-1"><Icon size={10} /> {label}</p>
      <p className="text-sm font-bold text-[#1A1F36]" style={MONO}>{value}</p>
      <p className="text-[9px] text-[#9CA3AF]">{unit}</p>
      <p className="text-[10px] font-semibold mt-1" style={{ color: noteColor }}>{note}</p>
    </div>
  );
}

export default function SustainabilityIntel({ data }) {
  const { pueTrend, peerMedianPue, carbonIntensity, wue, renewable } = data;
  const lo = Math.min(...pueTrend.map((p) => p.pue), peerMedianPue);
  const hi = Math.max(...pueTrend.map((p) => p.pue), peerMedianPue);
  const share = renewable.pct;

  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Sustainability Intelligence</h2>
        <span className="text-[10px] text-[#00704A] font-bold bg-[#00B0A0]/10 px-2 py-0.5 rounded-full">From metered energy and water</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-[#6B7280]">Portfolio PUE, 12 months</p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
              <span className="w-6 border-t border-dashed border-[#64748B]" />Tier III peer median {peerMedianPue}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={84}>
            <LineChart data={pueTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis domain={[Math.floor(lo * 100 - 1) / 100, Math.ceil(hi * 100 + 1) / 100]} tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <ReferenceLine y={peerMedianPue} stroke="#64748B" strokeDasharray="4 2" strokeWidth={1} />
              <Line type="monotone" dataKey="pue" stroke="#005EB8" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Tooltip content={<CustomTooltip />} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-[#9CA3AF]">Energy-weighted across operating sites (total facility load over total IT load).</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Factory} label="Carbon intensity" value={carbonIntensity.value} unit="tCO₂ per MWh"
            note={`${carbonIntensity.changePct >= 0 ? '+' : ''}${carbonIntensity.changePct}% since ${carbonIntensity.since}`}
            noteColor={carbonIntensity.changePct > 0 ? '#A47C0B' : '#00704A'} />
          <Stat icon={Droplets} label="WUE" value={wue.value} unit="L per IT kWh"
            note={wue.value > wue.peerMedian ? `Above peer median ${wue.peerMedian}` : `Within peer median ${wue.peerMedian}`}
            noteColor={wue.value > wue.peerMedian ? '#A47C0B' : '#00704A'} />
          <Stat icon={Sun} label="Renewable share" value={`${share}%`} unit={renewable.month}
            note={`${fmtNumber(renewable.renewableMwh)} MWh renewable`} noteColor="#00704A" />
        </div>

        <div>
          <p className="text-xs font-semibold text-[#6B7280] mb-2">Energy supply, {renewable.month}</p>
          <div className="h-4 rounded-full overflow-hidden flex bg-[#D8DCE3]" role="img" aria-label={`${share}% renewable`}>
            <div className="h-full bg-[#00B0A0]" style={{ width: `${share}%` }} />
            <div className="h-full bg-[#94A3B8] border-l-2 border-white" style={{ width: `${100 - share}%` }} />
          </div>
          <div className="flex gap-3 mt-1.5 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00B0A0]" />Renewable (PPA and on-site) {fmtNumber(renewable.renewableMwh)} MWh</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#94A3B8]" />Grid {fmtNumber(renewable.gridMwh)} MWh</span>
          </div>
        </div>
      </div>
    </div>
  );
}
