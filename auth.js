import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
import prisma from './prisma';

const COOKIE_NAME = 'hr_session';
const SECRET = process.env.JWT_SECRET || 'insecure-development-secret-change-me';
const MAX_AGE = 60 * 60 * 24 * 7;

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, {
    expiresIn: MAX_AGE
  });
}

export function sessionCookie(token) {
  return serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE
  });
}

export function clearedCookie() {
  return serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
}

export function readToken(req) {
  try {
    const cookies = parse(req.headers.cookie || '');
    const raw = cookies[COOKIE_NAME];
    if (!raw) return null;
    return jwt.verify(raw, SECRET);
  } catch (err) {
    return null;
  }
}

export async function getCurrentUser(req) {
  const payload = readToken(req);
  if (!payload || !payload.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      allowance: true,
      active: true
    }
  });
  if (!user || !user.active) return null;
  return user;
}

export function hasRole(user, roles) {
  return Boolean(user) && roles.indexOf(user.role) !== -1;
}

export async function requireUser(req, res, roles) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }
  if (roles && !hasRole(user, roles)) {
    res.status(403).json({ error: 'You do not have permission to do that' });
    return null;
  }
  return user;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
