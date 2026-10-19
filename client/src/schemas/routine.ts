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
  subtasks: z.array(z.object({ title: z.string().trim().min(1, "Enter a subtask title."), completed: z.boolean() })),
});

export type TaskFormValues = z.infer<typeof taskSchema>;
