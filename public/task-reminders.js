export function validReminderAt(value) {
  return value == null || value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
}

export function localReminderValue(value) {
  if (!value || !validReminderAt(value)) return '';
  const d = new Date(value), pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nextTaskReminder(value) {
  if (!value) return '';
  const d = new Date(value);
  d.setDate(d.getDate()+1);
  return d.toISOString();
}
