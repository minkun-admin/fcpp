/* 투표가 마감되면 관리자 기기(adminDevices)로만 푸시 알림을 보내요. 5분마다 확인해요. */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { dueMessages } = require("./lib");

admin.initializeApp();

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
    }
  }
);
