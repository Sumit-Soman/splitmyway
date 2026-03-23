"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadProfileAvatar, removeProfileAvatar } from "@/actions/avatar";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { useToast } from "@/components/ui/toast";

async function removeAvatarAction(_prev: ActionResult | null, _formData: FormData): Promise<ActionResult> {
  return removeProfileAvatar();
}

export function ProfileAvatarField({
  userId,
  name,
  email,
  avatarUrl,
}: {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadProfileAvatar, null as ActionResult | null);
  const [removeState, removeAction, removePending] = useActionState(removeAvatarAction, null as ActionResult | null);

  useEffect(() => {
    if (uploadState?.success) {
      toast({ title: "Saved", description: uploadState.message ?? "Photo updated." });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else if (uploadState && !uploadState.success) {
      toast({ title: "Could not upload", description: uploadState.error, variant: "destructive" });
    }
  }, [uploadState, toast, router]);

  useEffect(() => {
    if (removeState?.success) {
      if (removeState.message && removeState.message !== "No photo to remove.") {
        toast({ title: "Removed", description: removeState.message });
      }
      router.refresh();
    } else if (removeState && !removeState.success) {
      toast({ title: "Error", description: removeState.error, variant: "destructive" });
    }
  }, [removeState, toast, router]);

  return (
    <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 sm:flex-row sm:items-center sm:gap-6">
      <MemberAvatar userId={userId} name={name} email={email} avatarUrl={avatarUrl} size="lg" className="shrink-0" />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-neutral-900">Profile photo</p>
        <p className="text-xs leading-relaxed text-neutral-500">JPEG, PNG, WebP, or GIF · max 2 MB</p>
        <div className="flex flex-wrap gap-2">
          <form action={uploadAction}>
            <input
              ref={fileRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              id="profile-avatar-file"
              disabled={uploadPending}
              onChange={(e) => {
                if (e.target.files?.length) {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadPending}
              onClick={() => fileRef.current?.click()}
            >
              {uploadPending ? "Uploading…" : "Upload photo"}
            </Button>
          </form>
          {avatarUrl ? (
            <form action={removeAction}>
              <Button type="submit" variant="ghost" size="sm" disabled={removePending} className="text-neutral-600">
                {removePending ? "Removing…" : "Remove"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
