import { Redis } from '@upstash/redis';
import { taskSyncHandler } from '../server/task-sync.js';

export default async function(req,res) {
  try { return await taskSyncHandler(Redis.fromEnv())(req,res); }
  catch { res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Vérifie la configuration Redis dans Vercel.'}); }
}
