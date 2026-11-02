import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createTransport: vi.fn(), sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));
import { buildAuthEmail, deliverAuthEmail, isAuthEmailConfigured } from "../services/auth/email.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ messageId: "sent" });
});
afterEach(() => vi.unstubAllEnvs());

describe("authentication email delivery", () => {
  it("renders branded link email with a fallback address and plain text alternative", () => {
    vi.stubEnv("CLIENT_URL", "https://irontrack.example");
    vi.stubEnv("NODE_ENV", "production");
    const email = buildAuthEmail("verify_email", "A <B>", "https://irontrack.example/verify-email#token=abc");
    expect(email.subject).toBe("Verify your IronTrack email");
    expect(email.text).toContain("https://irontrack.example/verify-email#token=abc");
    expect(email.html).toContain("/apple-touch-icon.png");
    expect(email.html).toContain("Verify email address");
    expect(email.html).toContain("A &lt;B&gt;");
    expect(email.html).toContain("copy this address into your browser");
    expect(email.html).not.toContain("A <B>");
  });

  it("sends verification mail directly over SMTP without Redis configuration", async () => {
    vi.stubEnv("EMAIL_USER", "mailer@example.com");
    vi.stubEnv("EMAIL_PASS", "smtp-password");
    vi.stubEnv("CLIENT_URL", "https://irontrack.example");
    vi.stubEnv("REDIS_URL", "");
    expect(isAuthEmailConfigured()).toBe(true);
    await deliverAuthEmail("verify_email", "person@example.com", "Person", "opaque-token");
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ service: "gmail", auth: { user: "mailer@example.com", pass: "smtp-password" } }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "person@example.com",
      from: "IronTrack <mailer@example.com>",
      text: expect.stringContaining("https://irontrack.example/verify-email#token=opaque-token"),
    }));
  });
});
