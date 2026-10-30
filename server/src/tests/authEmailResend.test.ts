import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), updateOne: vi.fn(), challengeDeleteMany: vi.fn(), challengeCreate: vi.fn(),
  enqueueAuthEmail: vi.fn(),
}));

vi.mock("../models/auth/user.model.js", () => ({ User: { findOne: mocks.findOne, updateOne: mocks.updateOne }, toPublicUser: vi.fn() }));
vi.mock("../models/auth/authChallenge.model.js", () => ({ AuthChallenge: { deleteMany: mocks.challengeDeleteMany, create: mocks.challengeCreate } }));
vi.mock("../models/auth/session.model.js", () => ({ AuthSession: { deleteMany: vi.fn() } }));
vi.mock("../services/auth/emailQueue.service.js", () => ({ enqueueAuthEmail: mocks.enqueueAuthEmail }));

import { sendVerificationForEmail } from "../services/auth/auth.service.js";

const user = { _id: "507f1f77bcf86cd799439011", email: "athlete@example.com", name: "Athlete", emailVerified: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOne.mockResolvedValue(user);
  mocks.updateOne.mockResolvedValue({ acknowledged: true });
  mocks.challengeDeleteMany.mockResolvedValue({ deletedCount: 1 });
  mocks.challengeCreate.mockResolvedValue({});
  mocks.enqueueAuthEmail.mockResolvedValue("queue-job-1");
});

describe("email verification resend", () => {
  it("sends a fresh link before reporting the resend as complete", async () => {
    await sendVerificationForEmail(user.email);
    expect(mocks.challengeCreate).toHaveBeenCalledOnce();
    expect(mocks.enqueueAuthEmail).toHaveBeenCalledWith("verify_email", user.email, user.name, expect.any(String));
  });

  it("removes the unusable challenge and propagates SMTP failures", async () => {
    const deliveryError = new Error("SMTP unavailable");
    mocks.enqueueAuthEmail.mockRejectedValue(deliveryError);
    await expect(sendVerificationForEmail(user.email)).rejects.toBe(deliveryError);
    expect(mocks.challengeDeleteMany).toHaveBeenLastCalledWith(expect.objectContaining({
      userId: user._id,
      purpose: "verify_email",
      tokenHash: expect.any(String),
    }));
  });

  it("does not send links for missing or already verified accounts", async () => {
    mocks.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...user, emailVerified: true });
    await sendVerificationForEmail(user.email);
    await sendVerificationForEmail(user.email);
    expect(mocks.enqueueAuthEmail).not.toHaveBeenCalled();
  });
});
