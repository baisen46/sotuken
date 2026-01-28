import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SP =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseIntOrNull(s: string | undefined) {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
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

type SortKey =
  | "created"
  | "damage"
  | "drive"
  | "super"
  | "popular"
  | "rating"
  | "recommend";

type Dir = "asc" | "desc";

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

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean);
}

/**
 * q のゆれ対策：
 * - "2 中K" / "2中K" / 空白なし も拾う
 */
function buildQVariants(q: string) {
  const base = q.trim();
  if (!base) return [];

  const v1 = base.replace(/\s+/g, " ");

  // 数字 + 空白 + 次トークン を結合（繰り返し適用）
  let merged = v1;
  for (let i = 0; i < 5; i++) {
    const next = merged.replace(/(\d)\s+([^\s])/g, "$1$2");
    if (next === merged) break;
    merged = next;
  }

  const noSpace = v1.replace(/\s+/g, "");

  return uniq([v1, merged, noSpace]);
}

const META_TOKENS = new Set([
  ">", "CR", "DR", "DI", "OD", "SA", "SA1", "SA2", "SA3", "J", "A",
]);

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
  const tokens = comboText
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const starter: string[] = [];
  for (const t of tokens) {
    if (t === ">") break;
    starter.push(t);
  }
  return mergeNumberWithNext(starter).join(" ");
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
    sortRaw === "rating" ||
    sortRaw === "recommend"
      ? sortRaw
      : "created";

  const dir: Dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";

  const pageWanted = clamp(Number(first(sp.page) ?? "1"), 1, 1000000);
  const take = clamp(Number(first(sp.take) ?? "50"), 1, 200);

  const tagsRaw = first(sp.tags);
  const { tagIds, tagNames } = parseTagsParam(tagsRaw);

  // タグ名 -> id 解決
  const resolvedFromNames =
    tagNames.length > 0
      ? await prisma.tag.findMany({
          where: { name: { in: tagNames } },
          select: { id: true },
        })
      : [];

  const mergedTagIds = Array.from(
    new Set([...tagIds, ...resolvedFromNames.map((t) => t.id)])
  );

  const qVariants = buildQVariants(q);

  // -------- Prisma where（フィルタ）--------
  const and: any[] = [];

  // ★ 公開のみ表示（削除済み/非公開は除外）
  and.push({ deletedAt: null });
  and.push({ isPublished: true });

  if (characterId) and.push({ characterId });
  if (minDamage != null) and.push({ damage: { gte: minDamage } });
  if (maxDamage != null) and.push({ damage: { lte: maxDamage } });
  if (maxDrive != null) and.push({ driveCost: { lte: maxDrive } });
  if (maxSuper != null) and.push({ superCost: { lte: maxSuper } });

  if (qVariants.length > 0) {
    and.push({
      OR: [
        ...qVariants.map((qq) => ({ comboText: { contains: qq } })),
        { tags: { some: { tag: { name: { contains: q } } } } },
        { steps: { some: { move: { name: { contains: q } } } } },
      ],
    });
  }

  if (mergedTagIds.length > 0) {
    const tagConds = mergedTagIds.map((id) => ({ tags: { some: { tagId: id } } }));
    if (mode === "and") and.push(...tagConds);
    else and.push({ OR: tagConds });
  }

  const where = and.length > 0 ? { AND: and } : {};

  const characters = await prisma.character.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  const currentParams: Record<string, string> = {
    q,
    mode,
    sort,
    dir,
    page: "1", // 後で入れる
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
    const href = buildHref("/combos/search", currentParams, {
      sort: col,
      dir: nextDir,
      page: "1",
    });
    return (
      <Link href={href} className="hover:underline">
        {label}
        {sortMark(sort, dir, col)}
      </Link>
    );
  };

  // -------- 取得 --------
  // rating / recommend は raw SQL を使わず、JS ソートで確実に動かす
  const needJsSort = sort === "rating" || sort === "recommend";

  // 画面表示用
  let sortedCombos: any[] = [];
  let total = 0;

  if (needJsSort) {
    const all = await prisma.combo.findMany({
      where,
      include: {
        character: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        _count: { select: { favorites: true, ratings: true, comments: true } },
      },
    });

    total = all.length;

    const ids = all.map((c) => c.id);

    // 全体平均 C（おすすめのベイズ平均用）
    const globalAvg = await prisma.rating.aggregate({ _avg: { value: true } });
    const C = globalAvg._avg.value ?? 0;

    const ratingAgg =
      ids.length > 0
        ? await prisma.rating.groupBy({
            by: ["comboId"],
            where: { comboId: { in: ids } },
            _avg: { value: true },
            _count: { _all: true },
          })
        : [];

    const rMap = new Map<number, { avg: number | null; count: number }>();
    for (const r of ratingAgg) {
      rMap.set(r.comboId, {
        avg: r._avg.value ?? null,
        count: r._count._all ?? 0,
      });
    }

    const m = 10; // 推薦の事前票（強めに安定）

    const enriched = all.map((c) => {
      const r = rMap.get(c.id) ?? { avg: null, count: 0 };
      const v = r.count; // 票数
      const R = r.avg ?? 0; // 平均（票なしなら0扱い）
      const fav = c._count?.favorites ?? 0;
      const com = c._count?.comments ?? 0;

      // ベイズ平均 + ちょい加点（logで暴れ防止）
      const bayes = v === 0 ? 0 : (v / (v + m)) * R + (m / (v + m)) * C;

      const score = bayes + 0.05 * Math.log1p(fav) + 0.02 * Math.log1p(com);

      return {
        c,
        ratingAvg: r.avg,
        ratingCount: v,
        score,
      };
    });

    enriched.sort((a, b) => {
      // 票なしは常に下
      const az = a.ratingCount === 0 ? 1 : 0;
      const bz = b.ratingCount === 0 ? 1 : 0;
      if (az !== bz) return az - bz;

      if (sort === "rating") {
        const av = a.ratingAvg ?? 0;
        const bv = b.ratingAvg ?? 0;
        if (av !== bv) return dir === "asc" ? av - bv : bv - av;
        if (a.ratingCount !== b.ratingCount) return b.ratingCount - a.ratingCount;
      } else {
        if (a.score !== b.score)
          return dir === "asc" ? a.score - b.score : b.score - a.score;
        if (a.ratingCount !== b.ratingCount) return b.ratingCount - a.ratingCount;
      }

      const at =
        a.c.createdAt instanceof Date
          ? a.c.createdAt.getTime()
          : new Date(a.c.createdAt).getTime();
      const bt =
        b.c.createdAt instanceof Date
          ? b.c.createdAt.getTime()
          : new Date(b.c.createdAt).getTime();
      if (at !== bt) return bt - at;
      return b.c.id - a.c.id;
    });

    const pages = Math.max(1, Math.ceil(total / take));
    const page = Math.min(pageWanted, pages);
    const skip = (page - 1) * take;

    currentParams.page = String(page);

    sortedCombos = enriched.slice(skip, skip + take).map((x) => x.c);

    // 表示用に rating をもう一度 map 化（表示分だけ）
    const shownIds = sortedCombos.map((c) => c.id);
    const shownAgg =
      shownIds.length > 0
        ? await prisma.rating.groupBy({
            by: ["comboId"],
            where: { comboId: { in: shownIds } },
            _avg: { value: true },
            _count: { _all: true },
          })
        : [];

    const ratingMap = new Map<number, { avg: number | null; count: number }>();
    for (const r of shownAgg) {
      ratingMap.set(r.comboId, {
        avg: r._avg.value ?? null,
        count: r._count._all ?? 0,
      });
    }

    const pagesForRender = pages;
    const pageForRender = page;

    return (
      <Render
        q={q}
        characters={characters}
        characterId={characterId}
        tagsRaw={tagsRaw}
        mode={mode}
        minDamage={minDamage}
        maxDamage={maxDamage}
        maxDrive={maxDrive}
        maxSuper={maxSuper}
        take={take}
        sort={sort}
        dir={dir}
        total={total}
        page={pageForRender}
        pages={pagesForRender}
        currentParams={currentParams}
        th={th}
        combos={sortedCombos}
        ratingMap={ratingMap}
      />
    );
  }

  // -------- 通常ソート（PrismaでOK）--------
  total = await prisma.combo.count({ where });
  const pages = Math.max(1, Math.ceil(total / take));
  const page = Math.min(pageWanted, pages);
  const skip = (page - 1) * take;
  currentParams.page = String(page);

  const orderBy: any[] = [];
  if (sort === "created") orderBy.push({ createdAt: dir });
  if (sort === "damage") orderBy.push({ damage: dir });
  if (sort === "drive") orderBy.push({ driveCost: dir });
  if (sort === "super") orderBy.push({ superCost: dir });
  if (sort === "popular") orderBy.push({ favorites: { _count: dir } });

  orderBy.push({ createdAt: "desc" }, { id: "desc" });

  sortedCombos = await prisma.combo.findMany({
    where,
    take,
    skip,
    orderBy,
    include: {
      character: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      _count: { select: { favorites: true, ratings: true, comments: true } },
    },
  });

  const shownIds = sortedCombos.map((c) => c.id);
  const shownAgg =
    shownIds.length > 0
      ? await prisma.rating.groupBy({
          by: ["comboId"],
          where: { comboId: { in: shownIds } },
          _avg: { value: true },
          _count: { _all: true },
        })
      : [];

  const ratingMap = new Map<number, { avg: number | null; count: number }>();
  for (const r of shownAgg) {
    ratingMap.set(r.comboId, {
      avg: r._avg.value ?? null,
      count: r._count._all ?? 0,
    });
  }

  return (
    <Render
      q={q}
      characters={characters}
      characterId={characterId}
      tagsRaw={tagsRaw}
      mode={mode}
      minDamage={minDamage}
      maxDamage={maxDamage}
      maxDrive={maxDrive}
      maxSuper={maxSuper}
      take={take}
      sort={sort}
      dir={dir}
      total={total}
      page={page}
      pages={pages}
      currentParams={currentParams}
      th={th}
      combos={sortedCombos}
      ratingMap={ratingMap}
    />
  );
}

