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

  // 共通ボタン（必殺技以外）
  const commonButtons = {
    actions: ["弱", "中", "強", "P", "K", "J", "DR", "DI", "CR", "OD", "SA", "A", "＞"],
    numpad: ["7", "8", "9", "4", "6", "1", "2", "3"], // 5は除外
  };

  // API: キャラ一覧
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/characters");
      setCharacters(await res.json());
    })();
  }, []);

  // API: 技一覧
  useEffect(() => {
    if (!selectedCharacter) return;
    (async () => {
      const res = await fetch(`/api/moves/${selectedCharacter}`);
      setMoves(await res.json());
    })();
  }, [selectedCharacter]);

  // 追加：ボタン押したら「名前そのまま」追加（＞は自動付与しない）
  const add = (name: string) => {
    setComboText((prev) => (prev ? prev + " " + name : name));
  };

  // 追加：最後の要素だけ消す（削除）
  const deleteLast = () => {
    const parts = comboText.trim().split(" ");
    parts.pop();
    setComboText(parts.join(" "));
  };

  // 追加：全クリア
  const clearAll = () => {
    setComboText("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>コンボ入力画面（改良版）</h1>

      {/* キャラ選択 */}
      <div style={{ marginBottom: "20px" }}>
        <label>キャラ：</label>
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

      {/* 必殺技 */}
      {moves.length > 0 && (
        <>
          <h2>必殺技</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {moves.map((m) => (
              <button key={m.id} onClick={() => add(m.name)}>
                {m.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 共通ボタン */}
      <h2 style={{ marginTop: "20px" }}>共通ボタン</h2>

      {/* 技ボタン（弱中強・P・K・DR など） */}
      <div style={{ marginBottom: "15px" }}>
        <h3>攻撃 / 操作 / 状態</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {commonButtons.actions.map((b) => (
            <button key={b} onClick={() => add(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* テンキー */}
      <h3>テンキー入力</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 40px)",
          gap: "6px",
          width: "130px",
        }}
      >
        <button onClick={() => add("7")}>7</button>
        <button onClick={() => add("8")}>8</button>
        <button onClick={() => add("9")}>9</button>

        <button onClick={() => add("4")}>4</button>
        <div></div>
        <button onClick={() => add("6")}>6</button>

        <button onClick={() => add("1")}>1</button>
        <button onClick={() => add("2")}>2</button>
        <button onClick={() => add("3")}>3</button>
      </div>

      {/* コンボ入力 */}
      <div style={{ marginTop: "30px" }}>
        <h2>コンボ</h2>

        {/* 削除ボタン・クリアボタン */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button onClick={deleteLast}>最後を削除</button>
          <button onClick={clearAll}>全消去</button>
        </div>

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
