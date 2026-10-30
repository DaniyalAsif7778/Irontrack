import nodemailer, { type Transporter } from "nodemailer";

export type AuthEmailKind = "verify_email" | "reset_password";

let transporter: Transporter | undefined;

export class EmailDeliveryError extends Error {
  readonly statusCode = 503;
  constructor() { super("Email delivery is temporarily unavailable. Try again shortly."); }
}

function mailConfig() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) throw new Error("Email delivery is not configured");
  return { user, pass };
}

export function clientUrl() {
  const configured = process.env.CLIENT_URL || process.env.CLIENT_ORIGIN?.split(",")[0]?.trim();
  if (!configured) throw new Error("CLIENT_URL is required for authentication emails");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("CLIENT_URL must use HTTPS in production");
  }
  return url.origin;
}

export function isAuthEmailConfigured() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.REDIS_URL || !process.env.AUTH_JWT_SECRET) return false;
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    if (!["redis:", "rediss:"].includes(redisUrl.protocol)) return false;
    clientUrl();
    return true;
  } catch { return false; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function buildAuthEmail(kind: AuthEmailKind, name: string, link: string) {
  const verification = kind === "verify_email";
  const title = verification ? "Confirm your email" : "Reset your password";
  const action = verification ? "Verify email address" : "Reset password";
  const description = verification
    ? "Finish setting up your IronTrack account by confirming this email address."
    : "We received a request to reset the password for your IronTrack account.";
  const expiry = verification ? "30 minutes" : "30 minutes";
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  const logo = escapeHtml(new URL("/apple-touch-icon.png", clientUrl()).toString());
  const subject = verification ? "Verify your IronTrack email" : "Reset your IronTrack password";
  const text = `${title}\n\nHi ${name},\n\n${description}\n\n${action}: ${link}\n\nThis link expires in ${expiry}. If you did not request this, you can ignore this email.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${description}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce4ee;border-radius:14px;overflow:hidden"><tr><td style="height:5px;background:#12cf9a;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:30px 32px 8px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle"><img src="${logo}" width="44" height="44" alt="IronTrack" style="display:block;border:0;border-radius:10px"></td><td style="padding-left:12px;vertical-align:middle"><span style="font-size:19px;font-weight:700;letter-spacing:-.3px;color:#10151d">IronTrack</span><br><span style="font-size:12px;color:#607086">Training that fits your life</span></td></tr></table></td></tr><tr><td style="padding:24px 32px 34px"><h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;letter-spacing:-.5px;color:#10151d">${title}</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#334155">Hi ${safeName},</p><p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#334155">${description}</p><table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px"><tr><td align="center" bgcolor="#397ded" style="border-radius:8px"><a href="${safeLink}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;line-height:1.2;font-weight:700;border-radius:8px">${action}</a></td></tr></table><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#607086">This secure link expires in ${expiry}. It can be used once.</p><p style="margin:0;font-size:13px;line-height:1.6;color:#607086">If the button does not work, copy this address into your browser:</p><p style="margin:8px 0 0;word-break:break-all;font-size:12px;line-height:1.6"><a href="${safeLink}" style="color:#245fca">${safeLink}</a></p><hr style="height:1px;margin:26px 0 18px;border:0;background:#e5ebf2"><p style="margin:0;font-size:12px;line-height:1.6;color:#738197">If you did not request this, you can safely ignore this message. Your account remains secure.</p></td></tr></table><p style="margin:18px 0 0;text-align:center;font-size:11px;line-height:1.5;color:#8290a3">IronTrack · Personal training, built around your routine</p></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function deliverAuthEmail(kind: AuthEmailKind, to: string, name: string, token: string) {
  try {
    const { user, pass } = mailConfig();
    transporter ??= nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
      auth: { user, pass },
    });
    const route = kind === "verify_email" ? "/verify-email" : "/reset-password";
    const link = new URL(route, clientUrl());
    link.hash = new URLSearchParams({ token }).toString();
    const email = buildAuthEmail(kind, name, link.toString());
    await transporter.sendMail({ from: `IronTrack <${user}>`, to, ...email });
  } catch {
    // Do not expose SMTP diagnostics, credentials, addresses, or link tokens to API logs.
    throw new EmailDeliveryError();
  }
}
