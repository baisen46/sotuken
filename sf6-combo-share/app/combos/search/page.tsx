import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { starterFromComboText } from "@/lib/notation";

export const dynamic = "force-dynamic";

type SP =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function clampInt(v: string | undefined, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parseIntOrNull(s: string | undefined) {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function buildHref(basePath: string, current: Record<string, string>, patch: Record<string, string | null>) {
  const usp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) usp.delete(k);
    else usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

type SortKey = "created" | "damage" | "drive" | "super";
type Dir = "asc" | "desc";

function normalizeSort(raw: string | undefined): SortKey {
  // 互換: sort=new -> created
  if (raw === "new") return "created";
  if (raw === "damage" || raw === "drive" || raw === "super") return raw;
  return "created";
}

function normalizePlayStyle(raw: string | undefined): "CLASSIC" | "MODERN" | undefined {
  if (raw === "CLASSIC" || raw === "MODERN") return raw;
  return undefined;
}

function sortLabel(sort: SortKey, dir: Dir) {
  const base =
    sort === "created" ? "作成日" : sort === "damage" ? "ダメージ" : sort === "drive" ? "Dゲージ" : "SAゲージ";
  return `${base}（${dir === "asc" ? "昇順" : "降順"}）`;
}

function parseTags(raw: string | undefined) {
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

function uniqPreserve<T>(arr: T[]) {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

export default async function ComboSearchPage(props: { searchParams?: SP }) {
  const sp = (await (props.searchParams as any)) ?? {};

  // ===== 統一クエリ =====
  const q = (first(sp.q) ?? "").trim();
  const characterIdNum = Number(first(sp.characterId));
  const characterId =
    Number.isInteger(characterIdNum) && characterIdNum > 0 ? characterIdNum : undefined;

  const playStyle = normalizePlayStyle(first(sp.playStyle));
  const sort = normalizeSort(first(sp.sort));
  const dir: Dir = (first(sp.dir) ?? "desc") === "asc" ? "asc" : "desc";
  const pageWanted = clampInt(first(sp.page), 1, 1, 1000000);
  const take = clampInt(first(sp.take), 50, 10, 200);

  // ===== 追加フィルタ（あってもOK）=====
  const minDamage = parseIntOrNull(first(sp.minDamage));
  const maxDamage = parseIntOrNull(first(sp.maxDamage));
  const maxDrive = parseIntOrNull(first(sp.maxDrive));
  const maxSuper = parseIntOrNull(first(sp.maxSuper));

  // tags は「カンマ区切り（ID or 名前）」を許容
  const tagsRaw = (first(sp.tags) ?? "").trim();
  const { tagIds, tagNames } = parseTags(tagsRaw);

  // tags の組み合わせ: mode=and|or（未指定はand）
  const mode = (first(sp.mode) ?? "and") === "or" ? "or" : "and";

  // フォーム・リンクが引き継ぐ現在パラメータ
  const currentParams: Record<string, string> = {
    q,
    sort,
    dir,
    page: String(pageWanted),
    take: String(take),
  };
  if (characterId) currentParams.characterId = String(characterId);
  if (playStyle) currentParams.playStyle = playStyle;
  if (minDamage != null) currentParams.minDamage = String(minDamage);
  if (maxDamage != null) currentParams.maxDamage = String(maxDamage);
  if (maxDrive != null) currentParams.maxDrive = String(maxDrive);
  if (maxSuper != null) currentParams.maxSuper = String(maxSuper);
  if (tagsRaw) currentParams.tags = tagsRaw;
  if (mode === "or") currentParams.mode = "or";

  // キャラ一覧（セレクト用）
  const characters = await prisma.character.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  const selectedCharacterName =
    characterId ? characters.find((c) => c.id === characterId)?.name : undefined;

  // ===== 人気タグ（クリックで追加/解除）=====
  const popularTags = await prisma.tag.findMany({
    take: 10,
    orderBy: { comboTags: { _count: "desc" } },
    select: {
      id: true,
      name: true,
      _count: { select: { comboTags: true } },
    },
  });

  // tagsRaw をトグルしやすい形に
  const tagTokenStrings = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const tagTokenSet = new Set(tagTokenStrings.map((t) => t.toLowerCase()));

  const toggleTagHref = (tagName: string) => {
    const key = tagName.toLowerCase();
    const exists = tagTokenSet.has(key);

    let nextTokens: string[];
    if (exists) {
      nextTokens = tagTokenStrings.filter((t) => t.toLowerCase() !== key);
    } else {
      nextTokens = uniqPreserve([...tagTokenStrings, tagName]);
    }

    const nextTags = nextTokens.join(", ");
    return buildHref("/combos/search", currentParams, {
      tags: nextTags ? nextTags : null,
      page: "1",
    });
  };

  // ===== プリセット（sort/dirだけ変えて他条件維持）=====
  const presetHref = (nextSort: SortKey, nextDir: Dir) =>
    buildHref("/combos/search", currentParams, {
      sort: nextSort,
      dir: nextDir,
      page: "1",
    });

  // ===== where =====
  const and: Prisma.ComboWhereInput[] = [];

  // 公開のみ
  and.push({ deletedAt: null });
  and.push({ isPublished: true });

  if (characterId) and.push({ characterId });
  if (playStyle) and.push({ playStyle });

  if (minDamage != null) and.push({ damage: { gte: minDamage } });
  if (maxDamage != null) and.push({ damage: { lte: maxDamage } });
  if (maxDrive != null) and.push({ driveCost: { lte: maxDrive } });
  if (maxSuper != null) and.push({ superCost: { lte: maxSuper } });

  if (q) {
    and.push({
      OR: [
        { comboText: { contains: q } },
        { character: { is: { name: { contains: q } } } },
        ...( /^\d+$/.test(q) ? [{ id: Number(q) }] : [] ),
      ],
    });
  }

  // tags フィルタ
  if (tagIds.length > 0 || tagNames.length > 0) {
    const tagConds: Prisma.ComboWhereInput[] = [];

    if (tagIds.length > 0) {
      tagConds.push({
        tags: {
          some: {
            tag: { is: { id: { in: tagIds } } },
          },
        },
      });
    }

    if (tagNames.length > 0) {
      tagConds.push({
        tags: {
          some: {
            tag: { is: { name: { in: tagNames } } },
          },
        },
      });
    }

    if (mode === "or") and.push({ OR: tagConds });
    else and.push({ AND: tagConds });
  }

  const where: Prisma.ComboWhereInput = and.length > 0 ? { AND: and } : {};

  // ===== orderBy =====
  const orderBy =
    sort === "created"
      ? [{ createdAt: dir }, { id: "desc" as const }]
      : sort === "damage"
      ? [{ damage: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : sort === "drive"
      ? [{ driveCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }]
      : [{ superCost: dir }, { createdAt: "desc" as const }, { id: "desc" as const }];

  // 件数→ページ確定
  const total = await prisma.combo.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / take));
  const page = Math.min(pageWanted, totalPages);
  const skip = (page - 1) * take;

  const items = await prisma.combo.findMany({
    where,
    include: {
      character: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    orderBy: orderBy as any,
    skip,
    take,
  });

  // 条件の見える化
  const filterText = [
    `キャラ=${selectedCharacterName ?? "全キャラ"}`,
    `スタイル=${playStyle === "CLASSIC" ? "クラシック" : playStyle === "MODERN" ? "モダン" : "両方"}`,
    `並び替え=${sortLabel(sort, dir)}`,
    q ? `検索="${q}"` : null,
    minDamage != null ? `最小ダメ=${minDamage}` : null,
    maxDamage != null ? `最大ダメ=${maxDamage}` : null,
    maxDrive != null ? `D上限=${maxDrive}` : null,
    maxSuper != null ? `SA上限=${maxSuper}` : null,
    tagsRaw ? `タグ=${tagsRaw}（${mode.toUpperCase()}）` : null,
    `件数=${take}`,
  ]
    .filter(Boolean)
    .join(" / ");

  const pageLink = (p: number) => buildHref("/combos/search", currentParams, { page: String(p) });

  // 0件導線
  const resetHref = "/combos/search";
  const clearQHref = q ? buildHref("/combos/search", currentParams, { q: null, page: "1" }) : null;
  const clearCharHref = characterId
    ? buildHref("/combos/search", currentParams, { characterId: null, page: "1" })
    : null;
  const clearStyleHref = playStyle
    ? buildHref("/combos/search", currentParams, { playStyle: null, page: "1" })
    : null;
  const clearRangesHref =
    minDamage != null || maxDamage != null || maxDrive != null || maxSuper != null
      ? buildHref("/combos/search", currentParams, {
          minDamage: null,
          maxDamage: null,
          maxDrive: null,
          maxSuper: null,
          page: "1",
        })
      : null;
  const clearTagsHref = tagsRaw
    ? buildHref("/combos/search", currentParams, { tags: null, mode: null, page: "1" })
    : null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">コンボ検索</h1>
        <Link href="/combos" className="text-sm text-blue-600 hover:underline">
          一覧へ →
        </Link>
      </div>

      {/* プリセット（②） */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-600">プリセット:</span>
        <Link className="px-2 py-1 border rounded text-xs hover:bg-gray-50" href={presetHref("created", "desc")}>
          新着
        </Link>
        <Link className="px-2 py-1 border rounded text-xs hover:bg-gray-50" href={presetHref("damage", "desc")}>
          高ダメ
        </Link>
        <Link className="px-2 py-1 border rounded text-xs hover:bg-gray-50" href={presetHref("drive", "asc")}>
          低ゲージ（D少）
        </Link>
      </div>

      {/* 人気タグ（③） */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-600">人気タグ:</span>
        {popularTags.map((t) => {
          const active = tagTokenSet.has(t.name.toLowerCase());
          return (
            <Link
              key={t.id}
              href={toggleTagHref(t.name)}
              className={`px-2 py-1 rounded text-xs border hover:bg-gray-50 ${active ? "bg-gray-200" : ""}`}
              title="クリックで追加/解除"
            >
              {t.name} <span className="text-gray-500">({t._count.comboTags})</span>
            </Link>
          );
        })}
      </div>

      {/* フィルタ（GET） */}
      <form action="/combos/search" method="get" className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">検索（q）</label>
          <input
            name="q"
            defaultValue={q}
            className="border rounded px-2 py-1 w-72"
            placeholder="例: 昇竜 / OD / 2弱P / コンボID"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">キャラ（characterId）</label>
          <select
            name="characterId"
            defaultValue={characterId ? String(characterId) : ""}
            className="border rounded px-2 py-1"
          >
            <option value="">全キャラ</option>
            {characters.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">スタイル（playStyle）</label>
          <select name="playStyle" defaultValue={playStyle ?? ""} className="border rounded px-2 py-1">
            <option value="">両方</option>
            <option value="CLASSIC">クラシック</option>
            <option value="MODERN">モダン</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">最小ダメ</label>
          <input name="minDamage" defaultValue={minDamage ?? ""} className="border rounded px-2 py-1 w-28" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">最大ダメ</label>
          <input name="maxDamage" defaultValue={maxDamage ?? ""} className="border rounded px-2 py-1 w-28" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">D上限</label>
          <input name="maxDrive" defaultValue={maxDrive ?? ""} className="border rounded px-2 py-1 w-24" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">SA上限</label>
          <input name="maxSuper" defaultValue={maxSuper ?? ""} className="border rounded px-2 py-1 w-24" />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">タグ（tags）</label>
          <input
            name="tags"
            defaultValue={tagsRaw}
            className="border rounded px-2 py-1 w-56"
            placeholder="例: 起き攻め, 端, 1 (IDも可)"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">タグ結合（mode）</label>
          <select name="mode" defaultValue={mode} className="border rounded px-2 py-1">
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">並び替え（sort）</label>
          <select name="sort" defaultValue={sort} className="border rounded px-2 py-1">
            <option value="created">作成日</option>
            <option value="damage">ダメージ</option>
            <option value="drive">Dゲージ</option>
            <option value="super">SAゲージ</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">方向（dir）</label>
          <select name="dir" defaultValue={dir} className="border rounded px-2 py-1">
            <option value="desc">降順</option>
            <option value="asc">昇順</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">件数（take）</label>
          <select name="take" defaultValue={String(take)} className="border rounded px-2 py-1">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>

        <input type="hidden" name="page" value="1" />

        <button className="border rounded px-3 py-1 bg-white" type="submit">
          適用
        </button>

        <Link href={resetHref} className="text-sm text-blue-600 hover:underline">
          リセット
        </Link>
      </form>

      <div className="text-sm text-gray-700">条件: {filterText}</div>
      <div className="text-sm text-gray-700">
        {total} 件 / {page} / {totalPages}
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">キャラ</th>
              <th className="p-2 text-left">スタイル</th>
              <th className="p-2 text-left">始動</th>
              <th className="p-2 text-left">コンボ</th>
              <th className="p-2 text-left">作成日</th>
              <th className="p-2 text-left">ダメ</th>
              <th className="p-2 text-left">D</th>
              <th className="p-2 text-left">SA</th>
              <th className="p-2 text-left">タグ</th>
              <th className="p-2 text-center">詳細</th>
            </tr>
          </thead>

          <tbody>
            {items.map((c) => {
              const tags = c.tags?.map((t) => t.tag.name) ?? [];
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.character?.name ?? "-"}</td>
                  <td className="p-2">{c.playStyle}</td>
                  <td className="p-2 font-bold">{starterFromComboText(c.comboText ?? "")}</td>
                  <td className="p-2 max-w-[520px]">
                    <div
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as any,
                        overflow: "hidden",
                      }}
                    >
                      {c.comboText}
                    </div>
                  </td>
                  <td className="p-2">{new Date(c.createdAt).toLocaleDateString("ja-JP")}</td>
                  <td className="p-2 font-bold">{c.damage ?? "-"}</td>
                  <td className="p-2">{c.driveCost ?? 0}</td>
                  <td className="p-2">{c.superCost ?? 0}</td>
                  <td className="p-2 space-x-1">
                    {tags.slice(0, 4).map((name) => (
                      <span key={name} className="inline-block bg-gray-200 px-2 py-1 rounded text-xs">
                        {name}
                      </span>
                    ))}
                    {tags.length > 4 && <span className="text-xs text-gray-500">+{tags.length - 4}</span>}
                  </td>
                  <td className="p-2 text-center">
                    <Link className="text-blue-600 hover:underline" href={`/combos/${c.id}`}>
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-600 space-y-2">
                  <div>条件に一致するコンボがありません。</div>
                  <div className="flex flex-wrap justify-center gap-3 text-sm">
                    <Link className="text-blue-600 hover:underline" href={resetHref}>
                      条件をリセット
                    </Link>
                    {clearQHref && (
                      <Link className="text-blue-600 hover:underline" href={clearQHref}>
                        検索語を消す
                      </Link>
                    )}
                    {clearCharHref && (
                      <Link className="text-blue-600 hover:underline" href={clearCharHref}>
                        キャラ条件を外す
                      </Link>
                    )}
                    {clearStyleHref && (
                      <Link className="text-blue-600 hover:underline" href={clearStyleHref}>
                        スタイル条件を外す
                      </Link>
                    )}
                    {clearRangesHref && (
                      <Link className="text-blue-600 hover:underline" href={clearRangesHref}>
                        数値条件を外す
                      </Link>
                    )}
                    {clearTagsHref && (
                      <Link className="text-blue-600 hover:underline" href={clearTagsHref}>
                        タグ条件を外す
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={pageLink(Math.max(1, page - 1))}
          className={`px-3 py-1 border rounded ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
        >
          前へ
        </Link>

        <span className="text-sm text-gray-700">
          {page} / {totalPages}
        </span>

        <Link
          href={pageLink(Math.min(totalPages, page + 1))}
          className={`px-3 py-1 border rounded ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        >
          次へ
        </Link>
      </div>
    </div>
  );
}
