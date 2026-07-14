/* ==================================================================
 * 구글 시트 연동 레이어
 * ------------------------------------------------------------------
 * 사용법
 *  1) google-apps-script/Code.gs 를 구글 시트에 붙여넣고 "웹 앱"으로 배포
 *  2) 배포 후 받은 웹 앱 URL(.../exec)을 아래 API_URL 에 붙여넣기
 *  3) URL 을 비워두면 데모 데이터로 동작합니다(배포 전 미리보기용)
 * ================================================================== */

export const SHEETS = {
  API_URL: "https://script.google.com/macros/s/AKfycbwNc39rpuDZ8uhJw_4Q0b5QFml7cLXwiX0u4j0v-jSWak7b63r-nL7Idjk451SmeRGB6A/exec",
  POLL_MS: 5000, // 실시간 갱신 주기(ms)
};
SHEETS.enabled = !!SHEETS.API_URL;

/* 시트 → 앱 데이터 형태로 변환 */
function normalize(r) {
  const parts = String(r.date || "").split(/[-/.]/).map((n) => parseInt(n, 10));
  const [y, m, d] = parts.length === 3 ? parts : [2026, 1, 1];
  return {
    id: Number(r.id),
    title: r.title || "",
    cat: r.category || r.cat || "행사",
    date: new Date(y, (m || 1) - 1, d || 1),
    time: r.time || "",
    place: r.place || "",
    host: r.host || "",
    capacity: +r.capacity || 0,
    invited: +r.invited || 0,
    opened: +r.opened || 0,
    yes: +r.yes || 0,
    no: +r.no || 0,
    stage: +r.stage || 0,
    checkedIn: +r.checkedIn || 0,
  };
}

export async function loadEventsRemote() {
  if (!SHEETS.enabled) return [];
  const res = await fetch(`${SHEETS.API_URL}?action=events`);
  const data = await res.json();
  return (data.events || []).map(normalize);
}

/* 쓰기 요청: text/plain 으로 보내 CORS preflight 를 피함 */
function post(action, payload) {
  if (!SHEETS.enabled) return Promise.resolve(null);
  return fetch(SHEETS.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  }).catch(() => null);
}

export const api = {
  invite: (eventId, count) => post("invite", { eventId, count }),
  checkin: (eventId, name) => post("checkin", { eventId, name }),
  rsvp: (eventId, attend) => post("rsvp", { eventId, attend }), // attend: true/false
  waitlist: (eventId) => post("waitlist", { eventId }),
  remind: (eventId) => post("remind", { eventId }),
};
