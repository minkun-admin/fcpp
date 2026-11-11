/* 알림이 필요한 투표를 고르고 알림 문구를 만드는 순수 함수 (테스트하기 쉽게 분리) */
var DOW = ["일", "월", "화", "수", "목", "금", "토"];
function toMs(v) {
  if (v && typeof v.toMillis === "function") return v.toMillis();
  return Number(v) || 0;
}
function fmtDate(s) {
  var p = String(s).split("-");
  if (p.length !== 3) return String(s);
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  return Number(p[1]) + "/" + Number(p[2]) + "(" + DOW[d.getUTCDay()] + ")";
}
function isClosed(p, now) {
  var cands = Array.isArray(p.candidates) ? p.candidates.length : 0;
  return now >= toMs(p.endsAt) || (cands > 0 && (Number(p.votes) || 0) >= cands);
}
/* 마감됐고 아직 알리지 않은 최근 투표(생성 후 4일 이내)만 */
function dueMessages(polls, now) {
  var WINDOW = 4 * 24 * 3600 * 1000;
  return polls.filter(function (p) {
    return p && p.date && Array.isArray(p.candidates) && !p.notified &&
      now - toMs(p.createdAt) < WINDOW && isClosed(p, now);
  }).map(function (p) {
    return {
      id: p.id,
      title: "MOM 투표가 마감됐어요",
      body: fmtDate(p.date) + " · " + (Number(p.votes) || 0) + "/" + p.candidates.length + "명 참여. 결과를 확인해 보세요."
    };
  });
}
module.exports = { toMs: toMs, fmtDate: fmtDate, isClosed: isClosed, dueMessages: dueMessages };
