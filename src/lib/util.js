// 日付・色・曜日の共通ユーティリティ

export const PALETTE = [
  "#2563EB", "#059669", "#DB2777", "#D97706",
  "#7C3AED", "#0891B2", "#DC2626", "#65A30D",
];

export const WD = ["日", "月", "火", "水", "木", "金", "土"];

export const pad = (n) => String(n).padStart(2, "0");

export const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// その日が含まれる週の日曜
export const sundayOf = (d) => addDays(d, -d.getDay());

// 他の人が使っていない色を1つ選ぶ（無ければ先頭）
export const pickFreeColor = (usedColors) => {
  const used = new Set(usedColors);
  return PALETTE.find((c) => !used.has(c)) || PALETTE[0];
};
