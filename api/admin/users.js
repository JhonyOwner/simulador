const {db,json}=require('../_lib/auth');
function admin(req){return req.headers['x-admin-key'] && process.env.ADMIN_KEY && req.headers['x-admin-key']===process.env.ADMIN_KEY}