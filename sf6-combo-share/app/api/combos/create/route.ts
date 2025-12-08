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
      starterText,
      driveCost,
      superCost,
      description, // 備考
    } = body;

    // Prisma への登録
    const combo = await prisma.combo.create({
      data: {
        // 基本情報
        userId: Number(userId) || 1,
        characterId: Number(characterId),
        conditionId: Number(conditionId),
        attributeId: attributeId != null ? Number(attributeId) : null,
        playStyle, // "MODERN" | "CLASSIC"
        comboText,
        damage: damage != null ? Number(damage) : null,

        // 追加情報
        starterText: starterText ?? null,
        driveCost: driveCost != null ? Number(driveCost) : 0,
        superCost: superCost != null ? Number(superCost) : 0,
        description: description ?? null,

        // 手順
        steps: {
          create: (steps ?? []).map((s: any, index: number) => ({
            order: s.order ?? index + 1,
            moveId: s.moveId ?? null,
            attributeId: s.attributeId ?? null,
            note: s.note ?? null,
          })),
        },

        // タグ（ヒット状況 / カテゴリ / 属性 などをまとめて受ける）
        tags: {
          create: (tags ?? []).map((name: string) => ({
            tag: {
              connectOrCreate: {
                where: { name },      // name は Tag.name（@unique）の想定
                create: { name },
              },
            },
          })),
        },
      },
    });

    return NextResponse.json({ success: true, combo });
  } catch (e) {
    console.error("CREATE COMBO ERROR:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
