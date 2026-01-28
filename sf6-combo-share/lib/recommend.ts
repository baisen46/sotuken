import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type RecommendParams = {
  take: number;
  skip: number;
  dir?: "asc" | "desc"; // 基本 desc 推奨
  characterId?: number | null;
  q?: string | null; // combo_text 部分一致 or タグ名 部分一致
  tagIds?: number[]; // Tag.id の配列
  tagMode?: "and" | "or"; // デフォ: and
  minDamage?: number | null;
  maxDamage?: number | null;
  maxDrive?: number | null;
  maxSuper?: number | null;
};

export async function getRecommendOrderedIds(params: RecommendParams) {
  const {
    take,
    skip,
    dir = "desc",
    characterId,
    q,
    tagIds = [],
    tagMode = "and",
    minDamage,
    maxDamage,
    maxDrive,
    maxSuper,
  } = params;

  const m = 10; // ベイズの最低票数
  const like = q?.trim() ? `%${q.trim()}%` : null;

  const whereParts: Prisma.Sql[] = [Prisma.sql`1=1`];

  if (characterId != null && Number.isFinite(characterId)) {
    whereParts.push(Prisma.sql`c.character_id = ${characterId}`);
  }

  if (minDamage != null && Number.isFinite(minDamage)) {
    whereParts.push(Prisma.sql`c.damage IS NOT NULL AND c.damage >= ${minDamage}`);
  }
  if (maxDamage != null && Number.isFinite(maxDamage)) {
    whereParts.push(Prisma.sql`c.damage IS NOT NULL AND c.damage <= ${maxDamage}`);
  }
  if (maxDrive != null && Number.isFinite(maxDrive)) {
    whereParts.push(Prisma.sql`c.drive_cost <= ${maxDrive}`);
  }
  if (maxSuper != null && Number.isFinite(maxSuper)) {
    whereParts.push(Prisma.sql`c.super_cost <= ${maxSuper}`);
  }

  if (like) {
    // combo_text 部分一致 OR タグ名 部分一致（EXISTSで重複JOIN回避）
    whereParts.push(Prisma.sql`
      (
        c.combo_text LIKE ${like}
        OR EXISTS (
          SELECT 1
          FROM combo_tags ctq
          JOIN tags tq ON tq.id = ctq.tag_id
          WHERE ctq.combo_id = c.id
            AND tq.name LIKE ${like}
        )
      )
    `);
  }

  if (tagIds.length > 0) {
    const inList = Prisma.join(tagIds);

    if (tagMode === "or") {
      whereParts.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM combo_tags ct2
          WHERE ct2.combo_id = c.id
            AND ct2.tag_id IN (${inList})
        )
      `);
    } else {
      // and: 指定タグを全部持つ
      whereParts.push(Prisma.sql`
        (
          SELECT COUNT(DISTINCT ct2.tag_id)
          FROM combo_tags ct2
          WHERE ct2.combo_id = c.id
            AND ct2.tag_id IN (${inList})
        ) = ${tagIds.length}
      `);
    }
  }

  const whereSql = Prisma.sql`WHERE ${Prisma.join(whereParts, Prisma.sql` AND `)}`;
  const dirSql = Prisma.raw(dir === "asc" ? "ASC" : "DESC");

  // total
  const totalRow = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM combos c
    ${whereSql}
  `);
  const total = Number(totalRow?.[0]?.total ?? 0);

  // score:
  // - rating はベイズ平均
  // - fav/comment はログで軽く加点
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT
      c.id
    FROM combos c
    LEFT JOIN (
      SELECT combo_id, COUNT(*) AS v, AVG(value) AS avg_value
      FROM ratings
      GROUP BY combo_id
    ) rc ON rc.combo_id = c.id
    LEFT JOIN (
      SELECT combo_id, COUNT(*) AS fav_count
      FROM favorites
      GROUP BY combo_id
    ) fc ON fc.combo_id = c.id
    LEFT JOIN (
      SELECT combo_id, COUNT(*) AS comment_count
      FROM comments
      GROUP BY combo_id
    ) cc ON cc.combo_id = c.id
    CROSS JOIN (
      SELECT COALESCE(AVG(value), 0) AS C
      FROM ratings
    ) gs
    ${whereSql}
    ORDER BY
      (COALESCE(rc.v, 0) = 0) ASC, -- 無評価は下へ
      (
        (COALESCE(rc.v,0) / (COALESCE(rc.v,0) + ${m})) * COALESCE(rc.avg_value,0)
        + (${m} / (COALESCE(rc.v,0) + ${m})) * gs.C
        + 0.05 * LOG(1 + COALESCE(fc.fav_count,0))
        + 0.02 * LOG(1 + COALESCE(cc.comment_count,0))
      ) ${dirSql},
      COALESCE(rc.v,0) DESC,
      c.created_at DESC,
      c.id DESC
    LIMIT ${take} OFFSET ${skip}
  `);

  const orderedIds = rows.map((r) => r.id);
  return { orderedIds, total };
}
