import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      user_id,
      character_id,
      play_style,
      combo_text,
      damage,
      condition_id,
      attribute_id,
      starter_move_id,
      version,
    } = body;

    // 必須チェック
    if (!user_id || !character_id || !combo_text) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    const combo = await prisma.combos.create({
      data: {
        user_id,
        character_id,
        play_style,
        combo_text,
        damage: damage ? Number(damage) : null,
        condition_id: condition_id || null,
        attribute_id: attribute_id || null,
        starter_move_id: starter_move_id || null,
        version: version || "1.00",
      },
    });

    return NextResponse.json({ success: true, id: combo.id });
  } catch (error) {
    console.error("コンボ投稿エラー", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
