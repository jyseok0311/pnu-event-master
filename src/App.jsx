import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, CalendarDays, Send, Users, Bell, Clock, TrendingUp,
  AlertTriangle, CheckCircle2, Mail, MapPin, ChevronRight, Activity,
  Plus, X, ArrowLeft, UserCheck, MailOpen, HelpCircle, Sparkles,
  QrCode, BarChart3, ScanLine, Search, Download, Percent,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { SHEETS, loadEventsRemote, api } from "./sheets";

/* ==================================================================
 * PNU Event Master — 부산대학교 실시간 능동형 행사 관리 (독립 서비스)
 * 색상: 부산대 공식 교색 #005BAA / 보조색 #00A651
 * ================================================================== */
const C = {
  bg: "#EEF2F7", card: "#FFFFFF",
  navy: "#003D77",      // 사이드바/헤더 (교색 심화)
  navySoft: "#005BAA",
  ink: "#0C2233", muted: "#5E7185", line: "#E1E8F0",
  blue: "#005BAA", blueSoft: "#E4EFF8",       // 부산대 교색
  green: "#00A651", greenSoft: "#E4F6EC",     // 부산대 보조색 (실시간/참석)
  teal: "#00A651", tealSoft: "#E4F6EC",
  amber: "#D98A00", amberSoft: "#FBF0DA",
  red: "#DC3D34", redSoft: "#FBE6E4",
};
const FONT =
  "'Pretendard','Pretendard Variable','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
const STAGES = ["기획", "초대 발송", "회신 수집", "준비 완료", "진행 중", "종료"];

