import { describe, expect, it } from "vitest";
import { extractBackup } from "../utils/importer.js";

describe("IronTrack backup importer", () => {
  it("maps routine sections, completion dates, and body weight", () => {
    const result = extractBackup({ data: { routine_state_v2: { tempTasks: { post_fajr: [{ title: "Fajr reading", type: "reading", priority: "high", status: "completed", completedAt: "2026-09-04T05:00:00.000Z" }] } }, body_weight_log: [{ date: "2026-08-30", weight: 95.05, unit: "kg" }] } });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({ block: "fajr", dayType: "weekday", title: "Fajr reading", completedDate: "2026-09-04" });
    expect(result.weights).toEqual([{ date: "2026-08-30", weight: 95.05, unit: "kg" }]);
  });

  it("uses the backup's active weekend schedule when provided", () => {
    const result = extractBackup({ data: { routine_type: "weekend", routine_state_v2: { tempTasks: { post_asr: [{ title: "Exercise" }] } } } });
    expect(result.tasks[0].dayType).toBe("weekend");
  });
});
