import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ characterId: string }> }
) {
  // Next.js 16 では params が Promise になっている
  const { characterId } = await context.params;

  const id = Number(characterId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid character ID" }, { status: 400 });
  }

  try {
    const moves = await prisma.move.findMany({
      where: { characterId: id },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(moves);
  } catch (error) {
    console.error("GET /api/moves error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
