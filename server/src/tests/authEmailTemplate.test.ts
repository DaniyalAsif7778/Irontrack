import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthEmail } from "../services/auth/email.service.js";
import { decryptEmailToken, encryptEmailToken } from "../services/auth/emailTokenCrypto.js";

afterEach(() => vi.unstubAllEnvs());

describe("authentication email presentation and queue token protection", () => {
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

  it("encrypts queued link tokens and rejects tampering", () => {
    vi.stubEnv("AUTH_JWT_SECRET", "test-secret-with-more-than-thirty-two-bytes");
    const token = "opaque-single-use-auth-link-token";
    const encrypted = encryptEmailToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptEmailToken(encrypted)).toBe(token);
    expect(() => decryptEmailToken(`${encrypted.slice(0, -1)}x`)).toThrow();
  });
});
