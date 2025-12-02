import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const combos = await prisma.combo.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        character: true,
      },
    });

    return NextResponse.json(combos);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
