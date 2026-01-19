// app/combos/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // 念のため（ソート確認時の混乱防止）

type SortKey = "created" | "damage" | "drive" | "super";
type SortDir = "asc" | "desc";

function normalizeSortKey(v?: string): SortKey {
  if (v === "damage" || v === "drive" || v === "super") return v;
  return "created";
}
function normalizeSortDir(v?: string): SortDir {
  return v === "asc" ? "asc" : "desc";
}
function nextDir(current: SortDir) {
  return current === "asc" ? "desc" : "asc";
}

export default async function CombosPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;

  const sort = normalizeSortKey(sp.sort);
  const dir = normalizeSortDir(sp.dir);

  const orderBy =
    sort === "damage"
      ? { damage: dir }
      : sort === "drive"
      ? { driveCost: dir }
      : sort === "super"
      ? { superCost: dir }
      : { createdAt: dir };

  const combos = await prisma.combo.findMany({
    include: {
      user: { select: { id: true, name: true } },
      character: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    orderBy,
    take: 100,
  });

  const sortLink = (key: SortKey) => {
    const isActive = sort === key;
    const next = isActive ? nextDir(dir) : "desc";
    return `/combos?sort=${key}&dir=${next}`;
  };

  return (
    <main style={{ maxWidth: "1200px", margin: "20px auto", padding: "0 16px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "12px" }}>
        <div>
          <h1 style={{ marginBottom: "4px" }}>コンボ一覧</h1>
          <p style={{ fontSize: "13px", color: "#666" }}>最大100件表示（ソート切替対応）</p>
          <p style={{ fontSize: "12px", color: "#888" }}>
            現在: sort={sort}, dir={dir}
          </p>
        </div>

        <Link href="/combo/new">
          <button
            type="button"
            style={{
              borderRadius: "6px",
              border: "1px solid #2b74ff",
              backgroundColor: "#e4efff",
              padding: "8px 12px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            コンボを投稿
          </button>
        </Link>
      </div>

      <div style={{ marginTop: "14px", border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
            <tr>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>
                <Link href={sortLink("created")} style={{ color: "#333", textDecoration: "none" }}>
                  投稿日{sort === "created" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>

              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>キャラ</th>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>始動</th>
              <th style={{ padding: "10px 8px", textAlign: "left" }}>コンボ表記</th>

              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={sortLink("damage")} style={{ color: "#333", textDecoration: "none" }}>
                  ダメージ{sort === "damage" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>

              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={sortLink("drive")} style={{ color: "#333", textDecoration: "none" }}>
                  Dゲージ{sort === "drive" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>

              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={sortLink("super")} style={{ color: "#333", textDecoration: "none" }}>
                  SAゲージ{sort === "super" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>

              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>タグ</th>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>投稿者</th>
              <th style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>詳細</th>
            </tr>
          </thead>

          <tbody>
            {combos.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: "14px 10px", color: "#777" }}>
                  コンボがまだありません。
                </td>
              </tr>
            ) : (
              combos.map((combo: any) => {
                const created = new Date(combo.createdAt);
                const createdStr = `${created.getFullYear()}/${created.getMonth() + 1}/${created.getDate()}`;
                const tags = combo.tags?.map((ct: any) => ct.tag?.name).filter(Boolean) ?? [];

                return (
                  <tr key={combo.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>{createdStr}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>{combo.character?.name ?? "-"}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>{combo.starterText ?? "-"}</td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>{combo.comboText}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>{combo.damage ?? "-"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>{combo.driveCost ?? 0}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>{combo.superCost ?? 0}</td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {tags.length === 0 ? (
                          <span style={{ color: "#aaa" }}>タグなし</span>
                        ) : (
                          tags.slice(0, 8).map((t: string) => (
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
                        {tags.length > 8 && <span style={{ color: "#888", fontSize: "12px" }}>…</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>{combo.user?.name ?? "名無し"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      <Link href={`/combos/${combo.id}`} style={{ color: "#2b74ff", fontSize: "12px" }}>
                        詳細
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
