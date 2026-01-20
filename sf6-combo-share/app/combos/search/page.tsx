// app/combos/search/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SortKey = "created" | "damage" | "drive" | "super";
type SortDir = "asc" | "desc";
type TagMode = "and" | "or";

function normalizeSortKey(v?: string): SortKey {
  if (v === "damage" || v === "drive" || v === "super") return v;
  return "created";
}
function normalizeSortDir(v?: string): SortDir {
  return v === "asc" ? "asc" : "desc";
}
function normalizeMode(v?: string): TagMode {
  return v === "or" ? "or" : "and";
}
function toNum(v?: string) {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// 投稿UI側と揃える（検索UI候補）
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

// 表示優先度（カテゴリ→ヒット→属性→属性タグ→その他）
function sortTagsByPriority(tags: string[]) {
  const pri = new Map<string, number>();
  for (const t of CATEGORY_OPTIONS) pri.set(t, 0);
  for (const t of HIT_OPTIONS) pri.set(t, 1);
  for (const t of ATTRIBUTE_OPTIONS) pri.set(t, 2);
  for (const t of PROPERTY_TAG_OPTIONS) pri.set(t, 3);

  return [...tags].sort((a, b) => {
    const pa = pri.has(a) ? (pri.get(a) as number) : 9;
    const pb = pri.has(b) ? (pri.get(b) as number) : 9;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "ja");
  });
}

