import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { WD, pad, toISO, fromISO, addDays, sundayOf } from "../lib/util";

/*
 * 空き時間カレンダー本体（プレゼンテーション＋塗り操作）。
 * - 編集できるのは「自分（me）」の行だけ。他者（others）は重なり表示用の読み取り専用。
 * - 親(EventPage)が Firestore とのI/Oを持ち、ここは props と callback だけで動く。
 *
 * props:
 *   startHour, endHour : 時間帯（イベント設定）
 *   isOwner            : オーナーのみ時間帯を変更可
 *   onHoursChange(s,e) : 時間帯変更
 *   me     : {uid, name, color, slots:[], saved}
 *   others : [{uid, name, color, slots:[]}]
 *   mode, onModeChange : "input" | "overlap"
 *   onTogglePaint(key, add) : 自分の1コマを追加/削除
 *   onSaveName(name)        : 名前を入れて保存（共有開始）
 */
export default function AvailabilityCalendar({
  startHour = 9,
  endHour = 22,
  isOwner = false,
  onHoursChange,
  me,
  others = [],
  mode = "input",
  onModeChange,
  onTogglePaint,
  onSaveName,
}) {
  const DAYS = 7;
  const STEP = 60;

  const today = useMemo(() => toISO(new Date()), []);
  const [weekStart, setWeekStart] = useState(() => toISO(sundayOf(new Date())));
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    setSaveName(me?.name || "");
  }, [me?.uid, me?.saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const participants = useMemo(() => [me, ...others].filter(Boolean), [me, others]);
  const total = participants.length;

  const dayList = useMemo(() => {
    const base = fromISO(weekStart);
    return Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(base, i);
      const iso = toISO(d);
      return { iso, wd: d.getDay(), label: `${d.getMonth() + 1}/${d.getDate()}`, disabled: iso <= today };
    });
  }, [weekStart, today]);

  const times = useMemo(() => {
    const out = [];
    for (let m = startHour * 60; m < endHour * 60; m += STEP) {
      out.push({ m, label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}` });
    }
    return out;
  }, [startHour, endHour]);

  const keyOf = (iso, m) => `${iso}|${m}`;
  const fmt = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  // 重なり集計
  const counts = useMemo(() => {
    const map = new Map();
    participants.forEach((p) =>
      (p.slots || []).forEach((k) => {
        const cur = map.get(k) || { count: 0, ids: [] };
        cur.count += 1;
        cur.ids.push(p.uid);
        map.set(k, cur);
      })
    );
    return map;
  }, [participants]);

  // 候補：同じメンバー集合で連続するコマを1区間にまとめる
  const candidates = useMemo(() => {
    if (!total) return [];
    const runs = [];
    dayList.forEach((day) => {
      if (day.disabled) return;
      let run = null;
      times.forEach((t) => {
        const c = counts.get(keyOf(day.iso, t.m));
        const sig = c ? c.ids.slice().sort().join(",") : "";
        if (c && c.count > 0) {
          if (run && run.sig === sig && run.endM === t.m) {
            run.endM = t.m + STEP;
          } else {
            if (run) runs.push(run);
            run = { iso: day.iso, label: day.label, wd: day.wd, sig, ids: c.ids, count: c.count, startM: t.m, endM: t.m + STEP };
          }
        } else if (run) {
          runs.push(run);
          run = null;
        }
      });
      if (run) runs.push(run);
    });
    runs.sort(
      (a, b) =>
        b.count - a.count ||
        b.endM - b.startM - (a.endM - a.startM) ||
        a.iso.localeCompare(b.iso) ||
        a.startM - b.startM
    );
    return runs.slice(0, 8);
  }, [counts, dayList, times, total]);

  // 塗り操作（ポインタ）
  const painting = useRef(false);
  const paintAdd = useRef(true);
  const mySlots = useMemo(() => new Set(me?.slots || []), [me?.slots]);

  useEffect(() => {
    const move = (e) => {
      if (!painting.current) return;
      const pt = e.touches ? e.touches[0] : e;
      const el = document.elementFromPoint(pt.clientX, pt.clientY);
      const cell = el && el.closest("[data-key]");
      if (cell) onTogglePaint(cell.getAttribute("data-key"), paintAdd.current);
    };
    const up = () => (painting.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onTogglePaint]);

  const startPaint = (key) => {
    if (mode !== "input") return;
    const has = mySlots.has(key);
    paintAdd.current = !has;
    painting.current = true;
    onTogglePaint(key, !has);
  };

  const cellBg = (key) => {
    const c = counts.get(key);
    if (mode === "input") {
      if (mySlots.has(key)) return me.color;
      if (c) {
        const others = c.ids.filter((id) => id !== me.uid).length;
        if (others > 0) return `rgba(100,116,139,${0.1 + 0.14 * Math.min(others, 4)})`;
      }
      return "#fff";
    }
    if (!c || c.count === 0) return "#fff";
    return `rgba(5,150,105,${0.18 + 0.62 * (c.count / total)})`;
  };
  const isFull = (key) => {
    const c = counts.get(key);
    return total > 0 && c && c.count === total;
  };

  const shiftWeek = (dir) => setWeekStart(toISO(addDays(fromISO(weekStart), dir * DAYS)));

  return (
    <div style={S.root}>
      <style>{`
        *{box-sizing:border-box}
        .acal-cell{transition:background .04s linear}
        .acal-grid::-webkit-scrollbar{height:8px;width:8px}
        .acal-grid::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px}
      `}</style>

      <div style={S.cfgRow}>
        <div style={S.modeWrap}>
          <button onClick={() => onModeChange("input")} style={{ ...S.modeBtn, ...(mode === "input" ? S.modeOn : {}) }}>塗る</button>
          <button onClick={() => onModeChange("overlap")} style={{ ...S.modeBtn, ...(mode === "overlap" ? S.modeOn : {}) }}>重なりを見る</button>
        </div>
        <span style={S.gap} />
        <button style={S.navBtn} onClick={() => shiftWeek(-1)}>◀ 前の週</button>
        <span style={S.weekLabel}>{dayList[0].label} – {dayList[DAYS - 1].label}</span>
        <button style={S.navBtn} onClick={() => shiftWeek(1)}>次の週 ▶</button>
        <span style={S.gap} />
        {isOwner ? (
          <label style={S.cfgLabel}>時間
            <select value={startHour} onChange={(e) => onHoursChange(+e.target.value, endHour)} style={S.sel}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}:00</option>)}
            </select>–
            <select value={endHour} onChange={(e) => onHoursChange(startHour, +e.target.value)} style={S.sel}>
              {Array.from({ length: 25 }, (_, h) => <option key={h} value={h}>{pad(h)}:00</option>)}
            </select>
          </label>
        ) : (
          <span style={S.cfgLabel}>{pad(startHour)}:00 – {pad(endHour)}:00</span>
        )}
      </div>

      <div style={S.body}>
        <aside style={S.side}>
          <div style={S.sideSec}>
            <div style={S.sideTitle}>メンバー</div>
            {participants.map((p) => (
              <div key={p.uid} style={S.pRow}>
                <span style={{ ...S.dot, background: p.color }} />
                <span style={{ ...S.pName, ...(p.uid === me.uid && !me.saved ? S.unsaved : {}) }}>
                  {p.uid === me.uid ? (me.saved ? me.name : "あなた") : (p.name?.trim() ? p.name : "（未入力）")}
                </span>
                {p.uid === me.uid && !me.saved && <span style={S.draftTag}>下書き</span>}
                <span style={S.pCount}>{(p.slots || []).length}</span>
              </div>
            ))}
            {mode === "input" && (
              <p style={S.hint}>
                {me.saved
                  ? <>あなたの空き時間を塗っています。なぞって追加、塗った所をなぞると消去。</>
                  : <>空き時間をなぞって選択。<b>保存・共有するには下で名前を入力</b>。</>}
              </p>
            )}
          </div>

          <div style={S.sideSec}>
            <div style={S.sideTitle}>保存・共有</div>
            {me.saved ? (
              <>
                <p style={S.savedTag}>✓ 「{me.name}」として保存・共有中</p>
                <div style={S.row}>
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSaveName(saveName)} placeholder="名前を変更" style={S.input} />
                  <button style={S.saveBtn} onClick={() => onSaveName(saveName)}>更新</button>
                </div>
              </>
            ) : (
              <>
                <p style={S.note}>名前を入れると保存され、共有相手にも表示されます。入れるまではこの端末内だけの下書きです。</p>
                <div style={S.row}>
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSaveName(saveName)} placeholder="あなたの名前" style={S.input} />
                  <button style={{ ...S.saveBtn, opacity: saveName.trim() ? 1 : 0.45 }} onClick={() => onSaveName(saveName)}>保存</button>
                </div>
              </>
            )}
          </div>

          <div style={S.sideSec}>
            <div style={S.sideTitle}>候補（重なり順）</div>
            {candidates.length === 0 && <p style={S.empty}>まだ重なりがありません。</p>}
            {candidates.map((r, i) => (
              <div key={i} style={S.cand}>
                <div style={S.candTop}>
                  <span style={S.candDate}>{r.label}（{WD[r.wd]}）</span>
                  <span style={{ ...S.candBadge, ...(r.count === total ? S.candFull : {}) }}>{r.count}/{total}人</span>
                </div>
                <div style={S.candTime}>{fmt(r.startM)}–{fmt(r.endM)}</div>
                <div style={S.candMembers}>
                  {r.ids.map((id) => {
                    const p = participants.find((x) => x.uid === id);
                    return p ? <span key={id} style={{ ...S.miniDot, background: p.color }} title={p.uid === me.uid ? (me.name || "あなた") : p.name} /> : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="acal-grid" style={S.grid}>
          <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${DAYS}, minmax(64px,1fr))`, gridTemplateRows: `auto repeat(${times.length}, minmax(30px,1fr))`, minWidth: 56 + DAYS * 64, height: "100%" }}>
            <div style={S.corner} />
            {dayList.map((d) => (
              <div key={d.iso} style={{ ...S.dayHead, ...(d.disabled ? S.dayHeadDisabled : {}) }}>
                <div style={{ ...S.dayWd, color: d.disabled ? "#cbd5e1" : d.wd === 0 ? "#dc2626" : d.wd === 6 ? "#2563eb" : "#94a3b8" }}>{WD[d.wd]}</div>
                <div style={{ ...S.dayNum, color: d.disabled ? "#cbd5e1" : "#0f172a" }}>{d.label}</div>
              </div>
            ))}
            {times.map((t) => (
              <Fragment key={t.m}>
                <div style={{ ...S.timeCell, borderTop: "1px solid #e2e8f0" }}>
                  <span style={S.timeLabel}>{t.label}</span>
                </div>
                {dayList.map((d) => {
                  const key = keyOf(d.iso, t.m);
                  if (d.disabled) {
                    return <div key={key} className="acal-cell" style={{ ...S.cell, borderTop: "1px solid #e2e8f0", background: "repeating-linear-gradient(45deg,#f8fafc,#f8fafc 5px,#f1f5f9 5px,#f1f5f9 10px)", cursor: "not-allowed" }} />;
                  }
                  const full = mode === "overlap" && isFull(key);
                  return (
                    <div
                      key={key}
                      data-key={key}
                      className="acal-cell"
                      onPointerDown={(e) => { e.preventDefault(); startPaint(key); }}
                      style={{ ...S.cell, borderTop: "1px solid #e2e8f0", background: cellBg(key), cursor: mode === "input" ? "crosshair" : "default", boxShadow: full ? "inset 0 0 0 2px #f59e0b" : "none" }}
                    >
                      {full && <span style={S.star}>★</span>}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

const S = {
  root: { fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", color: "#0f172a", background: "#f8fafc", height: "100%", display: "flex", flexDirection: "column" },
  cfgRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0" },
  modeWrap: { display: "flex", gap: 4, background: "#f1f5f9", padding: 4, borderRadius: 10 },
  modeBtn: { padding: "7px 16px", borderRadius: 7, border: "none", background: "transparent", color: "#475569", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  modeOn: { background: "#fff", color: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,.12)" },
  gap: { flex: "0 0 6px" },
  navBtn: { padding: "6px 12px", borderRadius: 8, border: "none", background: "#f1f5f9", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  weekLabel: { fontSize: 13.5, fontWeight: 700, minWidth: 96, textAlign: "center", fontVariantNumeric: "tabular-nums" },
  cfgLabel: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" },
  sel: { padding: "5px 6px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13 },
  body: { display: "flex", flex: 1, minHeight: 0 },
  side: { width: 248, flexShrink: 0, borderRight: "1px solid #e2e8f0", background: "#fff", overflowY: "auto", padding: 14 },
  sideSec: { marginBottom: 22 },
  sideTitle: { fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 },
  pRow: { display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8 },
  dot: { width: 12, height: 12, borderRadius: 4, flexShrink: 0 },
  pName: { flex: 1, fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  unsaved: { fontStyle: "italic", color: "#94a3b8" },
  draftTag: { fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", borderRadius: 5, padding: "1px 5px" },
  pCount: { fontSize: 11.5, color: "#94a3b8", fontVariantNumeric: "tabular-nums" },
  hint: { fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5 },
  row: { display: "flex", gap: 6 },
  input: { flex: 1, padding: "7px 9px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minWidth: 0 },
  saveBtn: { padding: "7px 12px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  note: { fontSize: 12, color: "#64748b", margin: "0 0 8px", lineHeight: 1.5 },
  savedTag: { fontSize: 13, color: "#059669", fontWeight: 600, margin: "0 0 8px" },
  empty: { fontSize: 12.5, color: "#94a3b8", margin: "4px 0" },
  cand: { padding: "8px 9px", borderRadius: 9, border: "1px solid #eef2f6", marginBottom: 7, background: "#fafcff" },
  candTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  candDate: { fontSize: 12.5, fontWeight: 600 },
  candBadge: { fontSize: 11, fontWeight: 700, color: "#475569", background: "#eef2f6", borderRadius: 6, padding: "2px 6px" },
  candFull: { color: "#fff", background: "#f59e0b" },
  candTime: { fontSize: 15, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" },
  candMembers: { display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" },
  miniDot: { width: 9, height: 9, borderRadius: 3 },
  grid: { flex: 1, overflow: "auto", background: "#fff" },
  corner: { position: "sticky", top: 0, left: 0, zIndex: 3, background: "#fff", borderBottom: "1px solid #e2e8f0" },
  dayHead: { position: "sticky", top: 0, zIndex: 2, background: "#fff", textAlign: "center", padding: "8px 2px", borderLeft: "1px solid #f1f5f9", borderBottom: "1px solid #e2e8f0" },
  dayHeadDisabled: { background: "#f8fafc" },
  dayWd: { fontSize: 11, fontWeight: 600 },
  dayNum: { fontSize: 14, fontWeight: 700, marginTop: 1 },
  timeCell: { position: "sticky", left: 0, zIndex: 1, background: "#fff" },
  timeLabel: { position: "absolute", top: 0, right: 6, transform: "translateY(-50%)", fontSize: 10.5, color: "#94a3b8", background: "#fff", padding: "0 2px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  cell: { borderLeft: "1px solid #f1f5f9", position: "relative", userSelect: "none", WebkitUserSelect: "none", touchAction: "none" },
  star: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#b45309" },
};
