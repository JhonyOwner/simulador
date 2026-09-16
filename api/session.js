const { auth, json, cookies } = require('./__auth');
module.exports = async (req, res) => {
  try { return json(res, 200, { user: await auth.getUser(cookies(req).sim_session) }); }
  catch (error) { return json(res, 503, { message: error.message }); }
};