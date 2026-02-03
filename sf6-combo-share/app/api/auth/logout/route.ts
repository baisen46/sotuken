// sf6-combo-share/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 既存実装のCookie名が確定してないので広めに消す
const COOKIE_NAMES = [
  "session_token",
  "sessionToken",
  "session",
  "token",
  "auth_token",
  "authToken",
  "sf6_session",
];

function buildRedirect(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/";
  return NextResponse.redirect(new URL(next, url.origin), 303);
}

function clearCookies(res: NextResponse) {
  // 固定候補を全部消す（存在しないCookieを指定しても問題ない）
  for (const name of COOKIE_NAMES) {
    res.cookies.set(name, "", { path: "/", expires: new Date(0) });
  }

  // 追加で “session / token” を含む名前も念のため消す（Cookie名が違っても拾える）
  // ただし Next.js ではリクエスト側Cookie名の列挙が環境で面倒なので、ここは候補固定でOK。
  return res;
}

async function handler(req: Request) {
  try {
    const res = buildRedirect(req);
    clearCookies(res);
    return res;
  } catch (e) {
    console.error("[logout] error:", e);
    return NextResponse.json({ success: false, error: "logout_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handler(req);
}

export async function GET(req: Request) {
  return handler(req);
}