function Render(props: {
  q: string;
  characters: { id: number; name: string }[];
  characterId: number | null;
  tagsRaw: string | undefined;
  mode: "and" | "or";
  minDamage: number | null;
  maxDamage: number | null;
  maxDrive: number | null;
  maxSuper: number | null;
  take: number;
  sort: SortKey;
  dir: Dir;
  total: number;
  page: number;
  pages: number;
  currentParams: Record<string, string>;
  th: (label: string, col: SortKey) => JSX.Element;
  combos: any[];
  ratingMap: Map<number, { avg: number | null; count: number }>;
}) {
  const {
    q,
    characters,
    characterId,
    tagsRaw,
    mode,
    minDamage,
    maxDamage,
    maxDrive,
    maxSuper,
    take,
    sort,
    dir,
    total,
    page,
    pages,
    currentParams,
    th,
    combos,
    ratingMap,
  } = props;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">コンボ検索</h1>

      <form action="/combos/search" method="get" className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">キーワード</label>
          <input
            name="q"
            defaultValue={q}
            className="border rounded px-2 py-1 w-64"
            placeholder="例: 2中K / 2 中K / 236P"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">キャラ</label>
          <select
            name="characterId"
            defaultValue={characterId ? String(characterId) : ""}
            className="border rounded px-2 py-1"
          >
            <option value="">全部</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">タグ(カンマ)</label>
          <input
            name="tags"
            defaultValue={tagsRaw ?? ""}
            className="border rounded px-2 py-1 w-64"
            placeholder="例: CRコン,ノーマル"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">タグ条件</label>
          <select name="mode" defaultValue={mode} className="border rounded px-2 py-1">
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">最小ダメ</label>
          <input name="minDamage" defaultValue={minDamage ?? ""} className="border rounded px-2 py-1 w-24" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">最大ダメ</label>
          <input name="maxDamage" defaultValue={maxDamage ?? ""} className="border rounded px-2 py-1 w-24" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">最大Drive</label>
          <input name="maxDrive" defaultValue={maxDrive ?? ""} className="border rounded px-2 py-1 w-24" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">最大SA</label>
          <input name="maxSuper" defaultValue={maxSuper ?? ""} className="border rounded px-2 py-1 w-24" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">表示件数</label>
          <select name="take" defaultValue={String(take)} className="border rounded px-2 py-1">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">ソート</label>
          <select name="sort" defaultValue={sort} className="border rounded px-2 py-1">
            <option value="recommend">おすすめ(実用)</option>
            <option value="created">新着</option>
            <option value="popular">お気に入り</option>
            <option value="rating">評価</option>
            <option value="damage">ダメージ</option>
            <option value="drive">Drive消費</option>
            <option value="super">SA消費</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">昇降</label>
          <select name="dir" defaultValue={dir} className="border rounded px-2 py-1">
            <option value="desc">DESC</option>
            <option value="asc">ASC</option>
          </select>
        </div>

        <input type="hidden" name="page" value="1" />

        <button className="border rounded px-3 py-1 bg-white">検索</button>

        <Link href="/combos/search" className="text-sm text-blue-600 hover:underline">
          条件クリア
        </Link>
      </form>

      <div className="text-sm text-gray-700">
        {total} 件 / {page} / {pages}
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">キャラ</th>
              <th className="p-2 text-left">始動</th>
              <th className="p-2 text-left">コンボ</th>
              <th className="p-2">{th("作成", "created")}</th>
              <th className="p-2">{th("ダメ", "damage")}</th>
              <th className="p-2">{th("D消費", "drive")}</th>
              <th className="p-2">{th("SA消費", "super")}</th>
              <th className="p-2">{th("お気に入り", "popular")}</th>
              <th className="p-2">{th("評価", "rating")}</th>
              <th className="p-2">コメント</th>
              <th className="p-2 text-left">タグ</th>
              <th className="p-2">詳細</th>
            </tr>
          </thead>

          <tbody>
            {combos.map((c: any) => {
              const r = ratingMap.get(c.id) ?? { avg: null, count: 0 };
              const starter = starterFromComboText(c.comboText);
              const tags = (c.tags ?? []).map((t: any) => t.tag?.name).filter(Boolean);

              return (
                <tr key={c.id} className="border-t">
                  <td className="p-2">
                    <Link href={`/combos/search?characterId=${c.characterId}`} className="hover:underline">
                      {c.character?.name ?? `#${c.characterId}`}
                    </Link>
                  </td>

                  <td className="p-2 font-semibold">{starter || "-"}</td>

                  <td className="p-2 max-w-[520px]">
                    <div className="line-clamp-2">{c.comboText}</div>
                  </td>

                  <td className="p-2 text-center">
                    {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                  </td>

                  <td className="p-2 text-center">{c.damage ?? "-"}</td>
                  <td className="p-2 text-center">{c.driveCost ?? 0}</td>
                  <td className="p-2 text-center">{c.superCost ?? 0}</td>

                  <td className="p-2 text-center">{c._count?.favorites ?? 0}</td>

                  <td className="p-2 text-center">
                    {r.avg == null ? "-" : `${Math.round(r.avg * 10) / 10}`}{" "}
                    <span className="text-gray-500">({r.count})</span>
                  </td>

                  <td className="p-2 text-center">{c._count?.comments ?? 0}</td>

                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 6).map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded bg-gray-100">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="p-2 text-center">
                    <Link href={`/combos/${c.id}`} className="text-blue-600 hover:underline">
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {combos.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-600" colSpan={12}>
                  該当なし
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={buildHref("/combos/search", currentParams, { page: String(Math.max(1, page - 1)) })}
          className={`px-3 py-1 border rounded ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          前へ
        </Link>

        <span className="text-sm text-gray-700">
          {page} / {pages}
        </span>

        <Link
          href={buildHref("/combos/search", currentParams, { page: String(Math.min(pages, page + 1)) })}
          className={`px-3 py-1 border rounded ${page >= pages ? "pointer-events-none opacity-50" : ""}`}
        >
          次へ
        </Link>
      </div>
    </div>
  );
}
