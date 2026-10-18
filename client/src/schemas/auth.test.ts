import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

describe("account form validation", () => {
  it("accepts a shorter existing password when signing in", () => {
    expect(loginSchema.safeParse({ email: "person@example.com", password: "short" }).success).toBe(true);
  });

  it("requires a name and a strong password for account creation", () => {
    expect(registerSchema.safeParse({ name: "Sam", email: "person@example.com", password: "long-enough-password" }).success).toBe(true);
    expect(registerSchema.safeParse({ name: "S", email: "person@example.com", password: "short" }).success).toBe(false);
  });
});
