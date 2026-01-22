import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ComboSortKey = "created" | "damage" | "drive" | "super";
export type SortDir = "asc" | "desc";

export type ComboListQuery = {
  characterId?: number;
  page?: number; // 1-based
  take?: number;
  sort?: ComboSortKey;
  dir?: SortDir;
};

export type ComboListItem = Prisma.ComboGetPayload<{
  include: {
    character: { select: { id: true; name: true } };
    condition: { select: { type: true; description: true } };
    attribute: { select: { type: true; description: true } };
    tags: { include: { tag: true } };
    steps: {
      take: 1;
      orderBy: { order: "asc" };
      include: { move: { select: { id: true; name: true; input: true } } };
    };
  };
}>;

export type ComboListResult = {
  items: ComboListItem[];
  total: number;
  page: number;
  take: number;
  pages: number;
  sort: ComboSortKey;
  dir: SortDir;
};

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function parseComboListSearchParams(
  sp: Record<string, string | string[] | undefined>
): Pick<ComboListQuery, "page" | "take" | "sort" | "dir"> {
  const page = clampInt(Number(firstString(sp.page) ?? "1"), 1, 1000000);
  const take = clampInt(Number(firstString(sp.take) ?? "50"), 1, 200);

  const sortRaw = firstString(sp.sort) ?? "created";
  const sort: ComboSortKey =
    sortRaw === "damage" || sortRaw === "drive" || sortRaw === "super"
      ? sortRaw
      : "created";

  const dirRaw = firstString(sp.dir) ?? "desc";
  const dir: SortDir = dirRaw === "asc" ? "asc" : "desc";

  return { page, take, sort, dir };
}

function buildOrderBy(
  sort: ComboSortKey,
  dir: SortDir
): Prisma.ComboOrderByWithRelationInput[] {
  if (sort === "created") return [{ createdAt: dir }, { id: "desc" }];
  if (sort === "damage") return [{ damage: dir }, { createdAt: "desc" }, { id: "desc" }];
  if (sort === "drive") return [{ driveCost: dir }, { createdAt: "desc" }, { id: "desc" }];
  return [{ superCost: dir }, { createdAt: "desc" }, { id: "desc" }];
}

export async function queryComboList(q: ComboListQuery): Promise<ComboListResult> {
  const page = q.page ?? 1;
  const take = q.take ?? 50;
  const sort: ComboSortKey = q.sort ?? "created";
  const dir: SortDir = q.dir ?? "desc";

  const where: Prisma.ComboWhereInput = {};
  if (q.characterId != null) where.characterId = q.characterId;

  const skip = (page - 1) * take;

  const include = {
    character: { select: { id: true, name: true } },
    condition: { select: { type: true, description: true } },
    attribute: { select: { type: true, description: true } },
    tags: { include: { tag: true } },
    steps: {
      take: 1,
      orderBy: { order: "asc" as const },
      include: { move: { select: { id: true, name: true, input: true } } },
    },
  } as const;

  const orderBy = buildOrderBy(sort, dir);

  const [total, items] = await prisma.$transaction([
    prisma.combo.count({ where }),
    prisma.combo.findMany({ where, include, orderBy, skip, take }),
  ]);

  const pages = Math.max(1, Math.ceil(total / take));
  const safePage = Math.min(page, pages);

  return {
    items,
    total,
    page: safePage,
    take,
    pages,
    sort,
    dir,
  };
}
