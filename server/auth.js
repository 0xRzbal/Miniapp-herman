import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ── Password Hashing ────────────────────────────────────────
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// ── User Management ─────────────────────────────────────────
function loadUsers() {
  try {
    if (existsSync(USERS_FILE)) {
      return JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveUsers(users) {
  const dir = path.dirname(USERS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function createUser(username, password, role = 'user') {
  const users = loadUsers();
  if (users.find(u => u.username === username)) {
    return null; // User already exists
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const user = {
    id: crypto.randomBytes(16).toString('hex'),
    username,
    passwordHash,
    salt,
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  return user;
}

export function authenticateUser(username, password) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;

  const passwordHash = hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) return null;

  return user;
}

export function getUserById(id) {
  const users = loadUsers();
  return users.find(u => u.id === id) || null;
}

// ── JWT Token Management ────────────────────────────────────
export function generateToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (SESSION_DURATION / 1000),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (signature !== expectedSignature) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// ── Middleware ───────────────────────────────────────────────
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const user = getUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── Initialize default admin user ───────────────────────────
export function initializeAuth() {
  const users = loadUsers();
  if (users.length === 0) {
    const admin = createUser('admin', 'admin123', 'admin');
    if (admin) {
      console.log('Default admin user created: admin/admin123');
    }
  }
}
