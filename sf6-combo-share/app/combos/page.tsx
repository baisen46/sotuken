import Link from "next/link";
import { prisma } from "@/lib/prisma";

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

// ===== 始動表示：comboText 先頭を「2弱P」形式に正規化して表示 =====
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

function starterFromComboText(comboText: string) {
  const before = (comboText.split(">")[0] ?? "").trim();
  if (!before) return "-";
  const tokens = before.split(/\s+/).filter(Boolean);
  return mergeNumberWithNext(tokens).join("").replace(/\s+/g, "");
}

export default async function CombosPage(props: { searchParams?: SP }) {
  const sp = (await (props.searchParams as any)) ?? {};

  const sortRaw = (first(sp.sort) ?? "created") as SortKey;
  const sort: SortKey =
    sortRaw === "damage" || sortRaw === "drive" || sortRaw === "super" ? sortRaw : "created";

  const dir: Dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";

  const currentParams: Record<string, string> = {
    sort,
    dir,
  };

  const th = (label: string, col: SortKey) => {
    const nextDir = sortNextDir(sort, dir, col);
    const href = buildHref("/combos", currentParams, { sort: col, dir: nextDir });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  const orderBy =
    sort === "created"
      ? [{ createdAt: dir }, { id: "desc" as const }]
      : sort === "damage"
      ? [{ damage: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : sort === "drive"
      ? [{ driveCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : [{ superCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }];

  const items = await prisma.combo.findMany({
    include: {
      character: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    orderBy: orderBy as any,
    take: 200, // とりあえず（ページネーション導入までは上限を置く）
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">全コンボ一覧</h1>
        <Link href="/combos/search" className="text-sm text-blue-600 hover:underline">
          検索へ →
        </Link>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            <th className="p-2">キャラ</th>
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
                <td className="p-2">{combo.character?.name ?? "-"}</td>
                <td className="p-2 font-bold">{starter}</td>
                <td className="p-2">
                  <div
                    className="max-w-[520px]"
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
              <td colSpan={9} className="p-6 text-center text-gray-500">
                まだコンボがありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
