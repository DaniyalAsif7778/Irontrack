import { describe, expect, it } from "vitest";
import { workoutLogCursor, workoutLogLimit, workoutLogPayload } from "../utils/workoutValidation.js";

const log = (date: string) => ({
  date,
  dayType: "day-upper",
  exercises: [{ exerciseId: "row", name: "Dumbbell row", sets: [{ reps: 8, weight: 20 }] }],
  duration: 600,
});

describe("workout log validation", () => {
  it("accepts real calendar dates and rejects impossible dates", () => {
    expect(workoutLogPayload(log("2024-02-29")).date).toBe("2024-02-29");
    for (const date of ["2025-02-29", "2024-13-01", "2024-04-31"]) {
      expect(() => workoutLogPayload(log(date))).toThrow(/real calendar day/i);
    }
  });

  it("bounds valid history limits and rejects malformed query values", () => {
    expect(workoutLogLimit(undefined)).toBe(30);
    expect(workoutLogLimit("0")).toBe(1);
    expect(workoutLogLimit("500")).toBe(200);
    for (const value of ["abc", "1.5", "1e100", ["10"]]) {
      expect(() => workoutLogLimit(value)).toThrow(/whole number/i);
    }
  });

  it("validates and decodes stable workout-history cursors", () => {
    const value = { date: "2026-11-02", completedAt: "2026-11-02T12:00:00.000Z", id: "507f1f77bcf86cd799439011" };
    const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
    expect(workoutLogCursor(encoded)).toEqual(value);
    expect(workoutLogCursor(undefined)).toBeNull();
    for (const cursor of ["broken", Buffer.from(JSON.stringify({ ...value, id: "bad" })).toString("base64url")]) {
      expect(() => workoutLogCursor(cursor)).toThrow(/cursor is invalid/i);
    }
  });
});
