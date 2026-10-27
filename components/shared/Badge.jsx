'use client';
export function Badge({ children, color = 'blue', size = 'sm' }) {
  const colors = {
    blue: 'bg-[#005EB8]/10 text-[#005EB8] border-[#005EB8]/20',
    navy: 'bg-[#00338D]/10 text-[#00338D] border-[#00338D]/20',
    green: 'bg-[#00B0A0]/10 text-[#00B0A0] border-[#00B0A0]/20',
    amber: 'bg-[#E87722]/10 text-[#E87722] border-[#E87722]/20',
    red: 'bg-red-50 text-red-600 border-red-200',
    grey: 'bg-[#F0F2F5] text-[#6B7280] border-[#D8DCE3]',
    tier4: 'bg-[#E87722]/10 text-[#E87722] border-[#E87722]/20',
    tier3plus: 'bg-[#005EB8]/10 text-[#005EB8] border-[#005EB8]/20',
    tier3: 'bg-[#00338D]/10 text-[#00338D] border-[#00338D]/20',
  };

  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`inline-flex items-center font-semibold rounded-md border ${colors[color] || colors.blue} ${sizes[size]}`}>
      {children}
    </span>
  );
}

export function TierBadge({ tier }) {
  if (!tier) return null;
  let color = 'grey';
  if (tier.includes('IV')) color = 'tier4';
  else if (tier.includes('III+')) color = 'tier3plus';
  else if (tier.includes('III')) color = 'tier3';

  return <Badge color={color}>{tier}</Badge>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  let color = 'grey';
  if (status.toLowerCase() === 'operational') color = 'green';
  else if (status.toLowerCase().includes('construction')) color = 'amber';
  else if (status.toLowerCase() === 'planned') color = 'blue';

  return (
    <Badge color={color}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${
        color === 'green' ? 'bg-[#00B0A0]' : color === 'amber' ? 'bg-[#E87722]' : 'bg-[#005EB8]'
      }`} />
      {status}
    </Badge>
  );
}
