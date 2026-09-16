const { auth, json, admin } = require('../_auth');
module.exports = (req, res) => {
  if (!admin(req)) return json(res, 401, { message: 'Não autorizado.' });
  return json(res, 200, { users: auth.listUsers() });
};
