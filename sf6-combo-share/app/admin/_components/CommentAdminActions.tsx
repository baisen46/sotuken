"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? `request failed: ${res.status}`);
  }
  return json;
}

export default function CommentAdminActions(props: {
  id: number;
  isPublished: boolean;
  deletedAt: Date | string | null;
}) {
  const { id, isPublished, deletedAt } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (deletedAt) {
    return (
      <button
        type="button"
        className="px-2 py-1 border rounded text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await post("/api/admin/comments/restore", { id });
          })
        }
      >
        復元
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="px-2 py-1 border rounded text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await post("/api/admin/comments/publish", { id, publish: !isPublished });
          })
        }
      >
        {isPublished ? "非公開" : "公開"}
      </button>

      <button
        type="button"
        className="px-2 py-1 border rounded text-xs"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await post("/api/admin/comments/delete", { id });
          })
        }
      >
        削除
      </button>
    </div>
  );
}
