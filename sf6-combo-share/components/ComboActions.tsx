"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  comboId: number;
  isLoggedIn: boolean;

  initialFavorited: boolean;
  initialFavoriteCount: number;

  initialMyRating: number | null;      // 1-5 or null
  initialAvgRating: number | null;     // 平均 or null
  initialRatingCount: number;          // 件数
};

export default function ComboActions(props: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [favorited, setFavorited] = useState(props.initialFavorited);
  const [favoriteCount, setFavoriteCount] = useState(props.initialFavoriteCount);
  const [favLoading, setFavLoading] = useState(false);

  const [myRating, setMyRating] = useState<number | null>(props.initialMyRating);
  const [avgRating, setAvgRating] = useState<number | null>(props.initialAvgRating);
  const [ratingCount, setRatingCount] = useState(props.initialRatingCount);
  const [rateLoading, setRateLoading] = useState(false);

  const avgLabel = useMemo(() => {
    if (avgRating == null) return "-";
    return avgRating.toFixed(2);
  }, [avgRating]);

  const requireLogin = () => {
    router.push(`/login?from=${encodeURIComponent(pathname)}`);
  };

  const toggleFavorite = async () => {
    if (!props.isLoggedIn) return requireLogin();
    if (favLoading) return;

    setFavLoading(true);
    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboId: props.comboId }),
      });

      if (res.status === 401) return requireLogin();

      const data = await res.json();
      if (!data?.success) return;

      setFavorited(!!data.favorited);
      setFavoriteCount(Number(data.count ?? favoriteCount));
    } finally {
      setFavLoading(false);
    }
  };

  const setRating = async (value: number) => {
    if (!props.isLoggedIn) return requireLogin();
    if (rateLoading) return;

    setRateLoading(true);
    try {
      const res = await fetch("/api/ratings/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboId: props.comboId, value }),
      });

      if (res.status === 401) return requireLogin();

      const data = await res.json();
      if (!data?.success) return;

      setMyRating(Number(data.myValue));
      setAvgRating(data.avg == null ? null : Number(data.avg));
      setRatingCount(Number(data.count ?? ratingCount));
    } finally {
      setRateLoading(false);
    }
  };

  const clearRating = async () => {
    if (!props.isLoggedIn) return requireLogin();
    if (rateLoading) return;

    setRateLoading(true);
    try {
      const res = await fetch("/api/ratings/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboId: props.comboId }),
      });

      if (res.status === 401) return requireLogin();

      const data = await res.json();
      if (!data?.success) return;

      setMyRating(null);
      setAvgRating(data.avg == null ? null : Number(data.avg));
      setRatingCount(Number(data.count ?? ratingCount));
    } finally {
      setRateLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded border p-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">アクション</div>
        {!props.isLoggedIn && (
          <button
            className="text-sm text-blue-600 hover:underline"
            onClick={requireLogin}
          >
            ログインして操作
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleFavorite}
          disabled={favLoading}
          className={`px-3 py-1 rounded border text-sm ${
            favorited ? "bg-yellow-100" : "hover:bg-gray-50"
          } disabled:opacity-60`}
        >
          {favorited ? "⭐ お気に入り" : "☆ お気に入り"}（{favoriteCount}）
        </button>

        <div className="text-xs text-gray-600">
          ※お気に入り数はランキング用
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => setRating(v)}
              disabled={rateLoading}
              className={`w-9 h-9 rounded border text-sm disabled:opacity-60 ${
                (myRating ?? 0) >= v ? "bg-yellow-100" : "hover:bg-gray-50"
              }`}
              aria-label={`rate ${v}`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="text-sm text-gray-700">
          平均: <span className="font-bold">{avgLabel}</span>（{ratingCount}件）
        </div>

        {myRating != null && (
          <button
            onClick={clearRating}
            disabled={rateLoading}
            className="px-3 py-1 rounded border text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            評価を消す
          </button>
        )}
      </div>
    </div>
  );
}
