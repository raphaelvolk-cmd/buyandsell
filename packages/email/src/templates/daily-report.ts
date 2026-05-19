import type { DailyReportContext, RecommendationRow } from "../types.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function actionColor(action: RecommendationRow["action"]): string {
  switch (action) {
    case "STRONG_BUY":
      return "#15803d";
    case "BUY":
      return "#16a34a";
    case "ADD":
      return "#2563eb";
    case "SELL":
      return "#dc2626";
    case "HOLD":
      return "#64748b";
  }
}

function rowHtml(r: RecommendationRow): string {
  const target = r.target_price !== undefined ? r.target_price.toFixed(2) : "—";
  const stop = r.stop_loss !== undefined ? r.stop_loss.toFixed(2) : "—";
  const score = r.total_score !== undefined ? r.total_score.toFixed(2) : "—";
  return `<tr>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${esc(r.symbol)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#475569">${esc(r.name ?? "")}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${r.current_price.toFixed(2)} ${esc(r.currency)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${score}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:${actionColor(r.action)};font-weight:600">${r.action.replace("_", " ")}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${target}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${stop}</td>
  </tr>`;
}

function section(title: string, rows: RecommendationRow[]): string {
  if (rows.length === 0) {
    return `<h3 style="margin-top:24px;font-size:15px">${esc(title)}</h3><p style="color:#64748b;font-size:13px">No signals.</p>`;
  }
  return `<h3 style="margin-top:24px;font-size:15px">${esc(title)} (${rows.length})</h3>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
  <thead><tr style="background:#f1f5f9;text-align:left">
    <th style="padding:6px 10px">Symbol</th><th style="padding:6px 10px">Name</th>
    <th style="padding:6px 10px">Price</th><th style="padding:6px 10px">Score</th>
    <th style="padding:6px 10px">Action</th><th style="padding:6px 10px">Target</th>
    <th style="padding:6px 10px">Stop</th>
  </tr></thead>
  <tbody>${rows.map(rowHtml).join("")}</tbody>
</table>`;
}

export function renderDailyReportSubject(ctx: DailyReportContext): string {
  const total = ctx.rows_watchlist.length + ctx.rows_portfolio.length;
  return `Daily Buy & Sell Report · ${ctx.date} · ${total} signals · F&G ${ctx.fear_greed_value} ${ctx.fear_greed_label}`;
}

export function renderDailyReportHtml(ctx: DailyReportContext): string {
  const dashLink = ctx.dashboard_link
    ? `<p style="margin-top:24px"><a href="${esc(ctx.dashboard_link)}" style="color:#2563eb">Open dashboard →</a></p>`
    : "";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;max-width:780px;margin:auto;padding:24px">
  <h2 style="margin:0">Daily Buy &amp; Sell Report</h2>
  <p style="color:#64748b;font-size:13px;margin:4px 0 16px">${esc(ctx.date)} · ${ctx.run_count} screening runs</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px">
    <strong>Fear &amp; Greed:</strong> ${ctx.fear_greed_value} (${esc(ctx.fear_greed_label)})
  </div>
  ${section("Watchlist signals", ctx.rows_watchlist)}
  ${section("Portfolio actions", ctx.rows_portfolio)}
  ${dashLink}
  <p style="margin-top:32px;font-size:11px;color:#64748b">Automated screening — not financial advice. Verify before acting.</p>
</body></html>`;
}

function rowText(r: RecommendationRow): string {
  const action = r.action.padEnd(11);
  const sym = r.symbol.padEnd(8);
  const price = `${r.current_price.toFixed(2)} ${r.currency}`.padStart(14);
  const score = r.total_score !== undefined ? r.total_score.toFixed(2).padStart(5) : "  —  ";
  const target = r.target_price !== undefined ? r.target_price.toFixed(2).padStart(8) : "      —";
  return `  ${action} ${sym} ${price}  score ${score}  target ${target}`;
}

export function renderDailyReportText(ctx: DailyReportContext): string {
  const sections: string[] = [];
  sections.push(`Daily Buy & Sell Report — ${ctx.date}`);
  sections.push(`Fear & Greed: ${ctx.fear_greed_value} (${ctx.fear_greed_label})`);
  sections.push(`${ctx.run_count} screening runs today`);
  sections.push("");
  if (ctx.rows_watchlist.length) {
    sections.push(`Watchlist signals (${ctx.rows_watchlist.length}):`);
    for (const r of ctx.rows_watchlist) sections.push(rowText(r));
  } else {
    sections.push("Watchlist: no signals.");
  }
  sections.push("");
  if (ctx.rows_portfolio.length) {
    sections.push(`Portfolio actions (${ctx.rows_portfolio.length}):`);
    for (const r of ctx.rows_portfolio) sections.push(rowText(r));
  } else {
    sections.push("Portfolio: no actions.");
  }
  if (ctx.dashboard_link) {
    sections.push("");
    sections.push(`Dashboard: ${ctx.dashboard_link}`);
  }
  sections.push("");
  sections.push("— Automated screening, not financial advice.");
  return sections.join("\n");
}
