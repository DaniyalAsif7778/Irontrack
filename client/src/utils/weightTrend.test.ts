import { describe, expect, it } from "vitest";
import type { Weight } from "../types";
import { weightTrendPoints } from "./weightTrend";

describe("weightTrendPoints", () => {
  it("orders entries chronologically and converts mixed units", () => {
    const weights: Weight[] = [
      { _id: "later", date: "2026-04-02", weight: 180, unit: "lb" },
      { _id: "earlier", date: "2026-04-01", weight: 80, unit: "kg" },
    ];

    expect(weightTrendPoints(weights, "kg")).toEqual([
      { date: "2026-04-01", weight: 80 },
      { date: "2026-04-02", weight: 81.65 },
    ]);
  });
});
