import { describe, expect, it } from "vitest";
import { taskPayload, weightPayload } from "../utils/validation.js";

describe("request validation", () => {
  it("accepts a complete routine task", () => expect(taskPayload({ dayType: "weekday", block: "fajr", title: "Prayer", priority: "medium" })).toMatchObject({ title: "Prayer", block: "fajr" }));
  it("rejects unknown blocks and invalid weight data", () => { expect(() => taskPayload({ dayType: "weekday", block: "custom", title: "Task" })).toThrow(); expect(() => weightPayload({ date: "today", weight: -1, unit: "kg" })).toThrow(); });
});
