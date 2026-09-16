const fs = require('fs');
const path = require('path');
const auth = require('../auth');

module.exports = function handler(req, res) {
  const cookie = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('sim_session='));
  const token = cookie ? decodeURIComponent(cookie.slice('sim_session='.length)) : '';
  if (!auth.getUser(token)) {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  const filePath = path.join(process.cwd(), 'simulador.html');
  const html = fs.readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
