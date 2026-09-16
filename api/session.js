const { auth, json, cookies } = require('./_auth');
module.exports = (req, res) => json(res, 200, { user: auth.getUser(cookies(req).sim_session) });
