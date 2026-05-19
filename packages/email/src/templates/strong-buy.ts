import type { StrongBuyAlert } from "../types.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPrice(n: number, currency: string): string {
  const dec = currency === "JPY" ? 0 : 2;
  return `${n.toFixed(dec)} ${currency}`;
}

export function renderStrongBuySubject(a: StrongBuyAlert): string {
  const ratio = ((a.target_price - a.current_price) / a.current_price) * 100;
  return `STRONG BUY · ${a.symbol} · ${a.current_price.toFixed(2)} ${a.currency} · Target +${ratio.toFixed(1)}%`;
}

export function renderStrongBuyHtml(a: StrongBuyAlert): string {
  const risksList = a.risks.map((r) => `<li>${esc(r)}</li>`).join("");
  const catalystsList = a.catalysts.map((c) => `<li>${esc(c)}</li>`).join("");
  const upside = (((a.target_price - a.current_price) / a.current_price) * 100).toFixed(1);
  const downside = (((a.current_price - a.stop_loss) / a.current_price) * 100).toFixed(1);
  const dashLink = a.dashboard_link
    ? `<p style="margin-top:16px"><a href="${esc(a.dashboard_link)}" style="color:#2563eb">Open dashboard →</a></p>`
    : "";

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;max-width:640px;margin:auto;padding:24px">
  <div style="background:#dcfce7;border-left:4px solid #16a34a;padding:12px 16px;border-radius:4px">
    <strong style="color:#15803d">STRONG BUY · ${esc(a.symbol)}${a.name ? ` — ${esc(a.name)}` : ""}</strong>
  </div>
  <table cellpadding="6" style="border-collapse:collapse;margin-top:16px;width:100%;font-size:14px">
    <tr><td><strong>Price</strong></td><td>${fmtPrice(a.current_price, a.currency)}</td>
        <td><strong>Conviction</strong></td><td>${(a.conviction * 100).toFixed(0)}%</td></tr>
    <tr><td><strong>Total score</strong></td><td>${a.total_score.toFixed(2)} / 5.0</td>
        <td><strong>Target</strong></td><td>${fmtPrice(a.target_price, a.currency)} <span style="color:#16a34a">(+${upside}%)</span></td></tr>
    <tr><td><strong>Stop loss</strong></td><td>${fmtPrice(a.stop_loss, a.currency)} <span style="color:#dc2626">(-${downside}%)</span></td>
        <td></td><td></td></tr>
  </table>
  <h3 style="margin-top:24px;font-size:16px">Thesis</h3>
  <p style="line-height:1.5">${esc(a.thesis)}</p>
  ${catalystsList
    ? `<h3 style="margin-top:20px;font-size:16px">Catalysts</h3><ul style="line-height:1.5">${catalystsList}</ul>`
    : ""}
  ${risksList
    ? `<h3 style="margin-top:20px;font-size:16px">Risks</h3><ul style="line-height:1.5">${risksList}</ul>`
    : ""}
  ${dashLink}
  <p style="margin-top:32px;font-size:11px;color:#64748b">Automated screening signal — not financial advice. Verify before acting. Reply STOP to disable alerts.</p>
</body></html>`;
}

export function renderStrongBuyText(a: StrongBuyAlert): string {
  const upside = (((a.target_price - a.current_price) / a.current_price) * 100).toFixed(1);
  const downside = (((a.current_price - a.stop_loss) / a.current_price) * 100).toFixed(1);
  return [
    `STRONG BUY · ${a.symbol}${a.name ? ` — ${a.name}` : ""}`,
    ``,
    `Price:       ${fmtPrice(a.current_price, a.currency)}`,
    `Score:       ${a.total_score.toFixed(2)} / 5.0`,
    `Conviction:  ${(a.conviction * 100).toFixed(0)}%`,
    `Target:      ${fmtPrice(a.target_price, a.currency)} (+${upside}%)`,
    `Stop loss:   ${fmtPrice(a.stop_loss, a.currency)} (-${downside}%)`,
    ``,
    `Thesis:`,
    a.thesis,
    ``,
    a.catalysts.length > 0 ? `Catalysts:\n${a.catalysts.map((c) => `  - ${c}`).join("\n")}` : "",
    a.risks.length > 0 ? `\nRisks:\n${a.risks.map((r) => `  - ${r}`).join("\n")}` : "",
    a.dashboard_link ? `\nDashboard: ${a.dashboard_link}` : "",
    ``,
    `— Automated screening signal, not financial advice.`,
  ]
    .filter(Boolean)
    .join("\n");
}
