import { describe, expect, it } from "vitest";
import { dueMinuteSlots, localCalendarParts } from "../services/notifications/push.service.js";

describe("persistent notification scheduler time windows", () => {
  it("includes a recent exact-minute reminder after a delayed scheduler tick", () => {
    const now = new Date("2026-11-05T09:05:30.000Z");
    const slots = dueMinuteSlots(now, "UTC");
    expect(slots.some(slot => slot.time === "09:00" && slot.dueAt.toISOString() === "2026-11-05T09:00:00.000Z")).toBe(true);
  });

  it("drops reminders older than the defined grace window", () => {
    const now = new Date("2026-11-05T09:16:00.000Z");
    const slots = dueMinuteSlots(now, "UTC");
    expect(slots.some(slot => slot.time === "09:00")).toBe(false);
  });

  it("builds due minutes from local timezone wall time across a daylight-saving jump", () => {
    const now = new Date("2026-03-08T07:05:30.000Z");
    const slots = dueMinuteSlots(now, "America/New_York");
    expect(slots.some(slot => slot.time === "03:00" && slot.dueAt.toISOString() === "2026-03-08T07:00:00.000Z")).toBe(true);
    expect(slots.some(slot => slot.time.startsWith("02:"))).toBe(false);
    expect(localCalendarParts(now, "America/New_York").time).toBe("03:05");
  });
});
