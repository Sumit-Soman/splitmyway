import { z } from "zod";
import { recordIdSchema } from "@/lib/validations/record-id";

export const createGroupSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  category: z.string(),
  currency: z.string().min(3).max(3),
});

export const addMemberSchema = z.object({
  groupId: recordIdSchema,
  email: z.string().email(),
});
