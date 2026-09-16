const { auth, json, cookies } = require('./__auth');
module.exports = async (req, res) => {
  await auth.logout(cookies(req).sim_session);
  return json(res, 200, { ok: true }, { 'Set-Cookie': 'sim_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
};