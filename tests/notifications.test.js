import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandlers, dueReminders, dueTaskReminders, validateSubscription, validateSchedule } from '../server/notifications.js';

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys: { p256dh: Buffer.alloc(65, 1).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') } };
const habit = { id: 'read', name: 'Lire', days: [3], reminders: ['10:00'], completedToday: null };
function fixture(send = async () => {}) {
  const hash = {}, values = new Map();
  const redis = {
    hget: async (_, id) => hash[id] || null, hlen: async () => Object.keys(hash).length,
    hset: async (_, fields) => Object.assign(hash, structuredClone(fields)),
    hgetall: async () => structuredClone(hash), hdel: async (_, id) => { delete hash[id]; },
    set: async (key, value) => { if (values.has(key)) return null; values.set(key, value); return 'OK'; },
    del: async key => values.delete(key),
    get: async key => values.get(key) || null
  };
  const handlers = createHandlers({ redis, send, env: { CRON_SECRET: 'scheduler', VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:test@example.com' }, now: () => new Date('2026-11-04T09:00:00Z') });
  async function call(name, body, token = name === 'cron' ? 'scheduler' : '', method = 'POST') {
    const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(s) { this.code=s; return this; }, json(data) { this.data=data; return this; } };
    await handlers[name]({ method, body, headers: { authorization: `Bearer ${token}` } }, res);
    return res;
  }
  const sync = () => call('push', { action: 'sync', subscription, habits: [habit], timezone: 'Europe/Paris' });
  return { call, sync, hash, values };
}
test('authentication and HTTP methods are enforced', async () => {
  const f=fixture();
  assert.equal((await f.call('push',{action:'config'},'')).code,200);
  assert.equal((await f.call('cron',{},'personal')).code,401);
  assert.equal((await f.call('push',{},'personal','GET')).code,405);
  assert.equal((await f.call('push',{action:'config'})).data.publicKey,'public');
});
test('rejects private destinations, invalid keys and malformed schedules', () => {
  for(const endpoint of ['https://127.0.0.1/push','http://fcm.googleapis.com/x','https://fcm.googleapis.com.evil.test/x','https://fcm.googleapis.com:444/x']) assert.throws(()=>validateSubscription({...subscription,endpoint}));
  assert.throws(()=>validateSubscription({...subscription,keys:{}}));
  assert.throws(()=>validateSchedule({habits:[habit],timezone:'invalid'}));
  assert.throws(()=>validateSchedule({habits:[{...habit,reminders:['25:00']}],timezone:'Europe/Paris'}));
  assert.throws(()=>validateSchedule({habits:[habit,habit],timezone:'Europe/Paris'}));
});
test('due times respect local date, weekday, completion and daylight saving', () => {
  const device={habits:[habit],timezone:'Europe/Paris'};
  assert.equal(dueReminders(device,new Date('2026-11-04T09:00:00Z')).length,1);
  assert.equal(dueReminders(device,new Date('2026-11-04T10:00:00Z')).length,0);
  assert.equal(dueReminders(device,new Date('2026-07-01T08:00:00Z')).length,1);
  assert.equal(dueReminders({...device,habits:[{...habit,completedToday:'2026-11-04'}]},new Date('2026-11-04T09:00:00Z')).length,0);
  assert.equal(dueReminders(device,new Date('2026-11-05T09:00:00Z')).length,0);
});
test('sync, scheduled send and overlapping cron calls do not duplicate a reminder',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(JSON.parse(p)));
  assert.equal((await f.sync()).code,200);
  await Promise.all([f.call('cron',{}),f.call('cron',{})]);
  assert.equal(sent.length,1);assert.equal(sent[0].body,'Lire');
});
test('expired subscriptions are removed and temporary send failures can retry',async()=>{
  const expired=fixture(async()=>{throw {statusCode:410};});await expired.sync();
  assert.equal((await expired.call('cron',{})).code,200);assert.equal(Object.keys(expired.hash).length,0);
  let attempts=0;const retry=fixture(async()=>{if(++attempts===1)throw {statusCode:503};});await retry.sync();
  assert.equal((await retry.call('cron',{})).code,503);
  assert.equal((await retry.call('cron',{})).data.sent,1);
});
test('test sends only to the selected device and is rate limited; disabling removes it',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(p));await f.sync();
  assert.equal((await f.call('push',{action:'test',subscription})).code,200);
  assert.equal((await f.call('push',{action:'test',subscription})).code,429);
  assert.equal(sent.length,1);
  assert.equal((await f.call('push',{action:'disable',subscription})).code,200);
  assert.equal(Object.keys(f.hash).length,0);
});
test('sync replaces reminders and an empty schedule stops future reminders',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(p));await f.sync();
  await f.call('push',{action:'sync',subscription,habits:[],timezone:'Europe/Paris'});
  assert.equal((await f.call('cron',{})).data.sent,0);assert.equal(sent.length,0);
});

