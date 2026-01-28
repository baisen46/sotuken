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

async function softDeleteComment(commentId: number) {
  const c = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, deletedAt: true },
  });

  if (!c) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (c.deletedAt) {
    return NextResponse.json({ success: true });
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: {
      deletedAt: new Date(),
      isPublished: false,
    },
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail((user as any).email))
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const rawId = body?.id ?? body?.commentId;
  const commentId = Number(rawId);

  if (!Number.isInteger(commentId) || commentId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid comment id" }, { status: 400 });
  }

  return softDeleteComment(commentId);
}

export async function DELETE(req: Request) {
  return POST(req);
}
