import { z } from "zod";

export const weightSchema = z.object({
  date: z.string().min(1, "Choose a date."),
  weight: z.number().positive("Enter a weight above zero.").max(1000, "Weight must be below 1000."),
  unit: z.enum(["kg", "lb"]),
});

export type WeightFormValues = z.infer<typeof weightSchema>;
