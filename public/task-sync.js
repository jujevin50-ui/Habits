import { taskSnapshot, taskChanges, applyTaskChanges, validTaskSnapshot } from './task-changes.js';

const STORAGE='habits-task-sync';
const newToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export function createTaskSync({getState,onChange,onStatus}) {
  let config=null,inFlight=null,timer,status='Non associés';
  try { const saved=JSON.parse(localStorage.getItem(STORAGE));if(/^[a-f0-9]{64}$/.test(saved?.token)&&validTaskSnapshot(saved.base))config=saved; } catch {}
  const setStatus=value=>{status=value;onStatus(value);};
  const persist=()=>{localStorage.setItem(STORAGE,JSON.stringify(config));};
  async function request(action,body={},token=config?.token||newToken()) {
    const response=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(15000)});
    const result=await response.json().catch(()=>({error:'Synchronisation indisponible.'}));
    if(!response.ok)throw Error(result.error||'Synchronisation indisponible.');
    return result;
  }
  function run() {
    if(!config)return Promise.resolve();
    if(inFlight)return inFlight;
    const currentConfig=config,before=taskSnapshot(getState());
    setStatus('Synchronisation…');
    inFlight=(async()=>{
      try {
        const remote=await request('sync',{changes:taskChanges(currentConfig.base,before)},currentConfig.token);
        if(config!==currentConfig)return;
        if(!validTaskSnapshot(remote))throw Error('Réponse de synchronisation invalide.');
        const latest=taskSnapshot(getState()),pending=taskChanges(before,latest),merged=applyTaskChanges(remote,pending);
        if(!validTaskSnapshot(merged))throw Error('Conflit de dossiers. Réessaie après les modifications en cours.');
        if(JSON.stringify(merged)!==JSON.stringify(latest))onChange(merged);
        config.base=taskSnapshot(remote);persist();setStatus('Synchronisés');
        if(pending.length)schedule();
      } catch(error) {setStatus('À synchroniser — données conservées ici');throw error;}
      finally {inFlight=null;}
    })();
    return inFlight;
  }
  function schedule(){clearTimeout(timer);if(config)timer=setTimeout(()=>run().catch(()=>{}),500);}
  return {
    get enabled(){return !!config;},get status(){return config?status:'Non associés';},run,schedule,
    async pair(){
      if(!config){config={token:newToken(),base:{tasks:[],folders:[]}};persist();}
      await run();return (await request('pair')).code;
    },
    async join(code){
      if(inFlight)await inFlight.catch(()=>{});
      const result=await request('join',{code});
      if(!/^[a-f0-9]{64}$/.test(result.token))throw Error('Association invalide.');
      localStorage.setItem('habits-tasks-before-link',JSON.stringify(taskSnapshot(getState())));
      config={token:result.token,base:{tasks:[],folders:[]}};persist();
      await run();
    },
    async disconnect(){if(inFlight)await inFlight.catch(()=>{});config=null;clearTimeout(timer);localStorage.removeItem(STORAGE);setStatus('Non associés');}
  };
}
