const { auth, json, body, admin } = require('../_auth');
module.exports = async (req, res) => {
  if (!admin(req)) return json(res, 401, { message: 'Não autorizado.' });
  try { const input = await body(req); return json(res, 200, { ok: await auth.setApproval(input.id, input.approved) }); }
  catch { return json(res, 400, { message: 'Dados inválidos.' }); }
};
