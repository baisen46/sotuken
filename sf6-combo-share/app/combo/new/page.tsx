"use client";

import { useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";

type Move = {
  id: number;
  name: string;
};

type Character = {
  id: number;
  name: string;
};

type StepItem = {
  label: string;
  moveId: number | null;
  attributeId: number | null;
};

export default function ComboInputPage() {
  // ▼ キャラ
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);

  // ▼ 必殺技
  const [moves, setMoves] = useState<Move[]>([]);

  // ▼ 履歴は構造化
  const [history, setHistory] = useState<StepItem[]>([]);

  // ▼ コンボテキスト
  const comboText = history.map((h) => h.label).join(" ");

  // ▼ ダメージ
  const [damage, setDamage] = useState<string>("");

  // ▼ 操作タイプ
  const [playStyle, setPlayStyle] = useState<"モダン" | "クラシック">("モダン");

  // ▼ ヒット状況
  const hitOptions = ["ノーマル", "カウンター", "パニッシュカウンター", "フォースダウン"] as const;
  const [hitType, setHitType] = useState<string>("ノーマル");

  // ▼ 属性（折りたたみ）
  const [attrOpen, setAttrOpen] = useState(false);
  const attributeOptions = ["ダメージ重視", "起き攻め重視", "運び重視"];
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  const toggleAttribute = (attr: string) => {
    setSelectedAttributes((prev) =>
      prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]
    );
  };

  const listRef = useRef<HTMLDivElement>(null);

  // ▼ キャラ一覧取得
  useEffect(() => {
    const loadCharacters = async () => {
      const res = await fetch("/api/characters", { cache: "no-store" });
      const data = await res.json();
      setCharacters(data);
    };
    loadCharacters();
  }, []);

  // ▼ 必殺技取得
  useEffect(() => {
    if (!selectedCharacter) return;

    (async () => {
      const res = await fetch(`/api/moves/${selectedCharacter}`);
      const data = await res.json();
      setMoves(data);
    })();
  }, [selectedCharacter]);

  // ▼ 通常技　→ moveId: null
  const add = (label: string) => {
    setHistory((prev) => [...prev, { label, moveId: null, attributeId: null }]);
  };

  // ▼ 必殺技　→ moveId あり
  const addMove = (move: Move) => {
    setHistory((prev) => [
      ...prev,
      { label: move.name, moveId: move.id, attributeId: null },
    ]);
  };

  const deleteLast = () => setHistory((prev) => prev.slice(0, -1));
  const clearAll = () => setHistory([]);

  // ▼ 並び替え
  useEffect(() => {
    if (!listRef.current) return;

    Sortable.create(listRef.current, {
      animation: 150,
      onEnd: (evt) => {
        setHistory((prev) => {
          const arr = [...prev];
          const [moved] = arr.splice(evt.oldIndex!, 1);
          arr.splice(evt.newIndex!, 0, moved);
          return arr;
        });
      },
    });
  }, []);

  // ▼ 共通ボタンスタイル
  const commonButton = {
    padding: "10px 14px",
    minWidth: "60px",
    height: "40px",
    borderRadius: "6px",
    border: "1px solid gray",
    background: "white",
    cursor: "pointer",
  } as const;

  // ▼ 丸ボタン
  const circle = (label: string, bg: string) => (
    <button
      onClick={() => add(label)}
      style={{
        width: "55px",
        height: "55px",
        borderRadius: "50%",
        background: bg,
        border: "1px solid gray",
        fontSize: "20px",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const numpad = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
  const actionButtons = ["J", "DR", "DI", "OD", "SA", "A"]; // ← J を復活

  // ▼ コンボ保存
  const saveCombo = async () => {
    if (!selectedCharacter) {
      alert("キャラを選んでください");
      return;
    }

    const steps = history.map((item, index) => ({
      order: index + 1,
      moveId: item.moveId,
      attributeId: item.attributeId,
      note: item.moveId ? null : item.label,
    }));

    const body = {
      userId: 1,
      characterId: selectedCharacter,
      conditionId: 1,
      attributeId: 1,
      playStyle: playStyle === "モダン" ? "MODERN" : "CLASSIC",
      comboText,
      damage: Number(damage) || null,
      steps,
      tags: [],
    };

    const res = await fetch("/api/combos/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log("SAVE RESULT:", data);

    if (data.success) {
      alert("保存成功！");
    } else {
      alert("エラー: " + JSON.stringify(data));
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1500px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "10px" }}>コンボ入力画面（完全強化版）</h1>

      {/* 上段 UI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 200px 200px 260px",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        {/* キャラ */}
        <div>
          <label>キャラ：</label>
          <select
            value={selectedCharacter ?? ""}
            onChange={(e) => setSelectedCharacter(Number(e.target.value))}
            style={{ padding: "6px", width: "200px" }}
          >
            <option value="">選択してください</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 操作タイプ */}
        <div>
          <label>操作タイプ：</label>
          <select
            value={playStyle}
            onChange={(e) => setPlayStyle(e.target.value as any)}
            style={{ padding: "6px", width: "160px" }}
          >
            <option value="モダン">モダン</option>
            <option value="クラシック">クラシック</option>
          </select>
        </div>

        {/* ヒット状況 */}
        <div>
          <label>ヒット状況：</label>
          <select
            value={hitType}
            onChange={(e) => add(e.target.value)}
            style={{ padding: "6px", width: "180px" }}
          >
            {hitOptions.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* 属性 */}
        <div>
          <label>属性：</label>
          <div>
            <button
              onClick={() => setAttrOpen(!attrOpen)}
              style={{
                padding: "6px 14px",
                border: "1px solid gray",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                width: "180px",
              }}
            >
              {selectedAttributes.length === 0
                ? "選択してください"
                : selectedAttributes.join(", ")}
            </button>

            {attrOpen && (
              <div
                style={{
                  border: "1px solid #ccc",
                  padding: "10px",
                  marginTop: "6px",
                  borderRadius: "6px",
                  background: "#fafafa",
                }}
              >
                {attributeOptions.map((attr) => (
                  <label key={attr} style={{ display: "block", marginBottom: "6px" }}>
                    <input
                      type="checkbox"
                      checked={selectedAttributes.includes(attr)}
                      onChange={() => {
                        toggleAttribute(attr);
                        add(attr);
                      }}
                      style={{ marginRight: "6px" }}
                    />
                    {attr}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メイン UI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 400px 1fr",
          gap: "25px",
          marginBottom: "240px",
        }}
      >
        {/* テンキー */}
        <div style={{ border: "1px solid #ccc", padding: "12px", borderRadius: "8px" }}>
          <h3>テンキー</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 60px)",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            {numpad.map((num) => (
              <button key={num} onClick={() => add(num)} style={commonButton}>
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* 攻撃ボタン */}
        <div style={{ border: "1px solid #ccc", padding: "12px", borderRadius: "8px" }}>
          <h3>攻撃ボタン</h3>

          <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
            {circle("弱", "#7bd2ff")}
            {circle("中", "#ffe680")}
            {circle("強", "#ff7b7b")}
            {circle(">", "white")}
          </div>

          {/* LP〜HK */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 80px)",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <button onClick={() => add("弱P")} style={commonButton}>弱P</button>
            <button onClick={() => add("中P")} style={commonButton}>中P</button>
            <button onClick={() => add("強P")} style={commonButton}>強P</button>

            <button onClick={() => add("弱K")} style={commonButton}>弱K</button>
            <button onClick={() => add("中K")} style={commonButton}>中K</button>
            <button onClick={() => add("強K")} style={commonButton}>強K</button>
          </div>

          {/* DR / DI / OD / SA / A / J → 横1列 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 60px)",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {actionButtons.map((b) => (
              <button
                key={b}
                onClick={() => add(b)}
                style={{
                  padding: "6px",
                  width: "60px",
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid gray",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                {b}
              </button>
            ))}
          </div>

          {/* ダメージ */}
          <h4>ダメージ</h4>
          <input
            type="number"
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
            style={{
              padding: "6px",
              width: "120px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          />
        </div>

        {/* 必殺技 */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "12px",
            borderRadius: "8px",
            maxHeight: "330px",
            overflowY: "auto",
          }}
        >
          <h3>必殺技</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
            {moves.map((m) => (
              <button key={m.id} onClick={() => addMove(m)} style={commonButton}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 入力履歴（固定） */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: "white",
          borderTop: "2px solid #ccc",
          padding: "12px 20px",
          boxShadow: "0 -2px 6px rgba(0,0,0,0.15)",
        }}
      >
        <h3>入力履歴</h3>

        <div
          ref={listRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            minHeight: "40px",
          }}
        >
          {history.map((item, index) => (
            <div
              key={index}
              style={{
                padding: "6px 10px",
                border: "1px solid gray",
                borderRadius: "6px",
                background: "#f9f9f9",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "grab",
              }}
            >
              {item.label}

              <button
                onClick={() =>
                  setHistory(history.filter((_, i) => i !== index))
                }
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <button onClick={deleteLast} style={commonButton}>最後を削除</button>
          <button onClick={clearAll} style={commonButton}>全消去</button>

          {/* コンボ保存 */}
          <button
            onClick={saveCombo}
            style={{
              ...commonButton,
              background: "#def0ff",
              border: "2px solid #57a3ff",
              fontWeight: "bold",
              marginLeft: "20px",
            }}
          >
            コンボ保存
          </button>
        </div>
      </div>
    </div>
  );
}
