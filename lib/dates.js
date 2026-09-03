export function parseDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export function businessDays(start, end) {
  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function ymd(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function prettyDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}
