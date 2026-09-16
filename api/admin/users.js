const { auth, json, admin } = require('../__auth');
module.exports = async (req, res) => {
  if (!admin(req)) return json(res, 401, { message: 'Não autorizado.' });
  try { return json(res, 200, { users: await auth.listUsers() }); }
  catch (error) { return json(res, 503, { message: error.message }); }
};