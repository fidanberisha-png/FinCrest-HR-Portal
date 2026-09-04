// Company roster - authoritative employment start dates (source: HR spreadsheet).
// Start dates are NOT taken from what a user types during registration; they are
// resolved from this roster so the data always matches the official HR records.

const ROSTER = [
  { first: 'Pajazit', last: 'Shkurti', startDate: '2024-12-01' },
  { first: 'Viola', last: 'Magashi', startDate: '2024-12-16' },
  { first: 'Oranela', last: 'Lahu', startDate: '2024-12-23' },
  { first: 'Elsë', last: 'Shala', startDate: '2025-01-22' },
  { first: 'Jon', last: 'Karakushi', startDate: '2025-01-22' },
  { first: 'Tringa', last: 'Jashari', startDate: '2025-02-03' },
  { first: 'Genc', last: 'Ramadani', startDate: '2025-02-04' },
  { first: 'Arber', last: 'Ajeti', startDate: '2025-03-11' },
  { first: 'Nebih', last: 'Haziri', startDate: '2025-04-28' },
  { first: 'Fjorda', last: 'Vezgishi', startDate: '2025-05-01' },
  { first: 'Era', last: 'Vishaj', startDate: '2025-06-16' },
  { first: 'Vigan', last: 'Kastrati', startDate: '2025-09-17' },
  { first: 'Agon', last: 'Fejzullahu', startDate: '2025-10-01' },
  { first: 'Doajen', last: 'Prokshi', startDate: '2025-12-01' },
  { first: 'Dion', last: 'Shaqiri', startDate: '2025-12-01' },
  { first: 'Ardita', last: 'Rapuca', startDate: '2026-02-16' },
  { first: 'Shkelzen', last: 'Kozhani', startDate: '2026-02-23' },
  { first: 'Agon', last: 'Xhemaili', startDate: '2026-04-06' },
  { first: 'Natyra', last: 'Neziraj', startDate: '2026-04-13' },
  { first: 'Endrit', last: 'Feta', startDate: '2026-04-21' },
  { first: 'Elsa', last: 'Dreshaj', startDate: '2026-04-27' },
  { first: 'Genc', last: 'Ukmata', startDate: '2026-05-14' },
  { first: 'Adea', last: 'Zeqiri', startDate: '2026-06-02' },
  { first: 'Qendrim', last: 'Shehu', startDate: '2026-06-08' },
  { first: 'Jona', last: 'Kryeziu', startDate: '2026-06-15' },
  { first: 'Fidan', last: 'Berisha', startDate: '2026-06-15' },
  { first: 'Diellza', last: 'Mehmeti', startDate: '2026-06-29' },
  { first: 'Gentian', last: 'Shala', startDate: '2026-07-06' },
  { first: 'Venesa', last: 'Shala', startDate: '2026-07-06' },
  { first: 'Fortesa', last: 'Limoni', startDate: '2026-07-06' },
  { first: 'Jehona', last: 'Rama', startDate: '2026-07-07' },
  { first: 'Albin', last: 'Shala', startDate: '2026-07-22' },
  { first: 'Arbresha', last: 'Sopjani', startDate: '2026-07-20' },
  { first: 'Merita', last: 'Mani', startDate: '2025-03-21' },
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ë/g, 'e')
    .replace(/ç/g, 'c')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

export function rosterFullNames() {
  return ROSTER.map(function (person) {
    return person.first + ' ' + person.last;
  });
}

export function rosterStartDate(name) {
  const key = normalize(name);
  if (!key) return null;
  const hit = ROSTER.find(function (person) {
    return normalize(person.first + ' ' + person.last) === key;
  });
  return hit ? hit.startDate : null;
}

export function rosterStartDateByEmail(email) {
  const local = String(email || '').split('@')[0];
  return rosterStartDate(local.replace(/[._-]+/g, ' '));
}

export function resolveStartDate(name, email) {
  return rosterStartDate(name) || rosterStartDateByEmail(email);
}

export function isOnRoster(name, email) {
  return Boolean(resolveStartDate(name, email));
}

export default ROSTER;
