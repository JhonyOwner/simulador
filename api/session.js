const { auth, json, cookies } = require('./_auth');
module.exports = async (req, res) => json(res, 200, { user: await auth.getUser(cookies(req).sim_session) });
