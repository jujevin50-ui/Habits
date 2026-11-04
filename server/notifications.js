import { createHash, timingSafeEqual } from 'node:crypto';

const STORE = 'habits:devices:v1';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export function authorized(header, secret) {
  if (!secret) return false;
  const actual = Buffer.from(header || ''), expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function subscriptionId(subscription) {
  return createHash('sha256').update(subscription.endpoint).digest('hex');
}
export function validateSubscription(subscription) {
  let url;
  try { url = new URL(subscription?.endpoint); } catch { throw fail('Abonnement invalide.'); }
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com');
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed || url.href.length > 4096) throw fail('Service push non pris en charge.');
  const { p256dh, auth } = subscription.keys || {};
  if (typeof p256dh !== 'string' || !/^[\w-]+={0,2}$/.test(p256dh) || Buffer.from(p256dh, 'base64url').length !== 65 || typeof auth !== 'string' || !/^[\w-]+={0,2}$/.test(auth) || Buffer.from(auth, 'base64url').length !== 16) throw fail('Clés push invalides.');
  return { endpoint: url.href, keys: { p256dh, auth } };
}
export function validateSchedule(body) {
  try { new Intl.DateTimeFormat('fr', { timeZone: body.timezone }).format(); } catch { throw fail('Fuseau horaire invalide.'); }
  if (typeof body.timezone !== 'string' || !Array.isArray(body.habits) || body.habits.length > 1000) throw fail('Planning invalide.');
  const habits = body.habits.map(h => {
    if (!h || typeof h.id !== 'string' || !h.id.length || h.id.length > 100 || typeof h.name !== 'string' || !h.name.length || h.name.length > 80 || !Array.isArray(h.days) || !h.days.length || h.days.length > 7 || !h.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) || !Array.isArray(h.reminders) || h.reminders.length > 3 || !h.reminders.every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || (h.completedToday !== null && !/^\d{4}-\d{2}-\d{2}$/.test(h.completedToday))) throw fail('Habitude invalide.');
    return { id: h.id, name: h.name, days: [...new Set(h.days)], reminders: [...new Set(h.reminders)], completedToday: h.completedToday };
  });
  if (new Set(habits.map(h => h.id)).size !== habits.length) throw fail('Identifiants dupliqués.');
  return { habits, timezone: body.timezone };
}
export function dueReminders(device, now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: device.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`, time = `${parts.hour}:${parts.minute}`;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return device.habits.filter(h => h.days.includes(day) && h.reminders.includes(time) && h.completedToday !== date).map(h => ({ title: 'Habits', body: h.name, tag: `habit-${h.id}`, event: `${date}:${time}:${h.id}` }));
}

export function createHandlers({ redis, send, env, now = () => new Date() }) {
  async function sendTo(id, device, payload) {
    try { await send(device.subscription, JSON.stringify(payload)); return true; }
    catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) { await redis.hdel(STORE, id); return false; }
      throw error;
    }
  }
  async function push(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Méthode non autorisée.' }); }
    if (!env.APP_ACCESS_TOKEN) return res.status(503).json({ error: 'APP_ACCESS_TOKEN manque dans Vercel.' });
    if (!authorized(req.headers.authorization, env.APP_ACCESS_TOKEN)) return res.status(401).json({ error: 'Code personnel incorrect.' });
    try {
      let body;
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { throw fail('JSON invalide.'); }
      if (!body || Buffer.byteLength(JSON.stringify(body)) > 250000) throw fail('Requête invalide ou trop volumineuse.');
      if (body.action === 'config') {
        if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) throw fail('Clés VAPID manquantes dans Vercel.', 503);
        return res.status(200).json({ publicKey: env.VAPID_PUBLIC_KEY });
      }
      if (!['sync', 'test', 'disable'].includes(body.action)) throw fail('Action inconnue.');
      const subscription = validateSubscription(body.subscription), id = subscriptionId(subscription);
      if (body.action === 'disable') { await redis.hdel(STORE, id); return res.status(200).json({ ok: true }); }
      if (body.action === 'sync') {
        const schedule = validateSchedule(body);
        if (!await redis.hget(STORE, id) && await redis.hlen(STORE) >= 20) throw fail('Limite de 20 appareils atteinte.', 409);
        await redis.hset(STORE, { [id]: { subscription, ...schedule } });
        return res.status(200).json({ ok: true });
      }
      const device = await redis.hget(STORE, id);
      if (!device) throw fail('Active les notifications sur cet appareil avant de tester.', 404);
      const rateKey = `habits:test:${id}`;
      if (!await redis.set(rateKey, '1', { nx: true, ex: 30 })) throw fail('Attends 30 secondes avant un autre test.', 429);
      if (!await sendTo(id, device, { title: 'Habits', body: 'Tes notifications fonctionnent !', tag: 'habits-test' })) throw fail('Abonnement expiré : réactive les notifications.', 410);
      return res.status(200).json({ ok: true });
    } catch (error) { return res.status(error.status || 503).json({ error: error.status ? error.message : 'Service de notifications indisponible. Vérifie la configuration Redis et VAPID.' }); }
  }
  async function cron(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Méthode non autorisée.' }); }
    if (!env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET manquant.' });
    if (!authorized(req.headers.authorization, env.CRON_SECRET)) return res.status(401).json({ error: 'Non autorisé.' });
    let sent = 0, failed = 0;
    try {
      const devices = await redis.hgetall(STORE) || {}, date = now();
      for (const [id, device] of Object.entries(devices)) {
        for (const reminder of dueReminders(device, date)) {
          const lock = `habits:sent:${id}:${createHash('sha256').update(reminder.event).digest('hex')}`;
          if (!await redis.set(lock, '1', { nx: true, ex: 172800 })) continue;
          try {
            const { event, ...payload } = reminder;
            if (await sendTo(id, device, payload)) sent++;
          } catch { await redis.del(lock); failed++; }
        }
      }
      return res.status(failed ? 503 : 200).json({ sent, failed });
    } catch { return res.status(503).json({ error: 'Traitement des rappels indisponible.', sent, failed }); }
  }
  return { push, cron };
}
