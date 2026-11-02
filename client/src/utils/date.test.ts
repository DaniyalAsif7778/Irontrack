import { describe, expect, it } from "vitest";
import { ironToday } from "./date";

describe("ironToday", () => {
  it("uses the previous date before the 1 AM routine boundary", () => {
    expect(ironToday(new Date(2026, 1, 3, 0, 59))).toBe("2026-02-02");
  });

  it("starts the new routine date at 1 AM", () => {
    expect(ironToday(new Date(2026, 1, 3, 1, 0))).toBe("2026-02-03");
  });

  it("handles the previous date across year boundaries", () => {
    expect(ironToday(new Date(2026, 0, 1, 0, 30))).toBe("2025-12-31");
  });
});
