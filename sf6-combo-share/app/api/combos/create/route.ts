import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type StepInput = {
  order: number;
  moveId: number | null;
  attributeId: number | null;
  note: string | null;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const characterId = Number(body.characterId);
    const conditionId = Number(body.conditionId);
    const attributeId = body.attributeId === null || body.attributeId === undefined ? null : Number(body.attributeId);
    const playStyle = body.playStyle; // "MODERN" | "CLASSIC"
    const comboText = String(body.comboText ?? "");
    const damage = body.damage === null || body.damage === undefined ? null : Number(body.damage);
    const frame = body.frame === null || body.frame === undefined ? null : Number(body.frame);
    const driveCost = Number(body.driveCost ?? 0);
    const superCost = Number(body.superCost ?? 0);
    const description = body.description === null || body.description === undefined ? null : String(body.description);

    const steps: StepInput[] = Array.isArray(body.steps) ? body.steps : [];
    const tags: string[] = Array.isArray(body.tags) ? body.tags.filter((t: any) => typeof t === "string" && t.trim() !== "") : [];

    // 基本バリデーション
    if (!Number.isFinite(characterId) || characterId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid characterId" }, { status: 400 });
    }
    if (!Number.isFinite(conditionId) || conditionId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid conditionId" }, { status: 400 });
    }
    if (attributeId !== null && (!Number.isFinite(attributeId) || attributeId <= 0)) {
      return NextResponse.json({ success: false, error: "Invalid attributeId" }, { status: 400 });
    }
    if (playStyle !== "MODERN" && playStyle !== "CLASSIC") {
      return NextResponse.json({ success: false, error: "Invalid playStyle" }, { status: 400 });
    }
    if (!comboText.trim()) {
      return NextResponse.json({ success: false, error: "comboText is empty" }, { status: 400 });
    }
    if (damage !== null && (!Number.isFinite(damage) || damage < 0)) {
      return NextResponse.json({ success: false, error: "Invalid damage" }, { status: 400 });
    }
    if (frame !== null && !Number.isFinite(frame)) {
      return NextResponse.json({ success: false, error: "Invalid frame" }, { status: 400 });
    }

    // タグ upsert（日本語でもOK。Tag.name が unique 前提）
    const uniqTags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));

    const tagIds: number[] = [];
    for (const name of uniqTags) {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
        select: { id: true },
      });
      tagIds.push(tag.id);
    }

    const created = await prisma.combo.create({
      data: {
        userId: user.id,
        characterId,
        conditionId,
        attributeId,
        playStyle,
        comboText,
        damage,
        frame, // ★ 追加：完走後フレーム（不利も可）
        description,
        driveCost: Number.isFinite(driveCost) ? Math.max(0, driveCost) : 0,
        superCost: Number.isFinite(superCost) ? Math.max(0, superCost) : 0,

        steps: {
          create: steps.map((s) => ({
            order: Number(s.order),
            moveId: s.moveId === null || s.moveId === undefined ? null : Number(s.moveId),
            attributeId: s.attributeId === null || s.attributeId === undefined ? null : Number(s.attributeId),
            note: s.note === null || s.note === undefined ? null : String(s.note),
          })),
        },

        tags: {
          create: tagIds.map((id) => ({
            tag: { connect: { id } },
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, comboId: created.id });
  } catch (error) {
    console.error("POST /api/combos/create error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
