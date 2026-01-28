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

async function softDeleteCombo(comboId: number) {
  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    select: { id: true, deletedAt: true },
  });

  if (!combo) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // すでに削除済みなら成功扱い
  if (combo.deletedAt) {
    return NextResponse.json({ success: true });
  }

  await prisma.combo.update({
    where: { id: comboId },
    data: {
      deletedAt: new Date(),
      isPublished: false, // 念のため非公開化
    },
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail((user as any).email)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  // フロント実装の揺れを吸収： id / comboId どっちでもOK
  const rawId = body?.id ?? body?.comboId;
  const comboId = Number(rawId);

  if (!Number.isInteger(comboId) || comboId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid combo id" },
      { status: 400 }
    );
  }

  return softDeleteCombo(comboId);
}

// フロントが DELETE を使っても動くように保険
export async function DELETE(req: Request) {
  return POST(req);
}
