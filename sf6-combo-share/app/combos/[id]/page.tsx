import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import ComboActions from "./_components/ComboActions";

export const dynamic = "force-dynamic";

// Next.js 16: params は Promise
export default async function ComboDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const comboId = Number(id);

  if (!Number.isFinite(comboId)) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold text-red-600">エラー: Invalid combo id</h2>
      </div>
    );
  }

  const viewer = await getCurrentUser();

  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    include: {
      user: { select: { id: true, name: true } },
      character: true,
      steps: {
        orderBy: { order: "asc" },
        include: { move: true },
      },
      tags: { include: { tag: true } },
    },
  });

  if (!combo) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">コンボが見つかりません</h2>
      </div>
    );
  }

  const playStyleLabel = combo.playStyle === "MODERN" ? "モダン" : "クラシック";

  const tagNames = combo.tags.map((t) => t.tag.name);

  // カテゴリは tags から判定（ノーゲージコンボも追加）
  const CATEGORY_TAGS = ["ノーゲージコンボ", "CRコン", "ODコン", "PRコン", "リーサルコン", "対空コン"] as const;
  const categoryTag = tagNames.find((name) => (CATEGORY_TAGS as readonly string[]).includes(name)) ?? null;

  // タグ表示はカテゴリ以外（カテゴリしかない場合は全部出す）
  const otherTags = tagNames.filter((name) => !(CATEGORY_TAGS as readonly string[]).includes(name));
  const displayTags = otherTags.length > 0 ? otherTags : tagNames;

  // 始動技
  const starterText =
    combo.starterText && combo.starterText.trim().length > 0
      ? combo.starterText.trim()
      : (() => {
          if (!combo.comboText) return "-";
          const firstSeg = combo.comboText.split(">")[0];
          const t = firstSeg.trim();
          return t.length > 0 ? t : "-";
        })();

  // ゲージ
  const driveCost = combo.driveCost ?? 0;
  const superCost = combo.superCost ?? 0;
  const totalGauge = driveCost + superCost;
  const efficiency = combo.damage != null && totalGauge > 0 ? Math.round(combo.damage / totalGauge) : null;

  // ===== ここが不具合の根本修正：tags から「ヒット状況」「属性」を引く =====
  // 投稿側の hitOptions: ノーマル/カウンター/パニッシュカウンター/フォースダウン
  // 表示は「通常ヒット」に統一したいのでノーマル→通常ヒットに変換
  const HIT_TAGS = ["通常ヒット", "ノーマル", "カウンター", "パニッシュカウンター", "フォースダウン"] as const;
  const rawHit = tagNames.find((t) => (HIT_TAGS as readonly string[]).includes(t)) ?? null;
  const hitDisplay = rawHit === "ノーマル" ? "通常ヒット" : rawHit ?? "-";

  // 属性（複数ある場合は併記）
  const ATTR_TAGS = ["ダメージ重視", "起き攻め重視", "運び重視"] as const;
  const attrDisplays = (ATTR_TAGS as readonly string[]).filter((t) => tagNames.includes(t));
  const attributeDisplay = attrDisplays.length ? attrDisplays.join(" / ") : "-";

  // 完走後フレーム（不利も可）
  const frameDisplay =
    combo.frame === null || combo.frame === undefined ? "-" : combo.frame > 0 ? `+${combo.frame}` : String(combo.frame);

  // ===== アクション初期値（お気に入り/評価）=====
  const favoriteCount = await prisma.favorite.count({ where: { comboId: combo.id } });
  const isFavorited = viewer
    ? !!(await prisma.favorite.findFirst({ where: { comboId: combo.id, userId: viewer.id }, select: { id: true } }))
    : false;

  const ratingAgg = await prisma.rating.aggregate({
    where: { comboId: combo.id },
    _avg: { value: true },
    _count: { value: true },
  });

  const ratingAvg = ratingAgg._avg.value ?? null;
  const ratingCount = ratingAgg._count.value ?? 0;

  const myRating = viewer
    ? (await prisma.rating.findFirst({ where: { comboId: combo.id, userId: viewer.id }, select: { value: true } }))?.value ??
      null
    : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* 戻るリンク */}
      <div className="text-sm text-gray-600">
        <Link href={`/characters/${combo.characterId}/combos`} className="text-blue-600 hover:underline">
          ← {combo.character.name} のコンボ一覧に戻る
        </Link>
      </div>

      {/* 見出し + アクション */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">コンボ詳細</h1>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-base">
              {combo.character.name} / {playStyleLabel}
            </Badge>

            <Badge className="text-base bg-blue-100 text-blue-900 border-blue-300">始動技: {starterText}</Badge>

            {categoryTag ? (
              <Badge className="bg-purple-100 text-purple-900 border-purple-300">{categoryTag}</Badge>
            ) : null}
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

      {/* ステータスブロック（バージョンは表示しない＝削除） */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
        <div>
          <div className="text-xs text-gray-500">ダメージ</div>
          <div className="text-xl font-bold">{combo.damage != null ? combo.damage : "-"}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Drive消費</div>
          <div className="text-lg">{driveCost}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">SA消費</div>
          <div className="text-lg">{superCost}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">合計ゲージ</div>
          <div className="text-lg">{totalGauge}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">効率（ダメージ/ゲージ）</div>
          <div className="text-lg">{efficiency != null ? efficiency : "-"}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">完走後フレーム</div>
          <div className="text-lg font-semibold">{frameDisplay}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">ヒット状況</div>
          <div className="text-lg font-semibold">{hitDisplay}</div>
        </div>

        <div>
          <div className="text-xs text-gray-500">属性</div>
          <div className="text-lg font-semibold">{attributeDisplay}</div>
        </div>
      </section>

      {/* タグ */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">タグ</h2>
        {displayTags.length === 0 ? (
          <p className="text-sm text-gray-500">タグは設定されていません。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayTags.map((name) => (
              <Badge key={name} className="bg-gray-200">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* コンボレシピ */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">コンボレシピ</h2>
        <div className="rounded-md border bg-white px-3 py-2 text-sm leading-relaxed">{combo.comboText}</div>
      </section>

      {/* 備考 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">備考</h2>
        <div className="rounded-md border bg-white px-3 py-2 text-sm leading-relaxed min-h-[48px]">
          {combo.description && combo.description.trim().length > 0 ? combo.description : "備考は登録されていません。"}
        </div>
      </section>

      {/* メタ */}
      <section className="text-xs text-gray-500 space-y-1">
        <div>投稿者: {combo.user?.name ?? `User#${combo.user?.id ?? "?"}`}</div>
        <div>登録日時: {combo.createdAt.toLocaleString("ja-JP")}</div>
      </section>
    </div>
  );
}
