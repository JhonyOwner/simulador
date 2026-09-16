const auth = require('../auth');

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(item => {
    const index = item.indexOf('=');
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))];
  }));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}
function admin(req) { return req.headers['x-admin-key'] === (process.env.ADMIN_KEY || ''); }
module.exports = { auth, json, cookies, body, admin };