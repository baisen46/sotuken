import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      characterId,
      conditionId,
      attributeId,
      playStyle,
      comboText,
      damage,
      steps,
      tags,
      driveCost,
      superCost,
    } = body;

    // --- コンボ作成 ---
    const combo = await prisma.combo.create({
      data: {
        userId,
        characterId,
        conditionId,
        attributeId,
        playStyle,
        comboText,
        damage,
        driveCost,         // ★ 追加
        superCost,         // ★ 追加

        // steps の一括登録
        steps: {
          create: steps.map((s: any) => ({
            order: s.order,
            moveId: s.moveId,
            attributeId: s.attributeId,
            note: s.note,
          })),
        },

        // タグ
        tags: {
          create: tags?.map((t: any) => ({
            tag: {
              connectOrCreate: {
                where: { name: t },
                create: { name: t },
              },
            },
          })) ?? [],
        },
      },
    });

    return NextResponse.json({ success: true, combo });
  } catch (error: any) {
    console.error("CREATE COMBO ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
