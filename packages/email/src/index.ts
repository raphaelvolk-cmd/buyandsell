export type {
  DailyReportContext,
  RecommendationRow,
  SmtpConfig,
  StrongBuyAlert,
} from "./types.js";
export { createSmtpTransport, sendMail, fromHeader } from "./transport.js";
export {
  renderStrongBuyHtml,
  renderStrongBuySubject,
  renderStrongBuyText,
} from "./templates/strong-buy.js";
export {
  renderDailyReportHtml,
  renderDailyReportSubject,
  renderDailyReportText,
} from "./templates/daily-report.js";
export { dispatchStrongBuy, dispatchDailyReport } from "./dispatch.js";
export type { DispatchResult } from "./dispatch.js";
