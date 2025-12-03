import { prisma } from "@/lib/prisma";
import Link from "next/link";

// ★ このページも「params は Promise」の形式に合わせる
export default async function CharacterCombosPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const characterId = Number(id);

  if (isNaN(characterId)) {
    return <div className="p-4">キャラIDが不正です。</div>;
  }

  const combos = await prisma.combo.findMany({
    where: { characterId },
    include: {
      tags: { include: { tag: true } },
      steps: { include: { move: true } },
      attribute: true,
      character: true,
    },
    orderBy: { damage: "desc" },
  });

  if (combos.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">キャラID {characterId} のコンボ一覧</h1>
        <p>このキャラのコンボはまだ登録されていません。</p>
        <Link
          href="/"
          className="text-blue-600 hover:underline"
        >
          キャラ選択に戻る
        </Link>
      </div>
    );
  }

  const characterName = combos[0].character.name;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{characterName} のコンボ一覧</h1>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            <th className="p-2">カテゴリ</th>
            <th className="p-2">始動技</th>
            <th className="p-2">ダメージ</th>
            <th className="p-2">OD消費</th>
            <th className="p-2">SA消費</th>
            <th className="p-2">タグ</th>
            <th className="p-2">詳細</th>
          </tr>
        </thead>
        <tbody>
          {combos.map((combo) => {
            const starter =
              combo.steps[0]?.move?.name ||
              combo.steps[0]?.note ||
              "-";

            let od = 0;
            let sa = 0;

            combo.steps.forEach((s) => {
              const note = s.note || "";

              if (note.includes("OD")) od += 2;
              if (note.includes("DR")) od += 1;
              if (note.includes("DI")) od += 1;
              if (note.includes("CR")) od += 3;

              if (note.includes("SA1")) sa += 1;
              if (note.includes("SA2")) sa += 2;
              if (note.includes("SA3")) sa += 3;
            });

            return (
              <tr key={combo.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{combo.attribute?.type || "-"}</td>
                <td className="p-2">{starter}</td>
                <td className="p-2 font-bold">{combo.damage ?? "-"}</td>
                <td className="p-2">{od}</td>
                <td className="p-2">{sa}</td>
                <td className="p-2 space-x-1">
                  {combo.tags.map((t) => (
                    <span
                      key={t.tag.id}
                      className="inline-block bg-gray-200 px-2 py-1 rounded text-xs"
                    >
                      {t.tag.name}
                    </span>
                  ))}
                </td>
                <td className="p-2">
                  <Link
                    href={`/combos/${combo.id}`}
                    className="text-blue-600 hover:underline"
                  >
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
