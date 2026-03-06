import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1, "Digite ou fale algo"),
});

export type ChatFormValues = z.infer<typeof chatSchema>;
