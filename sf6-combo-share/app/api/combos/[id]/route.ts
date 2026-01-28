import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

function isAdminEmail(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw) return false;

  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return !!email && allow.includes(email.toLowerCase());
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 16: params は Promise
    const { id } = await ctx.params;

    const comboId = Number(id);
    if (!Number.isInteger(comboId) || comboId <= 0) {
      return NextResponse.json({ error: "Invalid combo id" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const isAdmin = isAdminEmail((user as any)?.email);

    // 一般公開: 非公開/削除済みは除外
    const where = isAdmin
      ? { id: comboId }
      : { id: comboId, deletedAt: null, isPublished: true };

    const combo = await prisma.combo.findFirst({
      where,
      include: {
        user: { select: { id: true, name: true } },
        character: true,
        condition: true,
        attribute: true,
        steps: {
          orderBy: { order: "asc" },
          include: { move: true, attribute: true },
        },
        tags: { include: { tag: true } },
        favorites: true,
        ratings: true,
      },
    });

    if (!combo) {
      // 公開側は「存在しない」と同じ扱いで 404
      return NextResponse.json({ error: "Combo not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, combo });
  } catch (err) {
    console.error("GET /api/combos/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
