import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type SP = SearchParams | Promise<SearchParams>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function setIf(usp: URLSearchParams, key: string, value: string | undefined) {
  if (value == null) return;
  const v = value.trim();
  if (v === "") return;
  usp.set(key, v);
}

export default async function CharacterCombosPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: SP;
}) {
  const { id } = await props.params;

  // 不正値ガード（"abc" とかを弾く）
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    redirect("/combos/search");
  }

  // searchParams は Promise の可能性があるので unwrap
  const sp: SearchParams = await Promise.resolve(props.searchParams ?? {});

  // /combos/search 側が受ける統一キーを引き継ぐ
  const usp = new URLSearchParams();

  // 固定：選択キャラ
  usp.set("characterId", String(n));

  // 引き継ぎ（統一キー）
  setIf(usp, "q", first(sp, "q"));
  setIf(usp, "playStyle", first(sp, "playStyle"));
  setIf(usp, "sort", first(sp, "sort"));
  setIf(usp, "dir", first(sp, "dir"));
  setIf(usp, "take", first(sp, "take"));

  // 拡張フィルタ（存在しても害はない）
  setIf(usp, "minDamage", first(sp, "minDamage"));
  setIf(usp, "maxDamage", first(sp, "maxDamage"));
  setIf(usp, "maxDrive", first(sp, "maxDrive"));
  setIf(usp, "maxSuper", first(sp, "maxSuper"));
  setIf(usp, "tags", first(sp, "tags"));
  setIf(usp, "mode", first(sp, "mode"));

  // キャラを変えたら基本は1ページ目に戻す
  usp.set("page", "1");

  redirect(`/combos/search?${usp.toString()}`);
}
