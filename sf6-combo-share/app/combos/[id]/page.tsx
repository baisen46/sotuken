import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

// ★ Next.js 16 の params は Promise
export default async function ComboDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const comboId = Number(id);

  if (isNaN(comboId)) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">エラー: Invalid combo id</h2>
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
      <div className="p-6">
        <h2 className="text-lg font-bold">コンボが見つかりません</h2>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* タイトル */}
      <h1 className="text-2xl font-extrabold">コンボ詳細</h1>

      {/* 情報カード */}
      <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{combo.character.name}</h2>
          <Badge variant="outline">{combo.playStyle}</Badge>
        </div>

        <div className="text-gray-700 space-y-1">
          <p>
            ダメージ:{" "}
            <span className="font-bold text-lg">{combo.damage ?? "-"}</span>
          </p>

          {combo.condition && (
            <p className="flex gap-2 items-center">
              条件:
              <Badge variant="secondary">
                {combo.condition.description}
              </Badge>
            </p>
          )}

          {combo.tags.length > 0 && (
            <p className="flex gap-2 items-center flex-wrap">
              タグ:
              {combo.tags.map((t) => (
                <Badge key={t.tag.id} variant="outline">
                  {t.tag.name}
                </Badge>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* 手順 */}
      <div>
        <h3 className="text-xl font-semibold mb-3">手順</h3>

        <div className="space-y-4">
          {combo.steps.map((step, index) => (
            <StepLine
              key={step.id}
              index={index}
              moveName={step.move?.name}
              note={step.note}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

/* ---------------------------------------------------------
   1ステップを見やすく表示 (パッと見重視)
--------------------------------------------------------- */

function StepLine({
  index,
  moveName,
  note,
}: {
  index: number;
  moveName?: string;
  note?: string | null;
}) {
  // move があるなら技名、無いなら note をバッジ分解して出力
  const displayText = moveName || note || "";
  const tokens = displayText.split(/[\s]+/);

  return (
    <div className="flex items-center gap-3 flex-wrap bg-gray-50 p-3 rounded-md">
      <span className="font-bold text-gray-600">{index + 1}.</span>

      {tokens.map((t, i) => (
        <Badge
          key={i}
          className="text-base py-1 px-2 bg-white border"
          variant="outline"
        >
          {t}
        </Badge>
      ))}
    </div>
  );
}
