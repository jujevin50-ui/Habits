import test from 'node:test';
import assert from 'node:assert/strict';
import {quotes} from '../server/quote-library.js';
import {dueQuotes,quoteForDay} from '../server/quotes.js';
import {quoteSettings,validQuoteSettings,DEFAULT_QUOTE_TIMES} from '../public/quotes-settings.js';
import {createHandlers} from '../server/notifications.js';
import {readFileSync} from 'node:fs';

const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/quotes',keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}};
const enabled={enabled:true,times:[...DEFAULT_QUOTE_TIMES]};
function fixture(send=async()=>{}){
  const devices={},locks=new Map();let current=new Date('2026-11-04T07:00:00Z');
  const redis={hget:async(_,id)=>devices[id]||null,hlen:async()=>Object.keys(devices).length,hset:async(_,values)=>Object.assign(devices,structuredClone(values)),hgetall:async()=>structuredClone(devices),hdel:async(_,id)=>{delete devices[id];},set:async(key,v)=>{if(locks.has(key))return null;locks.set(key,v);return 'OK';},del:async key=>locks.delete(key)};
  const handlers=createHandlers({redis,send,env:{CRON_SECRET:'test'},now:()=>current});
  async function call(name,body={}){const res={setHeader(){},status(s){this.code=s;return this;},json(data){this.data=data;return this;}};await handlers[name]({method:'POST',headers:{authorization:'Bearer test'},body},res);return res;}
  return {call,devices,tick:value=>{current=new Date(value);},sync:quotes=>call('push',{action:'sync',subscription,habits:[],timezone:'Europe/Paris',...(quotes===undefined?{}:{quotes})})};
}

test('quotes are opt-in and have three valid distinct default hours',()=>{
  assert.deepEqual(quoteSettings(),{enabled:false,times:['08:00','13:00','21:00']});
  assert.equal(validQuoteSettings(enabled),true);
  for(const value of [{enabled:true,times:['08:00','08:00','21:00']},{enabled:true,times:['08:00','13:00']},{enabled:true,times:['25:00','13:00','21:00']},{enabled:'yes',times:DEFAULT_QUOTE_TIMES}])assert.equal(validQuoteSettings(value),false);
});

test('library has 1,000 attributed classics with source references and no app-original slogans',()=>{
  assert.equal(quotes.length,1000);assert.equal(new Set(quotes.map(q=>q.text)).size,1000);
  assert.equal(quotes.filter(q=>!q.author).length,0);
  assert.equal(quotes.filter(q=>q.author).length,1000);
  for(const q of quotes){assert.ok(q.text.length>10&&q.text.length<=180);assert.ok((q.text+(q.author||'')).length<240);if(q.author)assert.ok(q.source);}
});

test('new classics link to frozen source editions and remain textually distinct',()=>{
  const editions=JSON.parse(readFileSync(new URL('../public/quote-sources/editions.json',import.meta.url),'utf8'));
  const imported=quotes.filter(q=>q.sourceId);
  assert.equal(imported.length,980);
  assert.equal(new Set(quotes.filter(q=>q.author).map(q=>q.author)).size,21);
  for(const q of imported){
    const edition=editions[q.sourceId];assert.ok(edition);assert.equal(q.author,edition.author);
    assert.match(edition.commit,/^[a-f0-9]{40}$/);assert.match(edition.sha256,/^[a-f0-9]{64}$/);
    assert.ok(q.sourceUrl.startsWith(`${edition.repository}/blob/${edition.commit}/${edition.file}#L`));
    assert.ok(!/[\u0000-\u001f\u007f-\u009f\ufffd]/.test(q.text));
  }
  const normalized=quotes.map(q=>q.text.toLowerCase().replaceAll('œ','oe').normalize('NFKD').replace(/[^a-z0-9]/g,''));
  assert.equal(new Set(normalized).size,quotes.length);
});

test('300 replacements come from ancient philosophy and translations are disclosed',()=>{
  const ancient=quotes.filter(q=>['marc-aurele','aristote','seneque','epictete'].includes(q.sourceId));
  assert.equal(ancient.length,300);
  assert.equal(ancient.filter(q=>q.author==='Marc Aurèle').length,210);
  for(const author of ['Aristote','Sénèque','Épictète'])assert.equal(ancient.filter(q=>q.author===author).length,30);
  for(const q of ancient){
    assert.equal(q.category,q.author==='Aristote'?'Philosophie antique':'Stoïcisme');
    if(q.sourceId==='marc-aurele'){assert.ok(q.sourceChunk);assert.match(q.source,/Barthélemy-Saint-Hilaire/);}
    else{assert.equal(q.translation,true);assert.ok(q.sourceText.length>10);assert.match(q.source,/traduction française pour Habits/);}
  }
});

