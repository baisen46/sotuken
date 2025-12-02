import { prisma } from "@/lib/prisma";

// ★ Next.js 16 の params は Promise
export default async function ComboDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const comboId = Number(id);

  if (isNaN(comboId)) {
    return (
      <div style={{ padding: 20 }}>
        <h2>エラー: Invalid combo id</h2>
      </div>
    );
  }

  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    include: {
      user: { select: { id: true, name: true } },
      character: true,
      condition: true,
      attribute: true,
      steps: {
        orderBy: { order: "asc" },
        include: { move: true, attribute: true },
      },
      tags: { include: { tag: true } },
      favorites: true,
      ratings: true,
    },
  });

  if (!combo) {
    return (
      <div style={{ padding: 20 }}>
        <h2>コンボが見つかりません</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>コンボ詳細</h1>

      <p>キャラ: {combo.character.name}</p>
      <p>操作タイプ: {combo.playStyle}</p>
      <p>ダメージ: {combo.damage ?? "-"}</p>

      <h2>手順</h2>
      <ul>
        {combo.steps.map((s) => (
          <li key={s.id}>
            {s.move ? s.move.name : s.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
