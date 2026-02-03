"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CommentItem = {
  id: number;
  userId: number;
  userName: string;
  comment: string;
  createdAt: string; // ISO string
};

export default function ComboComments(props: {
  comboId: number;
  nextPath: string;
  isLoggedIn: boolean;
  initialComments?: CommentItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [text, setText] = useState("");

  // ★ undefined でも必ず配列になる
  const comments: CommentItem[] = Array.isArray(props.initialComments) ? props.initialComments : [];

  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(props.nextPath)}`, [props.nextPath]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;

    startTransition(async () => {
      const res = await fetch("/api/combos/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ comboId: props.comboId, comment: body }),
      });

      if (res.status === 401) {
        router.push(loginHref);
        return;
      }

      const data = await res.json();
      if (!data?.success) {
        alert(data?.error ?? "コメント投稿に失敗しました。");
        return;
      }

      setText("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border bg-white p-4 space-y-4">
      {!props.isLoggedIn ? (
        <div className="text-sm text-gray-600">
          コメント投稿はログインが必要です。{" "}
          <Link href={loginHref} className="text-blue-600 hover:underline">
            ログイン
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="コメントを入力"
            className="w-full rounded-md border p-2 text-sm"
          />
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={pending}
              className="h-10 px-4 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              投稿
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-sm text-gray-500">まだコメントはありません。</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{c.userName}</div>
                <div className="text-xs text-gray-500">
                  {new Date(c.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </div>
              </div>
              <div className="text-sm whitespace-pre-wrap mt-2">{c.comment}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
