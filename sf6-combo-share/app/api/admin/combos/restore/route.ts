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

  // フロント実装の揺れ吸収： id / comboId どっちでもOK
  const rawId = body?.id ?? body?.comboId;
  const comboId = Number(rawId);

  if (!Number.isInteger(comboId) || comboId <= 0) {
    return NextResponse.json(
      { success: false, error: "Invalid combo id" },
      { status: 400 }
    );
  }

  const combo = await prisma.combo.findUnique({
    where: { id: comboId },
    select: { id: true, deletedAt: true, isPublished: true },
  });

  if (!combo) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // すでに復元済みなら成功扱い
  if (!combo.deletedAt) {
    return NextResponse.json({ success: true, restored: false });
  }

  await prisma.combo.update({
    where: { id: comboId },
    data: {
      deletedAt: null,
      // 復元時に自動公開しない（安全側）
      // 公開したい場合は別途 /publish を叩く
      isPublished: false,
    },
  });

  return NextResponse.json({ success: true, restored: true, isPublished: false });
}

// 保険：DELETEで叩かれても動く
export async function DELETE(req: Request) {
  return POST(req);
}
