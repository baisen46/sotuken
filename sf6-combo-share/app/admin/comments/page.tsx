export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CommentRowActions from "./CommentRowActions";

type SearchParams = Record<string, string | string[] | undefined>;
function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}
function clampInt(v: string | undefined, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
function buildQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  return qs.toString();
}

export default async function AdminCommentsPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const sp = (props.searchParams ? await props.searchParams : {}) as SearchParams;

  const scope = (first(sp, "scope") ?? "public") as "public" | "hidden" | "deleted" | "all";
  const q = (first(sp, "q") ?? "").trim();
  const take = clampInt(first(sp, "take"), 50, 10, 200);
  const page = clampInt(first(sp, "page"), 1, 1, 100000);
  const skip = (page - 1) * take;

  const where: any = {};

  if (scope === "public") {
    where.deletedAt = null;
    where.isPublished = true;
  } else if (scope === "hidden") {
    where.deletedAt = null;
    where.isPublished = false;
  } else if (scope === "deleted") {
    where.deletedAt = { not: null };
  }

  const isDigits = /^\d+$/.test(q);
  if (q) {
    where.OR = [
      { comment: { contains: q } },
      { user: { is: { name: { contains: q } } } },
      { user: { is: { email: { contains: q } } } },
      { combo: { is: { comboText: { contains: q } } } },
      { combo: { is: { character: { is: { name: { contains: q } } } } } },
      ...(isDigits ? [{ comboId: Number(q) }] : []),
    ];
  }

  const total = await prisma.comment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / take));

  const rows = await prisma.comment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take,
    include: {
      user: { select: { id: true, name: true, email: true } },
      combo: { select: { id: true, comboText: true, character: { select: { name: true } } } },
    },
  });

  const nextUrl = `/admin/comments?${buildQuery({
    scope,
    q: q || undefined,
    take: String(take),
    page: String(page),
  })}`;

  const pageLink = (p: number) =>
    `/admin/comments?${buildQuery({
      scope,
      q: q || undefined,
      take: String(take),
      page: String(p),
    })}`;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">コメント管理</h1>

      <form className="flex flex-wrap gap-2 items-end" action="/admin/comments" method="get">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">検索</label>
          <input name="q" defaultValue={q} className="border rounded px-2 py-1 w-72" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">状態</label>
          <select name="scope" defaultValue={scope} className="border rounded px-2 py-1">
            <option value="public">公開</option>
            <option value="hidden">非公開</option>
            <option value="deleted">削除</option>
            <option value="all">全部</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">件数</label>
          <select name="take" defaultValue={String(take)} className="border rounded px-2 py-1">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>

        <input type="hidden" name="page" value="1" />
        <button className="border rounded px-3 py-1 bg-white" type="submit">
          適用
        </button>

        <Link className="text-sm text-blue-600 hover:underline" href="/admin/comments">
          クリア
        </Link>
      </form>

      <div className="text-sm text-gray-700">
        {total} 件 / {page} / {totalPages}
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">キャラ</th>
              <th className="p-2 text-left">投稿者</th>
              <th className="p-2 text-left">コンボ</th>
              <th className="p-2 text-left">コメント</th>
              <th className="p-2 text-center">状態</th>
              <th className="p-2 text-center">操作</th>
              <th className="p-2 text-center">詳細</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-600" colSpan={8}>
                  該当なし
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isDeleted = r.deletedAt != null;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.id}</td>
                    <td className="p-2">{r.combo?.character?.name ?? "-"}</td>
                    <td className="p-2">
                      {r.user?.name ?? "-"}
                      <div className="text-xs text-gray-500">{r.user?.email ?? ""}</div>
                    </td>
                    <td className="p-2 max-w-[520px]">
                      <div className="line-clamp-2">{r.combo?.comboText ?? ""}</div>
                      <div className="text-xs text-gray-500">comboId: {r.comboId}</div>
                    </td>
                    <td className="p-2 max-w-[520px]">
                      <div className="line-clamp-2">{r.comment}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(r.createdAt).toLocaleString("ja-JP")}
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      {isDeleted ? "削除" : r.isPublished ? "公開" : "非公開"}
                    </td>
                    <td className="p-2">
                      <CommentRowActions
                        commentId={r.id}
                        isPublished={r.isPublished}
                        isDeleted={isDeleted}
                        nextUrl={nextUrl}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Link className="text-blue-600 hover:underline" href={`/combos/${r.comboId}`}>
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={pageLink(Math.max(1, page - 1))}
          className={`px-3 py-1 border rounded ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          前へ
        </Link>

        <span className="text-sm text-gray-700">
          {page} / {totalPages}
        </span>

        <Link
          href={pageLink(Math.min(totalPages, page + 1))}
          className={`px-3 py-1 border rounded ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          次へ
        </Link>
      </div>
    </div>
  );
}
