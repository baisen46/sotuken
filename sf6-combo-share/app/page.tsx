// app/page.tsx

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">

      <h1 className="text-2xl font-bold">SF6 Combo Share</h1>

      <p className="text-gray-600">
        ストリートファイター6のコンボを共有するためのサイトです。
      </p>

      <div className="space-y-3">

        <Link
          href="/combos"
          className="block w-full bg-blue-600 text-white text-center py-2 rounded-md hover:bg-blue-700"
        >
          コンボ一覧を見る
        </Link>

        <Link
          href="/combo/new"
          className="block w-full bg-green-600 text-white text-center py-2 rounded-md hover:bg-green-700"
        >
          コンボを投稿する
        </Link>

      </div>
    </div>
  );
}
