"use client";

import { useEffect, useState } from "react";

type Combo = {
  id: number;
  character: { name: string };
  playStyle: "MODERN" | "CLASSIC";
  damage: number | null;
  comboText: string;
  createdAt: string;
};

export default function ComboListPage() {
  const [combos, setCombos] = useState<Combo[]>([]);

useEffect(() => {
  const load = async () => {
    const res = await fetch("/api/combos/list", { cache: "no-store" });
    const data = await res.json();

    if (Array.isArray(data)) {
      setCombos(data);
    } else {
      console.error("API から配列が返ってきませんでした:", data);
      setCombos([]); // 空配列で扱う
    }
  };
  load();
}, []);


  const box = {
    border: "1px solid #ccc",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "10px",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1>コンボ一覧</h1>

      {combos.length === 0 && <p>投稿されたコンボがありません。</p>}

      {combos.map((c) => (
        <div
          key={c.id}
          style={box}
          onClick={() => (window.location.href = `/combos/${c.id}`)}
        >
          <h3>
            {c.character.name}（{c.playStyle === "MODERN" ? "モダン" : "クラシック"}）
          </h3>

          <p style={{ margin: "4px 0" }}>
            <strong>ダメージ：</strong>
            {c.damage ?? "-"}
          </p>

          <p style={{ margin: "4px 0" }}>
            <strong>コンボ：</strong>
            {c.comboText}
          </p>

          <p style={{ margin: "4px 0", fontSize: "12px", color: "#666" }}>
            投稿日：{new Date(c.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
