export const taskFolder = task => task.folderId || '';

export function folderPath(folders, id) {
  const names = [], seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folders.find(f => f.id === id);
    if (!folder) break;
    names.unshift(folder.name);
    id = folder.parentId;
  }
  return names.join(' / ') || 'Sans dossier';
}

export function folderDescendants(folders, id) {
  const result = new Set([id]);
  let size;
  do {
    size = result.size;
    for (const folder of folders) if (result.has(folder.parentId)) result.add(folder.id);
  } while (size !== result.size);
  return result;
}

export function orderedFolders(folders) {
  const result = [{ id: '', name: 'Sans dossier', parentId: null }];
  function visit(parent) {
    for (const folder of folders.filter(f => (f.parentId || '') === parent).toSorted((a,b) => a.name.localeCompare(b.name, 'fr'))) {
      result.push(folder);
      visit(folder.id);
    }
  }
  visit('');
  return result;
}

export function sortTasks(tasks) {
  return tasks.toSorted((a,b) => (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31') || a.name.localeCompare(b.name, 'fr'));
}

export function validTaskFolders(state) {
  const folders = state.folders ?? [];
  if (!Array.isArray(folders) || folders.length > 200 || !folders.every(f => f && typeof f.id === 'string' && f.id.length > 0 && f.id.length <= 100 && typeof f.name === 'string' && f.name.trim().length > 0 && f.name.length <= 60 && (f.parentId == null || typeof f.parentId === 'string'))) return false;
  const ids = new Set(folders.map(f => f.id));
  if (ids.size !== folders.length) return false;
  for (const folder of folders) {
    if (folder.parentId && !ids.has(folder.parentId)) return false;
    const seen = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent) {
      if (seen.has(parent)) return false;
      seen.add(parent);
      parent = folders.find(f => f.id === parent)?.parentId;
    }
  }
  return state.tasks.every(t => t && (t.folderId == null || t.folderId === '' || (typeof t.folderId === 'string' && ids.has(t.folderId))));
}

export function removeFolder(state, id) {
  const folder = state.folders.find(f => f.id === id);
  if (!folder) return;
  const parentId = folder.parentId || '';
  state.tasks.forEach(t => { if (t.folderId === id) t.folderId = parentId; });
  state.folders.forEach(f => { if (f.parentId === id) f.parentId = parentId || null; });
  state.folders = state.folders.filter(f => f.id !== id);
  return parentId;
}
