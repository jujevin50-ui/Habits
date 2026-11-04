import test from 'node:test';
import assert from 'node:assert/strict';
import { folderPath, folderDescendants, orderedFolders, sortTasks, removeFolder } from '../public/tasks.js';
import { validData } from '../public/model.js';

const folders = [
  { id: 'work', name: 'Travail', parentId: null },
  { id: 'project', name: 'Projet', parentId: 'work' },
  { id: 'home', name: 'Maison', parentId: null }
];
const task = (id, due = '', folderId) => ({ id, name: id, due, done: false, subtasks: [], ...(folderId === undefined ? {} : { folderId }) });
test('old backups remain valid and folder backups round-trip without losing tasks', () => {
  const old = { version: 1, habits: [], tasks: [task('old')] };
  assert.equal(validData(old), true);
  const next = { ...old, folders, tasks: [...old.tasks, task('new', '2026-11-05', 'project')] };
  const restored = JSON.parse(JSON.stringify(next));
  assert.equal(validData(restored), true);
  assert.equal(restored.tasks[0].id, 'old');
  assert.equal(folderPath(restored.folders, restored.tasks[1].folderId), 'Travail / Projet');
});
test('folders follow their hierarchy and use complete labels', () => {
  assert.deepEqual(orderedFolders(folders).map(f=>f.id), ['', 'home', 'work', 'project']);
  assert.equal(folderPath(folders, ''), 'Sans dossier');
  assert.deepEqual([...folderDescendants(folders, 'work')], ['work', 'project']);
});
test('tasks sort by due date with undated tasks last without mutating state', () => {
  const tasks = [task('undated'),task('later','2026-12-01'),task('first','2026-01-01')];
  assert.deepEqual(sortTasks(tasks).map(t=>t.id), ['first','later','undated']);
  assert.equal(tasks[0].id, 'undated');
});
test('folder deletion preserves tasks and reattaches child folders', () => {
  const state = { version: 1, habits: [], folders: structuredClone(folders), tasks: [task('parentTask','','work'),task('childTask','','project')] };
  assert.equal(removeFolder(state,'work'), '');
  assert.equal(state.tasks.length, 2);
  assert.equal(state.tasks[0].folderId, '');
  assert.equal(state.tasks[1].folderId, 'project');
  assert.equal(state.folders.find(f=>f.id==='project').parentId,null);
  assert.equal(validData(state),true);
  assert.equal(removeFolder(state,'project'), '');
  assert.equal(state.tasks[1].folderId,'');
});
test('invalid folder references, duplicate ids and cycles are rejected', () => {
  const state = { version:1, habits:[], tasks:[task('task','','project')], folders };
  assert.equal(validData({...state,folders:[...folders,{id:'work',name:'Duplicate'}]}),false);
  assert.equal(validData({...state,folders:folders.map(f=>f.id==='work'?{...f,parentId:'project'}:f)}),false);
  assert.equal(validData({...state,folders:folders.map(f=>f.id==='work'?{...f,parentId:'missing'}:f)}),false);
  assert.equal(validData({...state,tasks:[task('orphan','','missing')]}),false);
});
