export function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="muted">—</span>;
  const cls = `signal-badge signal-${signal}`;
  const display = signal.replace("_", " ");
  return <span className={cls}>{display}</span>;
}
