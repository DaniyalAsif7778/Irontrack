import { describe, expect, it } from "vitest";
import { workoutPlanDataPayload, workoutWeekPayload } from "../utils/workoutValidation.js";

const sevenDayWeek = [
  { key: "mon", label: "Monday", planId: "day-upper" },
  { key: "tue", label: "Tuesday", planId: null },
  { key: "wed", label: "Wednesday", planId: "day-lower" },
  { key: "thu", label: "Thursday", planId: null },
  { key: "fri", label: "Friday", planId: null },
  { key: "sat", label: "Saturday", planId: null },
  { key: "sun", label: "Sunday", planId: null },
];

describe("custom workout program validation", () => {
  it("accepts a user-named plan with an empty exercise list", () => {
    expect(workoutPlanDataPayload({ name: "Upper body", exercises: [] })).toEqual({ name: "Upper body", exercises: [] });
  });

  it("rejects blank, oversized, or unowned plan IDs in the weekly schedule", () => {
    expect(workoutWeekPayload({ days: sevenDayWeek }, ["day-upper", "day-lower"])).toEqual({ days: sevenDayWeek });
    expect(() => workoutWeekPayload({ days: sevenDayWeek.slice(1) }, ["day-upper"])).toThrow(/seven days/i);
    expect(() => workoutWeekPayload({ days: sevenDayWeek.map((day, index) => index === 6 ? { ...day, key: "mon" } : day) }, ["day-upper"])).toThrow(/weekday keys must be unique/i);
    expect(() => workoutWeekPayload({ days: sevenDayWeek.map((day, index) => index === 0 ? { ...day, planId: "another-users-plan" } : day) }, ["day-upper"])).toThrow(/belong to this account/i);
  });

  it("rejects a plan without a usable display name", () => {
    expect(() => workoutPlanDataPayload({ name: "   ", exercises: [] })).toThrow(/name/i);
  });
});
