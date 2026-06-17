import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, ensureAuth } from "../firebase";
import { recordVisit, getRecents, removeRecent } from "../lib/history";

export default function Home() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [recents, setRecents] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecents(getRecents());
  }, []);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uid = await ensureAuth();
      const t = title.trim() || "無題の日程調整";
      const ref = await addDoc(collection(db, "events"), {
        title: t,
        settings: { startHour: 9, endHour: 22 },
        createdAt: serverTimestamp(),
        ownerUid: uid,
      });
      recordVisit({ id: ref.id, title: t, role: "owner" });
      nav(`/e/${ref.id}`);
    } catch (e) {
      alert("作成に失敗しました: " + e.message);
      setBusy(false);
    }
  };

  const drop = (id) => {
    removeRecent(id);
    setRecents(getRecents());
  };

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <h1 style={S.h1}>空き時間カレンダー</h1>
        <p style={S.sub}>
          カレンダーを塗るだけの日程調整。リンクを共有すれば、相手はアカウントなしで空き時間を書き込めます。
        </p>

        <div style={S.createRow}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="イベント名（例：忘年会、紹介MTG）"
            maxLength={200}
            style={S.input}
          />
          <button style={S.createBtn} onClick={create} disabled={busy}>
            {busy ? "作成中…" : "新しい日程調整を作る"}
          </button>
        </div>

        {recents.length > 0 && (
          <div style={S.recents}>
            <div style={S.recentsTitle}>最近のイベント</div>
            {recents.map((r) => (
              <div key={r.id} style={S.recentRow}>
                <button style={S.recentLink} onClick={() => nav(`/e/${r.id}`)}>
                  <span style={S.recentName}>{r.title}</span>
                  <span style={S.role}>{r.role === "owner" ? "オーナー" : "メンバー"}</span>
                </button>
                <button style={S.del} title="履歴から削除" onClick={() => drop(r.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: 20, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", color: "#0f172a" },
  card: { width: "100%", maxWidth: 520, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,.04)" },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  sub: { margin: "8px 0 20px", fontSize: 13.5, color: "#64748b", lineHeight: 1.6 },
  createRow: { display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: "11px 13px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 14 },
  createBtn: { padding: "12px 16px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  recents: { marginTop: 26 },
  recentsTitle: { fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 },
  recentRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 },
  recentLink: { flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #eef2f6", background: "#fafcff", cursor: "pointer", textAlign: "left" },
  recentName: { fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  role: { fontSize: 11, fontWeight: 700, color: "#64748b", background: "#eef2f6", borderRadius: 6, padding: "2px 7px", flexShrink: 0 },
  del: { width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", color: "#cbd5e1", fontSize: 18, cursor: "pointer" },
};
