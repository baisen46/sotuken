import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ComboActions from "./_components/ComboActions";
import ComboComments from "./_components/ComboComments";

export const dynamic = "force-dynamic";

function pickHitDisplay(tagNames: string[]) {
  // 投稿側: ノーマル/カウンター/パニッシュカウンター/フォースダウン
  if (tagNames.includes("パニッシュカウンター")) return "パニッシュカウンター";
  if (tagNames.includes("カウンター")) return "カウンター";
  if (tagNames.includes("フォースダウン")) return "フォースダウン";
  if (tagNames.includes("ノーマル") || tagNames.includes("通常ヒット")) return "通常ヒット";
  return null;
}

function pickAttributeDisplay(tagNames: string[]) {
  const attrs = ["ダメージ重視", "起き攻め重視", "運び重視"].filter((a) => tagNames.includes(a));
  return attrs.length ? attrs.join(" / ") : null;
}

function formatSignedInt(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

export default async function ComboDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const comboId = Number(id);

  if (!Number.isInteger(comboId) || comboId <= 0) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="rounded-lg border bg-white p-4">
          コンボIDが不正です。{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            トップへ
          </Link>
        </div>
      </div>
    );
  }

  const viewer = await getCurrentUser();

  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    include: {
      user: { select: { id: true, name: true } },
      character: { select: { id: true, name: true } },
      steps: {
        orderBy: { order: "asc" },
        include: { move: { select: { id: true, name: true } } },
      },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      // condition/attribute は旧表示の fallback に使う余地があるので残す
      condition: true,
      attribute: true,
    },
  });

  if (!combo) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="rounded-lg border bg-white p-4">
          コンボが見つかりません。{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            トップへ
          </Link>
        </div>
      </div>
    );
  }

  const tagNames = combo.tags.map((t) => t.tag.name);

  // 上部表示の不整合修正：tags 優先
  const hitDisplay =
    pickHitDisplay(tagNames) ??
    (combo.condition?.type === "PUNISH"
      ? "パニッシュカウンター"
      : combo.condition?.type === "COUNTER"
      ? "カウンター"
      : combo.condition?.type === "FORCEDOWN"
      ? "フォースダウン"
      : "通常ヒット");

  const attributeDisplay =
    pickAttributeDisplay(tagNames) ??
    (combo.attribute?.type ? String(combo.attribute.type) : "なし");

  const frameDisplay =
    combo.frame === null || combo.frame === undefined ? "-" : formatSignedInt(combo.frame);

  // お気に入り / 評価 初期値
  const favoriteCount = await prisma.favorite.count({ where: { comboId: combo.id } });
  const isFavorited = viewer
    ? !!(await prisma.favorite.findUnique({
        where: { comboId_userId: { comboId: combo.id, userId: viewer.id } },
        select: { id: true },
      }))
    : false;

  const ratingAgg = await prisma.rating.aggregate({
    where: { comboId: combo.id },
    _avg: { value: true },
    _count: { value: true },
  });

  const ratingAvg = ratingAgg._avg.value ?? null;
  const ratingCount = ratingAgg._count.value ?? 0;

  const myRating = viewer
    ? (
        await prisma.rating.findUnique({
          where: { comboId_userId: { comboId: combo.id, userId: viewer.id } },
          select: { value: true },
        })
      )?.value ?? null
    : null;

  // コメント（Client Component に渡すためシリアライズ）
  const initialComments = combo.comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    userName: c.user.name,
    comment: c.comment,
    createdAt: c.createdAt.toISOString(),
  }));

  const createdAtJST = new Date(combo.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="text-sm text-gray-600">
        <Link href="/" className="text-blue-600 hover:underline">
          トップ
        </Link>{" "}
        /{" "}
        <Link href={`/characters/${combo.characterId}`} className="text-blue-600 hover:underline">
          {combo.character.name}
        </Link>{" "}
        / コンボ詳細
      </div>

      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">コンボ詳細</h1>
          <div className="text-sm text-gray-600">
            投稿者: {combo.user.name} / 作成: {createdAtJST} / 操作:{" "}
            {combo.playStyle === "MODERN" ? "モダン" : "クラシック"}
          </div>
        </div>

        <div className="w-full md:w-[360px]">
          <ComboActions
            comboId={combo.id}
            nextPath={`/combos/${combo.id}`}
            isLoggedIn={!!viewer}
            initial={{
              favoriteCount,
              isFavorited,
              ratingAvg,
              ratingCount,
              myRating,
            }}
          />
        </div>
      </header>

      {/* バージョン表示は削除（要望対応） */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">ダメージ</div>
          <div className="text-2xl font-bold">{combo.damage ?? "-"}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Drive消費</div>
          <div className="text-2xl font-bold">{combo.driveCost ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">SA消費</div>
          <div className="text-2xl font-bold">{combo.superCost ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">完走後フレーム</div>
          <div className="text-2xl font-bold">{frameDisplay}</div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">ヒット状況</div>
          <div className="text-xl font-bold">{hitDisplay}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">属性</div>
          <div className="text-xl font-bold">{attributeDisplay || "なし"}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">お気に入り</div>
          <div className="text-2xl font-bold">{favoriteCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">評価</div>
          <div className="text-2xl font-bold">{ratingAvg === null ? "-" : ratingAvg.toFixed(1)}</div>
          <div className="text-sm text-gray-500">評価{ratingCount}件</div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">コンボ</h2>
        <div className="rounded-lg border bg-white p-4 whitespace-pre-wrap">{combo.comboText}</div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">タグ</h2>
        <div className="rounded-lg border bg-white p-4">
          {tagNames.length === 0 ? (
            <div className="text-gray-500">タグなし</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagNames.map((name) => (
                <span key={name} className="px-2 py-1 rounded-full bg-gray-100 border text-sm">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ★ コメント欄（復活） */}
      <section className="space-y-2">
        <h2 className="text-xl font-bold">コメント</h2>
        <ComboComments
          comboId={combo.id}
          nextPath={`/combos/${combo.id}`}
          isLoggedIn={!!viewer}
          initialComments={initialComments}
        />
      </section>

      {combo.description ? (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">備考</h2>
          <div className="rounded-lg border bg-white p-4 whitespace-pre-wrap">{combo.description}</div>
        </section>
      ) : null}
    </div>
  );
}
