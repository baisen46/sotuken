import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type SP =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function buildHref(
  basePath: string,
  current: Record<string, string>,
  patch: Record<string, string | null>
) {
  const usp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) usp.delete(k);
    else usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function sortNextDir(currentSort: string, currentDir: string, nextSort: string) {
  if (currentSort !== nextSort) return "desc";
  return currentDir === "asc" ? "desc" : "asc";
}

function sortMark(currentSort: string, currentDir: string, col: string) {
  if (currentSort !== col) return "";
  return currentDir === "asc" ? " ▲" : " ▼";
}

type SortKey = "created" | "damage" | "drive" | "super" | "popular" | "rating";
type Dir = "asc" | "desc";

function parseIntOrNull(s: string | undefined) {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseTagsParam(raw: string | undefined) {
  if (!raw) return { tagIds: [] as number[], tagNames: [] as string[] };
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const tagIds: number[] = [];
  const tagNames: string[] = [];

  for (const t of tokens) {
    const n = Number(t);
    if (Number.isInteger(n) && n > 0) tagIds.push(n);
    else tagNames.push(t);
  }
  return { tagIds, tagNames };
}

// ====== 表示用：数字 + 次トークンを合体（2 弱P -> 2弱P） ======
const META_TOKENS = new Set([">", "CR", "DR", "DI", "OD", "SA", "SA1", "SA2", "SA3", "J", "A"]);

function mergeNumberWithNext(tokens: string[]) {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const next = tokens[i + 1];

    if (/^\d+$/.test(cur) && next && !META_TOKENS.has(next)) {
      out.push(cur + next);
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
}

function starterFromComboText(comboText: string) {
  // ">" より前を始動とみなす
  const before = (comboText.split(">")[0] ?? "").trim();
  if (!before) return "-";
  const tokens = before.split(/\s+/).filter(Boolean);
  return mergeNumberWithNext(tokens).join("").replace(/\s+/g, "");
}

// ====== 検索用：q のスペース差を吸収（2弱P / 2 弱P / 2 3 6 弱P など） ======
function buildQVariants(qRaw: string) {
  const raw = qRaw.trim();
  if (!raw) return [];

  const noSpace = raw.replace(/\s+/g, "");

  // 2中K -> 2 中K, 236P -> 236 P
  const spacedDigitRest = noSpace.replace(/^(\d+)(\D.+)$/, "$1 $2");

  // 236P -> 2 3 6 P（旧データ救済）
  let digitsSpaced = noSpace;
  const m = noSpace.match(/^(\d+)(\D.+)$/);
  if (m) {
    const digits = m[1].split("").join(" ");
    const rest = m[2];
    digitsSpaced = `${digits} ${rest}`;
  }

  const vars = [raw, noSpace, spacedDigitRest, digitsSpaced]
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set(vars));
}

export default async function ComboSearchPage(props: { searchParams?: SP }) {
  const sp = (await (props.searchParams as any)) ?? {};

  const q = (first(sp.q) ?? "").trim();
  const characterId = parseIntOrNull(first(sp.characterId));
  const minDamage = parseIntOrNull(first(sp.minDamage));
  const maxDamage = parseIntOrNull(first(sp.maxDamage));
  const maxDrive = parseIntOrNull(first(sp.maxDrive));
  const maxSuper = parseIntOrNull(first(sp.maxSuper));

  const mode = (first(sp.mode) ?? "and") === "or" ? "or" : "and";

  const sortRaw = (first(sp.sort) ?? "created") as SortKey;
  const sort: SortKey =
    sortRaw === "damage" ||
    sortRaw === "drive" ||
    sortRaw === "super" ||
    sortRaw === "popular" ||
    sortRaw === "rating"
      ? sortRaw
      : "created";

  const dir: Dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";

  const pageWanted = clamp(Number(first(sp.page) ?? "1"), 1, 1000000);
  const take = clamp(Number(first(sp.take) ?? "50"), 1, 200);

  const tagsRaw = first(sp.tags);
  const { tagIds, tagNames } = parseTagsParam(tagsRaw);

  const qVariants = buildQVariants(q);

  // ------- Prisma where（フィルタ） -------
  const and: any[] = [];

  if (characterId) and.push({ characterId });
  if (minDamage != null) and.push({ damage: { gte: minDamage } });
  if (maxDamage != null) and.push({ damage: { lte: maxDamage } });
  if (maxDrive != null) and.push({ driveCost: { lte: maxDrive } });
  if (maxSuper != null) and.push({ superCost: { lte: maxSuper } });

  // q: comboText / tag名 / move名
  if (qVariants.length > 0) {
    and.push({
      OR: [
        ...qVariants.map((qq) => ({ comboText: { contains: qq } })),
        { tags: { some: { tag: { name: { contains: q } } } } },
        { steps: { some: { move: { name: { contains: q } } } } },
      ],
    });
  }

  // tags: AND/OR切替（tags param は id or name を許容）
  const tagConds: any[] = [];
  for (const id of tagIds) tagConds.push({ tags: { some: { tagId: id } } });
  for (const name of tagNames) tagConds.push({ tags: { some: { tag: { name } } } });

  if (tagConds.length > 0) {
    if (mode === "and") and.push(...tagConds);
    else and.push({ OR: tagConds });
  }

  const where = and.length > 0 ? { AND: and } : {};

  // 総件数（ページネーション）
  const total = await prisma.combo.count({ where });
  const pages = Math.max(1, Math.ceil(total / take));
  const page = Math.min(pageWanted, pages);
  const skip = (page - 1) * take;

  const currentParams: Record<string, string> = {
    q,
    mode,
    sort,
    dir,
    page: String(page),
    take: String(take),
  };
  if (characterId) currentParams.characterId = String(characterId);
  if (tagsRaw) currentParams.tags = tagsRaw;
  if (minDamage != null) currentParams.minDamage = String(minDamage);
  if (maxDamage != null) currentParams.maxDamage = String(maxDamage);
  if (maxDrive != null) currentParams.maxDrive = String(maxDrive);
  if (maxSuper != null) currentParams.maxSuper = String(maxSuper);

  const th = (label: string, col: SortKey) => {
    const nextDir = sortNextDir(sort, dir, col);
    const href = buildHref("/combos/search", currentParams, { sort: col, dir: nextDir, page: "1" });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  // ------- rating 並び替え（平均でソートするため raw SQL） -------
  let orderedIds: number[] | null = null;

  if (sort === "rating") {
    const dirSql = dir === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");

    const wheres: Prisma.Sql[] = [];

    if (characterId) wheres.push(Prisma.sql`c.character_id = ${characterId}`);
    if (minDamage != null) wheres.push(Prisma.sql`c.damage >= ${minDamage}`);
    if (maxDamage != null) wheres.push(Prisma.sql`c.damage <= ${maxDamage}`);
    if (maxDrive != null) wheres.push(Prisma.sql`c.drive_cost <= ${maxDrive}`);
    if (maxSuper != null) wheres.push(Prisma.sql`c.super_cost <= ${maxSuper}`);

    // q（スペース有無差を吸収）※combo_text のみに適用（starter_text は参照しない）
    if (qVariants.length > 0) {
      const likeParts: Prisma.Sql[] = [];

      for (const v of qVariants) {
        const like = `%${v}%`;
        likeParts.push(Prisma.sql`c.combo_text LIKE ${like}`);
      }

      // タグ・技名は raw(q) を優先
      const likeQ = `%${q}%`;
      likeParts.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM combo_tags ct
        JOIN tags t ON t.id = ct.tag_id
        WHERE ct.combo_id = c.id AND t.name LIKE ${likeQ}
      )`);
      likeParts.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM combo_steps cs
        LEFT JOIN moves m ON m.id = cs.move_id
        WHERE cs.combo_id = c.id AND m.name LIKE ${likeQ}
      )`);

      wheres.push(Prisma.sql`(${Prisma.join(likeParts, Prisma.sql` OR `)})`);
    }

    // tags: id/name 両対応
    if (tagIds.length + tagNames.length > 0) {
      if (mode === "or") {
        const orParts: Prisma.Sql[] = [];

        if (tagIds.length > 0) {
          orParts.push(Prisma.sql`EXISTS (
            SELECT 1 FROM combo_tags ct
            WHERE ct.combo_id = c.id AND ct.tag_id IN (${Prisma.join(tagIds.map((x) => Prisma.sql`${x}`))})
          )`);
        }
        if (tagNames.length > 0) {
          orParts.push(Prisma.sql`EXISTS (
            SELECT 1 FROM combo_tags ct
            JOIN tags t ON t.id = ct.tag_id
            WHERE ct.combo_id = c.id AND t.name IN (${Prisma.join(tagNames.map((x) => Prisma.sql`${x}`))})
          )`);
        }

        wheres.push(Prisma.sql`(${Prisma.join(orParts, Prisma.sql` OR `)})`);
      } else {
        for (const id of tagIds) {
          wheres.push(Prisma.sql`EXISTS (
            SELECT 1 FROM combo_tags ct
            WHERE ct.combo_id = c.id AND ct.tag_id = ${id}
          )`);
        }
        for (const name of tagNames) {
          wheres.push(Prisma.sql`EXISTS (
            SELECT 1 FROM combo_tags ct
            JOIN tags t ON t.id = ct.tag_id
            WHERE ct.combo_id = c.id AND t.name = ${name}
          )`);
        }
      }
    }

    const whereSql =
      wheres.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(wheres, Prisma.sql` AND `)}`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT c.id
      FROM combos c
      LEFT JOIN ratings r ON r.combo_id = c.id
      ${whereSql}
      GROUP BY c.id
      ORDER BY
        (AVG(r.value) IS NULL) ASC,
        AVG(r.value) ${dirSql},
        COUNT(r.id) DESC,
        c.created_at DESC,
        c.id DESC
      LIMIT ${take} OFFSET ${skip}
    `);

    orderedIds = rows.map((r) => r.id);
  }

  // ------- 表示用データ取得 -------
  const include = {
    character: { select: { id: true, name: true } },
    tags: { include: { tag: true } },
    _count: { select: { favorites: true, ratings: true } },
  } as const;

  let items: any[] = [];

  if (orderedIds) {
    if (orderedIds.length === 0) items = [];
    else {
      const fetched = await prisma.combo.findMany({
        where: { id: { in: orderedIds } },
        include,
      });
      const index = new Map<number, number>();
      orderedIds.forEach((id, i) => index.set(id, i));
      fetched.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
      items = fetched as any;
    }
  } else {
    const orderBy =
      sort === "created"
        ? [{ createdAt: dir }, { id: "desc" as const }]
        : sort === "damage"
        ? [{ damage: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : sort === "drive"
        ? [{ driveCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : sort === "super"
        ? [{ superCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : sort === "popular"
        ? [{ favorites: { _count: dir } }, { createdAt: "desc" as const }, { id: "desc" as const }]
        : [{ createdAt: "desc" as const }, { id: "desc" as const }];

    items = (await prisma.combo.findMany({
      where,
      include,
      orderBy: orderBy as any,
      skip,
      take,
    })) as any;
  }

  const pageComboIds = items.map((c) => c.id);

  // rating 平均（表示用）
  const ratingAgg =
    pageComboIds.length > 0
      ? await prisma.rating.groupBy({
          by: ["comboId"],
          where: { comboId: { in: pageComboIds } },
          _avg: { value: true },
        })
      : [];

  const ratingAvgMap = new Map<number, number>();
  for (const row of ratingAgg) {
    const avg = row._avg.value;
    if (avg != null) ratingAvgMap.set(row.comboId, avg);
  }

  // キャラ一覧（フォーム用）
  const characters = await prisma.character.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  const chip = (label: string, patch: Record<string, string | null>) => (
    <Link
      href={buildHref("/combos/search", currentParams, patch)}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
    >
      <span>{label}</span>
      <span className="text-gray-500">×</span>
    </Link>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">コンボ検索</h1>

      {/* 検索フォーム */}
      <form
        action="/combos/search"
        method="get"
        className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded border p-4 bg-white"
      >
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input type="hidden" name="take" value={String(take)} />

        <div className="md:col-span-4">
          <div className="text-xs text-gray-500 mb-1">キーワード（コンボ/タグ/技名）</div>
          <input
            name="q"
            defaultValue={q}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="例: 2中K / 236弱P / 対空"
          />
        </div>

        <div className="md:col-span-3">
          <div className="text-xs text-gray-500 mb-1">キャラ</div>
          <select
            name="characterId"
            defaultValue={characterId ? String(characterId) : ""}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">全キャラ</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <div className="text-xs text-gray-500 mb-1">タグ（id or 名前をカンマ区切り）</div>
          <input
            name="tags"
            defaultValue={tagsRaw ?? ""}
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="例: 1,3  または  ODコン,対空コン"
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">minDamage</div>
          <input
            name="minDamage"
            defaultValue={minDamage ?? ""}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">maxDamage</div>
          <input
            name="maxDamage"
            defaultValue={maxDamage ?? ""}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">maxDrive</div>
          <input
            name="maxDrive"
            defaultValue={maxDrive ?? ""}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">maxSuper</div>
          <input
            name="maxSuper"
            defaultValue={maxSuper ?? ""}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 mb-1">タグ条件</div>
          <select name="mode" defaultValue={mode} className="w-full rounded border px-3 py-2 text-sm">
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-end gap-2">
          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-700"
          >
            検索
          </button>
          <Link href="/combos/search" className="w-full text-center rounded border px-3 py-2 text-sm hover:bg-gray-50">
            クリア
          </Link>
        </div>
      </form>

      {/* 条件チップ */}
      <div className="flex flex-wrap gap-2">
        {q && chip(`q: ${q}`, { q: null, page: "1" })}
        {characterId && chip(`character: ${characterId}`, { characterId: null, page: "1" })}
        {tagsRaw && chip(`tags: ${tagsRaw}`, { tags: null, page: "1" })}
        {minDamage != null && chip(`minDamage: ${minDamage}`, { minDamage: null, page: "1" })}
        {maxDamage != null && chip(`maxDamage: ${maxDamage}`, { maxDamage: null, page: "1" })}
        {maxDrive != null && chip(`maxDrive: ${maxDrive}`, { maxDrive: null, page: "1" })}
        {maxSuper != null && chip(`maxSuper: ${maxSuper}`, { maxSuper: null, page: "1" })}
        {mode === "or" && chip(`mode: OR`, { mode: "and", page: "1" })}
      </div>

      {/* 件数＋ページネーション */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>該当 {total} 件</div>
        <div className="flex items-center gap-2">
          <Link
            href={buildHref("/combos/search", currentParams, { page: String(Math.max(1, page - 1)) })}
            className={`px-3 py-1 rounded border ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            前へ
          </Link>
          <span>
            {page} / {pages}
          </span>
          <Link
            href={buildHref("/combos/search", currentParams, { page: String(Math.min(pages, page + 1)) })}
            className={`px-3 py-1 rounded border ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            次へ
          </Link>
        </div>
      </div>

      {/* 結果 */}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-700">
            <th className="p-2">キャラ</th>
            <th className="p-2">始動</th>
            <th className="p-2">コンボ</th>
            <th className="p-2">{th("作成", "created")}</th>
            <th className="p-2">{th("ダメージ", "damage")}</th>
            <th className="p-2">{th("D消費", "drive")}</th>
            <th className="p-2">{th("SA消費", "super")}</th>
            <th className="p-2">{th("お気に入り", "popular")}</th>
            <th className="p-2">{th("評価", "rating")}</th>
            <th className="p-2">タグ</th>
            <th className="p-2">詳細</th>
          </tr>
        </thead>

        <tbody>
          {items.map((combo: any) => {
            const starter = starterFromComboText(String(combo.comboText ?? ""));
            const tags = combo.tags?.map((t: any) => t.tag.name) ?? [];

            const favCount = combo._count?.favorites ?? 0;
            const rCount = combo._count?.ratings ?? 0;
            const rAvg = ratingAvgMap.get(combo.id);
            const rLabel = rAvg == null ? "-" : rAvg.toFixed(2);

            return (
              <tr key={combo.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{combo.character?.name ?? "-"}</td>
                <td className="p-2 font-bold">{starter}</td>
                <td className="p-2">
                  <div
                    className="max-w-[520px]"
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
                <td className="p-2">{new Date(combo.createdAt).toLocaleDateString("ja-JP")}</td>
                <td className="p-2 font-bold">{combo.damage ?? "-"}</td>
                <td className="p-2">{combo.driveCost ?? 0}</td>
                <td className="p-2">{combo.superCost ?? 0}</td>
                <td className="p-2">{favCount}</td>
                <td className="p-2">
                  {rLabel} <span className="text-xs text-gray-500">({rCount})</span>
                </td>
                <td className="p-2 space-x-1">
                  {tags.slice(0, 4).map((name: string) => (
                    <span key={name} className="inline-block bg-gray-200 px-2 py-1 rounded text-xs">
                      {name}
                    </span>
                  ))}
                  {tags.length > 4 && <span className="text-xs text-gray-500">+{tags.length - 4}</span>}
                </td>
                <td className="p-2">
                  <Link href={`/combos/${combo.id}`} className="text-blue-600 hover:underline">
                    →
                  </Link>
                </td>
              </tr>
            );
          })}

          {items.length === 0 && (
            <tr>
              <td colSpan={11} className="p-6 text-center text-gray-500">
                該当するコンボがありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
