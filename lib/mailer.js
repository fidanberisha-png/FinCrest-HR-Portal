import nodemailer from 'nodemailer';
import prisma from './prisma';
import { ymd } from './dates';

let cached = null;

function transporter() {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  cached = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return cached;
}

export async function sendMail(options) {
  const tx = transporter();
  if (!tx) {
    console.warn('[mailer] SMTP_HOST not set - skipping email to ' + options.to);
    return { skipped: true };
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    const info = await tx.sendMail({
      from: from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    console.log('[mailer] sent to ' + options.to);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] failed to send to ' + options.to + ': ' + err.message);
    return { ok: false, error: err.message };
  }
}

function appUrl() {
  return process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '';
}

function layout(title, lines, linkPath) {
  const base = appUrl();
  const body = lines
    .map(function (l) {
      return '<p style="margin:0 0 10px">' + l + '</p>';
    })
    .join('');
  const link = base
    ? '<p style="margin:22px 0 0"><a href="' +
      base +
      (linkPath || '/dashboard') +
      '" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open FinCrest HR Portal</a></p>'
    : '';
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1b1f24">' +
    '<h2 style="margin:0 0 14px;font-size:18px">' +
    title +
    '</h2>' +
    body +
    link +
    '<p style="margin:26px 0 0;color:#6b7280;font-size:12px">FinCrest HR Portal - automated notification</p>' +
    '</div>'
  );
}

function describe(request, requesterName) {
  return [
    'Employee: ' + requesterName,
    'Type: ' + request.type,
    'Dates: ' + ymd(request.startDate) + ' to ' + ymd(request.endDate) + ' (' + request.days + ' working day(s))',
    'Reason: ' + (request.reason || 'not provided')
  ];
}

export async function notifyNewRequest(request, requester) {
  const approvers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'APPROVER'] }, active: true },
    select: { email: true }
  });
  const extra = await prisma.setting.findUnique({ where: { key: 'notifyEmail' } });
  const recipients = approvers.map(function (a) {
    return a.email;
  });
  if (extra && extra.value) recipients.push(extra.value);
  if (recipients.length === 0) return { skipped: true };
  const lines = describe(request, requester.name).concat([
    'This request is waiting for approval.'
  ]);
  return sendMail({
    to: recipients.join(','),
    subject: 'Leave request from ' + requester.name + ' (' + request.type + ')',
    text: lines.join('\n'),
    html: layout('New leave request', lines, '/approvals')
  });
}

export async function notifyDecision(request, requester, decider) {
  const lines = [
    'Your ' + request.type.toLowerCase() + ' leave request has been ' + request.status.toLowerCase() + '.',
    'Dates: ' + ymd(request.startDate) + ' to ' + ymd(request.endDate) + ' (' + request.days + ' working day(s))',
    'Reviewed by: ' + (decider ? decider.name : 'HR'),
    'Note: ' + (request.decisionNote || 'none')
  ];
  return sendMail({
    to: requester.email,
    subject: 'Leave request ' + request.status.toLowerCase() + ' - ' + ymd(request.startDate),
    text: lines.join('\n'),
    html: layout('Leave request ' + request.status.toLowerCase(), lines, '/dashboard')
  });
}

export async function sendTestMail(to) {
  return sendMail({
    to: to,
    subject: 'FinCrest HR Portal - SMTP test',
    text: 'SMTP is configured correctly.',
    html: layout('SMTP test', ['Your SMTP settings are working correctly.'], '/dashboard')
  });
}
