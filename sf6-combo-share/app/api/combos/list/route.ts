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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";

    const user = await getCurrentUser().catch(() => null);
    const isAdmin = isAdminEmail((user as any)?.email);

    // 公開: 非公開/削除は除外
    // 管理者 + ?all=1 のときだけ全件
    const where =
      isAdmin && all
        ? {}
        : {
            deletedAt: null,
            isPublished: true,
          };

    const combos = await prisma.combo.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        character: true,
      },
    });

    // 既存互換：配列のまま返す
    return NextResponse.json(combos);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
