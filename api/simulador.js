const fs = require('fs');
const path = require('path');
const { getSession } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  try {
    const session = await getSession(req);

    if (!session) {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      return res.end();
    }

    if (session.locked) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end(
        'Esta conta está vinculada a outro dispositivo. Solicite ao administrador a liberação.'
      );
    }

    const filePath = path.join(process.cwd(), 'simulador.html');

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Arquivo simulador.html não encontrado.');
    }

    const html = fs.readFileSync(filePath, 'utf8');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(html);

  } catch (error) {
    console.error('Erro ao validar sessão do simulador:', error);

    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Erro ao validar a sessão: ' + error.message);
  }
};