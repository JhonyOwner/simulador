const fs = require('fs');
const path = require('path');
const auth = require('../_lib/auth');

module.exports = async function handler(req, res) {
  try {
    const session = await auth.getSession(req);

    if (!session) {
      res.writeHead(302, { Location: '/' });
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
    const html = fs.readFileSync(filePath, 'utf8');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);

  } catch (error) {
    console.error('Erro ao validar sessão do simulador:', error);

    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(error.message);
  }
};