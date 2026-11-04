import { validData } from './model.js';
import { validTaskFolders } from './tasks.js';
import { validReminderAt } from './task-reminders.js';

const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export const taskSnapshot = state => structuredClone({ tasks: state.tasks, folders: state.folders || [], ...(Array.isArray(state.habits)?{habits:state.habits}:{}) });

export function taskChanges(base, current) {
  const changes = [];
  for (const collection of ['folders','tasks',...(Array.isArray(current.habits)?['habits']:[])]) {
    const old = new Map((base[collection] || []).map(item => [item.id,item]));
    for (const item of current[collection]) {
      const previous = old.get(item.id);
      old.delete(item.id);
      if (!previous) changes.push({ collection, action:'create', id:item.id, fields:item });
      else {
        const fields = {}, unset = [];
        for (const key of Object.keys(item)) if (key !== 'id' && !(collection==='habits'&&key==='logs') && !equal(previous[key],item[key])) fields[key]=item[key];
        for (const key of Object.keys(previous)) if (!(key in item) && key !== 'id') unset.push(key);
        const logs={};if(collection==='habits'){for(const day of new Set([...Object.keys(previous.logs||{}),...Object.keys(item.logs||{})]))if(!equal(previous.logs?.[day],item.logs?.[day]))logs[day]=item.logs?.[day]??null;}if (Object.keys(fields).length || unset.length || Object.keys(logs).length) changes.push({collection,action:'patch',id:item.id,fields,unset,...(Object.keys(logs).length?{logs}:{})});
      }
    }
    for (const id of old.keys()) changes.push({collection,action:'delete',id});
  }
  return changes;
}

export function applyTaskChanges(snapshot, changes) {
  const result = taskSnapshot(snapshot);
  for (const change of changes) {
    const list = result[change.collection] ||= [], index=list.findIndex(item=>item.id===change.id);
    if (change.action === 'delete') { if (index !== -1) list.splice(index,1); }
    else if (change.action === 'create') { if (index === -1) list.push({...change.fields,id:change.id});else if(change.collection==='habits'){list[index].logs={...change.fields.logs,...list[index].logs};if(change.fields.created<list[index].created)list[index].created=change.fields.created;} }
    else if (index !== -1) {
      const created=list[index].created;list[index] = {...list[index], ...change.fields, id:change.id};if(change.collection==='habits'){if(created<list[index].created)list[index].created=created;list[index].logs={...list[index].logs};for(const [day,log] of Object.entries(change.logs||{})){if(log===null)delete list[index].logs[day];else list[index].logs[day]=log;}}
      for (const key of change.unset || []) delete list[index][key];
    }
  }
  // An offline device may still refer to a folder deleted on another device.
  const ids = new Set(result.folders.map(f=>f.id));
  for (const folder of result.folders) if (folder.parentId && !ids.has(folder.parentId)) folder.parentId=null;
  for (const task of result.tasks) if (task.folderId && !ids.has(task.folderId)) task.folderId='';
  return result;
}

export function validTaskSnapshot(snapshot) {
  return snapshot && validSyncedHabits(snapshot.habits) && Array.isArray(snapshot.tasks) && snapshot.tasks.length <= 5000 && validTaskFolders(snapshot) && snapshot.tasks.every(t => typeof t.id==='string' && t.id.length>0 && t.id.length<=100 && typeof t.name==='string' && t.name.length<=150 && typeof t.done==='boolean' && validReminderAt(t.reminderAt) && typeof t.due==='string' && (t.due==='' || /^\d{4}-\d{2}-\d{2}$/.test(t.due)) && Array.isArray(t.subtasks) && t.subtasks.length<=1000 && t.subtasks.every(s=>s && typeof s.name==='string' && s.name.length<=1000 && typeof s.done==='boolean')) && new Set(snapshot.tasks.map(t=>t.id)).size===snapshot.tasks.length;
}

export function validSyncedHabits(habits){
 if(habits===undefined)return true;
 return Array.isArray(habits)&&validData({version:1,habits,tasks:[]})&&new Set(habits.map(h=>h.id)).size===habits.length&&habits.every(h=>h.id.length>0&&h.id.length<=100&&h.name.length>0&&h.name.length<=80&&(h.description==null||(typeof h.description==='string'&&h.description.length<=150))&&Object.entries(h.logs).every(([day,log])=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&log.note.length<=2000));
}
