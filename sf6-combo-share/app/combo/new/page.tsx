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

export default function ComboInputPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);

  // ▼ 入力履歴（配列管理）
  const [history, setHistory] = useState<string[]>([]);

  // ▼ コンボテキスト（履歴から自動生成）
  const comboText = history.join(" ");

  // ▼ ダメージ入力
  const [damage, setDamage] = useState<string>("");

  // ▼ 操作タイプ
  const [playStyle, setPlayStyle] = useState<"モダン" | "クラシック">("モダン");

  // ▼ 並び替え用 ref
  const listRef = useRef<HTMLDivElement>(null);

  // ▼ API: キャラ一覧
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/characters");
      setCharacters(await res.json());
    })();
  }, []);

  // ▼ API: 必殺技一覧
  useEffect(() => {
    if (!selectedCharacter) return;
    (async () => {
      const res = await fetch(`/api/moves/${selectedCharacter}`);
      setMoves(await res.json());
    })();
  }, [selectedCharacter]);

  // ▼ ボタン入力 → 配列に追加
  const add = (name: string) => {
    setHistory((prev) => [...prev, name]);
  };

  // ▼ 最後だけ削除
  const deleteLast = () => {
    setHistory((prev) => prev.slice(0, -1));
  };

  // ▼ 全消去
  const clearAll = () => setHistory([]);

  // ▼ 並び替え（SortableJS）
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

  // ▼ ボタン共通デザイン
  const commonButton = {
    padding: "10px 14px",
    minWidth: "40px",
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

  // ▼ テンキー（5追加）
  const numpad = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

  // ▼ その他ボタン（＞ は弱中強横へ移動したので消す）
  const actionButtons = ["DR", "DI", "CR", "OD", "SA", "A"];

  return (
    <div style={{ padding: "20px" }}>
      <h1>コンボ入力画面（完全強化版）</h1>

      {/* キャラ選択 */}
      <div style={{ marginBottom: "10px" }}>
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

      {/* 操作タイプ */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ marginRight: "8px" }}>操作タイプ：</label>
        <button
          onClick={() => setPlayStyle("モダン")}
          style={{
            ...commonButton,
            border: playStyle === "モダン" ? "2px solid blue" : "1px solid gray",
          }}
        >
          モダン
        </button>
        <button
          onClick={() => setPlayStyle("クラシック")}
          style={{
            ...commonButton,
            marginLeft: "10px",
            border: playStyle === "クラシック" ? "2px solid blue" : "1px solid gray",
          }}
        >
          クラシック
        </button>
      </div>

      {/* メインレイアウト */}
      <div style={{ display: "flex", gap: "20px" }}>
        
        {/* テンキー */}
        <div>
          <h3>テンキー</h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 45px)",
            gap: "6px",
          }}>
            {numpad.map((num) => (
              <button key={num} onClick={() => add(num)} style={commonButton}>
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* 弱中強 + P K + ＞ + 状態＆属性 */}
        <div>

          <h3>攻撃 / 操作</h3>

          {/* 弱 中 強 ＞ */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            {circle("弱", "#7bd2ff")}
            {circle("中", "#ffe680")}
            {circle("強", "#ff7b7b")}
            {circle(">", "white")}
          </div>

          {/* P K （丸ボタン） */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            {circle("P", "#7bb7ff")}
            {circle("K", "#89ff8d")}
          </div>

          {/* その他のボタン */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {actionButtons.map((b) => (
              <button key={b} onClick={() => add(b)} style={commonButton}>
                {b}
              </button>
            ))}
          </div>

          {/* 状態 */}
          <h3 style={{ marginTop: "20px" }}>ヒット状況</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {["ノーマル", "カウンター", "パニッシュカウンター", "フォースダウン"].map((h) => (
              <button
                key={h}
                onClick={() => add(h)}
                style={commonButton}
              >
                {h}
              </button>
            ))}
          </div>

          {/* 属性 */}
          <h3 style={{ marginTop: "20px" }}>属性</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {["ダメージ重視", "起き攻め重視", "運び重視"].map((a) => (
              <button
                key={a}
                onClick={() => add(a)}
                style={commonButton}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* 必殺技 */}
        <div>
          <h3>必殺技</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", width: "220px" }}>
            {moves.map((m) => (
              <button key={m.id} onClick={() => add(m.name)} style={commonButton}>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ダメージ入力 */}
      <div style={{ marginTop: "20px" }}>
        <h3>ダメージ</h3>
        <input
          type="number"
          value={damage}
          onChange={(e) => setDamage(e.target.value)}
          style={{ width: "120px", padding: "6px" }}
        />
      </div>

      {/* 入力履歴（並び替え対応） */}
      <div style={{ marginTop: "30px" }}>
        <h2>入力履歴（並び替え・削除可）</h2>

        <div
          ref={listRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            padding: "10px",
            border: "1px solid #ccc",
            minHeight: "60px",
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
              {item}
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

        {/* 最後削除・全消去 */}
        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          <button onClick={deleteLast}>最後を削除</button>
          <button onClick={clearAll}>全消去</button>
        </div>
      </div>

      {/* コンボ表示 */}
      <div style={{ marginTop: "30px" }}>
        <h2>コンボテキスト</h2>
        <textarea
          value={comboText}
          readOnly
          rows={4}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
