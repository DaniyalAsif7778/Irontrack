import nodemailer from "nodemailer";

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

function clientUrl() {
  const configured = process.env.CLIENT_URL || process.env.CLIENT_ORIGIN?.split(",")[0]?.trim();
  if (!configured) throw new Error("CLIENT_URL is required for authentication emails");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("CLIENT_URL must use HTTPS in production");
  }
  return url.origin;
}

export function isAuthEmailConfigured() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;
  try { clientUrl(); return true; } catch { return false; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function sendAuthEmail(to: string, subject: string, heading: string, message: string, action: string, link: string, expires: string) {
  try {
    const { user, pass } = mailConfig();
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({
      from: `IronTrack <${user}>`, to, subject,
      text: `${heading}\n\n${message}\n\n${action}: ${link}\n\nThis link expires ${expires}. If you did not request this, you can ignore this email.`,
      html: `<main style="font-family:Arial,sans-serif;max-width:520px;margin:32px auto;padding:28px;color:#e8edf5;background:#10151d;border:1px solid #293342;border-radius:12px"><p style="color:#76a7ff;font-weight:700">IronTrack</p><h1 style="font-size:24px">${escapeHtml(heading)}</h1><p style="color:#b8c2d1;line-height:1.6">${escapeHtml(message)}</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;color:white;background:#3978e8;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(action)}</a></p><p style="color:#8c99aa;font-size:13px">This link expires ${escapeHtml(expires)}. If you did not request this, ignore this email.</p></main>`,
    });
  } catch {
    // Never pass SMTP responses, tokens, or credentials into API logs or user-facing errors.
    throw new EmailDeliveryError();
  }
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = new URL("/verify-email", clientUrl());
  link.hash = new URLSearchParams({ token }).toString();
  return sendAuthEmail(to, "Verify your IronTrack email", "Confirm your email", `Hi ${name}, confirm this address to activate your IronTrack account.`, "Verify email", link.toString(), "in 30 minutes");
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = new URL("/reset-password", clientUrl());
  link.hash = new URLSearchParams({ token }).toString();
  return sendAuthEmail(to, "Reset your IronTrack password", "Choose a new password", `Hi ${name}, use this link to reset your IronTrack password.`, "Reset password", link.toString(), "in 30 minutes");
}
