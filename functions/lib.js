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
/* 매월 1일: 지난달 결산 알림 문구 (한국 시간 기준 날짜로 계산) */
function monthlyMessage(now) {
  var k = new Date(now + 9 * 3600 * 1000); // KST
  var y = k.getUTCFullYear(), mo = k.getUTCMonth() + 1; // 이번 달
  var py = mo === 1 ? y - 1 : y, pm = mo === 1 ? 12 : mo - 1;
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var start = py + "-" + pad(pm) + "-01", end = y + "-" + pad(mo) + "-01";
  return {
    start: start, end: end,
    title: pm + "월 결산이 완료되었습니다",
    body: "관리자 탭 > 월간 결산에서 이미지를 만들어 카톡방에 공유하세요."
  };
}
function reportMessage(key) {
  return { title: Number(key.slice(5, 7)) + "월 결산이 완료되었습니다", body: "관리자 탭 > 월간 결산에서 이미지를 만들어 카톡방에 공유하세요." };
}
/* 이 투표가 "그 달 마지막 주 경기"(7일 뒤가 다음 달)이고, 그 달의 모든 투표가 마감됐으면 그 달(YYYY-MM)을 돌려줘요 */
function reportReady(polls, pollDate, now) {
  var p = String(pollDate).split("-");
  if (p.length !== 3) return null;
  var key = p[0] + "-" + p[1];
  var next = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + 7));
  var nextKey = next.getUTCFullYear() + "-" + String(next.getUTCMonth() + 1).padStart(2, "0");
  if (nextKey === key) return null;
  var inMonth = polls.filter(function (x) { return x && x.date && String(x.date).slice(0, 7) === key && Array.isArray(x.candidates); });
  if (!inMonth.length || !inMonth.every(function (x) { return isClosed(x, now); })) return null;
  return key;
}
module.exports = { toMs: toMs, fmtDate: fmtDate, isClosed: isClosed, dueMessages: dueMessages, monthlyMessage: monthlyMessage, reportMessage: reportMessage, reportReady: reportReady };
