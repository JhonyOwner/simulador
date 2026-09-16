const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'access.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);

const normalize = value => String(value || '').trim();
const digits = value => normalize(value).replace(/\D/g, '');
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value));
const validCPF = value => {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(cpf[10]);
};
const validPhone = value => digits(value).length >= 10 && digits(value).length <= 11;
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, approved: Boolean(user.approved) });
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function validateRegistration(input) {
  const user = {
    name: normalize(input.name),
    cpf: digits(input.cpf),
    email: normalize(input.email).toLowerCase(),
    phone: digits(input.phone),
    password: String(input.password || '')
  };
  const errors = {};
  if (user.name.length < 3) errors.name = 'Informe seu nome completo.';
  if (!validCPF(user.cpf)) errors.cpf = 'CPF inválido.';
  if (!validEmail(user.email)) errors.email = 'E-mail inválido.';
  if (!validPhone(user.phone)) errors.phone = 'Telefone inválido.';
  if (user.password.length < 8 || !/[A-Za-z]/.test(user.password) || !/\d/.test(user.password)) errors.password = 'Use ao menos 8 caracteres, com letra e número.';
  return { user, errors };
}

function createUser(input) {
  const { user, errors } = validateRegistration(input);
  if (Object.keys(errors).length) return { errors };
  try {
    db.prepare('INSERT INTO users (name, password_hash, cpf, email, phone) VALUES (?, ?, ?, ?, ?)').run(
      user.name, bcrypt.hashSync(user.password, 12), user.cpf, user.email, user.phone
    );
    return { user: { name: user.name, email: user.email } };
  } catch (error) {
    if (String(error.message).includes('users.email')) return { errors: { email: 'Este e-mail já está cadastrado.' } };
    if (String(error.message).includes('users.cpf')) return { errors: { cpf: 'Este CPF já está cadastrado.' } };
    throw error;
  }
}

function login(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalize(email).toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return { error: 'E-mail ou senha inválidos.' };
  if (!user.approved) return { error: 'Seu cadastro foi recebido e aguarda aprovação.' };
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), user.id, Date.now() + 1000 * 60 * 60 * 12);
  return { token, user: publicUser(user) };
}

function getUser(token) {
  if (!token) return null;
  const row = db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').get(hashToken(token), Date.now());
  return row ? publicUser(row) : null;
}

function logout(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

function listUsers() {
  return db.prepare('SELECT id, name, cpf, email, phone, approved, created_at FROM users ORDER BY created_at DESC').all().map(user => ({ ...user, approved: Boolean(user.approved) }));
}
function setApproval(id, approved) {
  return db.prepare('UPDATE users SET approved = ? WHERE id = ?').run(approved ? 1 : 0, Number(id)).changes > 0;
}

module.exports = { createUser, login, getUser, logout, listUsers, setApproval, validCPF, validEmail, validPhone };
