import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "ログインが必要です。" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      // 必須
      characterId,
      playStyle, // "MODERN" | "CLASSIC"

      // 任意（null や undefined でもOK）
      conditionId,
      attributeId,
      comboText,
      damage,
      frame,
      version,
      description,
      videoUrl,
      driveCost,
      superCost,
      parentComboId,

      // 手順・タグ（ある場合）
      steps,
      tags,
    } = body;

    // 必須チェック
    if (!characterId || !playStyle || !comboText) {
      return NextResponse.json(
        { success: false, error: "characterId, playStyle, comboText は必須です。" },
        { status: 400 }
      );
    }

    // steps は省略可だが、来ているなら配列であることを保証
    const comboSteps: any[] = Array.isArray(steps) ? steps : [];
    const comboTags: string[] = Array.isArray(tags) ? tags : [];

    const result = await prisma.$transaction(async (tx) => {
      // 1) Combo 本体
      const combo = await tx.combo.create({
        data: {
          userId: user.id,
          characterId,
          playStyle,
          comboText,
          damage: damage ?? null,
          frame: frame ?? null,
          conditionId: conditionId ?? 1, // デフォルト通常ヒットなどにしたい場合
          attributeId: attributeId ?? null,
          version: version ?? "1.00",
          description: description ?? null,
          videoUrl: videoUrl ?? null,
          driveCost: driveCost ?? 0,
          superCost: superCost ?? 0,
          parentComboId: parentComboId ?? null,
        },
      });

      // 2) コンボ手順（ある場合）
      if (comboSteps.length > 0) {
        await tx.comboStep.createMany({
          data: comboSteps.map((s, index) => ({
            comboId: combo.id,
            order: s.order ?? index + 1,
            moveId: s.moveId ?? null,
            attributeId: s.attributeId ?? null,
            note: s.note ?? null,
          })),
        });
      }

      // 3) タグ（ある場合）
      if (comboTags.length > 0) {
        const tagRecords = await Promise.all(
          comboTags.map((name) =>
            tx.tag.upsert({
              where: { name },
              update: {},
              create: { name },
            })
          )
        );

        await tx.comboTag.createMany({
          data: tagRecords.map((t) => ({
            comboId: combo.id,
            tagId: t.id,
          })),
          skipDuplicates: true,
        });
      }

      return combo;
    });

    return NextResponse.json({ success: true, combo: result });
  } catch (error) {
    console.error("コンボ投稿エラー", error);
    return NextResponse.json(
      { success: false, error: "コンボ登録中にサーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
