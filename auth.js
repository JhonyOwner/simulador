const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
}) : null;
let schemaReady;
function ensureSchema() {
  if (!pool) return Promise.reject(new Error('DATABASE_URL não configurada na Vercel.'));
  if (!schemaReady) schemaReady = pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    );
  `);
  return schemaReady;
}

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
  const user = { name: normalize(input.name), cpf: digits(input.cpf), email: normalize(input.email).toLowerCase(), phone: digits(input.phone), password: String(input.password || '') };
  const errors = {};
  if (user.name.length < 3) errors.name = 'Informe seu nome completo.';
  if (!validCPF(user.cpf)) errors.cpf = 'CPF inválido.';
  if (!validEmail(user.email)) errors.email = 'E-mail inválido.';
  if (!validPhone(user.phone)) errors.phone = 'Telefone inválido.';
  if (user.password.length < 8 || !/[A-Za-z]/.test(user.password) || !/\d/.test(user.password)) errors.password = 'Use ao menos 8 caracteres, com letra e número.';
  return { user, errors };
}

async function createUser(input) {
  const { user, errors } = validateRegistration(input);
  if (Object.keys(errors).length) return { errors };
  await ensureSchema();
  try {
    await pool.query('INSERT INTO users (name, password_hash, cpf, email, phone) VALUES ($1, $2, $3, $4, $5)', [user.name, await bcrypt.hash(user.password, 12), user.cpf, user.email, user.phone]);
    return { user: { name: user.name, email: user.email } };
  } catch (error) {
    if (error.code === '23505' && error.constraint?.includes('email')) return { errors: { email: 'Este e-mail já está cadastrado.' } };
    if (error.code === '23505' && error.constraint?.includes('cpf')) return { errors: { cpf: 'Este CPF já está cadastrado.' } };
    throw error;
  }
}

async function login(email, password) {
  await ensureSchema();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalize(email).toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) return { error: 'E-mail ou senha inválidos.' };
  if (!user.approved) return { error: 'Seu cadastro foi recebido e aguarda aprovação.' };
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), user.id, Date.now() + 1000 * 60 * 60 * 12]);
  return { token, user: publicUser(user) };
}

async function getUser(token) {
  if (!token) return null;
  await ensureSchema();
  const { rows } = await pool.query('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = $1 AND sessions.expires_at > $2', [hashToken(token), Date.now()]);
  return rows[0] ? publicUser(rows[0]) : null;
}
async function logout(token) { if (token) { await ensureSchema(); await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]); } }
async function listUsers() { await ensureSchema(); const { rows } = await pool.query('SELECT id, name, cpf, email, phone, approved, created_at FROM users ORDER BY created_at DESC'); return rows; }
async function setApproval(id, approved) { await ensureSchema(); const result = await pool.query('UPDATE users SET approved = $1 WHERE id = $2', [Boolean(approved), Number(id)]); return result.rowCount > 0; }

module.exports = { createUser, login, getUser, logout, listUsers, setApproval, validCPF, validEmail, validPhone };
