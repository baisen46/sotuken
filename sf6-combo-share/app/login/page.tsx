"use client";

import { useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? data?.message ?? `ログイン失敗（${res.status}）`);
        return;
      }

      // ✅ ここが重要：Header(Server Component)を確実に更新する
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message ? String(err.message) : "ログイン失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ログイン</h1>
        <Link href="/" className="link">
          ホームへ →
        </Link>
      </div>

      <form onSubmit={onSubmit} className="card-pad space-y-3">
        <label className="block space-y-1">
          <div className="text-xs text-gray-600">メールアドレス</div>
          <input
            className="border rounded px-3 py-2 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block space-y-1">
          <div className="text-xs text-gray-600">パスワード</div>
          <input
            className="border rounded px-3 py-2 w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
