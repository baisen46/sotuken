import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const comboId = Number(url.searchParams.get("comboId"));

  if (!Number.isFinite(comboId)) {
    return badRequest("comboId が不正です");
  }

  const comments = await prisma.comment.findMany({
    where: { comboId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, comments });
}

export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const comboId = Number(body?.comboId);
  const comment = String(body?.comment ?? "").trim();

  if (!Number.isFinite(comboId)) return badRequest("comboId が不正です");
  if (!comment) return badRequest("comment が空です");
  if (comment.length > 1000) return badRequest("comment が長すぎます（最大1000文字）");

  const created = await prisma.comment.create({
    data: {
      comboId,
      userId: user.id,
      comment,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, comment: created });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const commentId = Number(body?.commentId);

  if (!Number.isFinite(commentId)) return badRequest("commentId が不正です");

  const target = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true },
  });

  if (!target) {
    return NextResponse.json({ success: false, error: "Not Found" }, { status: 404 });
  }

  if (target.userId !== user.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}
