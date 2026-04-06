import { z } from "zod";
import { recordIdSchema } from "@/lib/validations/record-id";

export const createExpenseSchema = z.object({
  groupId: recordIdSchema,
  description: z.string().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  category: z.string(),
  date: z.coerce.date(),
  paidById: recordIdSchema,
  notes: z.string().max(2000).optional().nullable(),
  splitMethod: z.enum(["equal", "exact", "percentage", "shares"]),
  participantIds: z.array(recordIdSchema).min(1),
  exactAmounts: z.record(recordIdSchema, z.coerce.number()).optional(),
  percentages: z.record(recordIdSchema, z.coerce.number()).optional(),
  shares: z.record(recordIdSchema, z.coerce.number().int().positive()).optional(),
});

export const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: recordIdSchema,
});

export const settlementSchema = z.object({
  groupId: recordIdSchema,
  fromId: recordIdSchema,
  toId: recordIdSchema,
  amount: z.coerce.number().positive(),
  notes: z.string().max(2000).optional().nullable(),
});
