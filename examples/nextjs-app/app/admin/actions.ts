"use server";

import { captureEvent } from "@/lib/runtimecatch";

export async function publishPost(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();

  // … your real persistence logic …

  // Report a successful application event. Fire-and-forget by design —
  // the client swallows delivery errors so reporting can't break the action.
  await captureEvent("post.published", {
    title,
    userId: "usr_123",
  });
}
