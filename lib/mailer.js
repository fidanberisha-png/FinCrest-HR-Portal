import prisma from './prisma';
import { ymd } from './dates';

// Render's free tier blocks outbound SMTP connections, which caused every
// notification email to time out. Sending through Resend's HTTPS API avoids
// SMTP entirely and works reliably from Render.
const RESEND_API_KEY = process.env.SMTP_PASS || process.env.RESEND_API_KEY;

function fromAddress() {
return process.env.SMTP_FROM || process.env.SMTP_USER || 'onboarding@resend.dev';
}

export async function sendMail(options) {
if (!RESEND_API_KEY) {
console.warn('[mailer] RESEND_API_KEY not set - skipping email to ' + options.to);
return { skipped: true };
}
try {
const res = await fetch('https://api.resend.com/emails', {
method: 'POST',
headers: {
Authorization: 'Bearer ' + RESEND_API_KEY,
'Content-Type': 'application/json'
},
body: JSON.stringify({
from: fromAddress(),
to: options.to.split(',').map(function (s) {
return s.trim();
}),
subject: options.subject,
text: options.text,
html: options.html
})
});
if (!res.ok) {
const body = await res.text().catch(function () {
return '';
});
console.error('[mailer] failed to send to ' + options.to + ': HTTP ' + res.status + ' ' + body);
return { ok: false, error: 'HTTP ' + res.status };
}
const data = await res.json().catch(function () {
return {};
});
console.log('[mailer] sent to ' + options.to);
return { ok: true, messageId: data.id };
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
