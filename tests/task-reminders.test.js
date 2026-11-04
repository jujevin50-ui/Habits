import test from 'node:test';
import assert from 'node:assert/strict';
import {validReminderAt,localReminderValue,nextTaskReminder} from '../public/task-reminders.js';
import {validData} from '../public/model.js';
import {validTaskSnapshot,taskChanges,applyTaskChanges} from '../public/task-changes.js';

test('old tasks remain valid and reminder dates survive backups and sync changes',()=>{
  const snapshot={folders:[],tasks:[{id:'a',name:'Task',due:'',done:false,subtasks:[]}]};
  assert.equal(validTaskSnapshot(snapshot),true);
  const next=structuredClone(snapshot);next.tasks[0].reminderAt='2026-12-01T09:00:00.000Z';
  assert.equal(validData({version:1,habits:[],...next}),true);
  assert.deepEqual(applyTaskChanges(snapshot,taskChanges(snapshot,next)),next);
  assert.equal(validData({version:1,habits:[],...snapshot,tasks:[{...snapshot.tasks[0],reminderAt:'bad'}]}),false);
});
test('reminders reject invalid calendar dates and preserve the time for the next daily task',()=>{
  assert.equal(validReminderAt('2026-02-30T09:00:00.000Z'),false);
  assert.equal(validReminderAt('2026-12-01T29:00:00.000Z'),false);
  const value='2026-11-04T09:00:00.000Z';
  assert.match(localReminderValue(value),/^2026-11-04T\d{2}:00$/);
  assert.equal(nextTaskReminder(value),'2026-11-05T09:00:00.000Z');
  assert.equal(nextTaskReminder(''),'');
});
