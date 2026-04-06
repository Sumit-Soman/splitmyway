import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import { recordField } from "./record-field";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Auth payloads may be POJO (no `.get`) when loaded from cookies. */
type UserRecord = RecordModel | Record<string, unknown>;

export function recordToAppUser(pb: PocketBase, r: UserRecord): AppUser {
  const filePayload = r as Record<string, unknown>;
  const avatar = recordField(r, "avatar") as string | undefined;
  const avatarUrl = avatar ? pb.files.getUrl(filePayload, avatar) : null;
  const currency = (recordField(r, "currency") as string | undefined)?.trim() || "USD";
  const id = String(recordField(r, "id") ?? "");
  const email = String(recordField(r, "email") ?? "");
  const created = recordField(r, "created") as string | undefined;
  const updated = recordField(r, "updated") as string | undefined;
  return {
    id,
    email,
    name: (recordField(r, "name") as string | null) ?? null,
    avatarUrl,
    currency: currency.toUpperCase(),
    createdAt: new Date(created ?? 0),
    updatedAt: new Date(updated ?? 0),
  };
}

export function publicUserFromRecord(pb: PocketBase, r: UserRecord) {
  const filePayload = r as Record<string, unknown>;
  const avatar = recordField(r, "avatar") as string | undefined;
  return {
    id: String(recordField(r, "id") ?? ""),
    name: (recordField(r, "name") as string | null) ?? null,
    email: String(recordField(r, "email") ?? ""),
    avatarUrl: avatar ? pb.files.getUrl(filePayload, avatar) : null,
  };
}
