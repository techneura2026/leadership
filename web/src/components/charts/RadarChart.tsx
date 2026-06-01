'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface RadarDataPoint {
  competency: string;
  self: number;
  others: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  title?: string;
}

export function RadarChart({ data, title }: RadarChartProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {title && <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={320}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="competency"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickCount={6}
          />
          <Radar
            name="Self"
            dataKey="self"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name="Others"
            dataKey="others"
            stroke="#16a34a"
            fill="#16a34a"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: number) => value.toFixed(2)}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
