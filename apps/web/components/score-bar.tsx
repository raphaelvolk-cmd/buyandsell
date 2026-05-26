export function ScoreBar({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value === null || value === undefined) {
    return <span className="muted">—</span>;
  }
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    value >= 4 ? "var(--green)" : value >= 3 ? "var(--yellow)" : value >= 2 ? "#f97316" : "var(--red)";
  return (
    <span className="score-bar">
      <span className="bar">
        <span className="fill" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="num-val">{value.toFixed(2)}</span>
    </span>
  );
}
