import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Next.js 16: params は Promise
export default async function ComboDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const comboId = Number(id);

  if (isNaN(comboId)) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold text-red-600">エラー: Invalid combo id</h2>
      </div>
    );
  }

  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    include: {
      user: { select: { id: true, name: true } },
      character: true,
      condition: true,
      attribute: true,
      steps: {
        orderBy: { order: "asc" },
        include: { move: true, attribute: true },
      },
      tags: { include: { tag: true } },
      favorites: true,
      ratings: true,
    },
  });

  if (!combo) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">コンボが見つかりません</h2>
      </div>
    );
  }

  const playStyleLabel =
    combo.playStyle === "MODERN" ? "モダン" : "クラシック";

  const tagNames = combo.tags.map((t) => t.tag.name as string);
  const CATEGORY_TAGS = ["CRコン", "ODコン", "PRコン", "リーサルコン", "対空コン"] as const;

  const categoryTag =
    tagNames.find((name) => CATEGORY_TAGS.includes(name as any)) ?? "NONE";

  const otherTags = tagNames.filter(
    (name) => !CATEGORY_TAGS.includes(name as any)
  );
  const displayTags = otherTags.length > 0 ? otherTags : tagNames;

  const starterText =
    combo.starterText && combo.starterText.trim().length > 0
      ? combo.starterText.trim()
      : (() => {
          if (!combo.comboText) return "-";
          const firstSeg = combo.comboText.split(">")[0];
          const t = firstSeg.trim();
          return t.length > 0 ? t : "-";
        })();

  const driveCost = combo.driveCost ?? 0;
  const superCost = combo.superCost ?? 0;
  const totalGauge = driveCost + superCost;
  const efficiency =
    combo.damage != null && totalGauge > 0
      ? Math.round(combo.damage / totalGauge)
      : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 戻るリンク */}
      <div className="text-sm text-gray-600">
        <Link
          href={`/characters/${combo.characterId}/combos`}
          className="text-blue-600 hover:underline"
        >
          ← {combo.character.name} のコンボ一覧に戻る
        </Link>
      </div>

      {/* 見出し */}
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">コンボ詳細</h1>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="text-base">
            {combo.character.name} / {playStyleLabel}
          </Badge>

          <Badge className="text-base bg-blue-100 text-blue-900 border-blue-300">
            始動技: {starterText}
          </Badge>

          <Badge className="bg-purple-100 text-purple-900 border-purple-300">
            {categoryTag}
          </Badge>
        </div>
      </header>

      {/* ステータスブロック */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
        <div>
          <div className="text-xs text-gray-500">ダメージ</div>
          <div className="text-xl font-bold">
            {combo.damage != null ? combo.damage : "-"}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">OD消費</div>
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
          <div className="text-lg">
            {efficiency != null ? efficiency : "-"}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">状況 / 属性</div>
          <div className="text-sm text-gray-800">
            {combo.condition?.description ?? combo.condition?.type ?? "-"}
            {combo.attribute && (
              <>
                {" / "}
                {combo.attribute.description ?? combo.attribute.type}
              </>
            )}
          </div>
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

      {/* コンボレシピ（= comboText） */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">コンボレシピ</h2>
        <div className="rounded-md border bg-white px-3 py-2 text-sm leading-relaxed">
          {combo.comboText}
        </div>
      </section>

      {/* 備考（description） */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">備考</h2>
        <div className="rounded-md border bg-white px-3 py-2 text-sm leading-relaxed min-h-[48px]">
          {combo.description && combo.description.trim().length > 0
            ? combo.description
            : "備考は登録されていません。"}
        </div>
      </section>

      {/* メタ情報 */}
      <section className="text-xs text-gray-500 space-y-1">
        <div>
          投稿者:{" "}
          {combo.user ? (
            <span>{combo.user.name ?? `User#${combo.user.id}`}</span>
          ) : (
            "不明"
          )}
        </div>
        <div>登録日時: {combo.createdAt.toLocaleString("ja-JP")}</div>
      </section>
    </div>
  );
}
