export function Sparkline({
  points, width = 180, height = 44, className = "",
}: { points: number[]; width?: number; height?: number; className?: string }) {
  if (points.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const y = (v: number) => height - 4 - (v / max) * (height - 8);
  const coords = points.map((v, i) =>
    `${points.length > 1 ? i * step : width / 2},${y(v)}`);
  const line = `M ${coords.join(" L ")}`;
  const area = `${line} L ${points.length > 1 ? width : width / 2},${height} L ${points.length > 1 ? 0 : width / 2},${height} Z`;
  return (
    <svg width={width} height={height} className={className} aria-hidden="true"
         viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={area} fill="var(--live-soft)" />
      <path d={line} fill="none" stroke="var(--live)" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
      {points.length > 0 && (
        <circle cx={points.length > 1 ? width : width / 2} cy={y(points[points.length - 1])}
                r="2.5" fill="var(--live)" />
      )}
    </svg>
  );
}
