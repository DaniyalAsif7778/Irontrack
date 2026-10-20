import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/auth/user.model.js", () => ({
  User: { create: vi.fn(), findOne: vi.fn() },
  toPublicUser: vi.fn((user: { _id: string; name: string; email: string }) => ({ id: user._id, name: user.name, email: user.email })),
}));

import { User } from "../models/auth/user.model.js";
import { authenticateAccount, registerAccount } from "../services/auth/auth.service.js";

const account = { _id: "507f1f77bcf86cd799439011", name: "Daniyal", email: "daniyal@example.com", passwordHash: "" };

beforeEach(() => vi.clearAllMocks());

describe("account persistence", () => {
  it("stores a bcrypt password hash through MongoDB and never stores the raw password", async () => {
    vi.mocked(User.create).mockResolvedValue({ ...account } as never);
    const created = await registerAccount({ name: account.name, email: account.email, password: "a-long-test-password" });
    const createCalls = (User.create as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const stored = createCalls[0][0] as { passwordHash: string; email: string };
    expect(created.id).toBe(account._id);
    expect(stored.email).toBe(account.email);
    expect(stored.passwordHash).not.toBe("a-long-test-password");
    expect(await bcrypt.compare("a-long-test-password", stored.passwordHash)).toBe(true);
  });

  it("accepts a matching password and rejects a wrong password or unknown email", async () => {
    const select = vi.fn().mockResolvedValue({ ...account, passwordHash: await bcrypt.hash("correct-password", 4) });
    vi.mocked(User.findOne).mockReturnValue({ select } as never);
    expect(await authenticateAccount(account.email, "correct-password")).toMatchObject({ id: account._id });
    expect(await authenticateAccount(account.email, "wrong-password")).toBeNull();
    expect(User.findOne).toHaveBeenLastCalledWith({ email: account.email });

    vi.mocked(User.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue(null) } as never);
    expect(await authenticateAccount("missing@example.com", "any-password")).toBeNull();
  });
});
