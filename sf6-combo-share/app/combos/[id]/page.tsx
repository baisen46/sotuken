import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import ComboActions from "@/components/ComboActions";
import { getCurrentUser } from "@/lib/auth";
import CommentsSection from "@/components/CommentsSection";

export const dynamic = "force-dynamic";

function isAdminEmail(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw) return false;

  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return !!email && allow.includes(email.toLowerCase());
}

function formatPlayStyle(ps: string) {
  return ps === "MODERN" ? "モダン" : ps === "CLASSIC" ? "クラシック" : ps;
}

function toTokens(comboText: string) {
  return comboText
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 数字 + 次トークン結合（例: "2" "中K" -> "2中K"）
const META_TOKENS = new Set([">", "CR", "DR", "DI", "OD", "SA", "SA1", "SA2", "SA3", "J", "A"]);

function mergeNumberWithNext(tokens: string[]) {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const next = tokens[i + 1];

    if (/^\d+$/.test(cur) && next && !META_TOKENS.has(next)) {
      out.push(cur + next);
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
}

function extractStarterText(comboText: string) {
  const tokens = toTokens(comboText);
  const idx = tokens.indexOf(">");
  const starterTokens = idx === -1 ? tokens : tokens.slice(0, idx);
  return mergeNumberWithNext(starterTokens).join(" ");
}

export default async function ComboDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const comboId = Number(id);

  if (!Number.isInteger(comboId) || comboId <= 0) notFound();

  const currentUser = await getCurrentUser().catch(() => null);
  const isAdmin = isAdminEmail((currentUser as any)?.email);

  // 一般公開: 非公開/削除済みは除外（管理者は全表示）
  const comboWhere = isAdmin
    ? { id: comboId }
    : { id: comboId, deletedAt: null, isPublished: true };

  // コメントも同様に（管理者は全表示、一般は公開のみ）
  const commentsWhere = isAdmin ? undefined : { deletedAt: null, isPublished: true };

  const combo = await prisma.combo.findFirst({
    where: comboWhere as any,
    include: {
      user: true,
      character: true,
      condition: true,
      attribute: true,
      steps: {
        orderBy: { order: "asc" },
        include: { move: true },
      },
      tags: { include: { tag: true } },
      favorites: true,
      ratings: true,
      comments: {
        where: commentsWhere as any,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!combo) notFound();

  const tags = combo.tags.map((t) => t.tag.name);

  const favoriteCount = combo.favorites.length;
  const ratingCount = combo.ratings.length;

  const avgRating =
    ratingCount === 0 ? null : combo.ratings.reduce((sum, r) => sum + r.value, 0) / ratingCount;

  const meFavorite = currentUser ? combo.favorites.some((f) => f.userId === currentUser.id) : false;

  const meRating = currentUser
    ? combo.ratings.find((r) => r.userId === currentUser.id)?.value ?? null
    : null;

  const starterText = extractStarterText(combo.comboText);

  const tokens = mergeNumberWithNext(toTokens(combo.comboText));

  const driveCost = combo.driveCost ?? 0;
  const superCost = combo.superCost ?? 0;

  const damage = combo.damage ?? null;
  const dmgPerDrive = damage != null && driveCost > 0 ? Math.round((damage / driveCost) * 10) / 10 : null;
  const dmgPerSuper = damage != null && superCost > 0 ? Math.round((damage / superCost) * 10) / 10 : null;

  // CommentsSection へ渡す（createdAt は Date -> string に）
  const initialComments = combo.comments.map((c) => ({
    id: c.id,
    comboId: c.comboId,
    userId: c.userId,
    comment: c.comment,
    createdAt: c.createdAt.toISOString(),
    user: c.user,
  }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* パンくず */}
      <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
        <Link href="/" className="hover:underline">
          トップ
        </Link>
        <span>/</span>
        <Link href={`/combos/search?characterId=${combo.characterId}`} className="hover:underline">
          {combo.character.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800">コンボ詳細</span>
      </div>

      {/* ヘッダー */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{starterText || "（始動不明）"}</h1>
            <div className="text-sm text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
              <span>投稿者: {combo.user.name}</span>
              <span>作成: {new Date(combo.createdAt).toLocaleString("ja-JP")}</span>
              <span>操作: {formatPlayStyle(combo.playStyle)}</span>
            </div>
          </div>

          <div className="shrink-0">
            <ComboActions
              comboId={combo.id}
              initialIsFavorite={meFavorite as any}
              initialFavoriteCount={favoriteCount as any}
              initialMyRating={meRating as any}
              initialAvgRating={avgRating as any}
              initialRatingCount={ratingCount as any}
            />
          </div>
        </div>

        {/* ステータス */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">ダメージ</div>
            <div className="text-lg font-bold">{damage ?? "-"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">Drive消費</div>
            <div className="text-lg font-bold">{driveCost}</div>
            <div className="text-xs text-gray-500">{dmgPerDrive != null ? `効率: ${dmgPerDrive}/Drive` : ""}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">SA消費</div>
            <div className="text-lg font-bold">{superCost}</div>
            <div className="text-xs text-gray-500">{dmgPerSuper != null ? `効率: ${dmgPerSuper}/SA` : ""}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">評価</div>
            <div className="text-lg font-bold">{avgRating == null ? "-" : `${Math.round(avgRating * 10) / 10}`}</div>
            <div className="text-xs text-gray-500">{ratingCount > 0 ? `${ratingCount}件` : "評価なし"}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">お気に入り</div>
            <div className="text-lg font-bold">{favoriteCount}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">ヒット状況</div>
            <div className="text-sm">{combo.condition?.description ?? combo.condition?.type ?? "-"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">属性</div>
            <div className="text-sm">{combo.attribute?.description ?? combo.attribute?.type ?? "-"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-gray-500">バージョン</div>
            <div className="text-sm">{combo.version ?? "-"}</div>
          </div>
        </div>
      </div>

      {/* コンボ本体 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">コンボ</h2>
        <div className="border rounded-md p-3">
          <div className="flex flex-wrap gap-2">
            {tokens.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className={
                  t === ">"
                    ? "px-2 py-1 rounded bg-gray-200 text-gray-800 text-sm font-semibold"
                    : "px-2 py-1 rounded bg-gray-100 text-gray-900 text-sm"
                }
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500 break-words">{combo.comboText}</div>
        </div>
      </section>

      {/* タグ */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">タグ</h2>
        {tags.length === 0 ? (
          <div className="text-sm text-gray-600">タグなし</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* 備考 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">備考</h2>
        <div className="border rounded-md p-3 text-sm whitespace-pre-wrap">
          {combo.description?.trim() ? combo.description : "なし"}
        </div>
      </section>

      {/* 動画 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">動画</h2>
        {combo.videoUrl ? (
          <a href={combo.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
            {combo.videoUrl}
          </a>
        ) : (
          <div className="text-sm text-gray-600">なし</div>
        )}
      </section>

      {/* コメント */}
      <CommentsSection comboId={combo.id} initialComments={initialComments} currentUserId={currentUser?.id ?? null} />

      {/* 戻る */}
      <div className="pt-2">
        <Link href={`/combos/search?characterId=${combo.characterId}`} className="text-blue-600 hover:underline">
          ← 検索結果に戻る
        </Link>
      </div>
    </div>
  );
}
