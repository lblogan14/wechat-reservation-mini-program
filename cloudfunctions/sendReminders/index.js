const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(['confirmed', 'checked_in']);

function normalizeDate(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function fmtDateTime(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mi}`;
}

async function loadCatalog(db) {
  const cRes = await db.collection('daycareConfig').limit(1).get();
  const config = cRes.data[0] || null;
  const sRes = await db.collection('services').limit(200).get().catch(() => ({ data: [] }));
  const services = new Map(sRes.data.map((s) => [s._id, s]));
  return { config, services };
}

async function buildPetMap(db, petIds) {
  if (!petIds.length) return new Map();
  const _ = db.command;
  const res = await db.collection('pets').where({ _id: _.in(petIds) }).limit(500).get();
  return new Map(res.data.map((p) => [p._id, p]));
}

function buildData(booking, daycareName, serviceName, petNames, dateLabel) {
  // Generic 5-field payload. The user maps these to whichever fields their template defines in
  // 微信公众平台. Each value MUST conform to WeChat's per-field length + character rules
  // (~20 chars typical). The cloud function will swallow per-field validation errors with a log.
  return {
    thing1: { value: daycareName.slice(0, 20) || 'Pet Daycare' },
    thing2: { value: petNames.join(', ').slice(0, 20) || 'Your pet' },
    thing3: { value: serviceName.slice(0, 20) || '—' },
    date4: { value: dateLabel },
    thing5: { value: '请按预约时间送/接宠物' },
  };
}

async function sendOne(touser, tmplId, data) {
  try {
    const r = await cloud.openapi.subscribeMessage.send({
      touser,
      templateId: tmplId,
      page: 'pages/bookings/list/list',
      data,
      miniprogramState: 'formal',
      lang: 'zh_CN',
    });
    return { ok: true, raw: r };
  } catch (err) {
    return { ok: false, error: err && err.errMsg ? err.errMsg : String(err) };
  }
}

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;
  const todayStart = normalizeDate(Date.now());
  const tomorrowStart = todayStart + DAY_MS;
  const dayAfter = tomorrowStart + DAY_MS;

  const { config, services } = await loadCatalog(db);
  if (!config) {
    return { ok: false, error: 'no daycareConfig row', sent: 0 };
  }
  const dropoffTmplId = (config.reminderDropoffTmplId || '').trim();
  const pickupTmplId = (config.reminderPickupTmplId || '').trim();
  if (!dropoffTmplId && !pickupTmplId) {
    return { ok: true, sent: 0, skipped: 'no template IDs configured' };
  }

  // Window: bookings whose dropoff is in [tomorrow, dayAfter) or pickup is in [today, tomorrow).
  let target;
  try {
    target = await db.collection('bookings')
      .where(_.or([
        { dropoffAt: _.gte(tomorrowStart).and(_.lt(dayAfter)) },
        { pickupAt: _.gte(todayStart).and(_.lt(tomorrowStart)) },
      ]))
      .limit(500)
      .get();
  } catch (err) {
    return { ok: false, error: `query failed: ${err && err.errMsg ? err.errMsg : err}` };
  }

  // Resolve pet names in one batch
  const petIds = Array.from(new Set(target.data.flatMap((b) => b.petIds || [])));
  const petMap = await buildPetMap(db, petIds);

  const daycareName = config.nameZh || config.nameEn || '宠物寄养';
  let sent = 0;
  let skipped = 0;
  const errors = [];

  // Optimistic claim: flip the flag BEFORE sending. If two concurrent invocations race,
  // only one update succeeds (stats.updated === 1). The other sees 0 and skips.
  // Failure mode if send() throws after the flag flip: we lose that reminder rather than
  // double-send. That's the safer direction for users.
  async function claimReminder(bookingId, kind) {
    const field = kind === 'dropoff' ? 'reminderSentDropoff' : 'reminderSentPickup';
    try {
      const res = await db.collection('bookings')
        .where({ _id: bookingId, [field]: _.neq(true) })
        .update({ data: { [field]: true, updatedAt: Date.now() } });
      return res.stats && res.stats.updated === 1;
    } catch (err) {
      return false;
    }
  }

  for (const b of target.data) {
    if (!ACTIVE_STATUSES.has(b.bookingStatus)) continue;

    const svc = services.get(b.serviceId);
    const serviceName = svc ? (svc.nameZh || svc.nameEn || '') : '';
    const petNames = (b.petIds || []).map((id) => petMap.get(id)?.name).filter(Boolean);

    const dropoffDay = normalizeDate(b.dropoffAt);
    const pickupDay = normalizeDate(b.pickupAt);

    const before = sent + errors.length;

    // Drop-off reminder: dropoff day is tomorrow + we haven't sent yet
    if (dropoffTmplId && dropoffDay === tomorrowStart && !b.reminderSentDropoff) {
      const claimed = await claimReminder(b._id, 'dropoff');
      if (claimed) {
        const data = buildData(b, daycareName, serviceName, petNames, fmtDateTime(b.dropoffAt));
        const r = await sendOne(b.parentOpenid, dropoffTmplId, data);
        if (r.ok) sent += 1;
        else errors.push({ bookingId: b._id, kind: 'dropoff', error: r.error });
      }
    }

    // Pick-up reminder: pickup day is today + we haven't sent yet
    if (pickupTmplId && pickupDay === todayStart && !b.reminderSentPickup) {
      const claimed = await claimReminder(b._id, 'pickup');
      if (claimed) {
        const data = buildData(b, daycareName, serviceName, petNames, fmtDateTime(b.pickupAt));
        const r = await sendOne(b.parentOpenid, pickupTmplId, data);
        if (r.ok) sent += 1;
        else errors.push({ bookingId: b._id, kind: 'pickup', error: r.error });
      }
    }

    if (sent + errors.length === before) skipped += 1;
  }

  return { ok: true, sent, skipped, errors };
};
