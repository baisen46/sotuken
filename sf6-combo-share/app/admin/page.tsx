import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">管理ダッシュボード</h1>
      <div className="flex gap-3">
        <Link className="border rounded px-3 py-2 hover:bg-gray-50" href="/admin/combos">
          コンボ管理へ
        </Link>
        <Link className="border rounded px-3 py-2 hover:bg-gray-50" href="/admin/comments">
          コメント管理へ
        </Link>
      </div>

      <div className="text-sm text-gray-600">
        ・公開/非公開の切替 / ソフト削除 / 復元 ができます
      </div>
    </div>
  );
}
