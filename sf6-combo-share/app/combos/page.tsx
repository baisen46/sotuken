import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type SP =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function buildHref(basePath: string, current: Record<string, string>, patch: Record<string, string | null>) {
  const usp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) usp.delete(k);
    else usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function sortNextDir(currentSort: string, currentDir: string, nextSort: string) {
  if (currentSort !== nextSort) return "desc";
  return currentDir === "asc" ? "desc" : "asc";
}

function sortMark(currentSort: string, currentDir: string, col: string) {
  if (currentSort !== col) return "";
  return currentDir === "asc" ? " ▲" : " ▼";
}

type SortKey = "created" | "damage" | "drive" | "super" | "popular" | "rating";
type Dir = "asc" | "desc";

export default async function CombosPage(props: { searchParams?: SP }) {
  const sp = (await (props.searchParams as any)) ?? {};

  const page = clamp(Number(first(sp.page) ?? "1"), 1, 1000000);
  const take = clamp(Number(first(sp.take) ?? "50"), 1, 200);
  const skip = (page - 1) * take;

  const sortRaw = (first(sp.sort) ?? "created") as SortKey;
  const sort: SortKey =
    sortRaw === "damage" ||
    sortRaw === "drive" ||
    sortRaw === "super" ||
    sortRaw === "popular" ||
    sortRaw === "rating"
      ? sortRaw
      : "created";

  const dir: Dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";

  // 総件数
  const total = await prisma.combo.count({});
  const pages = Math.max(1, Math.ceil(total / take));
  const safePage = Math.min(page, pages);

  const currentParams: Record<string, string> = {
    page: String(safePage),
    take: String(take),
    sort,
    dir,
  };

  const th = (label: string, col: SortKey) => {
    const nextDir = sortNextDir(sort, dir, col);
    const href = buildHref("/combos", currentParams, { sort: col, dir: nextDir, page: "1" });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  // --- 1) まず「並び順に合わせた comboId の並び」を作る ---
  let orderedIds: number[] | null = null;

  if (sort === "rating") {
    // ratings の平均で並べたいので raw SQL（テーブル名/列名は schema.prisma の @@map/@map 前提）
    const dirSql = dir === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT c.id
      FROM combos c
      LEFT JOIN ratings r ON r.combo_id = c.id
      GROUP BY c.id
      ORDER BY
        (AVG(r.value) IS NULL) ASC,
        AVG(r.value) ${dirSql},
        COUNT(r.id) DESC,
        c.created_at DESC,
        c.id DESC
      LIMIT ${take} OFFSET ${skip}
    `);

    orderedIds = rows.map((r) => r.id);
  }

  // --- 2) combos を取得（rating以外は Prisma orderBy でOK） ---
  const include = {
    character: { select: { id: true, name: true } },
    condition: { select: { type: true, description: true } },
    attribute: { select: { type: true, description: true } },
    tags: { include: { tag: true } },
    steps: {
      take: 1,
      orderBy: { order: "asc" as const },
      include: { move: { select: { id: true, name: true, input: true } } },
    },
    _count: { select: { favorites: true, ratings: true } },
  } as const;

  let items = [];

  if (orderedIds) {
    if (orderedIds.length === 0) items = [];
    else {
      const fetched = await prisma.combo.findMany({
        where: { id: { in: orderedIds } },
        include,
      });

      const index = new Map<number, number>();
      orderedIds.forEach((id, i) => index.set(id, i));
      fetched.sort((a, b) => (index.get(a.id)! - index.get(b.id)!));

      items = fetched as any;
    }
  } else {
    const orderBy =
      sort === "created"
        ? [{ createdAt: dir }, { id: "desc" as const }]
        : sort === "damage"
        ? [{ damage: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : sort === "drive"
        ? [{ driveCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : sort === "super"
        ? [{ superCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : // popular
          [{ favorites: { _count: dir } }, { createdAt: "desc" as const }, { id: "desc" as const }];

    items = (await prisma.combo.findMany({
      include,
      orderBy: orderBy as any,
      skip,
      take,
    })) as any;
  }

  const pageComboIds = items.map((c: any) => c.id);

  // --- 3) 評価の「平均」だけ groupBy で作る（表示用） ---
  const ratingAgg =
    pageComboIds.length > 0
      ? await prisma.rating.groupBy({
          by: ["comboId"],
          where: { comboId: { in: pageComboIds } },
          _avg: { value: true },
        })
      : [];

  const ratingAvgMap = new Map<number, number>();
  for (const row of ratingAgg) {
    const avg = row._avg.value;
    if (avg != null) ratingAvgMap.set(row.comboId, avg);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">全コンボ一覧</h1>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>全 {total} 件</div>
        <div className="flex items-center gap-2">
          <Link
            href={buildHref("/combos", currentParams, { page: String(Math.max(1, safePage - 1)) })}
            className={`px-3 py-1 rounded border ${
              safePage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
            }`}
          >
            前へ
          </Link>
          <span>
            {safePage} / {pages}
          </span>
          <Link
            href={buildHref("/combos", currentParams, { page: String(Math.min(pages, safePage + 1)) })}
            className={`px-3 py-1 rounded border ${
              safePage >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
            }`}
          >
            次へ
          </Link>
        </div>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            <th className="p-2">キャラ</th>
            <th className="p-2">始動</th>
            <th className="p-2">コンボ</th>
            <th className="p-2">{th("作成", "created")}</th>
            <th className="p-2">{th("ダメージ", "damage")}</th>
            <th className="p-2">{th("D消費", "drive")}</th>
            <th className="p-2">{th("SA消費", "super")}</th>
            <th className="p-2">{th("お気に入り", "popular")}</th>
            <th className="p-2">{th("評価", "rating")}</th>
            <th className="p-2">状況</th>
            <th className="p-2">属性</th>
            <th className="p-2">タグ</th>
            <th className="p-2">詳細</th>
          </tr>
        </thead>

        <tbody>
          {items.map((combo: any) => {
            const starter = combo.steps?.[0]?.move?.name ?? combo.steps?.[0]?.note ?? "-";
            const hitLabel = combo.condition?.description ?? combo.condition?.type ?? "-";
            const attrLabel = combo.attribute?.description ?? combo.attribute?.type ?? "-";
            const tags = combo.tags?.map((t: any) => t.tag.name) ?? [];

            const favCount = combo._count?.favorites ?? 0;
            const rCount = combo._count?.ratings ?? 0;
            const rAvg = ratingAvgMap.get(combo.id);
            const rLabel = rAvg == null ? "-" : rAvg.toFixed(2);

            return (
              <tr key={combo.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{combo.character?.name ?? "-"}</td>
                <td className="p-2">{starter}</td>
                <td className="p-2">
                  <div className="max-w-[420px] truncate">{combo.comboText}</div>
                </td>
                <td className="p-2">{new Date(combo.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-2 font-bold">{combo.damage ?? "-"}</td>
                <td className="p-2">{combo.driveCost ?? 0}</td>
                <td className="p-2">{combo.superCost ?? 0}</td>
                <td className="p-2">{favCount}</td>
                <td className="p-2">
                  {rLabel} <span className="text-xs text-gray-500">({rCount})</span>
                </td>
                <td className="p-2">{hitLabel}</td>
                <td className="p-2">{attrLabel}</td>
                <td className="p-2 space-x-1">
                  {tags.slice(0, 4).map((name: string) => (
                    <span key={name} className="inline-block bg-gray-200 px-2 py-1 rounded text-xs">
                      {name}
                    </span>
                  ))}
                  {tags.length > 4 && <span className="text-xs text-gray-500">+{tags.length - 4}</span>}
                </td>
                <td className="p-2">
                  <Link href={`/combos/${combo.id}`} className="text-blue-600 hover:underline">
                    →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
