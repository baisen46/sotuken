import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const characters = await prisma.character.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" }
    });

    return NextResponse.json(characters);
  } catch (error) {
    console.error("GET /api/characters error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
