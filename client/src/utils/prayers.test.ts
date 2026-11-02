import { describe, expect, it } from "vitest";
import { prayersDueAt } from "./prayers";

describe("prayersDueAt", () => {
  it("matches configured prayer times and skips blank times", () => {
    expect(prayersDueAt({ fajr: "05:10", dhuhr: "12:30", asr: "", maghrib: "18:25", isha: "" }, "12:30"))
      .toEqual([{ key: "dhuhr", label: "Dhuhr" }]);
    expect(prayersDueAt({ fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" }, "05:10")).toEqual([]);
  });
});
