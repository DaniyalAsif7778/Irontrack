import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { calculateEndTime, prayerWindow, prayerTimesAreOrdered, taskTimingError } from "./routineTiming";

const prayers = { fajr: "05:00", dhuhr: "12:00", asr: "15:30", maghrib: "18:20", isha: "20:00" };

describe("routine task timing", () => {
  it("calculates task end times from their selected duration", () => {
    expect(calculateEndTime("05:00", 45)).toBe("05:45");
    expect(calculateEndTime("23:30", 45)).toBe("");
  });

  it("keeps a Fajr task inside the Fajr-to-Dhuhr window", () => {
    expect(prayerWindow("fajr", prayers)).toMatchObject({ startTime: "05:00", endTime: "12:00", nextPrayer: "Dhuhr" });
    expect(taskTimingError("fajr", "11:15", "12:00", 45, prayers)).toBeNull();
    expect(taskTimingError("fajr", "11:30", "12:15", 45, prayers)).toMatch(/before Dhuhr/);
    expect(taskTimingError("fajr", "04:59", "05:44", 45, prayers)).toMatch(/at or after 05:00/);
  });

  it("rejects overlapping tasks but allows adjacent blocks", () => {
    const existing = [{ _id: "existing", startTime: "05:30", endTime: "06:15" }] as Task[];
    expect(taskTimingError("fajr", "05:45", "06:30", 45, prayers, existing)).toMatch(/overlaps/);
    expect(taskTimingError("fajr", "06:15", "07:00", 45, prayers, existing)).toBeNull();
  });

  it("requires prayer anchors to be in chronological order", () => {
    expect(prayerTimesAreOrdered(prayers)).toBe(true);
    expect(prayerTimesAreOrdered({ ...prayers, dhuhr: "04:30" })).toBe(false);
    expect(prayerTimesAreOrdered({ fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" })).toBe(true);
  });
});
