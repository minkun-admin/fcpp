/* 투표가 마감되면 관리자 기기(adminDevices)로만 푸시 알림을 보내요. 5분마다 확인해요. */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { dueMessages, monthlyMessage, reportMessage, reportReady } = require("./lib");

admin.initializeApp();

/* 관리자 기기들로 푸시를 보내고, 만료된 토큰은 정리해요 */
async function pushToAdmins(db, title, body) {
  const devSnap = await db.collection("adminDevices").get();
  const tokens = devSnap.docs.map((d) => d.id);
  if (!tokens.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokens,
    data: { title: title, body: body },
    webpush: { headers: { Urgency: "high", TTL: "86400" } }
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => db.doc("adminDevices/" + t).delete()));
}

/* 매월 1일 오전 9시(한국 시간): 지난달 경기가 있으면 "결산이 완료되었습니다" 알림 */
exports.notifyMonthlyReport = onSchedule(
  { schedule: "0 9 1 * *", region: "asia-northeast3", timeZone: "Asia/Seoul", memory: "256MiB" },
  async () => {
    const db = admin.firestore();
    const m = monthlyMessage(Date.now());
    const snap = await db.collection("matches")
      .where(admin.firestore.FieldPath.documentId(), ">=", m.start)
      .where(admin.firestore.FieldPath.documentId(), "<", m.end)
      .limit(1).get();
    if (snap.empty) return;
    const key = m.start.slice(0, 7);
    if ((await db.doc("notices/" + key).get()).exists) return; // 마지막 경기 투표 마감 때 이미 알렸어요
    await db.doc("notices/" + key).set({ sentAt: Date.now(), via: "monthly" });
    await pushToAdmins(db, m.title, m.body);
  }
);

exports.notifyPollClosed = onSchedule(
  { schedule: "every 5 minutes", region: "asia-northeast3", timeZone: "Asia/Seoul", memory: "256MiB" },
  async () => {
    const db = admin.firestore();
    const pollSnap = await db.collection("polls").get();
    const polls = pollSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    const due = dueMessages(polls, Date.now());
    if (!due.length) return;

    const devSnap = await db.collection("adminDevices").get();
    const tokens = devSnap.docs.map((d) => d.id);

    for (const m of due) {
      if (tokens.length) {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: tokens,
          data: { title: m.title, body: m.body },
          webpush: { headers: { Urgency: "high", TTL: "86400" } }
        });
        const dead = [];
        res.responses.forEach((r, i) => {
          const code = r.error && r.error.code;
          if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(tokens[i]);
        });
        await Promise.all(dead.map((t) => db.doc("adminDevices/" + t).delete()));
      }
      await db.doc("polls/" + m.id).update({ notified: true });
      // 그 달 마지막 주 경기의 투표까지 모두 마감되면 "결산 완료" 알림 (달마다 한 번)
      const key = reportReady(polls, m.id, Date.now());
      if (key && !(await db.doc("notices/" + key).get()).exists) {
        await db.doc("notices/" + key).set({ sentAt: Date.now(), via: "poll" });
        const rm = reportMessage(key);
        await pushToAdmins(db, rm.title, rm.body);
      }
    }
  }
);
