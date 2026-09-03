# FinCrest HR Portal

Internal HR portal for leave / PTO and sick-leave requests.

Built with Next.js (pages router), Prisma ORM, PostgreSQL and Nodemailer.
Designed to run on free tiers: Neon for Postgres, Render for hosting, GitHub Actions for nightly backups.

## Roles

- **ADMIN** - full access: manage users and roles, edit settings, approve or reject requests.
- **APPROVER** - can approve or reject leave requests and see the approvals queue.
- **EMPLOYEE** - self-registers, submits requests, sees a personal dashboard with allowance usage.

Everyone who registers starts as EMPLOYEE. Promote the first administrator with SQL:

    UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@yourcompany.com';

## Pages

| Path | Who | Purpose |
| --- | --- | --- |
| /login | anyone | Sign in |
| /register | anyone | Self-registration (EMPLOYEE role) |
| /dashboard | signed in | Allowance summary, new request form, own request history |
| /approvals | APPROVER, ADMIN | Pending queue with approve / reject and decision notes |
| /admin/users | ADMIN | Change roles, allowances, activate or deactivate accounts |
| /admin/settings | ADMIN | Company settings and SMTP test email |

## API

| Method | Path | Notes |
| --- | --- | --- |
| POST | /api/auth/register | Create account, sets httpOnly session cookie |
| POST | /api/auth/login | Sign in |
| POST | /api/auth/logout | Clear session |
| GET | /api/auth/me | Current user |
| GET/POST | /api/requests | List own requests (scope=all for approvers) / create request |
| PATCH | /api/requests/:id | action = approve, reject or cancel |
| GET/PATCH | /api/admin/users | Admin only |
| GET/PUT | /api/admin/settings | Admin only |
| POST | /api/admin/test-email | Admin only SMTP check |
| GET | /api/backup | JSON export, requires BACKUP_TOKEN bearer token |
| GET | /api/health | Uptime and DB connectivity check |

## Environment variables

Copy .env.example to .env for local development. In production set the same keys in Render:

- DATABASE_URL - Neon Postgres connection string (sslmode=require)
- JWT_SECRET - random string, 32+ characters
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM - Gmail App Password or Resend SMTP
- BACKUP_TOKEN - random string shared with the GitHub Actions backup workflow
- APP_URL - public URL of the deployment, used for links in emails

If SMTP_HOST is not set the app still works; emails are skipped and logged instead.

## Deploying on Render

- Build command: npm install && npm run build
- Start command: npm run start

The build script runs prisma generate and prisma db push, so the Neon schema is created or
updated automatically on every deploy. No manual migration step is needed.

## Local development

    npm install
    cp .env.example .env
    npx prisma db push
    npm run dev

## Backups

.github/workflows/backup.yml runs every night at 02:15 UTC, calls /api/backup with the
BACKUP_TOKEN secret and uploads the JSON export as a workflow artifact kept for 30 days.
Repository secrets required: APP_URL and BACKUP_TOKEN.
