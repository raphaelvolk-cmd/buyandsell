"use client";

import { useMemo, useState } from "react";
import { SignalBadge, signalFromScore } from "./signal-badge";
import { ScoreBar } from "./score-bar";

export interface EvaluationRow {
  id: string;
  symbol: string;
  current_price: number;
  signal: string; // Claude signal
  conviction: number;
  score_total: number;
  score_technical: number;
  score_fundamental: number;
  score_sentiment: number;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  bb_position: number | null;
  sma50: number | null;
  sma200: number | null;
  atr: number | null;
  fib_support: number | null;
  fib_resistance: number | null;
  target_price: number | null;
  stop_loss: number | null;
  thesis: string | null;
  risks: string[] | null;
  catalysts: string[] | null;
}

type SortKey =
  | "score_total"
  | "symbol"
  | "current_price"
  | "rsi"
  | "conviction"
  | "signal";

const SIGNAL_RANK: Record<string, number> = {
  STRONG_BUY: 5,
  BUY: 4,
  HOLD: 3,
  SELL: 2,
  STRONG_SELL: 1,
};

export function WatchlistTable({ rows }: { rows: EvaluationRow[] }) {
  const [search, setSearch] = useState("");
  const [signalFilter, setSignalFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("score_total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return rows
      .filter((r) => !lower || r.symbol.toLowerCase().includes(lower))
      .filter((r) => !signalFilter || signalFromScore(r.score_total) === signalFilter)
      .sort((a, b) => {
        let av: number | string;
        let bv: number | string;
        if (sortKey === "signal") {
          av = SIGNAL_RANK[signalFromScore(a.score_total)] ?? 0;
          bv = SIGNAL_RANK[signalFromScore(b.score_total)] ?? 0;
        } else if (sortKey === "symbol") {
          av = a.symbol;
          bv = b.symbol;
        } else {
          av = (a[sortKey] as number) ?? -Infinity;
          bv = (b[sortKey] as number) ?? -Infinity;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [rows, search, signalFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function sortIndicator(k: SortKey) {
    if (sortKey !== k) return null;
    return <span className="dim"> {sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  return (
    <>
      <div className="controls">
        <input
          type="text"
          placeholder="Symbol suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)}>
          <option value="">Alle Signale</option>
          <option value="STRONG_BUY">Strong Buy</option>
          <option value="BUY">Buy</option>
          <option value="HOLD">Hold</option>
          <option value="SELL">Sell</option>
          <option value="STRONG_SELL">Strong Sell</option>
        </select>
        <span className="muted" style={{ alignSelf: "center", fontSize: "0.8rem" }}>
          {filtered.length} von {rows.length}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort("symbol")}>Symbol{sortIndicator("symbol")}</th>
              <th className="num" onClick={() => toggleSort("current_price")}>
                Kurs{sortIndicator("current_price")}
              </th>
              <th onClick={() => toggleSort("signal")}>Signal{sortIndicator("signal")}</th>
              <th className="num" onClick={() => toggleSort("conviction")}>
                Conv.{sortIndicator("conviction")}
              </th>
              <th onClick={() => toggleSort("score_total")}>
                Score{sortIndicator("score_total")}
              </th>
              <th className="num" onClick={() => toggleSort("rsi")}>
                RSI{sortIndicator("rsi")}
              </th>
              <th className="num">Target</th>
              <th className="num">Stop</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty">
                    <div className="big-icon">🔍</div>
                    Keine Treffer.
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((e) => {
              const isOpen = expanded === e.id;
              return (
                <>
                  <tr
                    key={e.id}
                    className={isOpen ? "expanded" : ""}
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="symbol-cell">
                      <strong>{e.symbol}</strong>
                    </td>
                    <td className="num">{e.current_price.toFixed(2)}</td>
                    <td>
                      <SignalBadge signal={signalFromScore(e.score_total)} />
                    </td>
                    <td className="num">{(e.conviction * 100).toFixed(0)}%</td>
                    <td>
                      <ScoreBar value={e.score_total} />
                    </td>
                    <td
                      className="num"
                      style={{
                        color:
                          e.rsi != null && e.rsi < 35
                            ? "var(--green)"
                            : e.rsi != null && e.rsi > 65
                              ? "var(--red)"
                              : undefined,
                      }}
                    >
                      {e.rsi != null ? e.rsi.toFixed(1) : "—"}
                    </td>
                    <td className="num">
                      {e.target_price != null ? e.target_price.toFixed(2) : "—"}
                    </td>
                    <td className="num">
                      {e.stop_loss != null ? e.stop_loss.toFixed(2) : "—"}
                    </td>
                    <td className="muted">{isOpen ? "▲" : "▼"}</td>
                  </tr>
                  {isOpen && (
                    <tr className="detail-row">
                      <td colSpan={9}>
                        <div className="detail-content">
                          <div className="detail-grid">
                            <div className="detail-section">
                              <h4>Technische Indikatoren</h4>
                              <div className="detail-item">
                                <span className="dl">RSI (14)</span>
                                <span className="dv">
                                  {e.rsi != null ? e.rsi.toFixed(2) : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">MACD</span>
                                <span className="dv">
                                  {e.macd != null ? e.macd.toFixed(3) : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">MACD Signal</span>
                                <span className="dv">
                                  {e.macd_signal != null ? e.macd_signal.toFixed(3) : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Bollinger Position</span>
                                <span className="dv">
                                  {e.bb_position != null
                                    ? (e.bb_position * 100).toFixed(0) + "%"
                                    : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">ATR (14)</span>
                                <span className="dv">
                                  {e.atr != null ? e.atr.toFixed(2) : "—"}
                                </span>
                              </div>
                            </div>
                            <div className="detail-section">
                              <h4>Moving Averages &amp; Fibonacci</h4>
                              <div className="detail-item">
                                <span className="dl">SMA 50</span>
                                <span className="dv">
                                  {e.sma50 != null ? e.sma50.toFixed(2) : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">SMA 200</span>
                                <span className="dv">
                                  {e.sma200 != null ? e.sma200.toFixed(2) : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Fib Support</span>
                                <span className="dv">
                                  {e.fib_support != null ? e.fib_support.toFixed(2) : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Fib Resistance</span>
                                <span className="dv">
                                  {e.fib_resistance != null
                                    ? e.fib_resistance.toFixed(2)
                                    : "—"}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Stop-Loss</span>
                                <span className="dv">
                                  {e.stop_loss != null ? e.stop_loss.toFixed(2) : "—"}
                                </span>
                              </div>
                            </div>
                            <div className="detail-section">
                              <h4>Score-Aufteilung</h4>
                              <div className="detail-item">
                                <span className="dl">Technisch (40%)</span>
                                <span className="dv">
                                  {e.score_technical?.toFixed(2)}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Fundamental (40%)</span>
                                <span className="dv">
                                  {e.score_fundamental?.toFixed(2)}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Sentiment (20%)</span>
                                <span className="dv">
                                  {e.score_sentiment?.toFixed(2)}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Gesamt</span>
                                <span className="dv" style={{ fontWeight: 700 }}>
                                  {e.score_total?.toFixed(2)}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="dl">Conviction</span>
                                <span className="dv">
                                  {(e.conviction * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="ai-analysis">
                            <div className="ai-header">
                              <span>🤖</span>
                              <h4>Claude Analyse</h4>
                              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="muted" style={{ fontSize: "0.72rem" }}>
                                  Claude-Einschätzung:
                                </span>
                                <SignalBadge signal={e.signal} />
                              </span>
                            </div>
                            {e.thesis && <div className="ai-summary">{e.thesis}</div>}
                            <div className="ai-columns">
                              <div className="ai-col catalysts">
                                <h5>Katalysatoren</h5>
                                <ul>
                                  {(e.catalysts ?? []).length > 0 ? (
                                    e.catalysts!.map((c, i) => <li key={i}>{c}</li>)
                                  ) : (
                                    <li
                                      style={{ color: "var(--text-dim)", paddingLeft: 0 }}
                                    >
                                      keine genannt
                                    </li>
                                  )}
                                </ul>
                              </div>
                              <div className="ai-col risks">
                                <h5>Risiken</h5>
                                <ul>
                                  {(e.risks ?? []).length > 0 ? (
                                    e.risks!.map((r, i) => <li key={i}>{r}</li>)
                                  ) : (
                                    <li
                                      style={{ color: "var(--text-dim)", paddingLeft: 0 }}
                                    >
                                      keine genannt
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
