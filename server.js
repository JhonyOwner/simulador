// Servidor estático simples para o Simulador de Consórcio.
// Uso: node server.js  (porta padrão 8080, ou defina PORT no ambiente)
const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const auth = require('./auth');
const port = process.env.PORT || 8080;
const root = __dirname;

const adminKey = process.env.ADMIN_KEY || 'troque-esta-chave';
if (process.env.NODE_ENV === 'production' && adminKey === 'troque-esta-chave') {
  throw new Error('Defina ADMIN_KEY antes de iniciar em produção.');
}

function cookies(req){
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(item => {
    const index = item.indexOf('=');
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))];
  }));
}
function sendJson(res, status, body, headers = {}){
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100000) reject(new Error('Payload too large')); });
    req.on('end', () => resolve(req.headers['content-type']?.includes('application/json') ? JSON.parse(body || '{}') : querystring.parse(body)));
    req.on('error', reject);
  });
}
function currentUser(req){ return auth.getUser(cookies(req).sim_session); }
function protectSimulator(req, res){
  if (currentUser(req)) return false;
  res.writeHead(302, { Location: '/' });
  res.end();
  return true;
}
function serveFile(res, filePath){
  fs.stat(filePath, (err, stats) => {
    if(err || !stats.isFile()){ res.statusCode=404; return res.end('Not found'); }
    res.setHeader('Content-Type', contentType(filePath));
    fs.createReadStream(filePath).pipe(res);
  });
}

function contentType(file){
  const ext = path.extname(file).toLowerCase();
  switch(ext){
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.csv': return 'text/csv; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

const srv = http.createServer((req,res)=>{
  try{
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if(urlPath === '/' || urlPath === '') urlPath = '/index.html';
    if(req.method === 'POST' && urlPath === '/api/register') return readBody(req).then(body => {
      const result = auth.createUser(body);
      sendJson(res, result.errors ? 400 : 201, result.errors ? result : { message: 'Cadastro recebido. Aguarde a aprovação para acessar o simulador.' });
    }).catch(() => sendJson(res, 400, { message: 'Dados inválidos.' }));
    if(req.method === 'POST' && urlPath === '/api/login') return readBody(req).then(body => {
      const result = auth.login(body.email, body.password);
      if(result.error) return sendJson(res, 401, result);
      sendJson(res, 200, { user: result.user }, { 'Set-Cookie': `sim_session=${result.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` });
    }).catch(() => sendJson(res, 400, { message: 'Dados inválidos.' }));
    if(req.method === 'POST' && urlPath === '/api/logout') {
      auth.logout(cookies(req).sim_session);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'sim_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }
    if(req.method === 'GET' && urlPath === '/api/session') return sendJson(res, 200, { user: currentUser(req) });
    if(req.method === 'GET' && urlPath === '/api/admin/users') {
      if(req.headers['x-admin-key'] !== adminKey) return sendJson(res, 401, { message: 'Não autorizado.' });
      return sendJson(res, 200, { users: auth.listUsers() });
    }
    if(req.method === 'POST' && urlPath === '/api/admin/approval') return readBody(req).then(body => {
      if(req.headers['x-admin-key'] !== adminKey) return sendJson(res, 401, { message: 'Não autorizado.' });
      sendJson(res, 200, { ok: auth.setApproval(body.id, body.approved) });
    }).catch(() => sendJson(res, 400, { message: 'Dados inválidos.' }));
    if(urlPath === '/simulador' || urlPath === '/simulador.html') {
      if(protectSimulator(req, res)) return;
      urlPath = '/simulador.html';
    }
    const filePath = path.join(root, urlPath);
    if(!filePath.startsWith(root)) { res.statusCode = 403; return res.end('Forbidden'); }
    serveFile(res, filePath);
  }catch(e){ res.statusCode=500; res.end('Server error'); }
});

srv.listen(port, '0.0.0.0', ()=>{
  console.log(`Servidor rodando em http://localhost:${port}/`);
  console.log(`Servindo a pasta: ${root}`);
});
