export function signalFromScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "HOLD";
  if (score >= 4.0) return "STRONG_BUY";
  if (score >= 3.5) return "BUY";
  if (score >= 2.5) return "HOLD";
  if (score >= 2.0) return "SELL";
  return "STRONG_SELL";
}

export function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="muted">—</span>;
  const cls = `signal-badge signal-${signal}`;
  const display = signal.replace(/_/g, " ");
  return <span className={cls}>{display}</span>;
}
