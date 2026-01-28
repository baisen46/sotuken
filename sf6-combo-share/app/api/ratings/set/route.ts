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
  const value = Number(body?.value);

  if (!Number.isInteger(comboId) || comboId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid comboId" }, { status: 400 });
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return NextResponse.json({ success: false, error: "Invalid value (1-5)" }, { status: 400 });
  }

  const key = { comboId_userId: { comboId, userId: user.id } };

  const result = await prisma.$transaction(async (tx) => {
    await tx.rating.upsert({
      where: key,
      create: { comboId, userId: user.id, value },
      update: { value },
    });

    const agg = await tx.rating.aggregate({
      where: { comboId },
      _avg: { value: true },
      _count: { _all: true },
    });

    return {
      myValue: value,
      avg: agg._avg.value ?? null,
      count: agg._count._all,
    };
  });

  return NextResponse.json({ success: true, ...result });
}
