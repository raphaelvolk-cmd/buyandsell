import { createSmtpTransport, sendMail } from "./transport.js";
import {
  renderDailyReportHtml,
  renderDailyReportSubject,
  renderDailyReportText,
} from "./templates/daily-report.js";
import {
  renderStrongBuyHtml,
  renderStrongBuySubject,
  renderStrongBuyText,
} from "./templates/strong-buy.js";
import type {
  DailyReportContext,
  SmtpConfig,
  StrongBuyAlert,
} from "./types.js";

export interface DispatchResult {
  ok: boolean;
  recipient_count: number;
  message_id?: string;
  error?: string;
}

export async function dispatchStrongBuy(
  cfg: SmtpConfig,
  recipients: string[],
  alert: StrongBuyAlert,
): Promise<DispatchResult> {
  if (recipients.length === 0) {
    return { ok: false, recipient_count: 0, error: "no_recipients" };
  }
  const transporter = createSmtpTransport(cfg);
  try {
    const info = await sendMail(transporter, cfg, {
      to: recipients,
      subject: renderStrongBuySubject(alert),
      html: renderStrongBuyHtml(alert),
      text: renderStrongBuyText(alert),
    });
    return {
      ok: true,
      recipient_count: recipients.length,
      message_id: info.messageId,
    };
  } catch (err) {
    return {
      ok: false,
      recipient_count: recipients.length,
      error: (err as Error).message,
    };
  } finally {
    transporter.close();
  }
}

export async function dispatchDailyReport(
  cfg: SmtpConfig,
  recipients: string[],
  ctx: DailyReportContext,
): Promise<DispatchResult> {
  if (recipients.length === 0) {
    return { ok: false, recipient_count: 0, error: "no_recipients" };
  }
  const transporter = createSmtpTransport(cfg);
  try {
    const info = await sendMail(transporter, cfg, {
      to: recipients,
      subject: renderDailyReportSubject(ctx),
      html: renderDailyReportHtml(ctx),
      text: renderDailyReportText(ctx),
    });
    return {
      ok: true,
      recipient_count: recipients.length,
      message_id: info.messageId,
    };
  } catch (err) {
    return {
      ok: false,
      recipient_count: recipients.length,
      error: (err as Error).message,
    };
  } finally {
    transporter.close();
  }
}
