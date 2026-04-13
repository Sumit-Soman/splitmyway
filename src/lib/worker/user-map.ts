import type { AppUser } from "@/lib/pocketbase/user-map";

export type ApiUserPayload = {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function recordToAppUserFromApi(u: ApiUserPayload): AppUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    currency: (u.currency ?? "USD").toUpperCase(),
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
  };
}
