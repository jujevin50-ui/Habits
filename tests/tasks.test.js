import test from 'node:test';
import assert from 'node:assert/strict';
import { folderPath, folderDescendants, orderedFolders, sortTasks, filterTasks, removeFolder } from '../public/tasks.js';
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
test('today and overdue filters exclude completed and undated tasks without changing data', () => {
  const tasks = [task('late','2026-11-04'),task('today','2026-11-05'),task('future','2026-11-06'),task('undated'),{...task('done','2026-11-04'),done:true}];
  const before=structuredClone(tasks);
  assert.deepEqual(filterTasks(tasks,{today:'2026-11-05',filter:'today'}).map(t=>t.id),['today']);
  assert.deepEqual(filterTasks(tasks,{today:'2026-11-05',filter:'overdue'}).map(t=>t.id),['late']);
  assert.equal(filterTasks(tasks).length,5);
  assert.deepEqual(tasks,before);
});
test('search finds accented titles, nested folder paths and subtasks together', () => {
  const tasks=[{...task('report','','project'),name:'Préparer la réunion',subtasks:[{name:'Vérifier le budget',done:false}]},task('other','','home')];
  assert.deepEqual(filterTasks(tasks,{folders,query:'  REUNION  budget travail  '}).map(t=>t.id),['report']);
  assert.deepEqual(filterTasks(tasks,{folders,query:'maison'}).map(t=>t.id),['other']);
  assert.equal(filterTasks(tasks,{folders,query:'réunion maison'}).length,0);
});
test('invalid folder references, duplicate ids and cycles are rejected', () => {
  const state = { version:1, habits:[], tasks:[task('task','','project')], folders };
  assert.equal(validData({...state,folders:[...folders,{id:'work',name:'Duplicate'}]}),false);
  assert.equal(validData({...state,folders:folders.map(f=>f.id==='work'?{...f,parentId:'project'}:f)}),false);
  assert.equal(validData({...state,folders:folders.map(f=>f.id==='work'?{...f,parentId:'missing'}:f)}),false);
  assert.equal(validData({...state,tasks:[task('orphan','','missing')]}),false);
});
