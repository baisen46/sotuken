import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CharacterCombosPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // 不正値ガード（"abc" とかを弾く）
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    redirect("/combos/search");
  }

  redirect(`/combos/search?characterId=${encodeURIComponent(String(n))}`);
}