/* 날짜 (오늘 = 2026-07-13) */
const TODAY = new Date(2026, 6, 13, 9, 41, 0);
const addDays = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };
const fmtDate = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${["일","월","화","수","목","금","토"][d.getDay()]})`;
const dday = (d) => {
  const a = new Date(d); a.setHours(0,0,0,0);
  const b = new Date(TODAY); b.setHours(0,0,0,0);
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `종료 +${-diff}일`;
};

const seedEvents = () => [
  { id: 1, title: "2026 인공지능 신기술 세미나", cat: "학술", date: addDays(2), time: "14:00",
    place: "대학본부 대강당", host: "정보컴퓨터공학부", capacity: 200, invited: 240, opened: 198, yes: 141, no: 22, stage: 2, checkedIn: 0 },
  { id: 2, title: "신입생 학부모 오리엔테이션", cat: "행사", date: addDays(5), time: "10:30",
    place: "학생회관 대극장", host: "교무처", capacity: 300, invited: 300, opened: 96, yes: 61, no: 8, stage: 1, checkedIn: 0 },
  { id: 3, title: "산학협력 네트워킹 데이", cat: "네트워킹", date: addDays(1), time: "16:00",
    place: "국제컨벤션홀", host: "산학협력단", capacity: 120, invited: 120, opened: 118, yes: 116, no: 3, stage: 3, checkedIn: 0 },
  { id: 4, title: "교직원 업무혁신 워크숍", cat: "내부", date: TODAY, time: "13:00",
    place: "행정관 세미나실 B", host: "총무과", capacity: 60, invited: 58, opened: 58, yes: 54, no: 4, stage: 4, checkedIn: 31 },
  { id: 5, title: "글로벌 리더십 초청 특강", cat: "특강", date: addDays(9), time: "15:30",
    place: "국제관 201호", host: "국제처", capacity: 150, invited: 150, opened: 71, yes: 44, no: 12, stage: 2, checkedIn: 0 },
  { id: 6, title: "개교 80주년 기념 음악회", cat: "문화", date: addDays(24), time: "18:30",
    place: "넉넉한터 특설무대", host: "대외협력과", capacity: 500, invited: 0, opened: 0, yes: 0, no: 0, stage: 0, checkedIn: 0 },
];

const pending = (e) => Math.max(0, e.invited - e.yes - e.no);
const openRate = (e) => (e.invited ? Math.round((e.opened / e.invited) * 100) : 0);
const catColor = (cat) =>
  ({ 학술: C.blue, 행사: C.green, 네트워킹: C.amber, 내부: C.muted, 특강: "#6E4BC4", 문화: "#C0398A" }[cat] || C.muted);

/* 능동형 엔진 */
function deriveTasks(events) {
  const t = [];
  for (const e of events) {
    const dd = Math.round((new Date(e.date).setHours(0,0,0,0) - new Date(TODAY).setHours(0,0,0,0)) / 86400000);
    if (e.stage === 0 && dd <= 30)
      t.push({ id: `send-${e.id}`, eid: e.id, level: "start", title: `「${e.title}」 초대장 발송을 시작하세요`,
        why: `아직 초대장이 나가지 않았어요. 행사까지 ${dd}일 남았습니다.`, action: "초대장 만들기", kind: "compose" });
    if (e.yes > e.capacity)
      t.push({ id: `over-${e.id}`, eid: e.id, level: "urgent", title: `「${e.title}」 정원을 초과했습니다`,
        why: `정원 ${e.capacity}명 · 현재 참석 ${e.yes}명. 대기자 전환이 필요해요.`, action: "대기자로 전환", kind: "waitlist" });
    if (e.stage >= 1 && e.stage <= 2 && pending(e) > 0 && dd <= 7 && dd >= 0)
      t.push({ id: `remind-${e.id}`, eid: e.id, level: dd <= 2 ? "urgent" : "todo", title: `「${e.title}」 미회신 ${pending(e)}명에게 리마인더`,
        why: `${dd === 0 ? "오늘" : `D-${dd}`}인데 아직 답을 안 준 분들이 있어요.`, action: "리마인더 발송", kind: "remind" });
    if (e.stage === 3)
      t.push({ id: `check-${e.id}`, eid: e.id, level: "todo", title: `「${e.title}」 QR 현장 체크인을 준비하세요`,
        why: `참석 확정 ${e.yes}명. 입구용 QR을 띄우면 도착 인원이 실시간 집계됩니다.`, action: "QR 열기", kind: "qr" });
  }
  const order = { urgent: 0, start: 1, todo: 2 };
  return t.sort((a, b) => order[a.level] - order[b.level]);
}

/* ---------- 공통 조각 ---------- */
function Chip({ children, bg, fg }) {
  return <span style={{ background: bg, color: fg, fontSize: 12, fontWeight: 700, padding: "3px 9px",
    borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "-.01em" }}>{children}</span>;
}
function StageBadge({ stage }) {
  const m = [[C.muted,"#EEF1F5"],[C.blue,C.blueSoft],[C.green,C.greenSoft],[C.amber,C.amberSoft],[C.green,C.greenSoft],[C.muted,"#EEF1F5"]];
  const [fg, bg] = m[stage];
  return <Chip bg={bg} fg={fg}>{STAGES[stage]}</Chip>;
}
function Stepper({ stage }) {
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {STAGES.map((s, i) => {
        const done = i < stage, cur = i === stage;
        const dot = done ? C.green : cur ? C.blue : "#CBD5E1";
        return (
          <React.Fragment key={s}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: cur ? 15 : 12, height: cur ? 15 : 12, borderRadius: 999, background: dot,
                boxShadow: cur ? `0 0 0 5px ${C.blueSoft}` : "none", transition: "all .3s" }} />
              <span style={{ fontSize: 11, fontWeight: cur ? 800 : 600, color: cur ? C.blue : done ? C.green : C.muted }}>{s}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div style={{ flex: 1, height: 3, borderRadius: 2, margin: "0 6px 20px",
                background: i < stage ? C.green : "#E2E8F0", transition: "background .3s" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
function AttBar({ e }) {
  const tot = Math.max(1, e.invited);
  const seg = [[e.yes, C.green, "참석"], [e.no, C.red, "불참"], [pending(e), "#D7DEE7", "미회신"]];
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "#EEF2F7" }}>
        {seg.map(([v, col], i) => <div key={i} style={{ width: `${(v/tot)*100}%`, background: col, transition: "width .5s" }} />)}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
        {seg.map(([v, col, lab], i) => (
          <span key={i} style={{ fontSize: 12, color: C.muted, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: col }} />{lab} <b style={{ color: C.ink }}>{v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
/* 단일값 링 */
function Ring({ value, total, color, big, sub }) {
  const R = 62, CIRC = 2 * Math.PI * R, pct = total ? Math.min(1, value / total) : 0;
  return (
    <div style={{ position: "relative", width: 164, height: 164 }}>
      <svg width="164" height="164" viewBox="0 0 164 164" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="82" cy="82" r={R} fill="none" stroke="#EAEFF4" strokeWidth="14" />
        <circle cx="82" cy="82" r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${pct * CIRC} ${CIRC}`} style={{ transition: "stroke-dasharray .6s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{big}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}
function Donut({ e }) {
  const tot = Math.max(1, e.invited), R = 54, CIRC = 2 * Math.PI * R;
  const seg = [[e.yes, C.green], [e.no, C.red], [pending(e), "#DCE3EC"]];
  let acc = 0;
  return (
    <div style={{ position: "relative", width: 148, height: 148 }}>
      <svg width="148" height="148" viewBox="0 0 148 148" style={{ transform: "rotate(-90deg)" }}>
        {seg.map(([v, col], i) => {
          const len = (v / tot) * CIRC;
          const el = <circle key={i} cx="74" cy="74" r={R} fill="none" stroke={col} strokeWidth="16"
            strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-acc} style={{ transition: "all .5s" }} />;
          acc += len; return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{e.yes}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>참석 확정</div>
      </div>
    </div>
  );
}
/* 유사 QR 매트릭스 */
function qrMatrix(seed, n = 25) {
  let s = 7; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const g = Array.from({ length: n }, () => Array(n).fill(false));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g[y][x] = rnd() > 0.52;
  const finder = (ox, oy) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const gy = oy + y, gx = ox + x; if (gy < 0 || gx < 0 || gy >= n || gx >= n) continue;
      const inb = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const edge = inb && (x === 0 || x === 6 || y === 0 || y === 6);
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      g[gy][gx] = inb ? (edge || core) : false;
    }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  return g;
}
function QRCode({ seed, size = 200, color = C.navy }) {
  const g = useMemo(() => qrMatrix(seed), [seed]);
  const n = g.length, cell = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8 }}>
      <rect width={size} height={size} fill="#fff" />
      {g.map((row, y) => row.map((on, x) => on
        ? <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.5} height={cell + 0.5} fill={color} /> : null))}
    </svg>
  );
}

/* ================================================================== *
 * 앱
 * ================================================================== */
