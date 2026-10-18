export const DAY_TYPES = ["weekday", "weekend"] as const;
export const BLOCKS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type DayType = (typeof DAY_TYPES)[number];
export type Block = (typeof BLOCKS)[number];

export const blockLabel: Record<Block, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
export const isDayType = (value: unknown): value is DayType => typeof value === "string" && DAY_TYPES.includes(value as DayType);
export const isBlock = (value: unknown): value is Block => typeof value === "string" && BLOCKS.includes(value as Block);
