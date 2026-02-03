"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Initial = {
  favoriteCount: number;
  isFavorited: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  myRating: number | null;
};

export default function ComboActions(props: {
  comboId: number;
  nextPath: string;
  isLoggedIn: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [favoriteCount, setFavoriteCount] = useState(props.initial.favoriteCount);
  const [isFavorited, setIsFavorited] = useState(props.initial.isFavorited);

  const [ratingAvg, setRatingAvg] = useState<number | null>(props.initial.ratingAvg);
  const [ratingCount, setRatingCount] = useState(props.initial.ratingCount);
  const [myRating, setMyRating] = useState<number | null>(props.initial.myRating);

  const loginHref = `/login?next=${encodeURIComponent(props.nextPath)}`;

  const btnBase =
    "h-10 px-3 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";

  const toggleFavorite = () => {
    startTransition(async () => {
      const res = await fetch("/api/combos/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ comboId: props.comboId }),
      });

      if (res.status === 401) {
        router.push(loginHref);
        return;
      }

      const data = await res.json();
      if (!data?.success) {
        alert(data?.error ?? "お気に入りの更新に失敗しました。");
        return;
      }

      setIsFavorited(data.isFavorited);
      setFavoriteCount(data.favoriteCount);
    });
  };

  const setRating = (value: number) => {
    startTransition(async () => {
      const res = await fetch("/api/combos/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ comboId: props.comboId, value }),
      });

      if (res.status === 401) {
        router.push(loginHref);
        return;
      }

      const data = await res.json();
      if (!data?.success) {
        alert(data?.error ?? "評価の更新に失敗しました。");
        return;
      }

      setMyRating(data.myRating);
      setRatingAvg(data.ratingAvg);
      setRatingCount(data.ratingCount);
    });
  };

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold">アクション</div>
        {!props.isLoggedIn ? (
          <Link href={loginHref} className="text-blue-600 hover:underline text-sm">
            ログインして操作
          </Link>
        ) : (
          <span className="text-xs text-gray-500">ログイン中</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleFavorite}
          disabled={pending || !props.isLoggedIn}
          className={btnBase}
          title={!props.isLoggedIn ? "ログインが必要です" : "お気に入り切り替え"}
        >
          {isFavorited ? "★" : "☆"} お気に入り（{favoriteCount}）
        </button>
        <div className="text-xs text-gray-500">※お気に入り数はランキング用</div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setRating(v)}
            disabled={pending || !props.isLoggedIn}
            className={btnBase}
            aria-label={`評価 ${v}`}
            title={!props.isLoggedIn ? "ログインが必要です" : `評価 ${v}`}
          >
            {myRating !== null && v <= myRating ? "★" : "☆"}
          </button>
        ))}

        <div className="text-sm">
          平均: {ratingAvg === null ? "-" : ratingAvg.toFixed(1)}（{ratingCount}件）
        </div>
      </div>
    </div>
  );
}
