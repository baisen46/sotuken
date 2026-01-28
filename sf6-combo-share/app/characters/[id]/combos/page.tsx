import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { starterFromComboText } from "@/lib/notation";

type Params = { id: string };
type SP =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
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

type SortKey = "created" | "damage" | "drive" | "super";
type Dir = "asc" | "desc";

export default async function CharacterCombosPage(props: { params: Params | Promise<Params>; searchParams?: SP }) {
  const params = await props.params;
  const sp = (await (props.searchParams as any)) ?? {};

  const characterId = Number(params.id);
  if (!Number.isFinite(characterId)) {
    return <div className="p-6">characterId が不正です</div>;
  }

  const sortRaw = (first(sp.sort) ?? "created") as SortKey;
  const sort: SortKey =
    sortRaw === "damage" || sortRaw === "drive" || sortRaw === "super" ? sortRaw : "created";
  const dir: Dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";

  const currentParams: Record<string, string> = { sort, dir };

  const th = (label: string, col: SortKey) => {
    const nextDir = sortNextDir(sort, dir, col);
    const href = buildHref(`/characters/${characterId}/combos`, currentParams, { sort: col, dir: nextDir });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true, name: true },
  });

  const orderBy =
    sort === "created"
      ? [{ createdAt: dir }, { id: "desc" as const }]
      : sort === "damage"
      ? [{ damage: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : sort === "drive"
      ? [{ driveCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : [{ superCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }];

  const items = await prisma.combo.findMany({
    where: { characterId },
    include: { tags: { include: { tag: true } } },
    orderBy: orderBy as any,
    take: 200,
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{character?.name ?? "キャラ"} のコンボ一覧</h1>
          <div className="text-sm text-gray-600">characterId: {characterId}</div>
        </div>

        <div className="flex gap-3 text-sm">
          <Link href={`/combos/search?characterId=${characterId}`} className="text-blue-600 hover:underline">
            検索（このキャラ）へ →
          </Link>
          <Link href="/combos" className="text-blue-600 hover:underline">
            全体一覧へ →
          </Link>
        </div>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            <th className="p-2">始動</th>
            <th className="p-2">コンボ</th>
            <th className="p-2">{th("作成", "created")}</th>
            <th className="p-2">{th("ダメ", "damage")}</th>
            <th className="p-2">{th("D", "drive")}</th>
            <th className="p-2">{th("SA", "super")}</th>
            <th className="p-2">タグ</th>
            <th className="p-2">詳細</th>
          </tr>
        </thead>

        <tbody>
          {items.map((combo) => {
            const starter = starterFromComboText(combo.comboText ?? "");
            const tags = combo.tags?.map((t) => t.tag.name) ?? [];

            return (
              <tr key={combo.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-bold">{starter}</td>
                <td className="p-2">
                  <div
                    className="max-w-[620px]"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as any,
                      overflow: "hidden",
                    }}
                  >
                    {combo.comboText}
                  </div>
                </td>
                <td className="p-2">{new Date(combo.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-2 font-bold">{combo.damage ?? "-"}</td>
                <td className="p-2">{combo.driveCost ?? 0}</td>
                <td className="p-2">{combo.superCost ?? 0}</td>
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

          {items.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-gray-500">
                まだこのキャラのコンボがありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
