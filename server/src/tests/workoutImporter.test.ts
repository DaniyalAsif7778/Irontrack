import { describe, expect, it } from "vitest";
import { extractWorkoutExport } from "../utils/workoutImporter.js";

describe("IronTrack workout export mapper", () => {
  it("maps legacy high-rep plan names and completed-set history", () => {
    const result = extractWorkoutExport({
      app: "IronTrack", scope: "workout", version: 1,
      data: {
        custom_workout_plan: {
          push_high_rep: [{ id: "press-hr", name: "Floor Press", sets: 2, reps: 12, muscle: "Chest", tempo: "3-1-2", rest: 60, cues: ["Brace"], setList: [{ reps: 12, weight: 5 }, { reps: 10, weight: 7 }] }],
        },
        ppl_workout_logs: {
          "2026-09-10_push_high_rep": { date: "2026-09-10", dayType: "push_high_rep", duration: 27, completedSets: { "press-hr": [12, 10] } },
        },
        ppl_progression: { "press-hr": { maxReps: 12, maxSets: 2, sessions: 1, lastDate: "2026-09-10" } },
      },
    });

    expect(result.plans[0]).toMatchObject({ dayType: "push_high", exercises: [{ id: "press-hr", name: "Floor Press" }] });
    expect(result.logs[0]).toMatchObject({ date: "2026-09-10", dayType: "push_high", totalSets: 2, totalVolume: 130, duration: 1620 });
    expect(result.logs[0]?.exercises[0]?.sets).toEqual([{ reps: 12, weight: 5 }, { reps: 10, weight: 7 }]);
    expect(result.progression).toEqual([{ exerciseId: "press-hr", maxReps: 12, maxSets: 2, sessions: 1, lastDate: "2026-09-10" }]);
  });

  it("rejects an unrelated export", () => {
    expect(() => extractWorkoutExport({ data: {} })).toThrow("This is not an IronTrack workout export");
  });
});
