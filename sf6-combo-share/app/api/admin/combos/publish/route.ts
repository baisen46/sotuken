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

  // フロントの揺れ吸収： id / comboId どっちでもOK
  const rawId = body?.id ?? body?.comboId;
  const comboId = Number(rawId);

  // publish: boolean | isPublished: boolean | status: "publish"|"unpublish"
  const rawPublish =
    body?.publish ??
    body?.isPublished ??
    (body?.status === "publish" ? true : body?.status === "unpublish" ? false : undefined);

  const publish = rawPublish === true || rawPublish === false ? rawPublish : null;

  if (!Number.isInteger(comboId) || comboId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid combo id" }, { status: 400 });
  }
  if (publish === null) {
    return NextResponse.json(
      { success: false, error: "Missing publish flag (publish/isPublished)" },
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

  // 削除済みは公開に戻さない（誤操作防止）
  if (publish === true && combo.deletedAt) {
    return NextResponse.json(
      { success: false, error: "Combo is deleted. Restore first." },
      { status: 409 }
    );
  }

  await prisma.combo.update({
    where: { id: comboId },
    data: { isPublished: publish },
  });

  return NextResponse.json({ success: true, isPublished: publish });
}

// 保険：DELETEで叩かれても動くように
export async function DELETE(req: Request) {
  return POST(req);
}
