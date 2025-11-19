import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/moves?characterId=1
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const characterId = Number(searchParams.get("characterId"));

    if (!characterId || isNaN(characterId)) {
      return NextResponse.json(
        { error: "Invalid characterId" },
        { status: 400 }
      );
    }

    const moves = await prisma.move.findMany({
      where: { characterId },
      select: { id: true, name: true },
      orderBy: { id: "asc" }
    });

    return NextResponse.json(moves);
  } catch (error) {
    console.error("GET /api/moves error:", error);
    return NextResponse.json(
      { error: "Server Error" },
      { status: 500 }
    );
  }
}
