const { auth, json, body } = require('./_auth');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { message: 'Método não permitido.' });
  try {
    const input = await body(req);
    const result = auth.login(input.email, input.password);
    if (result.error) return json(res, 401, result);
    return json(res, 200, { user: result.user }, { 'Set-Cookie': `sim_session=${result.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200` });
  } catch (error) { return json(res, 503, { message: error.message || 'Banco de dados indisponível.' }); }
};
