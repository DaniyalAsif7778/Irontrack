import { describe, expect, it } from "vitest";
import { workoutLogLimit, workoutLogPayload } from "../utils/workoutValidation.js";

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
});
