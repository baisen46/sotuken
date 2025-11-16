import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      frame,
      version,
      description,
      videoUrl,
      steps,
      tags,
    } = body;

    // ----------- バリデーション（最低限） -----------
    if (!userId || !characterId || !conditionId || !playStyle || !comboText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "Steps must be a non-empty array" },
        { status: 400 }
      );
    }

    // ----------- トランザクション開始 -----------
    const result = await prisma.$transaction(async (tx) => {
      // Combo 本体の作成
      const createdCombo = await tx.combo.create({
        data: {
          userId: Number(userId),
          characterId: Number(characterId),
          conditionId: Number(conditionId),
          attributeId: attributeId ? Number(attributeId) : null,
          playStyle, // "MODERN" / "CLASSIC"
          comboText,
          damage: damage ?? null,
          frame: frame ?? null,
          version: version ?? "1.00",
          description: description ?? null,
          videoUrl: videoUrl ?? null,
        },
      });

      const comboId = createdCombo.id;

      // ----------- ComboStep の作成 -----------
      for (const step of steps) {
        await tx.comboStep.create({
  data: {
    comboId,
    order: Number(step.order),
    moveId:
      step.moveId === null || step.moveId === undefined
        ? null
        : Number(step.moveId),
    attributeId:
      step.attributeId === null || step.attributeId === undefined
        ? null
        : Number(step.attributeId),
    note: step.note ?? null,
          },
        });
      }

      // ----------- Tag の作成（任意） -----------
      if (Array.isArray(tags)) {
        for (const tagId of tags) {
          await tx.comboTag.create({
            data: {
              comboId,
              tagId: Number(tagId),
            },
          });
        }
      }

      return createdCombo;
    });

    return NextResponse.json({ success: true, combo: result }, { status: 200 });
  } catch (error) {
    console.error("POST /api/combos/create error:", error);
    return NextResponse.json(
      { error: "Server error", detail: String(error) },
      { status: 500 }
    );
  }
}
