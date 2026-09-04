import prisma from '../../../lib/prisma';
import { requireUser } from '../../../lib/auth';
import ROSTER, { resolveStartDate } from '../../../lib/roster';
import { vacationYear, balancesByType, allTypeYears } from '../../../lib/leave';

// Yearly vacation (PTO) report for administrators and approvers.
// Every person on the official company roster gets a row, even before they
// have created a portal account, so this table always matches the HR list.
// One column per month, plus total used, total planned and remaining days.
// The numbers are built live from the approved and pending requests.

const DEFAULT_ALLOWANCE = 20;

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ë/g, 'e')
    .replace(/ç/g, 'c')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function emailKey(email) {
  const local = String(email || '').split('@')[0];
  return normalize(local.replace(/[._-]+/g, ' '));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res, ['ADMIN', 'APPROVER']);
  if (!user) return;

  const year = Number(req.query.year) || new Date().getFullYear();

  try {
    const people = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        position: true,
        allowance: true,
        startDate: true
      }
    });

    const requests = await prisma.leaveRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) },
        endDate: { gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0)) }
      },
      select: { userId: true, type: true, status: true, startDate: true, endDate: true }
    });

    const byUser = {};
    requests.forEach(function (item) {
      if (!byUser[item.userId]) byUser[item.userId] = [];
      byUser[item.userId].push(item);
    });

    const accounts = {};
    people.forEach(function (person) {
      const nameKey = normalize(person.name);
      if (nameKey && !accounts[nameKey]) accounts[nameKey] = person;
      const mailKey = emailKey(person.email);
      if (mailKey && !accounts[mailKey]) accounts[mailKey] = person;
    });

    function buildRow(firstName, lastName, rosterDate, person) {
      const mine = person ? byUser[person.id] || [] : [];
      const allowance = person && person.allowance ? person.allowance : DEFAULT_ALLOWANCE;
      const pto = vacationYear(mine, year, allowance);
      const fullName = (firstName + ' ' + lastName).trim();
      return {
        id: person ? person.id : 'roster-' + normalize(fullName).replace(/ /g, '-'),
        firstName: firstName,
        lastName: lastName,
        name: fullName,
        email: person ? person.email : null,
        department: person ? person.department : null,
        position: person ? person.position : null,
        hasAccount: Boolean(person),
        startDate: rosterDate || (person ? person.startDate : null),
        months: pto.months,
        used: pto.used,
        planned: pto.planned,
        pending: pto.pending,
        allowance: pto.allowance,
        remaining: pto.remaining,
        balances: balancesByType(mine, year, allowance),
        typeBreakdowns: allTypeYears(mine, year, allowance)
      };
    }

    const matched = {};
    const rows = ROSTER.map(function (entry) {
      const person = accounts[normalize(entry.first + ' ' + entry.last)] || null;
      if (person) matched[person.id] = true;
      return buildRow(entry.first, entry.last, entry.startDate, person);
    });

    people.forEach(function (person) {
      if (matched[person.id]) return;
      const parts = String(person.name || '').trim().split(' ');
      const firstName = parts.shift() || '';
      const lastName = parts.join(' ');
      rows.push(buildRow(firstName, lastName, resolveStartDate(person.name, person.email), person));
    });

    return res.status(200).json({
      year: year,
      rows: rows,
      count: rows.length,
      withAccount: rows.filter(function (row) {
        return row.hasAccount;
      }).length
    });
  } catch (error) {
    console.error('[leave-year] ' + error.message);
    return res.status(500).json({ error: 'Could not build the yearly leave report' });
  }
}
