"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CommentItem = {
  id: number;
  comboId: number;
  userId: number;
  comment: string;
  createdAt: string;
  user: { id: number; name: string };
};

export default function CommentsSection(props: {
  comboId: number;
  initialComments: CommentItem[];
  currentUserId: number | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CommentItem[]>(props.initialComments ?? []);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isLoggedIn = props.currentUserId != null;

  const canPost = useMemo(() => text.trim().length > 0 && text.trim().length <= 1000, [text]);

  async function reloadFromApi() {
    const res = await fetch(`/api/comments?comboId=${props.comboId}`, { cache: "no-store" });
    const data = await res.json();
    if (data?.success) setItems(data.comments ?? []);
  }

  async function submit() {
    if (!canPost) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboId: props.comboId, comment: text }),
      });

      if (res.status === 401) {
        alert("ログインしてください");
        return;
      }

      const data = await res.json();
      if (!data?.success) {
        alert(data?.error ?? "投稿に失敗しました");
        return;
      }

      setText("");

      // 即時反映（返ってきたコメントを先頭に追加）
      if (data.comment) setItems((prev) => [data.comment, ...prev]);

      // サーバー側の再取得でも整合取れるように（必要なら）
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(commentId: number) {
    if (!confirm("このコメントを削除しますか？")) return;

    setDeletingId(commentId);
    try {
      const res = await fetch("/api/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        alert("ログインしてください");
        return;
      }
      if (!data?.success) {
        alert(data?.error ?? "削除に失敗しました");
        return;
      }

      setItems((prev) => prev.filter((c) => c.id !== commentId));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">コメント</h2>
        <button
          type="button"
          onClick={reloadFromApi}
          className="text-xs rounded border px-3 py-1 hover:bg-gray-50"
        >
          更新
        </button>
      </div>

      {!isLoggedIn ? (
        <div className="border rounded-md p-3 text-sm text-gray-700">
          コメントするにはログインが必要です：
          <Link
            href={`/login?from=/combos/${props.comboId}`}
            className="ml-2 text-blue-600 hover:underline"
          >
            ログインへ →
          </Link>
        </div>
      ) : (
        <div className="border rounded-md p-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="コメントを書く（最大1000文字）"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{text.trim().length}/1000</div>
            <button
              type="button"
              onClick={submit}
              disabled={!canPost || submitting}
              className={`rounded px-4 py-2 text-sm font-semibold ${
                !canPost || submitting
                  ? "bg-gray-200 text-gray-500"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {submitting ? "送信中..." : "投稿"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">まだコメントはありません。</div>
        ) : (
          items.map((c) => {
            const mine = props.currentUserId != null && c.userId === props.currentUserId;
            const dt = new Date(c.createdAt);
            const dateStr = isNaN(dt.getTime()) ? c.createdAt : dt.toLocaleString("ja-JP");

            return (
              <div key={c.id} className="border rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold">{c.user?.name ?? "Unknown"}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500">{dateStr}</div>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        disabled={deletingId === c.id}
                        className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
                      >
                        {deletingId === c.id ? "削除中..." : "削除"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm whitespace-pre-wrap">{c.comment}</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