export default async function ComboSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // GETパラメータ取り出し
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const characterId = typeof sp.characterId === "string" ? toNum(sp.characterId) : undefined;

  // tags: ?tags=a&tags=b または ?tags=a,b を許容
  let tags: string[] = [];
  if (Array.isArray(sp.tags)) tags = sp.tags.filter((t): t is string => typeof t === "string");
  if (typeof sp.tags === "string") tags = sp.tags.split(",").map((s) => s.trim()).filter(Boolean);
  // 重複除去
  tags = Array.from(new Set(tags));

  const minDamage = typeof sp.minDamage === "string" ? toNum(sp.minDamage) : undefined;
  const maxDamage = typeof sp.maxDamage === "string" ? toNum(sp.maxDamage) : undefined;
  const maxDrive = typeof sp.maxDrive === "string" ? toNum(sp.maxDrive) : undefined;
  const maxSuper = typeof sp.maxSuper === "string" ? toNum(sp.maxSuper) : undefined;

  const mode = normalizeMode(typeof sp.mode === "string" ? sp.mode : undefined);

  const sort = normalizeSortKey(typeof sp.sort === "string" ? sp.sort : undefined);
  const dir = normalizeSortDir(typeof sp.dir === "string" ? sp.dir : undefined);

  const page = Math.max(1, typeof sp.page === "string" ? toNum(sp.page) ?? 1 : 1);
  const take = 50;
  const skip = (page - 1) * take;

  // where を組み立て（基本はANDで束ねる）
  const and: any[] = [];

  if (characterId) and.push({ characterId });
  if (minDamage !== undefined) and.push({ damage: { gte: minDamage } });
  if (maxDamage !== undefined) and.push({ damage: { lte: maxDamage } });
  if (maxDrive !== undefined) and.push({ driveCost: { lte: maxDrive } });
  if (maxSuper !== undefined) and.push({ superCost: { lte: maxSuper } });

  // tags: mode=and は「全部含む」、mode=or は「どれか含む」
  if (tags.length > 0) {
    if (mode === "and") {
      for (const t of tags) {
        and.push({
          tags: {
            some: { tag: { name: t } },
          },
        });
      }
    } else {
      and.push({
        tags: {
          some: { tag: { name: { in: tags } } },
        },
      });
    }
  }

  // q: comboText / starterText / tag名 の部分一致（OR）
  if (q) {
    and.push({
      OR: [
        { comboText: { contains: q } },
        { starterText: { contains: q } },
        { tags: { some: { tag: { name: { contains: q } } } } },
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

  // UI用：キャラ一覧
  const characters = await prisma.character.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  // 件数 + 取得
  const total = await prisma.combo.count({ where });
  const maxPage = Math.max(1, Math.ceil(total / take));

  const combos = await prisma.combo.findMany({
    where,
    include: {
      character: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    orderBy,
    skip,
    take,
  });

  const isChecked = (name: string) => tags.includes(name);

  // URL生成（ページ移動/ソート用）
  const buildHref = (overrides: Partial<Record<string, string | undefined>>) => {
    const usp = new URLSearchParams();

    if (q) usp.set("q", q);
    if (characterId) usp.set("characterId", String(characterId));
    if (minDamage !== undefined) usp.set("minDamage", String(minDamage));
    if (maxDamage !== undefined) usp.set("maxDamage", String(maxDamage));
    if (maxDrive !== undefined) usp.set("maxDrive", String(maxDrive));
    if (maxSuper !== undefined) usp.set("maxSuper", String(maxSuper));

    usp.set("mode", mode);
    usp.set("sort", sort);
    usp.set("dir", dir);

    // tags は複数 append
    for (const t of tags) usp.append("tags", t);

    usp.set("page", String(page));

    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") usp.delete(k);
      else usp.set(k, v);
    }

    return `/combos/search?${usp.toString()}`;
  };

  const sortHref = (key: SortKey) => {
    const nextDir: SortDir = sort === key ? (dir === "asc" ? "desc" : "asc") : "desc";
    return buildHref({ sort: key, dir: nextDir, page: "1" });
  };

  const selectedCharacterName =
    characterId ? characters.find((c) => c.id === characterId)?.name ?? `ID:${characterId}` : null;

  const selectedSummaryChips: { label: string; value: string }[] = [];
  if (q) selectedSummaryChips.push({ label: "q", value: q });
  if (selectedCharacterName) selectedSummaryChips.push({ label: "キャラ", value: selectedCharacterName });
  if (minDamage !== undefined || maxDamage !== undefined)
    selectedSummaryChips.push({
      label: "ダメージ",
      value: `${minDamage ?? "-"}〜${maxDamage ?? "-"}`,
    });
  if (maxDrive !== undefined) selectedSummaryChips.push({ label: "D上限", value: String(maxDrive) });
  if (maxSuper !== undefined) selectedSummaryChips.push({ label: "SA上限", value: String(maxSuper) });
  if (tags.length > 0) selectedSummaryChips.push({ label: `タグ(${mode.toUpperCase()})`, value: tags.join(", ") });

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
          marginBottom: "14px",
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

        {/* タグモード */}
        <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "12px", color: "#666" }}>タグ条件：</div>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <input type="radio" name="mode" value="and" defaultChecked={mode === "and"} />
            AND（全部含む）
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <input type="radio" name="mode" value="or" defaultChecked={mode === "or"} />
            OR（どれか含む）
          </label>
          <div style={{ fontSize: "12px", color: "#888" }}>
            ※タグを複数選択したときの挙動
          </div>
        </div>

        {/* タグ群（?tags=xxx を複数送る） */}
        <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          <TagBox title="カテゴリ" options={[...CATEGORY_OPTIONS]} isChecked={isChecked} />
          <TagBox title="ヒット状況" options={[...HIT_OPTIONS]} isChecked={isChecked} />
          <TagBox title="属性" options={[...ATTRIBUTE_OPTIONS]} isChecked={isChecked} />
          <TagBox title="属性タグ" options={[...PROPERTY_TAG_OPTIONS]} isChecked={isChecked} />
        </div>

        {/* 画面下に隠れやすいので、タグ選択後の検索ボタンも置く */}
        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
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
            この条件で検索
          </button>
          <Link href="/combos/search" style={{ fontSize: "13px", color: "#666", alignSelf: "center" }}>
            条件をリセット
          </Link>
        </div>
      </form>

      {/* 条件サマリー */}
      {selectedSummaryChips.length > 0 && (
        <div style={{ marginBottom: "10px" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>選択中の条件</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {selectedSummaryChips.map((c) => (
              <span
                key={`${c.label}:${c.value}`}
                style={{
                  padding: "3px 8px",
                  borderRadius: "999px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  fontSize: "12px",
                }}
                title={c.value}
              >
                <b>{c.label}</b>: {c.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 結果メタ */}
      <div style={{ marginBottom: "8px", fontSize: "13px", color: "#666", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <span>ヒット件数: {total}</span>
        <span>表示: {skip + 1}〜{Math.min(skip + take, total)} 件</span>
        <span>ページ: {page}/{maxPage}</span>
      </div>

      {/* 結果テーブル */}
      <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
            <tr>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>キャラ</th>
              <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>始動</th>
              <th style={{ padding: "10px 8px", textAlign: "left" }}>コンボ表記</th>

              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={sortHref("damage")} style={{ color: "#333", textDecoration: "none" }}>
                  ダメ{sort === "damage" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>
              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={sortHref("drive")} style={{ color: "#333", textDecoration: "none" }}>
                  D{sort === "drive" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>
              <th style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                <Link href={sortHref("super")} style={{ color: "#333", textDecoration: "none" }}>
                  SA{sort === "super" ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </Link>
              </th>

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
                const rawTags = combo.tags?.map((ct: any) => ct.tag?.name).filter(Boolean) ?? [];
                const tagsSorted = sortTagsByPriority(rawTags);

                return (
                  <tr key={combo.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.character?.name ?? "-"}
                    </td>

                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", verticalAlign: "top", fontWeight: "bold" }}>
                      {combo.starterText ?? "-"}
                    </td>

                    <td style={{ padding: "10px 8px", verticalAlign: "top", maxWidth: "520px" }}>
                      <div
                        style={{
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical" as any,
                          WebkitLineClamp: 2 as any,
                          lineHeight: "1.4",
                        }}
                        title={combo.comboText}
                      >
                        {combo.comboText}
                      </div>
                    </td>

                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.damage ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.driveCost ?? 0}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {combo.superCost ?? 0}
                    </td>

                    <td style={{ padding: "10px 8px", verticalAlign: "top", maxWidth: "260px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {tagsSorted.length === 0 ? (
                          <span style={{ color: "#aaa" }}>タグなし</span>
                        ) : (
                          tagsSorted.slice(0, 10).map((t: string) => (
                            <span
                              key={t}
                              style={{
                                padding: "2px 6px",
                                borderRadius: "999px",
                                border: "1px solid #ddd",
                                backgroundColor: "#fafafa",
                                fontSize: "12px",
                              }}
                            >
                              {t}
                            </span>
                          ))
                        )}
                        {tagsSorted.length > 10 && <span style={{ color: "#888", fontSize: "12px" }}>…</span>}
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

      {/* ページネーション */}
      {total > 0 && (
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <Link
              href={buildHref({ page: String(Math.max(1, page - 1)) })}
              aria-disabled={page <= 1}
              style={{
                pointerEvents: page <= 1 ? "none" : "auto",
                color: page <= 1 ? "#aaa" : "#2b74ff",
                textDecoration: "none",
                border: "1px solid #ddd",
                borderRadius: "6px",
                padding: "8px 10px",
                background: "#fff",
              }}
            >
              ← 前へ
            </Link>

            <Link
              href={buildHref({ page: String(Math.min(maxPage, page + 1)) })}
              aria-disabled={page >= maxPage}
              style={{
                pointerEvents: page >= maxPage ? "none" : "auto",
                color: page >= maxPage ? "#aaa" : "#2b74ff",
                textDecoration: "none",
                border: "1px solid #ddd",
                borderRadius: "6px",
                padding: "8px 10px",
                background: "#fff",
              }}
            >
              次へ →
            </Link>
          </div>

          <div style={{ fontSize: "12px", color: "#666" }}>
            1ページ {take} 件 / 全 {total} 件
          </div>
        </div>
      )}
    </main>
  );
}

function TagBox({
  title,
  options,
  isChecked,
}: {
  title: string;
  options: readonly string[];
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
