const { auth, json, body } = require('./__auth');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { message: 'Método não permitido.' });
  try {
    const result = await auth.createUser(await body(req));
    return json(res, result.errors ? 400 : 201, result.errors ? result : { message: 'Cadastro recebido. Aguarde a aprovação para acessar o simulador.' });
  } catch (error) { return json(res, 503, { message: error.message || 'Banco de dados indisponível.' }); }
};