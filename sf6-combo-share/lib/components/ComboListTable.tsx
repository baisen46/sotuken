import Link from "next/link";
import type { ComboListResult, ComboSortKey, SortDir } from "@/lib/combos/queryComboList";

type Props = {
  data: ComboListResult;
  basePath: string; // "/combos" or `/characters/${id}/combos`
  currentParams: Record<string, string>; // page/sort/dir/take
  showCharacter?: boolean;
};

function buildHref(basePath: string, current: Record<string, string>, patch: Record<string, string | null>) {
  const usp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) usp.delete(k);
    else usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function sortNextDir(currentSort: ComboSortKey, currentDir: SortDir, nextSort: ComboSortKey): SortDir {
  if (currentSort !== nextSort) return "desc";
  return currentDir === "asc" ? "desc" : "asc";
}

function sortMark(currentSort: ComboSortKey, currentDir: SortDir, col: ComboSortKey) {
  if (currentSort !== col) return "";
  return currentDir === "asc" ? " ▲" : " ▼";
}

export default function ComboListTable({ data, basePath, currentParams, showCharacter = true }: Props) {
  const { items, total, page, pages, take, sort, dir } = data;

  const thLink = (label: string, col: ComboSortKey) => {
    const nextDir = sortNextDir(sort, dir, col);
    const href = buildHref(basePath, currentParams, {
      sort: col,
      dir: nextDir,
      page: "1",
      take: String(take),
    });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>全 {total} 件</div>
        <div className="flex items-center gap-2">
          <Link
            href={buildHref(basePath, currentParams, { page: String(Math.max(1, page - 1)) })}
            className={`px-3 py-1 rounded border ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            前へ
          </Link>
          <span>
            {page} / {pages}
          </span>
          <Link
            href={buildHref(basePath, currentParams, { page: String(Math.min(pages, page + 1)) })}
            className={`px-3 py-1 rounded border ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            次へ
          </Link>
        </div>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            {showCharacter && <th className="p-2">キャラ</th>}
            <th className="p-2">始動</th>
            <th className="p-2">コンボ</th>
            <th className="p-2">{thLink("作成", "created")}</th>
            <th className="p-2">{thLink("ダメージ", "damage")}</th>
            <th className="p-2">{thLink("D消費", "drive")}</th>
            <th className="p-2">{thLink("SA消費", "super")}</th>
            <th className="p-2">状況</th>
            <th className="p-2">属性</th>
            <th className="p-2">タグ</th>
            <th className="p-2">詳細</th>
          </tr>
        </thead>

        <tbody>
          {items.map((combo) => {
            const starterByStep = combo.steps?.[0]?.move?.name ?? combo.steps?.[0]?.note ?? "-";
            const starter = (combo as any).starterText?.trim?.() ? (combo as any).starterText.trim() : starterByStep;

            const hitLabel = combo.condition?.description ?? combo.condition?.type ?? "-";
            const attrLabel = combo.attribute?.description ?? combo.attribute?.type ?? "-";

            const tags = combo.tags?.map((t) => t.tag.name) ?? [];
            const shown = tags.slice(0, 4);
            const rest = tags.length - shown.length;

            return (
              <tr key={combo.id} className="border-b hover:bg-gray-50">
                {showCharacter && <td className="p-2">{combo.character?.name ?? "-"}</td>}
                <td className="p-2">{starter}</td>
                <td className="p-2">
                  <div className="max-w-[520px] truncate">{combo.comboText}</div>
                </td>
                <td className="p-2">{new Date(combo.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-2 font-bold">{combo.damage ?? "-"}</td>
                <td className="p-2">{(combo as any).driveCost ?? 0}</td>
                <td className="p-2">{(combo as any).superCost ?? 0}</td>
                <td className="p-2">{hitLabel}</td>
                <td className="p-2">{attrLabel}</td>
                <td className="p-2 space-x-1">
                  {shown.map((name) => (
                    <span key={name} className="inline-block bg-gray-200 px-2 py-1 rounded text-xs">
                      {name}
                    </span>
                  ))}
                  {rest > 0 && <span className="text-xs text-gray-500">+{rest}</span>}
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

      <div className="flex items-center justify-end gap-2 text-sm">
        <Link
          href={buildHref(basePath, currentParams, { page: String(Math.max(1, page - 1)) })}
          className={`px-3 py-1 rounded border ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
        >
          前へ
        </Link>
        <Link
          href={buildHref(basePath, currentParams, { page: String(Math.min(pages, page + 1)) })}
          className={`px-3 py-1 rounded border ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
        >
          次へ
        </Link>
      </div>
    </div>
  );
}
