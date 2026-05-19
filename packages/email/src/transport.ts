import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import type { SmtpConfig } from "./types.js";

export function createSmtpTransport(cfg: SmtpConfig): nodemailer.Transporter {
  const options: SMTPTransport.Options = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure ?? cfg.port === 465,
    requireTLS: !cfg.secure && cfg.port === 587,
  };
  if (cfg.user && cfg.password) {
    options.auth = { user: cfg.user, pass: cfg.password };
  }
  return nodemailer.createTransport(options);
}

export function fromHeader(cfg: SmtpConfig): string {
  return cfg.from_name ? `${cfg.from_name} <${cfg.from_address}>` : cfg.from_address;
}

export async function sendMail(
  transporter: nodemailer.Transporter,
  cfg: SmtpConfig,
  msg: { to: string[]; subject: string; html: string; text: string },
): Promise<nodemailer.SentMessageInfo> {
  return transporter.sendMail({
    from: fromHeader(cfg),
    to: msg.to.join(", "),
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}
