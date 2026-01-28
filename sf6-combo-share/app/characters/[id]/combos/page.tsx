import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CharacterCombosPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/combos/search?characterId=${id}`);
}
