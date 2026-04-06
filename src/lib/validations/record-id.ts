import { z } from "zod";

/** PocketBase generates 15-character lowercase alphanumeric record ids. */
const pocketBaseId = z.string().regex(/^[a-z0-9]{15}$/);

/** Group/user/expense ids from PocketBase, or legacy UUID-shaped ids from imports. */
export const recordIdSchema = z.union([z.string().uuid(), pocketBaseId]);
