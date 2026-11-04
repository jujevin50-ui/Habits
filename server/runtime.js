import { Redis } from '@upstash/redis';
import webpush from 'web-push';
import { createHandlers } from './notifications.js';

export function handler(name) {
  return async (req, res) => {
    try {
      const redis = Redis.fromEnv();
      const send = (subscription, payload) => {
        webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
        return webpush.sendNotification(subscription, payload, { TTL: 300, timeout: 5000 });
      };
      return await createHandlers({ redis, send, env: process.env })[name](req, res);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'Configuration serveur incomplète : vérifie les variables Vercel.' });
    }
  };
}
