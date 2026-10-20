import { describe, expect, it } from "vitest";
import { taskPayload, weightPayload } from "../utils/validation.js";
import { isValidRoutineDate, nextPrayerBlockForShift, shouldCarryAfterCutoff } from "../services/routine/routine-events.service.js";

describe("request validation", () => {
  it("accepts a complete routine task", () => expect(taskPayload({ dayType: "weekday", block: "fajr", title: "Prayer", priority: "medium" })).toMatchObject({ title: "Prayer", block: "fajr" }));
  it("accepts a complete daily time block and rejects incomplete or inverted blocks", () => {
    expect(taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "05:30", endTime: "06:15" })).toMatchObject({ startTime: "05:30", endTime: "06:15" });
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "05:30" })).toThrow(/both task block/);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "06:15", endTime: "05:30" })).toThrow(/after its start/);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "25:70", endTime: "26:00" })).toThrow(/valid 24-hour time/);
  });
  it("rejects unknown blocks and invalid weight data", () => { expect(() => taskPayload({ dayType: "weekday", block: "custom", title: "Task" })).toThrow(); expect(() => weightPayload({ date: "today", weight: -1, unit: "kg" })).toThrow(); });
  it("accepts only real ISO routine dates", () => { expect(isValidRoutineDate("2026-10-20")).toBe(true); expect(isValidRoutineDate("2026-02-30")).toBe(false); expect(isValidRoutineDate("today")).toBe(false); });
  it("moves a shifted task only across configured fixed prayer boundaries", () => {
    const anchors = new Map([["dhuhr", 12 * 60], ["asr", 16 * 60], ["isha", 20 * 60]]);
    expect(nextPrayerBlockForShift("fajr", 13 * 60, anchors)).toBe("dhuhr");
    expect(nextPrayerBlockForShift("fajr", 17 * 60, anchors)).toBe("asr");
    expect(nextPrayerBlockForShift("asr", 15 * 60, anchors)).toBeUndefined();
  });
  it("carries tasks only when their end reaches the 9 pm local cutoff", () => {
    expect(shouldCarryAfterCutoff("20:59")).toBe(false);
    expect(shouldCarryAfterCutoff("21:00")).toBe(true);
    expect(shouldCarryAfterCutoff("25:00")).toBe(false);
  });
});
