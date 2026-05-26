function fgColor(value: number): string {
  if (value <= 25) return "#ef4444";
  if (value <= 45) return "#f97316";
  if (value <= 55) return "#eab308";
  if (value <= 75) return "#84cc16";
  return "#22c55e";
}

export function FearGreedGauge({
  value,
  label,
}: {
  value: number | null;
  label: string | null;
}) {
  const v = value ?? 50;
  // -180° (left, value=0) to 0° (right, value=100)
  const angleDeg = -180 + (v / 100) * 180;
  const rad = (angleDeg * Math.PI) / 180;
  const cx = 80 + 65 * Math.cos(rad);
  const cy = 80 + 65 * Math.sin(rad);
  const color = fgColor(v);
  return (
    <div className="fg-gauge" role="img" aria-label={`Fear and Greed Index ${v} ${label}`}>
      <svg viewBox="0 0 160 90">
        <defs>
          <linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path
          d="M 15 80 A 65 65 0 0 1 145 80"
          fill="none"
          stroke="url(#fgGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <line x1="80" y1="80" x2={cx} y2={cy} stroke="var(--text)" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="4" fill="var(--text)" />
        <circle cx="80" cy="80" r="3" fill="var(--text)" />
      </svg>
      <div className="fg-value" style={{ color }}>
        {value ?? "—"}
      </div>
    </div>
  );
}
