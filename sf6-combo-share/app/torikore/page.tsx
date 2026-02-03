import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { starterFromComboText } from "@/lib/notation";

export const dynamic = "force-dynamic";

type TorikoreItem = {
  id: number;
  playStyle: "CLASSIC" | "MODERN";
  comboText: string;
  damage: number | null;
  driveCost: number;
  superCost: number;
  createdAt: Date;
  tags: { tag: { name: string } }[];
  _count: { favorites: number; ratings: number; comments: number };
};

function clamp(lines: number) {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical" as any,
    overflow: "hidden",
  };
}

function badge(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {text}
    </span>
  );
}

function metric(label: string, value: string) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
      <div className="text-[11px] text-gray-500 leading-none">{label}</div>
      <div className="text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}

export default async function TorikorePage() {
  const characters = await prisma.character.findMany({
    select: { id: true, name: true, image: true },
    orderBy: { id: "asc" },
  });

  const torikoreTag = await prisma.tag.findUnique({
    where: { name: "とりコレ" },
    select: { id: true, name: true },
  });

  const perCharacter = await Promise.all(
    characters.map(async (ch) => {
      const baseWhere = {
        characterId: ch.id,
        deletedAt: null as any,
        isPublished: true,
      };

      const select = {
        id: true,
        playStyle: true,
        comboText: true,
        damage: true,
        driveCost: true,
        superCost: true,
        createdAt: true,
        tags: { select: { tag: { select: { name: true } } } },
        _count: { select: { favorites: true, ratings: true, comments: true } },
      };

      // 1) タグ「とりコレ」優先
      let picked: TorikoreItem[] = [];
      if (torikoreTag) {
        picked = (await prisma.combo.findMany({
          where: { ...baseWhere, tags: { some: { tagId: torikoreTag.id } } },
          select,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 3,
        })) as any;
      }

      // 2) 不足分を人気→評価→新着で補完
      const need = Math.max(0, 3 - picked.length);
      let filler: TorikoreItem[] = [];
      if (need > 0) {
        filler = (await prisma.combo.findMany({
          where: {
            ...baseWhere,
            id: picked.length ? { notIn: picked.map((x) => x.id) } : undefined,
          },
          select,
          orderBy: [
            { favorites: { _count: "desc" } },
            { ratings: { _count: "desc" } },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: need,
        })) as any;
      }

      return { character: ch, items: [...picked, ...filler] };
    })
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* ヘッダ */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">とりコレ</h1>
          <p className="text-sm text-gray-600">
            各キャラの「とりあえずこれ」コンボ（最大3件）
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ホームへ →
        </Link>
      </div>

      {/* ルール説明 */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-2">
        <div className="text-sm">
          選出ルール：{" "}
          {torikoreTag ? (
            <>
              {badge(`タグ「${torikoreTag.name}」優先`)}
              <span className="text-gray-600 ml-2">
                （不足分は お気に入り数→評価数→新着 で補完）
              </span>
            </>
          ) : (
            <span className="text-gray-700">
              お気に入り数→評価数→新着 の順で自動選出
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600">
         
        </div>
      </div>

      {/* キャラごと */}
      <div className="space-y-6">
        {perCharacter.map(({ character, items }) => (
          <section
            key={character.id}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-4"
          >
            {/* キャラ見出し */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {character.image ? (
                  <img
                    src={character.image}
                    alt={character.name}
                    className="w-11 h-11 object-contain rounded-xl border border-gray-200 bg-gray-50"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-sm font-semibold text-gray-600">
                    {character.name.slice(0, 1)}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-lg font-bold truncate">{character.name}</div>
                  <div className="text-xs text-gray-500">おすすめ3件</div>
                </div>
              </div>

              <Link
                href={`/combos/search?characterId=${character.id}&page=1`}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 whitespace-nowrap"
              >
                このキャラで検索 →
              </Link>
            </div>

            {/* コンボ一覧（カードグリッド） */}
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                まだ公開コンボがありません。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((c) => {
                  const starter = starterFromComboText(c.comboText ?? "");
                  const tagNames = c.tags?.map((t) => t.tag.name) ?? [];
                  const isManual = tagNames.some((n) => n === "とりコレ");

                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {badge(c.playStyle)}
                            {isManual && (
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                                とりコレ
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-semibold truncate">始動：{starter}</div>
                        </div>

                        <Link
                          href={`/combos/${c.id}`}
                          className="text-blue-600 hover:underline text-sm whitespace-nowrap"
                        >
                          詳細 →
                        </Link>
                      </div>

                      <div className="mt-2 text-sm text-gray-900" style={clamp(2)}>
                        {c.comboText}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {metric("ダメ", c.damage == null ? "-" : String(c.damage))}
                        {metric("D", String(c.driveCost ?? 0))}
                        {metric("SA", String(c.superCost ?? 0))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-700">
                        {badge(`★ ${c._count.favorites}`)}
                        {badge(`評価 ${c._count.ratings}`)}
                        <span className="text-gray-500">
                          {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                      </div>

                      {tagNames.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tagNames.slice(0, 6).map((n) => (
                            <span
                              key={n}
                              className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              {n}
                            </span>
                          ))}
                          {tagNames.length > 6 && (
                            <span className="text-xs text-gray-500">+{tagNames.length - 6}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
