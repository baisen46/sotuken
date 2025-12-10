// app/_components/Header.tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Header() {
  const user = await getCurrentUser();

  return (
    <header
      style={{
        borderBottom: "1px solid #e5e5e5",
        backgroundColor: "#ffffff",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        {/* 左：ロゴ */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ fontWeight: "bold", fontSize: "18px" }}>
              SF6 Combo Share
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#666",
                marginTop: "-2px",
              }}
            >
              スト6コンボ共有サイト
            </div>
          </Link>
        </div>

        {/* 中央：ナビ */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "14px",
          }}
        >
          <Link href="/" style={{ textDecoration: "none", color: "#333" }}>
            ホーム
          </Link>
          <Link
            href="/combos"
            style={{ textDecoration: "none", color: "#333" }}
          >
            コンボ一覧
          </Link>
          <Link
            href="/combos/search"
            style={{ textDecoration: "none", color: "#333" }}
          >
            コンボ検索
          </Link>
          <Link
            href="/characters"
            style={{ textDecoration: "none", color: "#333" }}
          >
            キャラ一覧
          </Link>
          <Link
            href="/tori-kore"
            style={{ textDecoration: "none", color: "#333" }}
          >
            とりコレ
          </Link>
        </nav>

        {/* 右：検索 + 投稿ボタン + 認証表示 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: "260px",
            justifyContent: "flex-end",
          }}
        >
          {/* 簡易検索 */}
          <form
            action="/combos/search"
            method="GET"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <input
              type="text"
              name="q"
              placeholder="コンボ・技名検索"
              style={{
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "4px 6px",
                fontSize: "12px",
                width: "140px",
              }}
            />
            <button
              type="submit"
              style={{
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "12px",
                backgroundColor: "#f5f5f5",
                cursor: "pointer",
              }}
            >
              検索
            </button>
          </form>

          {/* コンボ投稿 */}
          <Link href="/combo/new">
            <button
              type="button"
              style={{
                borderRadius: "4px",
                border: "1px solid #2b74ff",
                backgroundColor: "#e4efff",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              コンボを投稿
            </button>
          </Link>

          {/* 認証状態 */}
          {user ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "#333" }}>
                こんにちは、{user.name ?? "ユーザー"} さん
              </span>
              <Link
                href="/mypage"
                style={{ textDecoration: "none", color: "#2b74ff" }}
              >
                マイページ
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#888",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  ログアウト
                </button>
              </form>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
              }}
            >
              <Link
                href="/login"
                style={{ textDecoration: "none", color: "#2b74ff" }}
              >
                ログイン
              </Link>
              {/* 必要になったら新規登録を追加 */}
              {/* <Link href="/register" style={{ textDecoration: "none", color: "#2b74ff" }}>
                新規登録
              </Link> */}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
