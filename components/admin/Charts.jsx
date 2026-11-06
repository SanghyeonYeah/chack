'use client';
// 통계 그래프 (간단한 SVG 막대). 색은 테마 토큰 primary / accent

export function BarChart({ data, x, bars, height = 220, labelEvery = 1 }) {
  if (!data?.length) return <p className="muted">데이터가 없어요</p>;
  const max = Math.max(1, ...data.flatMap((d) => bars.map((b) => d[b.key])));
  const w = 100 / data.length;
  const bw = (w * 0.7) / bars.length;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <div>
      <div className="mb-2 flex gap-4 small">
        {bars.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: b.color }} />{b.label}</span>
        ))}
      </div>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {ticks.map((t) => (
            <line key={t} x1="0" x2="100" y1={height - (t / max) * (height - 20)} y2={height - (t / max) * (height - 20)} stroke="var(--c-line)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) =>
            bars.map((b, j) => {
              const h = (d[b.key] / max) * (height - 20);
              return (
                <rect key={`${i}-${j}`} x={i * w + w * 0.15 + j * bw} y={height - h} width={bw * 0.92} height={h} fill={b.color} rx="0.4">
                  <title>{`${d[x]} · ${b.label} ${d[b.key]}`}</title>
                </rect>
              );
            }),
          )}
        </svg>
        <div className="pointer-events-none absolute top-0 -left-10 flex h-full w-8 flex-col justify-between pb-0 text-right text-[13px] muted">
          <span>{max}</span><span>{ticks[1]}</span><span>0</span>
        </div>
      </div>
      <div className="mt-1 flex text-[13px] muted">
        {data.map((d, i) => (
          <span key={i} className="text-center" style={{ width: `${w}%` }}>{i % labelEvery === 0 ? d[x] : ''}</span>
        ))}
      </div>
    </div>
  );
}

export function Funnel({ steps }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / Math.max(1, s.base ?? top)) * 100);
        return (
          <li key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="font-semibold">{i + 1}. {s.label}</span>
              <span className="tabular-nums">{s.value}명 <span className="small muted">({pct}%{s.base != null ? ` · 분모 ${s.base}` : ''})</span></span>
            </div>
            <div className="bar"><i style={{ width: `${(s.value / Math.max(1, s.base ?? top)) * 100}%`, background: i === steps.length - 1 ? 'var(--c-accent)' : 'var(--c-primary)' }} /></div>
            {s.note && <p className="mt-1 small muted">{s.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
