import { SignalBadge, signalFromScore } from "./signal-badge";

export interface TopPickProps {
  symbol: string;
  name?: string | null;
  currency: string;
  current_price: number;
  score_total: number;
  score_technical: number;
  score_fundamental: number;
  score_sentiment: number;
  thesis: string | null;
  target_price: number | null;
  stop_loss: number | null;
  fearGreedValue: number | null;
  fearGreedLabel: string | null;
}

export function TopPickCard(p: TopPickProps) {
  const signal = signalFromScore(p.score_total);
  return (
    <div
      className="card"
      style={{
        borderColor: "rgba(34, 197, 94, 0.3)",
        background:
          "linear-gradient(180deg, rgba(34, 197, 94, 0.08) 0%, var(--surface) 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--green)",
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            🏆 Top Pick
          </div>
          <h2 style={{ marginBottom: 4 }}>
            {p.symbol}
            {p.name ? <span className="muted"> · {p.name}</span> : null}
          </h2>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {p.score_total.toFixed(2)}
            </span>
            <SignalBadge signal={signal} />
          </div>
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
            Score / Signal
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          padding: "12px 0",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          marginBottom: 12,
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Kurs
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
            {p.current_price.toFixed(2)} {p.currency}
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Tech (40%)
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{p.score_technical.toFixed(2)}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Fund (40%)
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{p.score_fundamental.toFixed(2)}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Sentiment (20%)
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{p.score_sentiment.toFixed(2)}</div>
          <div className="muted" style={{ fontSize: "0.7rem" }}>
            F&amp;G {p.fearGreedValue} ({p.fearGreedLabel})
          </div>
        </div>
        {p.target_price != null && (
          <div>
            <div
              className="muted"
              style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px" }}
            >
              Target / Stop
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              {p.target_price.toFixed(2)}
              {p.stop_loss != null && (
                <span className="muted" style={{ fontWeight: 400 }}>
                  {" / "}
                  {p.stop_loss.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {p.thesis && (
        <div style={{ fontSize: "0.88rem", lineHeight: 1.55, color: "var(--text)" }}>
          {p.thesis}
        </div>
      )}
    </div>
  );
}
