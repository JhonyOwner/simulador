const {db,json}=require('../_lib/auth');
function admin(req){return req.headers['x-admin-key'] && process.env.ADMIN_KEY && req.headers['x-admin-key']===process.env.ADMIN_KEY}
module.exports=async(req,res)=>{if(req.method!=='GET')return json(res,405,{message:'Método não permitido.'});if(!admin(req))return json(res,401,{message:'Chave administrativa inválida.'});try{const users=await db('users?select=id,name,email,cpf,phone,approved,active,device_id,device_bound_at,last_login_at,last_login_ip,created_at&order=created_at.desc');return json(res,200,{users:(users||[]).map(u=>({...u,device_id:!!u.device_id}))});}catch(e){return json(res,500,{message:e.message});}};

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isAdmin(req) {
  return req.headers['x-admin-key'] === process.env.ADMIN_KEY;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido.' });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({
      message: 'Chave administrativa inválida.'
    });
  }

  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      name,
      email,
      cpf,
      phone,
      approved,
      active,
      device_id,
      device_bound_at,
      last_login_at,
      last_login_ip
    `)
    .order('id', { ascending: false });

  if (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Não foi possível carregar os usuários.'
    });
  }

  return res.status(200).json({
    users: data || []
  });
}