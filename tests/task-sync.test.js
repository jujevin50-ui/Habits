import test from 'node:test';
import assert from 'node:assert/strict';
import {taskSyncHandler} from '../server/task-sync.js';
import {taskChanges,applyTaskChanges,validTaskSnapshot} from '../public/task-changes.js';

const task=(id,fields={})=>({id,name:id,done:false,due:'',subtasks:[],...fields});
const empty={tasks:[],folders:[]};
function fixture(){
  const data=new Map(),ttl=new Map();let failCas=false;
  const redis={
    get:async key=>structuredClone(data.get(key)??null),
    set:async(key,value,opts)=>{data.set(key,value);ttl.set(key,opts?.ex);},
    getdel:async key=>{const value=data.get(key);data.delete(key);return value;},
    eval:async(script,[key],[revision,value])=>{
      assert.ok(script.includes("redis.call('SET'"));
      if(failCas){failCas=false;return 0;}
      if((data.get(key)?.revision||0)!==Number(revision))return 0;
      data.set(key,JSON.parse(value));return 1;
    }
  };
  const handler=taskSyncHandler(redis);
  async function call(body,token='a'.repeat(64),method='POST'){
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(value){this.data=value;return this;}};
    await handler({method,headers:{authorization:`Bearer ${token}`},body},res);return res;
  }
  return {call,ttl,data,failNextCas:()=>{failCas=true;}};
}
test('independent edits merge without losing another device’s changes',()=>{
  const base={...empty,tasks:[task('a')]};
  const computer={...empty,tasks:[task('a',{name:'Computer'}),task('pc')]};
  const phone={...empty,tasks:[task('a',{done:true}),task('phone')]};
  const remote=applyTaskChanges(applyTaskChanges(base,taskChanges(base,computer)),taskChanges(base,phone));
  assert.equal(remote.tasks[0].name,'Computer');assert.equal(remote.tasks[0].done,true);
  assert.deepEqual(remote.tasks.map(t=>t.id),['a','pc','phone']);
});
test('a stale device cannot resurrect a deleted task and orphan folders are repaired',()=>{
  const base={folders:[{id:'work',name:'Work',parentId:null}],tasks:[task('a',{folderId:'work'})]};
  const remote=applyTaskChanges(base,[{collection:'tasks',action:'delete',id:'a'},{collection:'folders',action:'delete',id:'work'}]);
  const stale=applyTaskChanges(remote,taskChanges(base,{...base,tasks:[task('a',{folderId:'work',done:true}),task('new',{folderId:'work'})]}));
  assert.deepEqual(stale.tasks.map(t=>t.id),['new']);assert.equal(stale.tasks[0].folderId,'');assert.equal(validTaskSnapshot(stale),true);
});
test('changes made during an upload are reapplied to the downloaded state',()=>{
  const before={...empty,tasks:[task('a')]},during={...empty,tasks:[task('a',{done:true})]};
  const downloaded={...empty,tasks:[task('a'),task('phone')]};
  const merged=applyTaskChanges(downloaded,taskChanges(before,during));
  assert.equal(merged.tasks[0].done,true);assert.equal(merged.tasks.length,2);
});
test('different device tokens isolate workspaces; shared tokens see tasks, folders and subtasks',async()=>{
  const f=fixture(),snapshot={folders:[{id:'f',name:'Folder',parentId:null}],tasks:[task('a',{folderId:'f',subtasks:[{name:'Subtask',done:true}]})]};
  assert.equal((await f.call({action:'sync',changes:taskChanges(empty,snapshot)})).code,200);
  assert.deepEqual((await f.call({action:'sync',changes:[]})).data.tasks,snapshot.tasks);
  assert.equal((await f.call({action:'sync',changes:[]},'b'.repeat(64))).data.tasks.length,0);
  assert.equal((await f.call({action:'sync',changes:[]},'bad')).code,401);
  assert.equal((await f.call({},undefined,'GET')).code,405);
});
test('pairing codes expire after ten minutes and can be used only once',async()=>{
  const f=fixture(),pair=await f.call({action:'pair'});
  assert.match(pair.data.code,/^[A-F0-9]{16}$/);assert.equal([...f.ttl.values()][0],600);
  const joined=await f.call({action:'join',code:pair.data.code.toLowerCase().match(/.{4}/g).join(' ')},'b'.repeat(64));
  assert.equal(joined.data.token,'a'.repeat(64));
  assert.equal((await f.call({action:'join',code:pair.data.code})).code,400);
});
test('optimistic writes retry conflicts and reject invalid or malicious patches',async()=>{
  const f=fixture();f.failNextCas();
  assert.equal((await f.call({action:'sync',changes:taskChanges(empty,{...empty,tasks:[task('a')]})})).code,200);
  assert.equal((await f.call({action:'sync',changes:[{collection:'tasks',action:'patch',id:'a',fields:{done:'yes'}}]})).code,400);
  assert.equal((await f.call({action:'sync',changes:[{collection:'tasks',action:'patch',id:'a',fields:JSON.parse('{"__proto__":{"admin":true}}')}]})).code,400);
  assert.equal((await f.call({action:'sync',changes:[]})).data.tasks[0].done,false);
});