test('three different daily quotes rotate through the entire library before repeating',()=>{
  const seen=new Set();
  for(let day=0;day<Math.ceil(quotes.length/3);day++)for(let slot=0;slot<3;slot++){
    if(seen.size===quotes.length)break;const date=new Date(Date.UTC(2026,10,4+day)).toISOString().slice(0,10),quote=quoteForDay(date,slot);
    assert.equal(quoteForDay(date,slot),quote);assert.equal(seen.has(quote.text),false);seen.add(quote.text);
  }
  assert.equal(seen.size,quotes.length);
});

test('default and custom schedules respect local winter and summer times',()=>{
  const device={quotes:enabled,timezone:'Europe/Paris'};
  assert.equal(dueQuotes(device,new Date('2026-11-04T06:59:00Z')).length,0);
  for(const hour of ['07','12','20'])assert.equal(dueQuotes(device,new Date(`2026-11-04T${hour}:00:00Z`)).length,1);
  assert.equal(dueQuotes(device,new Date('2026-07-01T06:00:00Z')).length,1);assert.equal(dueQuotes(device,new Date('2026-11-04T07:00:00Z'))[0].url,'/#quotes');
  assert.equal(dueQuotes({...device,quotes:{enabled:true,times:['09:15','14:30','22:00']}},new Date('2026-11-04T08:15:00Z')).length,1);
  assert.equal(dueQuotes({...device,quotes:{...enabled,enabled:false}},new Date('2026-11-04T07:00:00Z')).length,0);
});

test('late runs catch up across midnight and repeated DST hours share one event',()=>{
  const device={quotes:{enabled:true,times:['02:30','13:00','23:59']},timezone:'Europe/Paris'};
  const midnight=dueQuotes(device,new Date('2026-11-04T23:01:00Z'));
  assert.equal(midnight.length,1);assert.equal(midnight[0].event,'quote:2026-11-04:2');
  assert.equal(dueQuotes(device,new Date('2026-11-04T23:04:00Z')).length,0);
  assert.equal(dueQuotes(device,new Date('2026-10-25T00:30:00Z'))[0].event,dueQuotes(device,new Date('2026-10-25T01:30:00Z'))[0].event);
});

test('cron sends exactly three a day, deduplicates concurrent runs and rescheduled slots',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(JSON.parse(p)));await f.sync(enabled);
  await Promise.all([f.call('cron'),f.call('cron')]);assert.equal(sent.length,1);assert.equal(sent[0].title,'Quotes');
  await f.sync({enabled:true,times:['08:01','13:00','21:00']});f.tick('2026-11-04T07:01:00Z');await f.call('cron');assert.equal(sent.length,1);
  f.tick('2026-11-04T12:00:00Z');await f.call('cron');f.tick('2026-11-04T20:00:00Z');await f.call('cron');
  assert.equal(sent.length,3);assert.equal(new Set(sent.map(q=>q.body)).size,3);
});

test('disabling quotes stops them without deleting the device; legacy sync preserves preference',async()=>{
  const sent=[],f=fixture(async(s,p)=>sent.push(p));await f.sync(enabled);await f.sync();
  assert.equal(Object.values(f.devices)[0].quotes.enabled,true);
  await f.sync({...enabled,enabled:false});await f.call('cron');assert.equal(sent.length,0);assert.equal(Object.keys(f.devices).length,1);
  assert.equal((await f.sync({enabled:true,times:['08:00','08:00','21:00']})).code,400);
});

test('temporary push errors retry the same quote inside the catch-up window',async()=>{
  let attempts=0;const f=fixture(async()=>{if(++attempts===1)throw Error('Temporary');});await f.sync(enabled);
  assert.equal((await f.call('cron')).code,503);f.tick('2026-11-04T07:01:00Z');assert.equal((await f.call('cron')).data.sent,1);
  assert.equal((await f.call('cron')).data.sent,0);
});
