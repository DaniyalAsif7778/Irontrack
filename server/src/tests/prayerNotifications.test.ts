import { describe, expect, it } from "vitest";
import { localCalendarParts, prayersDueAt } from "../services/notifications/push.service.js";

describe("prayer notification scheduling", () => {
  it("uses the saved prayer time and ignores blank times", () => {
    expect(prayersDueAt({
      fajr: "05:10",
      dhuhr: "12:30",
      asr: "",
      maghrib: "18:25",
      isha: "",
    }, "12:30")).toEqual([{ key: "dhuhr", label: "Dhuhr" }]);
    expect(prayersDueAt({ fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" }, "05:10")).toEqual([]);
  });

  it("uses the timezone's daylight-saving offset and local calendar date", () => {
    expect(localCalendarParts(new Date("2026-11-02T00:15:00.000Z"), "UTC"))
      .toEqual({ dateKey: "2026-11-02", time: "00:15" });
    expect(localCalendarParts(new Date("2026-11-02T00:15:00.000Z"), "America/Los_Angeles"))
      .toEqual({ dateKey: "2026-11-01", time: "16:15" });
    expect(localCalendarParts(new Date("2026-07-02T00:15:00.000Z"), "America/Los_Angeles"))
      .toEqual({ dateKey: "2026-07-01", time: "17:15" });
  });
});
