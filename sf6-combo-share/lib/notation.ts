// sf6-combo-share/lib/notation.ts

export const META_TOKENS = new Set([
  ">", "CR", "DR", "DI", "OD", "SA", "SA1", "SA2", "SA3", "J", "A",
]);

/**
 * ["2","弱P"] -> ["2弱P"]
 * ["236","弱P"] -> ["236弱P"]
 * 次がメタ記号のときは結合しない
 */
export function mergeNumberWithNext(tokens: string[]) {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const next = tokens[i + 1];

    if (/^\d+$/.test(cur) && next && !META_TOKENS.has(next)) {
      out.push(cur + next);
      i++;
      continue;
    }
    out.push(cur);
  }
  return out;
}

/**
 * comboText の ">" より前を始動として表示用に返す
 * 例: "2 弱P > 2 弱P > 強 昇竜拳" -> "2弱P"
 */
export function starterFromComboText(comboText: string) {
  const before = (comboText.split(">")[0] ?? "").trim();
  if (!before) return "-";
  const tokens = before.split(/\s+/).filter(Boolean);
  return mergeNumberWithNext(tokens).join("").replace(/\s+/g, "");
}

/**
 * q のスペース違いを吸収する検索用バリエーション
 * 例:
 *  - "2中K" -> ["2中K","2 中K"]
 *  - "236弱P" -> ["236弱P","236 弱P","2 3 6 弱P"]
 */
export function buildQVariants(qRaw: string) {
  const raw = qRaw.trim();
  if (!raw) return [];

  const noSpace = raw.replace(/\s+/g, "");

  // 2中K -> 2 中K, 236P -> 236 P
  const spacedDigitRest = noSpace.replace(/^(\d+)(\D.+)$/, "$1 $2");

  // 236P -> 2 3 6 P（旧データ救済）
  let digitsSpaced = noSpace;
  const m = noSpace.match(/^(\d+)(\D.+)$/);
  if (m) {
    const digits = m[1].split("").join(" ");
    const rest = m[2];
    digitsSpaced = `${digits} ${rest}`;
  }

  const vars = [raw, noSpace, spacedDigitRest, digitsSpaced]
    .map((s) => s.trim())
    .filter(Boolean);

  return Array.from(new Set(vars));
}
