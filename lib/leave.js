// Leave entitlements and balances.
//
// Every leave type has its OWN independent pool of days. Taking 2 days of
// vacation does not reduce the sick leave balance and the other way round.

export const LEAVE_TYPES = [
  { value: 'VACATION', label: 'Vacation / PTO', allowance: 20 },
  { value: 'SICK', label: 'Sick leave', allowance: 20 },
  { value: 'UNPAID', label: 'Unpaid leave', allowance: null },
  { value: 'PARENTAL', label: 'Parental leave', allowance: null },
  { value: 'OTHER', label: 'Other (special circumstances)', allowance: 5 }
];

export function typeLabel(value) {
  for (let i = 0; i < LEAVE_TYPES.length; i++) {
    if (LEAVE_TYPES[i].value === value) return LEAVE_TYPES[i].label;
  }
  return value;
}

// The vacation pool follows the allowance stored on the user record so it can
// be adjusted per person; the other pools use the policy defaults.
export function allowanceFor(type, userAllowance) {
  if (type === 'VACATION') {
    return typeof userAllowance === 'number' && userAllowance > 0 ? userAllowance : 20;
  }
  for (let i = 0; i < LEAVE_TYPES.length; i++) {
    if (LEAVE_TYPES[i].value === type) return LEAVE_TYPES[i].allowance;
  }
  return null;
}

function startOfToday() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Working days of a request that fall inside a given month of a given year.
export function businessDaysByMonth(start, end, year) {
  const months = [];
  for (let i = 0; i < 12; i++) months.push(0);
  const from = new Date(start);
  const to = new Date(end);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return months;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const last = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  let guard = 0;
  while (cursor.getTime() <= last && guard < 1000) {
    guard += 1;
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && cursor.getUTCFullYear() === year) {
      months[cursor.getUTCMonth()] += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return months;
}

function blankBalance(type, userAllowance) {
  return {
    type: type,
    label: typeLabel(type),
    allowance: allowanceFor(type, userAllowance),
    used: 0,
    planned: 0,
    pending: 0
  };
}

// Splits a list of leave requests into one independent balance per leave type.
//   used    - approved days that have already happened
//   planned - approved days still in the future
//   pending - days waiting for a decision
export function balancesByType(requests, year, userAllowance) {
  const today = startOfToday();
  const map = {};
  LEAVE_TYPES.forEach(function (item) {
    map[item.value] = blankBalance(item.value, userAllowance);
  });

  (requests || []).forEach(function (item) {
    const bucket = map[item.type];
    if (!bucket) return;
    if (item.status !== 'APPROVED' && item.status !== 'PENDING') return;

    const months = businessDaysByMonth(item.startDate, item.endDate, year);
    let daysInYear = 0;
    months.forEach(function (n) {
      daysInYear += n;
    });
    if (daysInYear === 0) return;

    if (item.status === 'PENDING') {
      bucket.pending += daysInYear;
      return;
    }

    const end = new Date(item.endDate);
    const endStamp = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    if (endStamp < today) {
      bucket.used += daysInYear;
    } else {
      bucket.planned += daysInYear;
    }
  });

  return LEAVE_TYPES.map(function (item) {
    const bucket = map[item.value];
    bucket.remaining =
      bucket.allowance === null ? null : bucket.allowance - bucket.used - bucket.planned;
    return bucket;
  });
}

export function balanceFor(balances, type) {
  for (let i = 0; i < balances.length; i++) {
    if (balances[i].type === type) return balances[i];
  }
  return null;
}

// Month by month vacation (PTO) picture for the yearly report.
export function vacationYear(requests, year, userAllowance) {
  const today = startOfToday();
  const months = [];
  for (let i = 0; i < 12; i++) months.push(0);
  let used = 0;
  let planned = 0;
  let pending = 0;

  (requests || []).forEach(function (item) {
    if (item.type !== 'VACATION') return;
    if (item.status !== 'APPROVED' && item.status !== 'PENDING') return;

    const split = businessDaysByMonth(item.startDate, item.endDate, year);
    let total = 0;
    split.forEach(function (n, index) {
      total += n;
      if (item.status === 'APPROVED') months[index] += n;
    });
    if (total === 0) return;

    if (item.status === 'PENDING') {
      pending += total;
      return;
    }

    const end = new Date(item.endDate);
    const endStamp = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    if (endStamp < today) used += total;
    else planned += total;
  });

  const allowance = allowanceFor('VACATION', userAllowance);
  return {
    months: months,
    used: used,
    planned: planned,
    pending: pending,
    allowance: allowance,
    remaining: allowance - used - planned
  };
}

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];