export default function App() {
  const [view, setView] = useState("dashboard");
  const [events, setEvents] = useState(SHEETS.enabled ? [] : seedEvents);
  const [selId, setSelId] = useState(null);
  const [checkId, setCheckId] = useState(4);
  const [feed, setFeed] = useState([
    { t: "방금", txt: "김서연님이 「산학협력 네트워킹 데이」 참석 회신", tone: "yes" },
    { t: "2분 전", txt: "이준호님이 초대장을 열람했습니다", tone: "open" },
    { t: "5분 전", txt: "「교직원 업무혁신 워크숍」 현장 체크인 시작", tone: "info" },
  ]);
  const [toasts, setToasts] = useState([]);
  const [compose, setCompose] = useState(null);
  const [clock, setClock] = useState(new Date(TODAY));
  const [doneTasks, setDoneTasks] = useState([]);

  const sel = events.find((e) => e.id === selId);
  const tasks = useMemo(() => deriveTasks(events).filter((t) => !doneTasks.includes(t.id)), [events, doneTasks]);

  useEffect(() => { const id = setInterval(() => setClock((c) => new Date(c.getTime() + 1000)), 1000); return () => clearInterval(id); }, []);

  /* 구글 시트 연결 시: 최초 로드 + 주기적 폴링으로 실시간 반영 */
  useEffect(() => {
    if (!SHEETS.enabled) return;
    let alive = true;
    const load = () => loadEventsRemote().then((rows) => { if (alive && rows.length) setEvents(rows); }).catch(() => {});
    load();
    const id = setInterval(load, SHEETS.POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const names = ["박민준","최지우","정하윤","강도현","윤서아","임채원","한지훈","오유진","신동엽","서예린"];
  useEffect(() => {
    if (SHEETS.enabled) return; // 데모 모드에서만 가상 회신을 생성
    const id = setInterval(() => {
      setEvents((prev) => {
        const active = prev.filter((e) => e.stage >= 1 && e.stage <= 3 && pending(e) > 0);
        if (!active.length) return prev;
        const target = active[Math.floor(Math.random() * active.length)];
        const isYes = Math.random() > 0.28;
        const nm = names[Math.floor(Math.random() * names.length)];
        setFeed((f) => [{ t: "방금", txt: isYes ? `${nm}님이 「${target.title}」 참석 회신` : `${nm}님이 「${target.title}」 불참 회신`,
          tone: isYes ? "yes" : "no" }, ...f.map((x) => ({ ...x, t: x.t === "방금" ? "1분 전" : x.t })).slice(0, 7)]);
        return prev.map((e) => e.id === target.id
          ? { ...e, opened: Math.min(e.invited, e.opened + 1), yes: isYes ? e.yes + 1 : e.yes, no: isYes ? e.no : e.no + 1 } : e);
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  const pushToast = (txt) => { const id = Math.random(); setToasts((t) => [...t, { id, txt }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400); };

  const runTask = (task) => {
    if (task.kind === "compose") { setCompose(task.eid); return; }
    if (task.kind === "qr") { setCheckId(task.eid); setView("checkin"); return; }
    setDoneTasks((d) => [...d, task.id]);
    if (task.kind === "remind") { api.remind(task.eid); pushToast("미회신자에게 리마인더를 발송했어요"); setFeed((f) => [{ t: "방금", txt: "리마인더 자동 발송 완료", tone: "info" }, ...f].slice(0, 8)); }
    else if (task.kind === "waitlist") { api.waitlist(task.eid); setEvents((p) => p.map((x) => x.id === task.eid ? { ...x, yes: x.capacity } : x)); pushToast("초과 인원을 대기자 명단으로 전환했어요"); }
  };
  const onSent = (eid, count) => {
    api.invite(eid, count);
    setEvents((p) => p.map((e) => e.id === eid ? { ...e, invited: e.invited + count, stage: Math.max(e.stage, 1) } : e));
    setCompose(null); pushToast(`초대장 ${count}건을 발송했어요`);
    setFeed((f) => [{ t: "방금", txt: `초대장 ${count}건 발송 완료`, tone: "info" }, ...f].slice(0, 8));
  };
  const doCheckIn = (eid, nm) => {
    api.checkin(eid, nm);
    setEvents((p) => p.map((e) => e.id === eid ? { ...e, checkedIn: Math.min(e.yes, e.checkedIn + 1) } : e));
    if (nm) setFeed((f) => [{ t: "방금", txt: `${nm}님 현장 체크인 완료`, tone: "info" }, ...f].slice(0, 8));
  };

  const NAV = [
    ["dashboard", "실시간 대시보드", LayoutDashboard],
    ["events", "행사 목록", CalendarDays],
    ["checkin", "QR 현장 체크인", QrCode],
    ["report", "통계 리포트", BarChart3],
  ];
  const stat = useMemo(() => {
    const running = events.filter((e) => e.stage >= 1 && e.stage <= 4).length;
    const today = events.filter((e) => dday(e.date) === "D-DAY").length;
    const totalYes = events.reduce((a, e) => a + e.yes, 0);
    const invited = events.reduce((a, e) => a + e.invited, 0) || 1;
    const rate = Math.round((events.reduce((a, e) => a + e.yes + e.no, 0) / invited) * 100);
    return { running, today, totalYes, rate };
  }, [events]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.ink, minHeight: "100vh", display: "flex", WebkitFontSmoothing: "antialiased" }}>
      {/* 사이드바 */}
      <aside style={{ width: 234, background: C.navy, color: "#fff", padding: "22px 16px", display: "flex",
        flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 6px 22px" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: C.blue, letterSpacing: "-.04em" }}>PNU</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.02em" }}>Event Master</div>
            <div style={{ fontSize: 11, color: "#9DBBDE" }}>부산대학교 행사 관리</div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map(([key, label, Icon]) => {
            const on = view === key || (key === "events" && view === "detail");
            return (
              <button key={key} onClick={() => { setView(key); if (key !== "detail") setSelId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 10, border: "none",
                  cursor: "pointer", textAlign: "left", background: on ? "rgba(255,255,255,.14)" : "transparent",
                  color: on ? "#fff" : "#B8CCE6", fontWeight: on ? 700 : 500, fontSize: 14, fontFamily: FONT, transition: "background .15s" }}>
                <Icon size={19} /> {label}
              </button>
            );
          })}
          <button onClick={() => setCompose("new")}
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", marginTop: 4, borderRadius: 10,
              border: "1px dashed rgba(255,255,255,.3)", cursor: "pointer", background: "transparent", color: "#B8CCE6",
              fontWeight: 600, fontSize: 14, fontFamily: FONT }}>
            <Send size={18} /> 초대장 발송
          </button>
        </nav>
        <div style={{ marginTop: "auto", background: "rgba(255,255,255,.09)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <HelpCircle size={15} color={C.green} /><span style={{ fontSize: 12.5, fontWeight: 700 }}>처음이신가요?</span>
          </div>
          <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "#AECAE9", margin: 0 }}>
            메뉴를 몰라도 괜찮아요. 대시보드가 지금 해야 할 일을 순서대로 알려드립니다.
          </p>
        </div>
      </aside>

      {/* 본문 */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 30px",
          background: C.card, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ position: "relative", width: 9, height: 9 }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: 999, background: C.green }} />
              <span style={{ position: "absolute", inset: -4, borderRadius: 999, border: `2px solid ${C.green}`, animation: "pnuPulse 1.6s ease-out infinite" }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>실시간 연결됨</span>
            <span style={{ color: C.line }}>·</span>
            <span style={{ fontSize: 13, color: C.muted, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Clock size={14} /> {clock.getFullYear()}.{String(clock.getMonth()+1).padStart(2,"0")}.{String(clock.getDate()).padStart(2,"0")}{" "}
              {String(clock.getHours()).padStart(2,"0")}:{String(clock.getMinutes()).padStart(2,"0")}:{String(clock.getSeconds()).padStart(2,"0")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <Bell size={20} color={C.muted} />
              {tasks.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: C.red, color: "#fff",
                fontSize: 10, fontWeight: 800, borderRadius: 999, minWidth: 16, height: 16, display: "grid", placeItems: "center", padding: "0 3px" }}>{tasks.length}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: C.blue, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>행</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>행정지원팀</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>담당자</div>
              </div>
            </div>
          </div>
        </header>

        <div style={{ padding: "26px 30px 60px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
          {view === "dashboard" && <Dashboard {...{ stat, tasks, runTask, feed, events, onOpen: (id) => { setSelId(id); setView("detail"); }, clock }} />}
          {view === "events" && <EventsList events={events} onOpen={(id) => { setSelId(id); setView("detail"); }} onCompose={() => setCompose("new")} />}
          {view === "detail" && sel && <Detail e={sel} onBack={() => { setView("events"); setSelId(null); }} onCompose={() => setCompose(sel.id)}
            onQR={() => { setCheckId(sel.id); setView("checkin"); }}
            onRemind={() => { setDoneTasks((d) => [...d, `remind-${sel.id}`]); pushToast("미회신자에게 리마인더를 발송했어요"); }} />}
          {view === "checkin" && <CheckIn events={events} checkId={checkId} setCheckId={setCheckId} doCheckIn={doCheckIn} pushToast={pushToast} />}
          {view === "report" && <Report events={events} stat={stat} pushToast={pushToast} />}
        </div>
      </main>

      {compose !== null && <Compose events={events} presetId={compose === "new" ? null : compose} onClose={() => setCompose(null)} onSent={onSent} />}

      <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 60, alignItems: "center" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: C.ink, color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600,
            boxShadow: "0 12px 30px rgba(12,34,51,.28)", display: "flex", alignItems: "center", gap: 9, animation: "pnuUp .25s ease" }}>
            <CheckCircle2 size={17} color={C.green} /> {t.txt}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pnuPulse { 0%{transform:scale(1);opacity:.9} 70%{transform:scale(2.1);opacity:0} 100%{opacity:0} }
        @keyframes pnuUp { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes pnuIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pnuScan { 0%{top:8%} 50%{top:88%} 100%{top:8%} }
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid ${C.green}; outline-offset: 2px; }
        input:focus-visible { outline: 2px solid ${C.blue}; }
        @media (max-width:860px){ aside{display:none!important} }
      `}</style>
    </div>
  );
}

/* ---------------- 대시보드 ---------------- */
function Dashboard({ stat, tasks, runTask, feed, events, onOpen, clock }) {
  const hour = clock.getHours();
  const greet = hour < 12 ? "좋은 아침이에요" : hour < 18 ? "오늘도 수고 많으세요" : "늦은 시간까지 고생 많으세요";
  const todayEvents = events.filter((e) => ["D-DAY", "D-1", "D-2"].includes(dday(e.date)));
  const lvl = {
    urgent: { fg: C.red, bg: C.redSoft, label: "긴급", Icon: AlertTriangle },
    start: { fg: C.blue, bg: C.blueSoft, label: "시작", Icon: Send },
    todo: { fg: C.amber, bg: C.amberSoft, label: "할 일", Icon: Clock },
  };
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 4 }}>{greet}</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-.03em" }}>오늘의 행사 브리핑</h1>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
        {[["진행 중 행사", stat.running, "건", TrendingUp, C.blue],
          ["오늘 예정", stat.today, "건", CalendarDays, C.green],
          ["참석 확정 인원", stat.totalYes.toLocaleString(), "명", UserCheck, C.green],
          ["평균 회신율", stat.rate, "%", Activity, C.amber]].map(([lab, v, unit, Icon, col]) => (
          <div key={lab} style={{ background: C.card, borderRadius: 16, padding: "18px 18px 16px", border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{lab}</span><Icon size={18} color={col} />
            </div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>
              {v}<span style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginLeft: 3 }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 20, alignItems: "start" }}>
        <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: C.greenSoft, display: "grid", placeItems: "center" }}><Sparkles size={18} color={C.green} /></div>
            <div><div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.02em" }}>지금 처리할 일</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>시스템이 행사 상태를 살펴 우선순위대로 정리했어요</div></div>
            <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: C.green }}>{tasks.length}</span>
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {tasks.length === 0 && (
              <div style={{ textAlign: "center", padding: "36px 20px", color: C.muted }}>
                <CheckCircle2 size={38} color={C.green} style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>지금은 처리할 일이 없어요</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>새 회신이 오면 여기에 자동으로 나타납니다.</div>
              </div>
            )}
            {tasks.map((t) => {
              const L = lvl[t.level];
              return (
                <div key={t.id} style={{ display: "flex", gap: 13, padding: 14, borderRadius: 13, border: `1px solid ${C.line}`, background: "#FCFDFE", animation: "pnuIn .25s ease" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: L.bg, display: "grid", placeItems: "center", flexShrink: 0 }}><L.Icon size={18} color={L.fg} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Chip bg={L.bg} fg={L.fg}>{L.label}</Chip>
                    <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-.01em", marginTop: 6 }}>{t.title}</div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{t.why}</div>
                  </div>
                  <button onClick={() => runTask(t)} style={{ alignSelf: "center", whiteSpace: "nowrap", background: C.blue, color: "#fff",
                    border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT,
                    display: "inline-flex", alignItems: "center", gap: 5 }}>{t.action} <ChevronRight size={15} /></button>
                </div>
              );
            })}
          </div>
        </section>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={17} color={C.green} /><span style={{ fontSize: 15, fontWeight: 800 }}>실시간 활동</span>
              <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: 999, background: C.green, boxShadow: `0 0 0 4px ${C.greenSoft}` }} />
            </div>
            <div style={{ padding: 6 }}>
              {feed.map((f, i) => {
                const tone = { yes: C.green, no: C.red, open: C.blue, info: C.muted }[f.tone];
                const Icn = { yes: UserCheck, no: X, open: MailOpen, info: Activity }[f.tone];
                return (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", alignItems: "flex-start", animation: i === 0 ? "pnuIn .3s ease" : "none" }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "#F1F5F9", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}><Icn size={14} color={tone} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, lineHeight: 1.45 }}>{f.txt}</div><div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{f.t}</div></div>
                  </div>
                );
              })}
            </div>
          </section>
          <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDays size={17} color={C.blue} /><span style={{ fontSize: 15, fontWeight: 800 }}>임박한 행사</span>
            </div>
            <div style={{ padding: 8 }}>
              {todayEvents.length === 0 && <div style={{ padding: "20px 14px", fontSize: 13, color: C.muted, textAlign: "center" }}>2일 이내 예정된 행사가 없어요.</div>}
              {todayEvents.map((e) => (
                <button key={e.id} onClick={() => onOpen(e.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", borderRadius: 11, border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT }}>
                  <div style={{ width: 46, borderRadius: 9, background: C.blue, color: "#fff", padding: "6px 0", textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#BFE3CF" }}>{dday(e.date)}</div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{e.time}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{e.place} · 참석 {e.yes}명</div>
                  </div>
                  <ChevronRight size={16} color={C.muted} />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 행사 목록 ---------------- */
function EventsList({ events, onOpen, onCompose }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-.03em" }}>행사 목록</h1>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3 }}>전체 {events.length}개 행사의 진행 상황을 한눈에 확인하세요</div></div>
        <button onClick={onCompose} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 11, padding: "11px 16px",
          fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={17} /> 새 초대장 발송</button>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {events.map((e) => (
          <button key={e.id} onClick={() => onOpen(e.id)} style={{ textAlign: "left", background: C.card, borderRadius: 16,
            border: `1px solid ${C.line}`, padding: "18px 20px", cursor: "pointer", fontFamily: FONT }}>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: catColor(e.cat) }}>{e.cat}</span>
                  <StageBadge stage={e.stage} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: dday(e.date) === "D-DAY" ? C.red : C.green }}>{dday(e.date)}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>{e.title}</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: C.muted }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CalendarDays size={14} /> {fmtDate(e.date)} {e.time}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={14} /> {e.place}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Users size={14} /> {e.yes} / {e.capacity}명</span>
                </div>
              </div>
              <div style={{ flex: "1 1 240px", minWidth: 220 }}><AttBar e={e} /></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 행사 상세 ---------------- */
function Detail({ e, onBack, onCompose, onQR, onRemind }) {
  const attendees = useMemo(() => {
    const nm = ["김서연","이준호","박민준","최지우","정하윤","강도현","윤서아","임채원"];
    const roles = ["교수","직원","학생","외부인사","학부모"];
    return Array.from({ length: Math.min(8, e.yes) }).map((_, i) => ({ name: nm[i % nm.length], role: roles[i % roles.length] }));
  }, [e]);
  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
        color: C.muted, cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, marginBottom: 16 }}><ArrowLeft size={16} /> 행사 목록으로</button>
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: "24px 26px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: catColor(e.cat) }}>{e.cat}</span>
              <StageBadge stage={e.stage} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: dday(e.date) === "D-DAY" ? C.red : C.green }}>{dday(e.date)}</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-.03em" }}>{e.title}</h1>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13.5, color: C.muted }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><CalendarDays size={15} /> {fmtDate(e.date)} {e.time}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin size={15} /> {e.place}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Users size={15} /> 주관: {e.host}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", flexWrap: "wrap" }}>
            <button onClick={onQR} style={{ background: "#fff", color: C.blue, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 15px",
              fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}><QrCode size={16} /> QR 체크인</button>
            <button onClick={onRemind} style={{ background: "#fff", color: C.blue, border: `1.5px solid ${C.line}`, borderRadius: 11, padding: "10px 15px",
              fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}><Bell size={16} /> 리마인더</button>
            <button onClick={onCompose} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 11, padding: "10px 15px",
              fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}><Send size={16} /> 초대장 발송</button>
          </div>
        </div>
        <div style={{ marginTop: 26, paddingTop: 22, borderTop: `1px solid ${C.line}` }}><Stepper stage={e.stage} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18, alignItems: "start" }}>
        <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: "22px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>인원 현황</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}><Donut e={e} /></div>
          <div style={{ display: "grid", gap: 10 }}>
            {[["초대 발송", e.invited, C.blue],["초대장 열람", `${e.opened} (${openRate(e)}%)`, C.blue],
              ["참석 확정", e.yes, C.green],["불참", e.no, C.red],["미회신", pending(e), C.muted]].map(([lab, v, col]) => (
              <div key={lab} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, paddingBottom: 9, borderBottom: "1px solid #F1F5F9" }}>
                <span style={{ color: C.muted, display: "inline-flex", alignItems: "center", gap: 7 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: col }} />{lab}</span>
                <b style={{ color: C.ink }}>{v}</b>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>
              <span>정원 대비</span><span style={{ color: e.yes > e.capacity ? C.red : C.green }}>{e.yes} / {e.capacity}명</span>
            </div>
          </div>
        </section>
        <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>참석자 명단</span><span style={{ fontSize: 12.5, color: C.muted }}>실시간 갱신 · 상위 {attendees.length}명</span>
          </div>
          <div>
            {attendees.length === 0 && <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13.5 }}>아직 참석 회신이 없어요. 초대장을 발송하면 여기에 표시됩니다.</div>}
            {attendees.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: i < attendees.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, background: "#EEF2F7", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: C.blue }}>{a.name[0]}</div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.name}</div><div style={{ fontSize: 12, color: C.muted }}>{a.role}</div></div>
                <Chip bg={C.greenSoft} fg={C.green}>참석</Chip>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- QR 현장 체크인 ---------------- */
function CheckIn({ events, checkId, setCheckId, doCheckIn, pushToast }) {
  const e = events.find((x) => x.id === checkId) || events.find((x) => x.stage >= 3) || events[0];
  const [recent, setRecent] = useState([
    { name: "이수민", role: "교수", t: "방금" }, { name: "정우성", role: "직원", t: "1분 전" }, { name: "김하늘", role: "외부인사", t: "2분 전" },
  ]);
  const [q, setQ] = useState("");
  const pool = ["박서진","최민서","한도윤","오지안","윤예준","임하은","신유나","서건우","조은채","강시우"];
  const roles = ["교수","직원","학생","외부인사","학부모"];

  /* 현장 체크인 실시간 시뮬레이션 (데모 모드 · 이 화면에 있는 동안만) */
  useEffect(() => {
    if (SHEETS.enabled || !e) return; // 시트 연결 시엔 폴링으로 실제 도착이 반영됨
    const id = setInterval(() => {
      if (e.checkedIn >= e.yes) return;
      const nm = pool[Math.floor(Math.random() * pool.length)];
      const role = roles[Math.floor(Math.random() * roles.length)];
      doCheckIn(e.id, nm);
      setRecent((r) => [{ name: nm, role, t: "방금" }, ...r.map((x) => ({ ...x, t: x.t === "방금" ? "1분 전" : x.t }))].slice(0, 8));
    }, 3200);
    return () => clearInterval(id);
  }, [e?.id, e?.checkedIn, e?.yes]);

  const manual = () => {
    if (!e || e.checkedIn >= e.yes) { pushToast("모든 참석자가 체크인했어요"); return; }
    const nm = q.trim() || pool[Math.floor(Math.random() * pool.length)];
    doCheckIn(e.id, nm);
    setRecent((r) => [{ name: nm, role: "직원", t: "방금" }, ...r].slice(0, 8));
    pushToast(`${nm}님 체크인 완료`); setQ("");
  };
  const rate = e && e.yes ? Math.round((e.checkedIn / e.yes) * 100) : 0;

  if (!e) return <div style={{ padding: "60px 0", textAlign: "center", color: C.muted, fontSize: 14 }}>행사 데이터를 불러오는 중입니다…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-.03em" }}>QR 현장 체크인</h1>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3 }}>QR을 입구에 띄우면 참석자 도착이 실시간으로 집계됩니다</div></div>
        <select value={checkId} onChange={(ev) => setCheckId(+ev.target.value)} style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600,
          padding: "10px 14px", borderRadius: 11, border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, cursor: "pointer" }}>
          {events.filter((x) => x.stage >= 3).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,380px) 1fr", gap: 18, alignItems: "start" }}>
        {/* QR 카드 */}
        <section style={{ background: C.navy, borderRadius: 20, padding: "26px 24px", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 12.5, color: "#9DBBDE", fontWeight: 700, marginBottom: 4 }}>{e.host}</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18, letterSpacing: "-.02em" }}>{e.title}</div>
          <div style={{ position: "relative", background: "#fff", borderRadius: 16, padding: 16, display: "inline-block" }}>
            <QRCode seed={`PNU-${e.id}-${e.title}`} size={210} color={C.navy} />
            <div style={{ position: "absolute", left: 16, right: 16, height: 3, background: C.green, borderRadius: 2,
              boxShadow: `0 0 10px ${C.green}`, animation: "pnuScan 2.6s ease-in-out infinite" }} />
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: "#CBDDF1", lineHeight: 1.6 }}>
            참석자가 휴대폰으로 이 QR을 스캔하면<br />자동으로 체크인됩니다.
          </div>
          <div style={{ marginTop: 16, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "#9DBBDE", marginBottom: 8, fontWeight: 700, textAlign: "left" }}>이름으로 직접 체크인</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, background: "#fff", borderRadius: 9, padding: "0 10px" }}>
                <Search size={15} color={C.muted} />
                <input value={q} onChange={(ev) => setQ(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && manual()}
                  placeholder="참석자 이름" style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 13.5, fontFamily: FONT, background: "transparent", color: C.ink }} />
              </div>
              <button onClick={manual} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 9, padding: "0 14px",
                fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>체크인</button>
            </div>
          </div>
        </section>

        {/* 실시간 도착 현황 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <ScanLine size={18} color={C.green} /><span style={{ fontSize: 15, fontWeight: 800 }}>실시간 도착 현황</span>
              <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: 999, background: C.green, boxShadow: `0 0 0 4px ${C.greenSoft}` }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
              <Ring value={e.checkedIn} total={e.yes} color={C.green} big={e.checkedIn} sub={`/ ${e.yes}명 도착`} />
              <div style={{ flex: 1, minWidth: 180, display: "grid", gap: 12 }}>
                {[["체크인 완료", e.checkedIn, "명", C.green],["아직 미도착", Math.max(0, e.yes - e.checkedIn), "명", C.amber],["도착률", rate, "%", C.blue]].map(([l, v, u, col]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#F8FAFC", borderRadius: 11 }}>
                    <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: 19, fontWeight: 800, color: col }}>{v}<span style={{ fontSize: 12, color: C.muted, marginLeft: 2 }}>{u}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, fontSize: 15, fontWeight: 800 }}>최근 체크인</div>
            <div style={{ padding: 8 }}>
              {recent.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", animation: i === 0 ? "pnuIn .3s ease" : "none" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: C.greenSoft, display: "grid", placeItems: "center" }}><UserCheck size={17} color={C.green} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name} <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>· {r.role}</span></div></div>
                  <span style={{ fontSize: 12, color: C.muted }}>{r.t}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 통계 리포트 ---------------- */
function Report({ events, stat, pushToast }) {
  const held = events.filter((e) => e.invited > 0);
  const seatRate = Math.round((held.reduce((a, e) => a + e.yes / e.capacity, 0) / (held.length || 1)) * 100);

  const barData = held.map((e) => ({ name: e.title.length > 9 ? e.title.slice(0, 9) + "…" : e.title, 참석: e.yes, 정원: e.capacity }));
  const catMap = {};
  events.forEach((e) => { if (e.yes) catMap[e.cat] = (catMap[e.cat] || 0) + e.yes; });
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const totalYes = stat.totalYes;
  const trendLabels = ["6일 전", "5일 전", "4일 전", "3일 전", "2일 전", "어제", "오늘"];
  const w = [0.06, 0.14, 0.24, 0.4, 0.6, 0.82, 1];
  const trendData = trendLabels.map((day, i) => ({ day, 누적회신: Math.round(totalYes * w[i]) }));

  const KPI = [["개최·준비 행사", held.length, "건", CalendarDays, C.blue],
    ["누적 참석 확정", totalYes.toLocaleString(), "명", UserCheck, C.green],
    ["평균 회신율", stat.rate, "%", Activity, C.amber],
    ["평균 좌석 점유율", seatRate, "%", Percent, "#6E4BC4"]];
  const PIE_COLORS = [C.blue, C.green, C.amber, "#6E4BC4", "#C0398A", C.muted];

  const Card = ({ title, sub, children, h = 300 }) => (
    <section style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: "20px 22px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>{sub}</div>}
      <div style={{ width: "100%", height: h }}>{children}</div>
    </section>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-.03em" }}>통계 리포트</h1>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3 }}>전체 행사 실적을 요약했어요. 수치는 실시간으로 갱신됩니다</div></div>
        <button onClick={() => pushToast("리포트를 내려받았어요")} style={{ background: "#fff", color: C.blue, border: `1.5px solid ${C.line}`,
          borderRadius: 11, padding: "11px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Download size={17} /> 리포트 내보내기
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
        {KPI.map(([lab, v, u, Icon, col]) => (
          <div key={lab} style={{ background: C.card, borderRadius: 16, padding: "18px", border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{lab}</span><Icon size={18} color={col} /></div>
            <div style={{ marginTop: 10, fontSize: 27, fontWeight: 800 }}>{v}<span style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginLeft: 3 }}>{u}</span></div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 18, marginBottom: 18 }}>
        <Card title="행사별 참석 인원" sub="정원 대비 실제 참석 확정 인원">
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF1F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: FONT }} cursor={{ fill: "#F1F5F9" }} />
              <Legend wrapperStyle={{ fontSize: 12.5, fontFamily: FONT }} />
              <Bar dataKey="정원" fill="#D3DEEA" radius={[5, 5, 0, 0]} />
              <Bar dataKey="참석" fill={C.blue} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card title="회신 추이" sub="최근 7일 누적 참석 회신" h={280}>
          <ResponsiveContainer>
            <AreaChart data={trendData} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.green} stopOpacity={0.32} /><stop offset="100%" stopColor={C.green} stopOpacity={0.02} />
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF1F6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} />
              <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: FONT }} />
              <Area type="monotone" dataKey="누적회신" stroke={C.green} strokeWidth={2.5} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="분야별 참석 비중" sub="카테고리별 참석 확정 인원" h={280}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={90} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: FONT }} />
              <Legend wrapperStyle={{ fontSize: 12.5, fontFamily: FONT }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- 초대장 발송 마법사 ---------------- */
function Compose({ events, presetId, onClose, onSent }) {
  const [step, setStep] = useState(1);
  const [eid, setEid] = useState(presetId ?? events[0]?.id);
  const [tone, setTone] = useState("formal");
  const [count, setCount] = useState(50);
  const e = events.find((x) => x.id === eid) || events[0];
  const templates = { formal: "정중하고 공식적인 안내문 (교외 인사·귀빈용)", friendly: "친근하고 부드러운 안내문 (교내 구성원용)", brief: "핵심만 담은 간결한 안내문 (재안내·리마인더용)" };
  const body = {
    formal: `안녕하십니까. 부산대학교 ${e?.host}입니다.\n\n「${e?.title}」에 귀하를 정중히 초대합니다.\n아래 일정을 확인하시어 많은 참석 부탁드립니다.`,
    friendly: `안녕하세요! 부산대학교 ${e?.host}입니다.\n\n「${e?.title}」 행사에 여러분을 초대합니다.\n편하게 오셔서 함께해 주세요 :)`,
    brief: `[부산대 ${e?.host}] 「${e?.title}」 안내드립니다. 참석 여부를 회신해 주세요.`,
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,34,51,.5)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ background: C.card, borderRadius: 20, width: "min(680px,100%)", maxHeight: "90vh",
        overflow: "auto", fontFamily: FONT, boxShadow: "0 30px 80px rgba(12,34,51,.35)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.blueSoft, display: "grid", placeItems: "center" }}><Send size={19} color={C.blue} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 800 }}>초대장 발송</div><div style={{ fontSize: 12.5, color: C.muted }}>3단계만 따라오시면 됩니다 · {step}/3</div></div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={22} color={C.muted} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "14px 24px 0" }}>
          {[1, 2, 3].map((s) => <div key={s} style={{ flex: 1, height: 5, borderRadius: 3, background: s <= step ? C.green : "#E2E8F0", transition: "background .3s" }} />)}
        </div>
        <div style={{ padding: 24 }}>
          {step === 1 && (
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>어떤 행사의 초대장인가요?</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>초대장을 보낼 행사를 골라 주세요.</p>
              <div style={{ display: "grid", gap: 10 }}>
                {events.map((ev) => (
                  <button key={ev.id} onClick={() => setEid(ev.id)} style={{ textAlign: "left", padding: "14px 16px", borderRadius: 13, cursor: "pointer",
                    background: eid === ev.id ? C.blueSoft : "#fff", fontFamily: FONT, border: `1.5px solid ${eid === ev.id ? C.blue : C.line}` }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{fmtDate(ev.date)} {ev.time} · {ev.place}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>안내 문구를 골라 주세요</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>받는 분에 맞는 말투를 고르면 문구가 자동으로 완성돼요.</p>
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {Object.entries(templates).map(([k, label]) => (
                  <button key={k} onClick={() => setTone(k)} style={{ textAlign: "left", padding: "13px 15px", borderRadius: 12, cursor: "pointer",
                    background: tone === k ? C.blueSoft : "#fff", fontFamily: FONT, border: `1.5px solid ${tone === k ? C.blue : C.line}`, fontSize: 13.5, fontWeight: 600 }}>{label}</button>
                ))}
              </div>
              <div style={{ background: "#F8FAFC", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, marginBottom: 8 }}>미리보기</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line", color: C.ink }}>{body[tone]}</div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.line}`, fontSize: 12.5, color: C.muted }}>📅 {fmtDate(e.date)} {e.time} · 📍 {e.place}</div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>몇 분께 보낼까요?</h3>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: C.muted }}>발송 대상 인원을 정하고 발송하면 끝이에요.</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <input type="range" min="10" max="500" step="10" value={count} onChange={(ev) => setCount(+ev.target.value)} style={{ flex: 1, accentColor: C.green }} />
                <div style={{ minWidth: 78, textAlign: "right", fontSize: 22, fontWeight: 800 }}>{count}<span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>명</span></div>
              </div>
              <div style={{ background: C.blueSoft, borderRadius: 13, padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: C.blue }}>발송 요약</div>
                {[["행사", e.title],["일시", `${fmtDate(e.date)} ${e.time}`],["말투", templates[tone].split(" (")[0]],["대상", `${count}명`]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                    <span style={{ color: C.muted }}>{k}</span><b style={{ color: C.ink, textAlign: "right", maxWidth: "70%" }}>{v}</b>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Mail size={14} style={{ marginTop: 1, flexShrink: 0 }} /> 발송 후 열람·회신 현황이 대시보드에 실시간 반영됩니다. 현장에서는 QR 체크인으로 도착 인원을 집계할 수 있어요.
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => (step === 1 ? onClose() : setStep(step - 1))} style={{ background: "#fff", color: C.muted, border: `1.5px solid ${C.line}`,
            borderRadius: 11, padding: "11px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>{step === 1 ? "취소" : "이전"}</button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 11, padding: "11px 22px",
              fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}>다음 <ChevronRight size={17} /></button>
          ) : (
            <button onClick={() => onSent(eid, count)} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 11, padding: "11px 22px",
              fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 7 }}><Send size={17} /> {count}명에게 발송하기</button>
          )}
        </div>
      </div>
    </div>
  );
}
