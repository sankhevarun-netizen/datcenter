'use client';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

export default function SparklineChart({ data, color = '#005EB8', height = 32 }) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v"
          stroke={color} strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#', '')})`}
          dot={false} isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
