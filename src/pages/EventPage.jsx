import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, ensureAuth } from "../firebase";
import { recordVisit } from "../lib/history";
import { PALETTE, pickFreeColor } from "../lib/util";
import AvailabilityCalendar from "../components/AvailabilityCalendar";

export default function EventPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [myUid, setMyUid] = useState(null);
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [others, setOthers] = useState([]); // 自分以外の回答

  // 自分の回答（保存されるまではローカルのみ）
  const [mySlots, setMySlots] = useState([]);
  const [myName, setMyName] = useState("");
  const [mySaved, setMySaved] = useState(false);
  const [myColor, setMyColor] = useState(PALETTE[0]);
  const myLoaded = useRef(false); // サーバーから自分の行を読むのは初回のみ

  const [mode, setMode] = useState("input");
  const [copied, setCopied] = useState(false);

  // 匿名認証
  useEffect(() => {
    ensureAuth().then(setMyUid).catch((e) => console.error(e));
  }, []);

  // イベント本体を購読
  useEffect(() => {
    const ref = doc(db, "events", id);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setEvent(data);
        recordVisit({ id: snap.id, title: data.title });
      },
      (e) => console.error(e)
    );
  }, [id]);

  // 回答（サブコレクション）を購読：他者はリアルタイム反映、自分は初回だけ取り込む
  useEffect(() => {
    if (!myUid) return;
    const col = collection(db, "events", id, "responses");
    return onSnapshot(
      col,
      (snap) => {
        const all = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setOthers(all.filter((r) => r.uid !== myUid));
        const mine = all.find((r) => r.uid === myUid);
        if (mine && !myLoaded.current) {
          setMySlots(mine.slots || []);
          setMyName(mine.name || "");
          setMySaved(true);
          if (mine.color) setMyColor(mine.color);
          myLoaded.current = true;
        }
      },
      (e) => console.error(e)
    );
  }, [id, myUid]);

  // 未保存のうちは他者と被らない色を選んでおく
  useEffect(() => {
    if (mySaved) return;
    setMyColor(pickFreeColor(others.map((o) => o.color)));
  }, [others, mySaved]);

  const isOwner = !!(event && myUid && event.ownerUid === myUid);

  const persistMine = useCallback(
    (patch) => {
      if (!myUid) return;
      const ref = doc(db, "events", id, "responses", myUid);
      setDoc(
        ref,
        {
          name: patch.name ?? myName,
          color: patch.color ?? myColor,
          slots: patch.slots ?? mySlots,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => console.error(e));
    },
    [myUid, id, myName, myColor, mySlots]
  );

  // 塗り：保存済みなら都度Firestoreへ、未保存ならローカルのみ
  const togglePaint = useCallback(
    (key, add) => {
      setMySlots((prev) => {
        const set = new Set(prev);
        add ? set.add(key) : set.delete(key);
        const next = [...set];
        if (mySaved) persistMine({ slots: next });
        return next;
      });
    },
    [mySaved, persistMine]
  );

  // 名前を入れて保存＝以降は共有対象
  const saveName = useCallback(
    (name) => {
      const n = name.trim();
      if (!n) return;
      setMyName(n);
      setMySaved(true);
      myLoaded.current = true;
      persistMine({ name: n, slots: mySlots, color: myColor });
      recordVisit({ id, title: event?.title, role: isOwner ? "owner" : "member" });
    },
    [persistMine, mySlots, myColor, id, event, isOwner]
  );

  // オーナーのみ時間帯を変更可能
  const setHours = useCallback(
    (startHour, endHour) => {
      if (!isOwner) return;
      setDoc(doc(db, "events", id), { settings: { startHour, endHour } }, { merge: true }).catch(
        (e) => console.error(e)
      );
    },
    [isOwner, id]
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("このリンクをコピーして共有してください", window.location.href);
    }
  };

  if (notFound) {
    return (
      <Centered>
        <p>このイベントは見つかりませんでした。</p>
        <button style={btn} onClick={() => nav("/")}>トップへ</button>
      </Centered>
    );
  }
  if (!event || !myUid) return <Centered><p>読み込み中…</p></Centered>;

  const me = { uid: myUid, name: myName, color: myColor, slots: mySlots, saved: mySaved };
  const startHour = event.settings?.startHour ?? 9;
  const endHour = event.settings?.endHour ?? 22;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={topbar}>
        <button style={homeBtn} onClick={() => nav("/")} title="トップ・履歴へ">←</button>
        <div style={titleWrap}>
          <span style={titleText}>{event.title}</span>
          {isOwner && <span style={ownerTag}>オーナー</span>}
        </div>
        <button style={shareBtn} onClick={copyLink}>
          {copied ? "コピーしました" : "共有リンクをコピー"}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AvailabilityCalendar
          startHour={startHour}
          endHour={endHour}
          isOwner={isOwner}
          onHoursChange={setHours}
          me={me}
          others={others}
          mode={mode}
          onModeChange={setMode}
          onTogglePaint={togglePaint}
          onSaveName={saveName}
        />
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", color: "#334155" }}>
      {children}
    </div>
  );
}

const topbar = { display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0", fontFamily: "system-ui,sans-serif" };
const homeBtn = { width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0 };
const titleWrap = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 };
const titleText = { fontSize: 16, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const ownerTag = { fontSize: 10.5, fontWeight: 700, color: "#475569", background: "#eef2f6", borderRadius: 6, padding: "2px 7px", flexShrink: 0 };
const shareBtn = { padding: "8px 14px", borderRadius: 9, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 };
const btn = { padding: "9px 16px", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, cursor: "pointer" };
