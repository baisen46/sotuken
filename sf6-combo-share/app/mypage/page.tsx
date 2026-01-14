// app/mypage/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export default async function MyPage() {
  const user = await getCurrentUser();

  // 未ログイン → ログイン画面へ
  if (!user) {
    redirect("/login?from=mypage");
  }

  // 自分の投稿コンボを取得（新しい順）
  const combos = await prisma.combo.findMany({
    where: { userId: user.id },
    include: {
      character: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
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
        ログインユーザー：{user.name ?? user.email}
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
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>
              {combos.length}
            </div>
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
            <div style={{ color: "#777", marginBottom: "2px" }}>
              ショートカット
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link
                href="/combo/new"
                style={{ fontSize: "13px", color: "#2b74ff" }}
              >
                コンボを投稿する
              </Link>
              <Link
                href="/combos"
                style={{ fontSize: "13px", color: "#2b74ff" }}
              >
                コンボ一覧を見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>
          自分の投稿コンボ一覧
        </h2>

        {combos.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#777" }}>
            まだコンボを投稿していません。
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
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    投稿日
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    キャラ
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    始動
                  </th>
                  <th style={{ padding: "8px", textAlign: "left" }}>コンボ表記</th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ダメージ
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Dゲージ
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    SAゲージ
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    タグ
                  </th>
                  <th
                    style={{
                      padding: "8px",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    詳細
                  </th>
                </tr>
              </thead>
              <tbody>
                {combos.map((combo) => {
                  const created = new Date(combo.createdAt);
                  const createdStr = `${created.getFullYear()}/${
                    created.getMonth() + 1
                  }/${created.getDate()}`;

                  const tags =
                    combo.tags?.map((ct: any) => ct.tag?.name).filter(Boolean) ??
                    [];

                  return (
                    <tr key={combo.id} style={{ borderTop: "1px solid #eee" }}>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {createdStr}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {combo.character?.name ?? "-"}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          whiteSpace: "nowrap",
                          maxWidth: "140px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {combo.starterText ?? "-"}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          maxWidth: "260px",
                        }}
                      >
                        <span>{combo.comboText}</span>
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {combo.damage ?? "-"}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {combo.driveCost ?? 0}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {combo.superCost ?? 0}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          maxWidth: "220px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                          }}
                        >
                          {tags.length === 0 ? (
                            <span style={{ color: "#aaa" }}>タグなし</span>
                          ) : (
                            tags.map((t: string) => (
                              <span
                                key={t}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "999px",
                                  border: "1px solid #ddd",
                                  backgroundColor: "#fafafa",
                                }}
                              >
                                {t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          verticalAlign: "top",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Link
                          href={`/combos/${combo.id}`}
                          style={{ color: "#2b74ff", fontSize: "12px" }}
                        >
                          詳細
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
