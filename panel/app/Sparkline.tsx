export function Sparkline({
  points, width = 180, height = 44, className = "",
}: { points: number[]; width?: number; height?: number; className?: string }) {
  if (points.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }
  // a single point renders as a flat line: cumulative spend with one day on
  // record is flat, and a lone dot reads as a rendering bug
  const pts = points.length === 1 ? [points[0], points[0]] : points;
  const max = Math.max(...pts, 1);
  const step = width / (pts.length - 1);
  const y = (v: number) => height - 4 - (v / max) * (height - 8);
  const coords = pts.map((v, i) => `${i * step},${y(v)}`);
  const line = `M ${coords.join(" L ")}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} className={className} aria-hidden="true"
         viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={area} fill="var(--live-soft)" />
      <path d={line} fill="none" stroke="var(--live)" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(pts[pts.length - 1])} r="2.5" fill="var(--live)" />
    </svg>
  );
}
