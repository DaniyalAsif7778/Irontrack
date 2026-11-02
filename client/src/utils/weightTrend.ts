import type { Weight } from "../types";

export type WeightTrendPoint = { date: string; weight: number };

export function weightTrendPoints(weights: Weight[], unit: "kg" | "lb"): WeightTrendPoint[] {
  return weights
    .map(({ date, weight, unit: entryUnit }) => ({
      date,
      weight: Number((entryUnit === unit ? weight : unit === "kg" ? weight / 2.20462 : weight * 2.20462).toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