test('another subscription cannot change, test or disable an existing device',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(p));await f.sync();
  const forged={...subscription,keys:{...subscription.keys,auth:Buffer.alloc(16,3).toString('base64url')}};
  for(const action of ['sync','test','disable']) {
    const result=await f.call('push',{action,subscription:forged,habits:[],timezone:'Europe/Paris'});
    assert.equal(result.code,403);
  }
  assert.equal(Object.keys(f.hash).length,1);
  assert.equal((await f.call('cron',{})).data.sent,1);
});
test('registration and updates work without a personal token, including existing subscriptions',async()=>{
  const f=fixture();assert.equal((await f.sync()).code,200);
  assert.equal((await f.call('push',{action:'sync',subscription,habits:[],timezone:'Europe/Paris'},'')).code,200);
  assert.equal((await f.call('push',{action:'test',subscription},'')).code,200);
  assert.equal((await f.call('push',{action:'disable',subscription},'')).code,200);
});

test('task reminders use absolute time, allow late cron runs and skip completed tasks',()=>{
  const task={id:'task',name:'Rapport',done:false,reminderAt:'2026-11-04T09:00:00.000Z',folderLabel:'Travail'};
  assert.equal(dueTaskReminders([task],new Date('2026-11-04T08:59:59Z')).length,0);
  const due=dueTaskReminders([task],new Date('2026-11-04T09:03:00Z'));
  assert.equal(due.length,1);assert.equal(due[0].title,'Rapport');assert.equal(due[0].body,'Travail');assert.equal(due[0].url,'/#tasks');
  assert.equal(dueTaskReminders([task],new Date('2026-11-04T09:05:00Z')).length,0);
  assert.equal(dueTaskReminders([{...task,done:true}],new Date('2026-11-04T09:00:00Z')).length,0);
});

test('task schedules validate dates and task-only reminders send once',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(JSON.parse(p)));
  const task={id:'task',name:'Rapport',done:false,reminderAt:'2026-11-04T09:00:00.000Z',folderLabel:'Travail'};
  assert.equal((await f.call('push',{action:'sync',subscription,habits:[],tasks:[{...task,reminderAt:'invalid'}],timezone:'Europe/Paris'})).code,400);
  assert.equal((await f.call('push',{action:'sync',subscription,habits:[],tasks:[task],timezone:'Europe/Paris'})).code,200);
  await Promise.all([f.call('cron',{}),f.call('cron',{})]);assert.equal(sent.length,1);assert.equal(sent[0].title,'Rapport');
  await f.call('push',{action:'sync',subscription,habits:[],tasks:[{...task,done:true}],timezone:'Europe/Paris'});
  assert.equal((await f.call('cron',{})).data.sent,0);
});

test('closed phones use the current shared task data, including remote completion and deletion',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(JSON.parse(p)));
  await f.call('push',{action:'sync',subscription,habits:[],tasks:[],taskToken:'a'.repeat(64),timezone:'Europe/Paris'});
  const workspace=Object.values(f.hash)[0].taskWorkspace,key=`habits:tasks:${workspace}`;
  const task={id:'task',name:'Created on PC',done:true,reminderAt:'2026-11-04T09:00:00.000Z',folderId:'work'};
  f.values.set(key,{folders:[{id:'work',name:'Travail',parentId:null}],tasks:[task]});
  assert.equal((await f.call('cron',{})).data.sent,0);
  f.values.set(key,{folders:[],tasks:[]});assert.equal((await f.call('cron',{})).data.sent,0);
  f.values.set(key,{folders:[{id:'work',name:'Travail',parentId:null}],tasks:[{...task,done:false}]});
  assert.equal((await f.call('cron',{})).data.sent,1);assert.equal(sent[0].body,'Travail');
});

test('shared habit validation and archiving suppress reminders on a closed phone',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(JSON.parse(p)));
  await f.call('push',{action:'sync',subscription,habits:[habit],tasks:[],taskToken:'a'.repeat(64),timezone:'Europe/Paris'});
  const key=`habits:tasks:${Object.values(f.hash)[0].taskWorkspace}`;
  const shared={...habit,goal:1,logs:{'2026-11-04':{value:1,note:'Fait sur PC'}}};
  f.values.set(key,{tasks:[],folders:[],habits:[shared]});assert.equal((await f.call('cron',{})).data.sent,0);
  f.values.set(key,{tasks:[],folders:[],habits:[{...shared,logs:{},archived:true}]});assert.equal((await f.call('cron',{})).data.sent,0);
  f.values.set(key,{tasks:[],folders:[],habits:[{...shared,logs:{}}]});assert.equal((await f.call('cron',{})).data.sent,1);
});
