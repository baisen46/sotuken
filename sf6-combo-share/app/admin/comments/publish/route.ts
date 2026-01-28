import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const publish = Boolean(body?.publish);

  if (!Number.isInteger(id)) return NextResponse.json({ success: false, error: "invalid id" }, { status: 400 });

  const updated = await prisma.comment.update({
    where: { id },
    data: { isPublished: publish },
    select: { id: true, isPublished: true, deletedAt: true },
  });

  return NextResponse.json({ success: true, comment: updated });
}
