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
    const value = Number(body.value);

    if (!Number.isFinite(comboId) || comboId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid comboId" }, { status: 400 });
    }
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return NextResponse.json({ success: false, error: "Invalid rating value" }, { status: 400 });
    }

    const existing = await prisma.rating.findFirst({
      where: { comboId, userId: user.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.rating.updateMany({
        where: { comboId, userId: user.id },
        data: { value },
      });
    } else {
      await prisma.rating.create({
        data: { comboId, userId: user.id, value },
      });
    }

    const agg = await prisma.rating.aggregate({
      where: { comboId },
      _avg: { value: true },
      _count: { value: true },
    });

    return NextResponse.json({
      success: true,
      myRating: value,
      ratingAvg: agg._avg.value ?? null,
      ratingCount: agg._count.value ?? 0,
    });
  } catch (e) {
    console.error("POST /api/combos/rate error:", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
