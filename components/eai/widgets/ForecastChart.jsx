'use client';
import {
  ComposedChart, Line, ReferenceLine, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function ForecastChart({
  data = [],
  capacityLimitMW = 175,
  projectedExceedDate = '',
  height = 220,
  xKey = 'month',
  yDomain = [0, 220],
  thresholdLabel = 'Capacity Limit',
  annotationLabel = 'Projected to exceed capacity on',
  valueUnit = ' MW',
}) {
  const LEGEND_ITEMS = [
    { label: 'Actual',      color: '#0077C8', dashed: false },
    { label: 'Forecast',    color: '#0077C8', dashed: true  },
    { label: thresholdLabel, color: '#EF4444', dashed: true  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Manual legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {LEGEND_ITEMS.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#6B7280' }}>
            <svg width="18" height="8" viewBox="0 0 18 8">
              {l.dashed
                ? <line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth="2" strokeDasharray="4 3" />
                : <line x1="0" y1="4" x2="18" y2="4" stroke={l.color} strokeWidth="2" />
              }
            </svg>
            {l.label}
          </div>
        ))}
      </div>

      {/* Chart + annotation */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <div style={{ width: '100%', height, overflow: 'hidden' }}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 8, fill: '#9CA3AF' }}
                axisLine={false} tickLine={false}
                width={30}
                domain={yDomain}
                tickCount={5}
              />
              <Tooltip
                contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 2px 8px rgba(16,24,40,0.08)', fontSize: 10, color: '#1A1F36' }}
                formatter={(v, n) => v != null ? [`${v}${valueUnit}`, n] : [null]}
                labelStyle={{ color: '#6B7280' }}
              />

              {/* Capacity limit reference line */}
              <ReferenceLine
                y={capacityLimitMW}
                stroke="#EF4444"
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />

              {/* Actual line */}
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="#0077C8"
                strokeWidth={2}
                dot={{ r: 4, fill: '#0077C8', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />

              {/* Forecast dashed line */}
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#0077C8"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Projected exceed annotation */}
        {projectedExceedDate && (
          <div style={{
            position: 'absolute', right: 8, bottom: 56,
            fontSize: 8, color: '#EF4444', textAlign: 'right',
            maxWidth: 130, lineHeight: 1.5, pointerEvents: 'none',
          }}>
            {annotationLabel}<br /><strong>{projectedExceedDate}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
