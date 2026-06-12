'use client';

/** Dependency-free SVG charts, tuned for the Lumora dashboard. */

export function BarChart({ data, height = 180, format }: {
  data: Array<{ label: string; value: number }>; height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div className="flex items-end gap-3 px-1" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center justify-end gap-1.5" title={`${d.label}: ${fmt(d.value)}`}>
          <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {fmt(d.value)}
          </span>
          <div
            className="w-full max-w-[48px] rounded-t-md bg-primary/85 transition-colors group-hover:bg-primary"
            style={{ height: `${(d.value / max) * (height - 44)}px` }}
          />
          <span className="text-[11px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, size = 150 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {data.map((d) => {
          const frac = d.value / total;
          const dash = `${frac * c} ${c}`;
          const el = (
            <circle
              key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={d.color} strokeWidth={18} strokeDasharray={dash}
              strokeDashoffset={-offset * c} strokeLinecap="butt"
            />
          );
          offset += frac;
          return el;
        })}
      </svg>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-semibold">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 36, stroke = 'hsl(221 83% 53%)' }: {
  values: number[]; width?: number; height?: number; stroke?: string;
}) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
