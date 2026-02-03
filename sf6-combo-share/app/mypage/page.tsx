// sf6-combo-share/app/mypage/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { starterFromComboText } from "@/lib/notation";

export const dynamic = "force-dynamic";

// 詳細ページのベース（あなたのプロジェクトで /combos/[id] を正とする）
const DETAIL_BASE = "/combos";

function safeStarter(comboText: string | null | undefined) {
  const t = (comboText ?? "").trim();
  if (!t) return "-";

  // 既存ヘルパーがあるならそれを優先
  try {
    const s = starterFromComboText(t);
    if (s && s !== "-") return s;
  } catch {
    // 失敗しても下のフォールバックへ
  }

  // フォールバック：最初の区切りまでを始動扱い
  // ComboInputPage.tsx の仕様（" > "が入る）に合わせる
  const seps = [">", "＞", "→", "➡", "⇒"];
  let cut = t.length;
  for (const sep of seps) {
    const idx = t.indexOf(sep);
    if (idx >= 0) cut = Math.min(cut, idx);
  }
  const head = t.slice(0, cut).trim();
  return head || "-";
}

export default async function MyPage() {
  const user = await getCurrentUser();

  // 未ログイン → ログイン画面へ
  if (!user) {
    redirect("/login?from=/mypage");
  }

  // 自分の投稿コンボを取得（新しい順）
  const combos = await prisma.combo.findMany({
    where: { userId: user.id },
    include: {
      character: true,
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "20px auto",
        padding: "0 16px 40px",
      }}
    >
      <h1 style={{ marginBottom: "4px" }}>マイページ</h1>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "16px" }}>
        ログインユーザー：{user.name ?? (user as any).email ?? "-"}
      </p>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>概要</h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid #e0e0e0",
              backgroundColor: "#fafafa",
              minWidth: "180px",
            }}
          >
            <div style={{ color: "#777", marginBottom: "2px" }}>投稿コンボ数</div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{combos.length}</div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid #e0e0e0",
              backgroundColor: "#fafafa",
              minWidth: "220px",
            }}
          >
            <div style={{ color: "#777", marginBottom: "2px" }}>ショートカット</div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href="/combo/new" style={{ fontSize: "13px", color: "#2b74ff" }}>
                コンボを投稿する
              </Link>
              <Link href="/combos" style={{ fontSize: "13px", color: "#2b74ff" }}>
                コンボ一覧を見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>自分の投稿コンボ一覧</h2>

        {combos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#777" }}>
            まだコンボを投稿していません。{" "}
            <Link href="/combo/new" style={{ color: "#2b74ff" }}>
              コンボ投稿ページ
            </Link>
            から最初のコンボを登録してみてください。
          </p>
        ) : (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead
                style={{
                  backgroundColor: "#f5f5f5",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <tr>
                  <th style={{ padding: "8px", textAlign: "left", whiteSpace: "nowrap" }}>投稿日</th>
                  <th style={{ padding: "8px", textAlign: "left", whiteSpace: "nowrap" }}>キャラ</th>
                  <th style={{ padding: "8px", textAlign: "left", whiteSpace: "nowrap" }}>始動</th>
                  <th style={{ padding: "8px", textAlign: "left" }}>コンボ表記</th>
                  <th style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>ダメージ</th>
                  <th style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>Dゲージ</th>
                  <th style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>SAゲージ</th>
                  <th style={{ padding: "8px", textAlign: "left", whiteSpace: "nowrap" }}>タグ</th>
                  <th style={{ padding: "8px", textAlign: "center", whiteSpace: "nowrap" }}>詳細</th>
                </tr>
              </thead>

              <tbody>
                {combos.map((combo) => {
                  const starter = safeStarter(combo.comboText);
                  const tags = combo.tags?.map((t) => t.tag.name) ?? [];

                  return (
                    <tr key={combo.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {new Date(combo.createdAt).toLocaleDateString("ja-JP")}
                      </td>

                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {combo.character?.name ?? "-"}
                      </td>

                      <td style={{ padding: "8px", whiteSpace: "nowrap", fontWeight: "bold" }}>
                        {starter}
                      </td>

                      <td style={{ padding: "8px" }}>
                        <div
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as any,
                            overflow: "hidden",
                          }}
                        >
                          {combo.comboText}
                        </div>
                      </td>

                      <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {combo.damage ?? "-"}
                      </td>

                      <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {combo.driveCost ?? 0}
                      </td>

                      <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {combo.superCost ?? 0}
                      </td>

                      <td style={{ padding: "8px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {tags.slice(0, 6).map((name) => (
                            <span
                              key={name}
                              style={{
                                padding: "2px 8px",
                                borderRadius: "999px",
                                border: "1px solid #e0e0e0",
                                background: "#fafafa",
                                fontSize: "12px",
                              }}
                            >
                              {name}
                            </span>
                          ))}
                          {tags.length > 6 && (
                            <span style={{ fontSize: "12px", color: "#777" }}>
                              +{tags.length - 6}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "8px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <Link href={`${DETAIL_BASE}/${combo.id}`} style={{ color: "#2b74ff" }}>
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
