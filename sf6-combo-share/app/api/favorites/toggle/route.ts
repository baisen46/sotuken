import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const comboId = Number(body?.comboId);

  if (!Number.isInteger(comboId) || comboId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid comboId" }, { status: 400 });
  }

  // コンボ存在確認（外部キーエラーを分かりやすくする）
  const combo = await prisma.combo.findUnique({ where: { id: comboId }, select: { id: true } });
  if (!combo) {
    return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
  }

  const key = { comboId_userId: { comboId, userId: user.id } };

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.favorite.findUnique({ where: key });

    if (existing) {
      await tx.favorite.delete({ where: { id: existing.id } });
      const count = await tx.favorite.count({ where: { comboId } });
      return { favorited: false, count };
    } else {
      await tx.favorite.create({ data: { comboId, userId: user.id } });
      const count = await tx.favorite.count({ where: { comboId } });
      return { favorited: true, count };
    }
  });

  return NextResponse.json({ success: true, ...result });
}
