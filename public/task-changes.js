import { validTaskFolders } from './tasks.js';

const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export const taskSnapshot = state => structuredClone({ tasks: state.tasks, folders: state.folders || [] });

export function taskChanges(base, current) {
  const changes = [];
  for (const collection of ['folders','tasks']) {
    const old = new Map((base[collection] || []).map(item => [item.id,item]));
    for (const item of current[collection]) {
      const previous = old.get(item.id);
      old.delete(item.id);
      if (!previous) changes.push({ collection, action:'create', id:item.id, fields:item });
      else {
        const fields = {}, unset = [];
        for (const key of Object.keys(item)) if (key !== 'id' && !equal(previous[key],item[key])) fields[key]=item[key];
        for (const key of Object.keys(previous)) if (!(key in item) && key !== 'id') unset.push(key);
        if (Object.keys(fields).length || unset.length) changes.push({collection,action:'patch',id:item.id,fields,unset});
      }
    }
    for (const id of old.keys()) changes.push({collection,action:'delete',id});
  }
  return changes;
}

export function applyTaskChanges(snapshot, changes) {
  const result = taskSnapshot(snapshot);
  for (const change of changes) {
    const list = result[change.collection], index=list.findIndex(item=>item.id===change.id);
    if (change.action === 'delete') { if (index !== -1) list.splice(index,1); }
    else if (change.action === 'create') { if (index === -1) list.push({...change.fields,id:change.id}); }
    else if (index !== -1) {
      list[index] = {...list[index], ...change.fields, id:change.id};
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
  return snapshot && Array.isArray(snapshot.tasks) && snapshot.tasks.length <= 5000 && validTaskFolders(snapshot) && snapshot.tasks.every(t => typeof t.id==='string' && t.id.length>0 && t.id.length<=100 && typeof t.name==='string' && t.name.length<=150 && typeof t.done==='boolean' && typeof t.due==='string' && (t.due==='' || /^\d{4}-\d{2}-\d{2}$/.test(t.due)) && Array.isArray(t.subtasks) && t.subtasks.length<=1000 && t.subtasks.every(s=>s && typeof s.name==='string' && s.name.length<=1000 && typeof s.done==='boolean')) && new Set(snapshot.tasks.map(t=>t.id)).size===snapshot.tasks.length;
}
