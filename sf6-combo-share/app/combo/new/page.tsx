"use client";

import { useEffect, useState } from "react";

type Move = {
  id: number;
  name: string;
};

type Character = {
  id: number;
  name: string;
};

export default function ComboInputPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [comboText, setComboText] = useState<string>("");

  // キャラ一覧取得
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/characters");
      const data = await res.json();
      setCharacters(data);
    })();
  }, []);

  // キャラ選択時 → 技取得
  useEffect(() => {
    if (!selectedCharacter) return;

    (async () => {
      const res = await fetch(`/api/moves/${selectedCharacter}`);
      const data = await res.json();
      setMoves(data);
    })();
  }, [selectedCharacter]);

  // 技をコンボテキストに追加
  const addMove = (name: string) => {
    setComboText((prev) => (prev ? prev + " > " + name : name));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>コンボ入力画面（β）</h1>

      {/* キャラ選択 */}
      <div style={{ marginBottom: "20px" }}>
        <label>キャラクター：</label>
        <select
          value={selectedCharacter ?? ""}
          onChange={(e) => setSelectedCharacter(Number(e.target.value))}
        >
          <option value="">選択してください</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 技ボタン一覧 */}
      {moves.length > 0 && (
        <div>
          <h2>技一覧</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {moves.map((m) => (
              <button key={m.id} onClick={() => addMove(m.name)}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* コンボテキスト */}
      <div style={{ marginTop: "30px" }}>
        <h2>コンボ</h2>
        <textarea
          value={comboText}
          onChange={(e) => setComboText(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
