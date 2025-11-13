import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const characters = await prisma.characters.findMany({
    orderBy: { id: "asc" },
  });

  return NextResponse.json(characters);
}
