export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const comboId = Number(body.comboId);
    const comment = String(body.comment ?? "").trim();

    if (!Number.isInteger(comboId) || comboId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid comboId" }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ success: false, error: "Comment is empty" }, { status: 400 });
    }
    if (comment.length > 2000) {
      return NextResponse.json({ success: false, error: "Comment too long" }, { status: 400 });
    }

    // combo 存在確認（外部キーエラーをユーザー向けにする）
    const exists = await prisma.combo.findUnique({ where: { id: comboId }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }

    await prisma.comment.create({
      data: {
        comboId,
        userId: user.id,
        comment,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/combos/comment error:", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
