import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const characters = await prisma.character.findMany({
    orderBy: { id: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">SF6 Combo Share</h1>
      <p className="text-gray-600">キャラを選択して検索画面を開きます（キャラ選択済み）。</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {characters.map((ch) => (
          <Link
            key={ch.id}
            href={`/combos/search?characterId=${ch.id}`}
            className="border rounded-lg p-4 flex flex-col items-center justify-center 
                       hover:bg-gray-100 transition"
          >
            {ch.image && (
              <img
                src={ch.image}
                alt={ch.name}
                className="w-16 h-16 object-contain mb-2"
              />
            )}

            <span className="text-sm font-semibold">{ch.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
