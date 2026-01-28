import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ComboAdminActions from "../_components/ComboAdminActions";

export const dynamic = "force-dynamic";

type SP =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export default async function AdminCombosPage(props: { searchParams?: SP }) {
  const sp = (await (props.searchParams as any)) ?? {};
  const q = (first(sp.q) ?? "").trim();
  const status = (first(sp.status) ?? "active") as "active" | "unpublished" | "deleted" | "all";
  const pageWanted = clamp(Number(first(sp.page) ?? "1"), 1, 1000000);
  const take = clamp(Number(first(sp.take) ?? "50"), 1, 200);

  const where: any = {};

  if (status === "active") {
    where.deletedAt = null;
    where.isPublished = true;
  } else if (status === "unpublished") {
    where.deletedAt = null;
    where.isPublished = false;
  } else if (status === "deleted") {
    where.deletedAt = { not: null };
  } // all は何も付けない

  if (q) {
    where.OR = [
      { comboText: { contains: q } },
      { description: { contains: q } },
      { user: { is: { name: { contains: q } } } },
      { character: { is: { name: { contains: q } } } },
    ];
  }

  const total = await prisma.combo.count({ where });
  const pages = Math.max(1, Math.ceil(total / take));
  const page = Math.min(pageWanted, pages);
  const skip = (page - 1) * take;

  const rows = await prisma.combo.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    skip,
    include: {
      user: { select: { id: true, name: true, email: true } },
      character: { select: { id: true, name: true } },
      _count: { select: { favorites: true, ratings: true, comments: true } },
    },
  });

  const params = new URLSearchParams({
    q,
    status,
    take: String(take),
  });

  const pageLink = (p: number) => {
    const usp = new URLSearchParams(params);
    usp.set("page", String(p));
    return `/admin/combos?${usp.toString()}`;
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">コンボ管理</h1>

      <form className="flex flex-wrap gap-2 items-end" action="/admin/combos" method="get">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">検索</label>
          <input name="q" defaultValue={q} className="border rounded px-2 py-1 w-72" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">状態</label>
          <select name="status" defaultValue={status} className="border rounded px-2 py-1">
            <option value="active">公開</option>
            <option value="unpublished">非公開</option>
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
        <button className="border rounded px-3 py-1 bg-white">適用</button>

        <Link className="text-sm text-blue-600 hover:underline" href="/admin/combos">
          クリア
        </Link>
      </form>

      <div className="text-sm text-gray-700">
        {total} 件 / {page} / {pages}
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">キャラ</th>
              <th className="p-2 text-left">投稿者</th>
              <th className="p-2 text-left">コンボ</th>
              <th className="p-2 text-center">Fav</th>
              <th className="p-2 text-center">Rate</th>
              <th className="p-2 text-center">Com</th>
              <th className="p-2 text-center">状態</th>
              <th className="p-2 text-center">操作</th>
              <th className="p-2 text-center">詳細</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{c.character?.name ?? "-"}</td>
                <td className="p-2">
                  {c.user?.name ?? "-"}
                  <div className="text-xs text-gray-500">{c.user?.email ?? ""}</div>
                </td>
                <td className="p-2 max-w-[520px]">
                  <div className="line-clamp-2">{c.comboText}</div>
                </td>
                <td className="p-2 text-center">{c._count.favorites}</td>
                <td className="p-2 text-center">{c._count.ratings}</td>
                <td className="p-2 text-center">{c._count.comments}</td>
                <td className="p-2 text-center">
                  {c.deletedAt ? "削除" : c.isPublished ? "公開" : "非公開"}
                </td>
                <td className="p-2">
                  <ComboAdminActions id={c.id} isPublished={c.isPublished} deletedAt={c.deletedAt} />
                </td>
                <td className="p-2 text-center">
                  <Link className="text-blue-600 hover:underline" href={`/combos/${c.id}`}>
                    →
                  </Link>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-600" colSpan={10}>
                  該当なし
                </td>
              </tr>
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
          {page} / {pages}
        </span>

        <Link
          href={pageLink(Math.min(pages, page + 1))}
          className={`px-3 py-1 border rounded ${page >= pages ? "pointer-events-none opacity-50" : ""}`}
        >
          次へ
        </Link>
      </div>
    </div>
  );
}
