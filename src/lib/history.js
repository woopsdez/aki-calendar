// ブラウザ内に「触れたイベント」の履歴を保持する。
// アカウント不要で、オーナー/メンバー問わず並行イベントを切り替えるための導線になる。

const KEY = "aki:recents";

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function write(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* localStorage不可の環境では履歴を諦める（致命的ではない） */
  }
}

// 訪問を記録（既存があればタイトル/ロールを保ちつつ最終訪問を更新）
export function recordVisit({ id, title, role }) {
  const arr = read();
  const prev = arr.find((x) => x.id === id) || {};
  const item = {
    id,
    title: title ?? prev.title ?? "無題の日程調整",
    role: role || prev.role || "member",
    lastOpened: Date.now(),
  };
  const rest = arr.filter((x) => x.id !== id);
  write([item, ...rest].slice(0, 30));
}

export function getRecents() {
  return read().sort((a, b) => b.lastOpened - a.lastOpened);
}

export function removeRecent(id) {
  write(read().filter((x) => x.id !== id));
}
