import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  context: { params: Promise<{ characterId: string }> } // ← Promise型にする
) {
  const { characterId } = await context.params; // ← await で取り出す

  const id = Number(characterId);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid character ID" }, { status: 400 });
  }

  try {
    const moves = await prisma.moves.findMany({
      where: { character_id: id },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(moves);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
