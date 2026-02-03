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

    if (!Number.isFinite(comboId) || comboId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid comboId" }, { status: 400 });
    }

    const existing = await prisma.favorite.findFirst({
      where: { comboId, userId: user.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.favorite.deleteMany({ where: { comboId, userId: user.id } });
    } else {
      await prisma.favorite.create({ data: { comboId, userId: user.id } });
    }

    const favoriteCount = await prisma.favorite.count({ where: { comboId } });
    const isFavorited = !existing;

    return NextResponse.json({ success: true, favoriteCount, isFavorited });
  } catch (e) {
    console.error("POST /api/combos/favorite error:", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
