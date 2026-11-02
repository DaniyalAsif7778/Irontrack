import { describe, expect, it } from "vitest";
import { analyticsRange } from "./analyticsPeriod.js";

describe("analytics period ranges", () => {
  it("returns a trailing seven-day window", () => {
    expect(analyticsRange("7d", "2026-11-02")).toMatchObject({ startDate: "2026-10-27", endDate: "2026-11-02", days: 7, granularity: "day" });
  });

  it("selects the entire previous month, including leap-day months", () => {
    expect(analyticsRange("previous-month", "2024-03-02")).toMatchObject({ startDate: "2024-02-01", endDate: "2024-02-29", days: 29, granularity: "day" });
  });

  it("groups longer ranges by month and includes the current month", () => {
    expect(analyticsRange("3m", "2026-01-05")).toMatchObject({ startDate: "2025-11-01", endDate: "2026-01-05", granularity: "month" });
    expect(analyticsRange("3y", "2026-11-02")).toMatchObject({ startDate: "2023-12-01", endDate: "2026-11-02", granularity: "month" });
  });
});
