import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SP = Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
type PP = { id: string } | Promise<{ id: string }>;

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

export default async function CharacterCombosPage(props: {
  params: PP;
  searchParams?: SP;
}) {
  const params = await (props.params as any);
  const sp = (await (props.searchParams as any)) ?? {};

  const characterId = Number(params.id);
  if (Number.isNaN(characterId)) return <div className="p-6">キャラIDが不正です。</div>;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true, name: true },
  });
  if (!character) return <div className="p-6">キャラが見つかりません。</div>;

  const page = clamp(Number(first(sp.page) ?? "1"), 1, 1000000);
  const take = clamp(Number(first(sp.take) ?? "50"), 1, 200);

  const sort = (first(sp.sort) ?? "created") as "created" | "damage" | "drive" | "super";
  const dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";

  const skip = (page - 1) * take;

  const orderBy =
    sort === "created"
      ? [{ createdAt: dir }, { id: "desc" as const }]
      : sort === "damage"
      ? [{ damage: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : sort === "drive"
      ? [{ driveCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : [{ superCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }];

  const include = {
    condition: { select: { type: true, description: true } },
    attribute: { select: { type: true, description: true } },
    tags: { include: { tag: true } },
    steps: {
      take: 1,
      orderBy: { order: "asc" as const },
      include: { move: { select: { id: true, name: true, input: true } } },
    },
  } as const;

  const where = { characterId };

  const [total, items] = await prisma.$transaction([
    prisma.combo.count({ where }),
    prisma.combo.findMany({ where, include, orderBy: orderBy as any, skip, take }),
  ]);

  const pages = Math.max(1, Math.ceil(total / take));
  const safePage = Math.min(page, pages);

  const basePath = `/characters/${characterId}/combos`;
  const currentParams: Record<string, string> = {
    page: String(safePage),
    take: String(take),
    sort,
    dir,
  };

  const th = (label: string, col: "created" | "damage" | "drive" | "super") => {
    const nextDir = sortNextDir(sort, dir, col);
    const href = buildHref(basePath, currentParams, { sort: col, dir: nextDir, page: "1" });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{character.name} のコンボ一覧</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-blue-600 hover:underline">キャラ選択へ</Link>
          <Link href="/combos" className="text-blue-600 hover:underline">全体一覧へ</Link>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>全 {total} 件</div>
        <div className="flex items-center gap-2">
          <Link
            href={buildHref(basePath, currentParams, { page: String(Math.max(1, safePage - 1)) })}
            className={`px-3 py-1 rounded border ${safePage <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            前へ
          </Link>
          <span>
            {safePage} / {pages}
          </span>
          <Link
            href={buildHref(basePath, currentParams, { page: String(Math.min(pages, safePage + 1)) })}
            className={`px-3 py-1 rounded border ${safePage >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            次へ
          </Link>
        </div>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            <th className="p-2">始動</th>
            <th className="p-2">コンボ</th>
            <th className="p-2">{th("作成", "created")}</th>
            <th className="p-2">{th("ダメージ", "damage")}</th>
            <th className="p-2">{th("D消費", "drive")}</th>
            <th className="p-2">{th("SA消費", "super")}</th>
            <th className="p-2">状況</th>
            <th className="p-2">属性</th>
            <th className="p-2">タグ</th>
            <th className="p-2">詳細</th>
          </tr>
        </thead>

        <tbody>
          {items.map((combo) => {
            const starter = combo.steps?.[0]?.move?.name ?? combo.steps?.[0]?.note ?? "-";
            const hitLabel = combo.condition?.description ?? combo.condition?.type ?? "-";
            const attrLabel = combo.attribute?.description ?? combo.attribute?.type ?? "-";
            const tags = combo.tags?.map((t) => t.tag.name) ?? [];

            return (
              <tr key={combo.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{starter}</td>
                <td className="p-2">
                  <div className="max-w-[560px] truncate">{combo.comboText}</div>
                </td>
                <td className="p-2">{new Date(combo.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-2 font-bold">{combo.damage ?? "-"}</td>
                <td className="p-2">{combo.driveCost ?? 0}</td>
                <td className="p-2">{combo.superCost ?? 0}</td>
                <td className="p-2">{hitLabel}</td>
                <td className="p-2">{attrLabel}</td>
                <td className="p-2 space-x-1">
                  {tags.slice(0, 4).map((name) => (
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
