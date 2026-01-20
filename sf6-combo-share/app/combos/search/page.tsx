// app/combos/search/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SortKey = "created" | "damage" | "drive" | "super";
type SortDir = "asc" | "desc";

function normalizeSortKey(v?: string): SortKey {
  if (v === "damage" || v === "drive" || v === "super") return v;
  return "created";
}
function normalizeSortDir(v?: string): SortDir {
  return v === "asc" ? "asc" : "desc";
}

function toNum(v?: string) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// いまCombo投稿UIで使ってるタグ群（検索UI側も同じ候補を出す）
const HIT_OPTIONS = ["ノーマル", "カウンター", "パニッシュカウンター", "フォースダウン"] as const;
const ATTRIBUTE_OPTIONS = ["ダメージ重視", "起き攻め重視", "運び重視"] as const;
const CATEGORY_OPTIONS = ["CRコン", "ODコン", "PRコン", "リーサルコン", "対空コン"] as const;
const PROPERTY_TAG_OPTIONS = [
  "立ち限定",
  "デカキャラ限定",
  "目押しコン",
  "密着限定",
  "入れ替えコン",
  "端付近",
  "端限定",
  "中央以上",
  "被画面端",
] as const;

export default async function ComboSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // GETパラメータ取り出し
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const characterId = typeof sp.characterId === "string" ? toNum(sp.characterId) : undefined;

  // tags は ?tags=a&tags=b でも ?tags=a,b でも受けられるようにする
  let tags: string[] = [];
  if (Array.isArray(sp.tags)) tags = sp.tags.filter((t): t is string => typeof t === "string");
  if (typeof sp.tags === "string") tags = sp.tags.split(",").map((s) => s.trim()).filter(Boolean);

  const minDamage = typeof sp.minDamage === "string" ? toNum(sp.minDamage) : undefined;
  const maxDamage = typeof sp.maxDamage === "string" ? toNum(sp.maxDamage) : undefined;
  const maxDrive = typeof sp.maxDrive === "string" ? toNum(sp.maxDrive) : undefined;
  const maxSuper = typeof sp.maxSuper === "string" ? toNum(sp.maxSuper) : undefined;

  const sort = normalizeSortKey(typeof sp.sort === "string" ? sp.sort : undefined);
  const dir = normalizeSortDir(typeof sp.dir === "string" ? sp.dir : undefined);

  // 絞り込み where を組み立て
  const and: any[] = [];

  if (characterId) and.push({ characterId });

  if (minDamage !== undefined) and.push({ damage: { gte: minDamage } });
  if (maxDamage !== undefined) and.push({ damage: { lte: maxDamage } });

  if (maxDrive !== undefined) and.push({ driveCost: { lte: maxDrive } });
  if (maxSuper !== undefined) and.push({ superCost: { lte: maxSuper } });

  // tags: AND条件（全部含む）
  for (const t of tags) {
    and.push({
      tags: {
        some: {
          tag: { name: t },
        },
      },
    });
  }

  // q: comboText/starterText/tag名 の部分一致（OR）
  if (q) {
    and.push({
      OR: [
        { comboText: { contains: q } },
        { starterText: { contains: q } },
        {
          tags: {
            some: {
              tag: { name: { contains: q } },
            },
          },
        },
      ],
    });
  }

  const where = and.length ? { AND: and } : {};

  // 安定ソート（同値時は createdAt desc）
  const orderBy =
    sort === "damage"
      ? [{ damage: dir }, { createdAt: "desc" }]
      : sort === "drive"
      ? [{ driveCost: dir }, { createdAt: "desc" }]
      : sort === "super"
      ? [{ superCost: dir }, { createdAt: "desc" }]
      : [{ createdAt: dir }];

  // フィルタUI用：キャラ一覧
  const characters = await prisma.character.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  // 検索実行（まずは100件）
  const combos = await prisma.combo.findMany({
    where,
    include: {
      character: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    orderBy,
    take: 100,
  });

  // UIヘルパー（チェック状態）
  const isChecked = (name: string) => tags.includes(name);

  return (
    <main style={{ maxWidth: "1200px", margin: "20px auto", padding: "0 16px 40px" }}>
      <h1 style={{ marginBottom: "8px" }}>コンボ検索</h1>

      {/* フィルタフォーム（GET） */}
      <form
        action="/combos/search"
        method="GET"
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          padding: "12px",
          background: "#fafafa",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 220px 220px", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>キーワード</div>
            <input
              name="q"
              defaultValue={q}
              placeholder="コンボ表記 / 始動 / タグ"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>キャラ</div>
            <select
              name="characterId"
              defaultValue={characterId?.toString() ?? ""}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            >
              <option value="">指定なし</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>Dゲージ上限</div>
            <input
              name="maxDrive"
              defaultValue={maxDrive?.toString() ?? ""}
              placeholder="例: 3"
              inputMode="numeric"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>SAゲージ上限</div>
            <input
              name="maxSuper"
              defaultValue={maxSuper?.toString() ?? ""}
              placeholder="例: 1"
              inputMode="numeric"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>ダメージ範囲</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                name="minDamage"
                defaultValue={minDamage?.toString() ?? ""}
                placeholder="min"
                inputMode="numeric"
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
              <input
                name="maxDamage"
                defaultValue={maxDamage?.toString() ?? ""}
                placeholder="max"
                inputMode="numeric"
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>ソート</div>
            <select
              name="sort"
              defaultValue={sort}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            >
              <option value="created">投稿日</option>
              <option value="damage">ダメージ</option>
              <option value="drive">Dゲージ</option>
              <option value="super">SAゲージ</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#666" }}>昇順/降順</div>
            <select
              name="dir"
              defaultValue={dir}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            >
              <option value="desc">降順</option>
              <option value="asc">昇順</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end", gap: "8px" }}>
            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                border: "1px solid #2b74ff",
                background: "#e4efff",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              検索
            </button>
            <Link href="/combos/search" style={{ fontSize: "12px", color: "#666" }}>
              クリア
            </Link>
          </div>
        </div>

        {/* タグ群（?tags=xxx を複数送る） */}
        <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          <TagBox title="ヒット状況" options={[...HIT_OPTIONS]} isChecked={isChecked} />
          <TagBox title="属性" options={[...ATTRIBUTE_OPTIONS]} isChecked={isChecked} />
          <TagBox title="カテゴリ" options={[...CATEGORY_OPTIONS]} isChecked={isChecked} />
          <TagBox title="属性タグ" options={[...PROPERTY_TAG_OPTIONS]} isChecked={isChecked} />
        </div>
      </form>

      {/* 結果 */}
      <div style={{ marginBottom: "8px", fontSize: "13px", color: "#666" }}>
        ヒット件数: {combos.length}（最大100件表示）
      </div>

      <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
            <tr>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>キャラ</th>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>始動</th>
              <th style={{ padding: "10px 8px", textAlign: "left" }}>コンボ表記</th>
              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>ダメ</th>
              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>D</th>
              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>SA</th>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>タグ</th>
              <th style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>詳細</th>
            </tr>
          </thead>
          <tbody>
            {combos.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "14px 10px", color: "#777" }}>
                  条件に一致するコンボがありません。
                </td>
              </tr>
            ) : (
              combos.map((combo: any) => {
                const tags = combo.tags?.map((ct: any) => ct.tag?.name).filter(Boolean) ?? [];
                return (
                  <tr key={combo.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.character?.name ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.starterText ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>{combo.comboText}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.damage ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.driveCost ?? 0}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.superCost ?? 0}
                    </td>
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

function TagBox({
  title,
  options,
  isChecked,
}: {
  title: string;
  options: string[];
  isChecked: (name: string) => boolean;
}) {
  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "10px", background: "#fff" }}>
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {options.map((t) => (
          <label key={t} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <input type="checkbox" name="tags" value={t} defaultChecked={isChecked(t)} />
            {t}
          </label>
        ))}
      </div>
    </div>
  );
}
