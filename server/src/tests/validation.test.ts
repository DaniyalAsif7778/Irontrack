import { describe, expect, it } from "vitest";
import { taskPayload, weightPayload } from "../utils/validation.js";
import { isValidRoutineDate, nextPrayerBlockForShift, shouldCarryAfterCutoff } from "../services/routine/routine-events.service.js";

describe("request validation", () => {
  const prayerTimes = { fajr: "05:00", dhuhr: "12:00", asr: "15:30", maghrib: "18:20", isha: "20:00" };

  it("accepts a complete routine task", () => expect(taskPayload({ dayType: "weekday", block: "fajr", title: "Prayer", priority: "medium" })).toMatchObject({ title: "Prayer", block: "fajr" }));
  it("accepts a complete daily time block and rejects incomplete or inverted blocks", () => {
    expect(taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "05:30", endTime: "06:15", duration: 45 }, false, prayerTimes)).toMatchObject({ startTime: "05:30", endTime: "06:15", duration: 45 });
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "05:30" })).toThrow(/both task block/);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "06:15", endTime: "05:30" })).toThrow(/after its start/);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "25:70", endTime: "26:00" })).toThrow(/valid 24-hour time/);
  });
  it("rejects scheduled Fajr tasks before Fajr or beyond Dhuhr", () => {
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "11:30", endTime: "12:15", duration: 45 }, false, prayerTimes)).toThrow(/before dhuhr/i);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "04:45", endTime: "05:30", duration: 45 }, false, prayerTimes)).toThrow(/at or after 05:00/);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "11:15", endTime: "12:00", duration: 30 }, false, prayerTimes)).toThrow(/match its block duration/);
    expect(() => taskPayload({ dayType: "weekday", block: "fajr", title: "Read", startTime: "05:30", endTime: "06:15", duration: 45 })).toThrow(/Set the fajr and next prayer/);
  });
  it("rejects unknown blocks, impossible weight dates, and invalid weight data", () => {
    expect(() => taskPayload({ dayType: "weekday", block: "custom", title: "Task" })).toThrow();
    expect(() => weightPayload({ date: "2026-02-30", weight: 70, unit: "kg" })).toThrow(/real.*calendar/i);
    expect(() => weightPayload(null)).toThrow();
    expect(() => weightPayload({ date: "today", weight: -1, unit: "kg" })).toThrow();
  });
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
