import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

function isAdminEmail(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw) return false;
  const allow = new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
  return !!email && allow.has(email.toLowerCase());
}

function safeNext(next: string | null, origin: string) {
  const fallback = new URL("/admin/comments?scope=all&take=50&page=1", origin);
  if (!next) return fallback;
  if (!next.startsWith("/admin/comments")) return fallback;
  return new URL(next, origin);
}

export async function GET(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  const url = new URL(req.url);

  const id = Number(url.searchParams.get("id"));
  const publish = url.searchParams.get("publish"); // "0" or "1"
  const next = url.searchParams.get("next");
  const redirectUrl = safeNext(next, url.origin);

  if (!me || !isAdminEmail((me as any).email)) return NextResponse.redirect(redirectUrl);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.redirect(redirectUrl);

  const pub = publish === "1" ? 1 : 0;

  await prisma.$executeRaw`
    UPDATE comments
    SET is_published = ${pub}
    WHERE id = ${id} AND deleted_at IS NULL
  `;

  return NextResponse.redirect(redirectUrl);
}
