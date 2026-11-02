import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findOneAndUpdate: vi.fn(), pushConfiguration: vi.fn() }));
vi.mock("../models/notifications/notification.model.js", () => ({ PushSubscription: { findOneAndUpdate: mocks.findOneAndUpdate } }));
vi.mock("../services/notifications/push.service.js", () => ({ pushConfiguration: mocks.pushConfiguration, sendTestPush: vi.fn() }));

import { subscribe } from "../controllers/notifications/notifications.controller.js";

const ownerId = "507f1f77bcf86cd799439011";
const subscription = {
  endpoint: "https://push.example/endpoint-token",
  keys: { p256dh: "valid-p256dh-public-key", auth: "valid-auth-key" },
  timezone: "Asia/Karachi",
  preferences: { taskTimes: true, workoutAtNine: true, hydration: false, movement: false, prayerTimes: false },
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.post("/subscriptions", (req, _res, next) => { req.auth = { userId: ownerId }; next(); }, subscribe);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pushConfiguration.mockReturnValue({ enabled: true });
  mocks.findOneAndUpdate.mockResolvedValue({});
});

describe("push subscription ownership", () => {
  it("upserts a subscription only within the signed-in account scope", async () => {
    await request(createApp()).post("/subscriptions").send(subscription).expect(200);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { ownerId, endpoint: subscription.endpoint },
      expect.objectContaining({ ownerId, endpoint: subscription.endpoint }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("does not reassign another account's globally unique endpoint", async () => {
    mocks.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: 11000 }));
    const response = await request(createApp()).post("/subscriptions").send(subscription).expect(409);
    expect(response.body.error).toMatch(/already assigned/i);
    expect(response.body.error).not.toContain(ownerId);
  });
});
