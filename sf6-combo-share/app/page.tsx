import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function setIf(usp: URLSearchParams, key: string, value: string | undefined) {
  if (value == null) return;
  const v = value.trim();
  if (!v) return;
  usp.set(key, v);
}

export const dynamic = "force-dynamic";

export default async function HomePage(props: { searchParams?: Promise<SearchParams> }) {
  // ★ Next.js: searchParams は Promise の場合があるので先に unwrap
  const sp: SearchParams = props.searchParams ? await props.searchParams : {};

  const characters = await prisma.character.findMany({
    orderBy: { id: "asc" },
  });

  // ✅ ホーム→検索へ引き継ぐ統一キー（許可リスト）
  const base = new URLSearchParams();
  setIf(base, "q", first(sp, "q"));
  setIf(base, "playStyle", first(sp, "playStyle"));
  setIf(base, "sort", first(sp, "sort"));
  setIf(base, "dir", first(sp, "dir"));
  setIf(base, "take", first(sp, "take"));

  // 検索ページで使ってる拡張フィルタ（あれば引き継ぐ）
  setIf(base, "minDamage", first(sp, "minDamage"));
  setIf(base, "maxDamage", first(sp, "maxDamage"));
  setIf(base, "maxDrive", first(sp, "maxDrive"));
  setIf(base, "maxSuper", first(sp, "maxSuper"));
  setIf(base, "tags", first(sp, "tags"));
  setIf(base, "mode", first(sp, "mode"));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">SF6 Combo Share</h1>
      <p className="text-gray-600">キャラを選択して検索画面を開きます。</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {characters.map((ch) => {
          const usp = new URLSearchParams(base);
          usp.set("characterId", String(ch.id));
          usp.set("page", "1"); // キャラ選択したら1ページ目に戻す
          const href = `/combos/search?${usp.toString()}`;

          return (
            <Link
              key={ch.id}
              href={href}
              className="border rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-100 transition"
            >
              {ch.image && (
                <img src={ch.image} alt={ch.name} className="w-16 h-16 object-contain mb-2" />
              )}
              <span className="text-sm font-semibold">{ch.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
