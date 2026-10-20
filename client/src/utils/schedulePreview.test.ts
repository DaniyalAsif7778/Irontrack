import { describe, expect, it } from "vitest";
import type { Schedule, Task } from "../types";
import { previewScheduleDelay } from "./schedulePreview";

const task = (id: string, startTime: string, endTime: string, title = id) => ({ _id: id, title, startTime, endTime } as Task);
const schedule: Schedule = { dayType: "weekday", blocks: [
  { id: "fajr", label: "Fajr", tasks: [task("current", "06:00", "06:45"), task("cross", "11:50", "12:20")] },
  { id: "dhuhr", label: "Dhuhr", tasks: [task("late", "20:40", "20:55")] },
] };
const anchors = { fajr: "05:00", dhuhr: "12:00", asr: "15:30", maghrib: "18:00", isha: "20:00" };

describe("previewScheduleDelay", () => {
  it("moves later tasks to the prayer block crossed by the delay", () => {
    expect(previewScheduleDelay(schedule, "current", 15, anchors)[0]).toMatchObject({ id: "cross", fromBlock: "fajr", toBlock: "dhuhr", startTime: "12:05", endTime: "12:35" });
  });
  it("carries tasks past the evening cutoff or midnight to tomorrow's Isha", () => {
    expect(previewScheduleDelay(schedule, "cross", 15, anchors)[0]).toMatchObject({ id: "late", toBlock: "isha", startTime: "20:15", endTime: "21:00", carriedToTomorrow: true });
    const midnight = { dayType: "weekday" as const, blocks: [{ id: "fajr", label: "Fajr", tasks: [task("a", "22:00", "22:30"), task("b", "23:55", "23:59")] }] };
    expect(previewScheduleDelay(midnight, "a", 10, anchors)[0]).toMatchObject({ id: "b", carriedToTomorrow: true, toBlock: "isha" });
  });
  it("ignores missing sources and untimed tasks", () => {
    expect(previewScheduleDelay(schedule, "missing", 15, anchors)).toEqual([]);
    const noTimes = { dayType: "weekday" as const, blocks: [{ id: "fajr", label: "Fajr", tasks: [task("a", "", ""), task("b", "", "")] }] };
    expect(previewScheduleDelay(noTimes, "a", 15, anchors)).toEqual([]);
  });
});
