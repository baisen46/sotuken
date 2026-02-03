import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ★ このページも「params は Promise」の形式に合わせる
export default async function CharacterCombosPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const characterId = Number(id);

  if (!Number.isFinite(characterId)) {
    return (
      <div className="container-page">
        <div className="card-pad">
          キャラIDが不正です。 <Link href="/" className="link">キャラ選択に戻る</Link>
        </div>
      </div>
    );
  }

  const combos = await prisma.combo.findMany({
    where: { characterId, deletedAt: null, isPublished: true },
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
      <div className="container-page space-y-4">
        <h1 className="text-2xl font-bold">キャラID {characterId} のコンボ一覧</h1>
        <div className="card-pad space-y-2">
          <p>このキャラのコンボはまだ登録されていません。</p>
          <Link href="/" className="link">
            キャラ選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  const characterName = combos[0].character.name;

  return (
    <div className="container-page space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{characterName} のコンボ一覧</h1>
        <Link href="/" className="link">
          キャラ選択に戻る
        </Link>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="th">カテゴリ</th>
              <th className="th">始動技</th>
              <th className="th">ダメージ</th>
              <th className="th">OD消費</th>
              <th className="th">SA消費</th>
              <th className="th">タグ</th>
              <th className="th">詳細</th>
            </tr>
          </thead>

          <tbody>
            {combos.map((combo) => {
              const starter = combo.steps[0]?.move?.name || combo.steps[0]?.note || "-";

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
                <tr key={combo.id} className="tr">
                  <td className="td">{combo.attribute?.type || "-"}</td>
                  <td className="td">{starter}</td>
                  <td className="td font-bold">{combo.damage ?? "-"}</td>
                  <td className="td">{od}</td>
                  <td className="td">{sa}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {combo.tags.map((t) => (
                        <span key={t.tag.id} className="chip">
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="td">
                    <Link href={`/combos/${combo.id}`} className="link">
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
