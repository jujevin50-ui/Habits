import { createHash, randomBytes } from 'node:crypto';
import { applyTaskChanges, validTaskSnapshot } from '../public/task-changes.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const compareAndSet = `local raw=redis.call('GET',KEYS[1]); local revision=0; if raw then revision=cjson.decode(raw).revision end; if revision~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1`;
const bad = message => Object.assign(new Error(message),{status:400});
export function taskSyncHandler(redis) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST') { res.setHeader('Allow','POST');return res.status(405).json({error:'Méthode non autorisée.'}); }
    const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
    if(!token) return res.status(401).json({error:'Appareil non associé.'});
    try {
      let body;
      try { body=typeof req.body==='string'?JSON.parse(req.body):req.body; } catch { throw bad('JSON invalide.'); }
      if(!body || Buffer.byteLength(JSON.stringify(body))>2000000) throw bad('Requête trop volumineuse.');
      if(body.action==='pair') {
        const code=randomBytes(8).toString('hex').toUpperCase();
        await redis.set(`habits:pair:${hash(code)}`,token,{ex:600});
        return res.status(200).json({code});
      }
      if(body.action==='join') {
        const code=String(body.code||'').replace(/[\s-]/g,'').toUpperCase();
        if(!/^[A-F0-9]{16}$/.test(code)) throw bad('Code d’association invalide.');
        const shared=await redis.getdel(`habits:pair:${hash(code)}`);
        if(!shared) throw bad('Code expiré ou déjà utilisé.');
        return res.status(200).json({token:shared});
      }
      if(body.action!=='sync'||!Array.isArray(body.changes)||body.changes.length>11000) throw bad('Synchronisation invalide.');
      const allowed={tasks:new Set(['id','name','due','done','priority','repeat','series','subtasks','folderId']),folders:new Set(['id','name','parentId'])};
      for(const op of body.changes) {
        if(!op || !['tasks','folders'].includes(op.collection) || !['create','patch','delete'].includes(op.action) || typeof op.id!=='string' || !op.id.length || op.id.length>100) throw bad('Modification invalide.');
        if(op.action!=='delete' && (!op.fields || Array.isArray(op.fields) || typeof op.fields!=='object' || Object.keys(op.fields).some(k=>!allowed[op.collection].has(k)))) throw bad('Champs invalides.');
        if(op.unset && (!Array.isArray(op.unset)||op.unset.some(k=>!allowed[op.collection].has(k)||k==='id'))) throw bad('Champs invalides.');
      }
      const key=`habits:tasks:${hash(token)}`;
      for(let retry=0;retry<5;retry++) {
        const previous=await redis.get(key)||{revision:0,tasks:[],folders:[]};
        if(!body.changes.length) return res.status(200).json(previous);
        const next={...applyTaskChanges(previous,body.changes),revision:previous.revision+1};
        if(!validTaskSnapshot(next) || Buffer.byteLength(JSON.stringify(next))>2000000) throw bad('Données de tâches invalides ou conflit de dossiers.');
        if(await redis.eval(compareAndSet,[key],[String(previous.revision),JSON.stringify(next)])) return res.status(200).json(next);
      }
      return res.status(409).json({error:'Modification simultanée. Réessaie dans quelques secondes.'});
    } catch(error) { return res.status(error.status||503).json({error:error.status?error.message:'Synchronisation indisponible. Les données restent sur cet appareil.'}); }
  };
}
