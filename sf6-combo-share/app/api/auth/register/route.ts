export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type RegisterBody = {
  email?: string;
  password?: string;
  name?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegisterBody;
    const { email, password, name } = body;

    // --- 入力バリデーション ---
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "email と password は必須です。" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name?.trim() ?? null;

    if (!trimmedEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "メールアドレスの形式が不正です。" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "パスワードは6文字以上にしてください。" },
        { status: 400 }
      );
    }

    // --- 既存ユーザー重複チェック ---
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "このメールアドレスは既に登録されています。" },
        { status: 409 }
      );
    }

    // --- パスワードハッシュ化 ---
    const passwordHash = await bcrypt.hash(password, 10);

    // --- ユーザー作成 ---
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        name: trimmedName,
        password: "",      // ★ 旧カラム用のダミー値
        passwordHash,      // ★ 実際に使うハッシュ
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    return NextResponse.json(
      { success: false, error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}
