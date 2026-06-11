'use client';

type ChartPoint = { label: string; value: number };

type SimpleBarChartProps = {
  title: string;
  points: ChartPoint[];
  valuePrefix?: string;
};

export function SimpleBarChart({ title, points, valuePrefix = '' }: SimpleBarChartProps) {
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="chart-card">
      <h4>{title}</h4>
      <div className="bar-chart">
        {points.map((point) => (
          <div key={point.label} className="bar-chart-row">
            <span className="bar-chart-label">{point.label}</span>
            <div className="bar-chart-track" aria-hidden="true">
              <div className="bar-chart-fill" style={{ width: `${Math.round((point.value / max) * 100)}%` }} />
            </div>
            <span className="bar-chart-value">
              {valuePrefix}
              {point.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TrendChartProps = {
  title: string;
  points: ChartPoint[];
};

export function SimpleTrendChart({ title, points }: TrendChartProps) {
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className="chart-card">
      <h4>{title}</h4>
      <div className="trend-chart" role="img" aria-label={title}>
        {points.map((point) => (
          <div key={point.label} className="trend-bar-wrap">
            <div className="trend-bar" style={{ height: `${Math.max(8, Math.round((point.value / max) * 100))}%` }} title={`${point.label}: ${point.value}`} />
            <span className="trend-label">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
