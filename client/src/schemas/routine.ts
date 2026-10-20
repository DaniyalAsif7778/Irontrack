import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(160, "Keep the title under 160 characters."),
  description: z.string().max(4000, "Keep the description under 4000 characters."),
  type: z.string().max(50, "Keep the task type under 50 characters."),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().max(80, "Keep the category under 80 characters."),
  duration: z.number().int().min(0).max(1440, "Duration cannot exceed 24 hours."),
  dueDate: z.string(),
  reminderTime: z.string(),
  startTime: z.string().regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/, "Enter a valid start time."),
  endTime: z.string().regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/, "Enter a valid end time."),
  subtasks: z.array(z.object({ title: z.string().trim().min(1, "Enter a subtask title."), completed: z.boolean() })),
}).refine(value => Boolean(value.startTime) === Boolean(value.endTime), { message: "Set both start and end times, or leave both empty.", path: ["startTime"] })
  .refine(value => !value.startTime || value.endTime > value.startTime, { message: "End time must be after start time.", path: ["endTime"] });

export type TaskFormValues = z.infer<typeof taskSchema>;
