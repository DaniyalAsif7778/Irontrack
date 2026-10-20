import { describe, expect, it } from "vitest";
import { settingsSchema } from "./settings";

describe("settings validation", () => {
  it("accepts supported account preferences", () => {
    expect(settingsSchema.safeParse({ name: "Daniyal", weightUnit: "lb", focusMinutes: 50, breakMinutes: 10, prayerTimes: { fajr: "05:10", dhuhr: "12:30", asr: "15:45", maghrib: "18:20", isha: "20:00" } }).success).toBe(true);
  });

  it("rejects out-of-range timers and invalid units", () => {
    expect(settingsSchema.safeParse({ name: "Daniyal", weightUnit: "stone", focusMinutes: 50, breakMinutes: 10 }).success).toBe(false);
    expect(settingsSchema.safeParse({ name: "Daniyal", weightUnit: "kg", focusMinutes: 200, breakMinutes: 10 }).success).toBe(false);
  });
});
