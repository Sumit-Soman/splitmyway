import { z } from "zod";

export const createExpenseSchema = z.object({
  groupId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  category: z.string(),
  date: z.coerce.date(),
  paidById: z.string().uuid(),
  notes: z.string().max(2000).optional().nullable(),
  splitMethod: z.enum(["equal", "exact", "percentage", "shares"]),
  participantIds: z.array(z.string().uuid()).min(1),
  exactAmounts: z.record(z.string(), z.coerce.number()).optional(),
  percentages: z.record(z.string(), z.coerce.number()).optional(),
  shares: z.record(z.string(), z.coerce.number().int().positive()).optional(),
});

export const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: z.string().uuid(),
});

export const settlementSchema = z.object({
  groupId: z.string().uuid(),
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  notes: z.string().max(2000).optional().nullable(),
});
