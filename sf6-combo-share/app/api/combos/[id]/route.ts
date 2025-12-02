import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ★ Next.js 16では params が Promise なので await が必要
    const { id } = await context.params;

    const comboId = Number(id);
    if (isNaN(comboId)) {
      return NextResponse.json(
        { error: "Invalid combo id" },
        { status: 400 }
      );
    }

    const combo = await prisma.combo.findUnique({
      where: { id: comboId },
      include: {
        user: { select: { id: true, name: true } },
        character: true,
        condition: true,
        attribute: true,

        steps: {
          orderBy: { order: "asc" },
          include: {
            move: true,
            attribute: true,
          },
        },

        tags: { include: { tag: true } },
        favorites: true,
        ratings: true,
      }
    });

    if (!combo) {
      return NextResponse.json(
        { error: "Combo not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      combo,
    });
  } catch (err) {
    console.error("GET /api/combos/[id] error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
  
}
