const { auth, json, body, admin } = require('../__auth');
module.exports = async (req, res) => {
  if (!admin(req)) return json(res, 401, { message: 'Não autorizado.' });
  try { const input = await body(req); return json(res, 200, { ok: await auth.setApproval(input.id, input.approved) }); }
  catch (error) { return json(res, 503, { message: error.message || 'Banco de dados indisponível.' }); }
};