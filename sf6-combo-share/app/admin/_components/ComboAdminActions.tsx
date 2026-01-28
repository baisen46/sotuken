"use client";

import { useState } from "react";

async function post(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

export default function ComboAdminActions(props: {
  id: number;
  isPublished: boolean;
  deletedAt: string | Date | null;
}) {
  const { id, isPublished, deletedAt } = props;
  const [busy, setBusy] = useState(false);

  const onPublishToggle = async () => {
    setBusy(true);
    try {
      await post("/api/admin/combos/publish", { id, publish: !isPublished });
      location.reload();
    } catch (e: any) {
      alert(e?.message ?? "error");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("ソフト削除します。よろしいですか？")) return;
    setBusy(true);
    try {
      await post("/api/admin/combos/delete", { id });
      location.reload();
    } catch (e: any) {
      alert(e?.message ?? "error");
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      await post("/api/admin/combos/restore", { id });
      location.reload();
    } catch (e: any) {
      alert(e?.message ?? "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {deletedAt ? (
        <button className="border rounded px-2 py-1" disabled={busy} onClick={onRestore}>
          復元
        </button>
      ) : (
        <>
          <button className="border rounded px-2 py-1" disabled={busy} onClick={onPublishToggle}>
            {isPublished ? "非公開" : "公開"}
          </button>
          <button className="border rounded px-2 py-1" disabled={busy} onClick={onDelete}>
            削除
          </button>
        </>
      )}
    </div>
  );
}
