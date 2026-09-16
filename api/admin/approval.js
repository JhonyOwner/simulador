const {db,json}=require('../_lib/auth');
function admin(req){return req.headers['x-admin-key'] && process.env.ADMIN_KEY && req.headers['x-admin-key']===process.env.ADMIN_KEY}
module.exports=async(req,res)=>{if(req.method!=='POST')return json(res,405,{message:'Método não permitido.'});if(!admin(req))return json(res,401,{message:'Chave administrativa inválida.'});try{const {id,approved,active}=req.body||{};if(!id)return json(res,400,{message:'Usuário inválido.'});const patch={};if(typeof approved==='boolean')patch.approved=approved;if(typeof active==='boolean')patch.active=active;await db(`users?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});if(approved===false||active===false)await db(`sessions?user_id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});return json(res,200,{message:'Acesso atualizado.'});}catch(e){return json(res,500,{message:e.message});}};

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isAdmin(req) {
  return req.headers['x-admin-key'] === process.env.ADMIN_KEY;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      message: 'Método não permitido.'
    });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({
      message: 'Chave administrativa inválida.'
    });
  }

  const { id, approved } = req.body || {};

  if (!id) {
    return res.status(400).json({
      message: 'Usuário não informado.'
    });
  }

  const value = approved === true;

  const { error } = await supabase
    .from('users')
    .update({
      approved: value,
      active: value
    })
    .eq('id', id);

  if (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Não foi possível atualizar o usuário.'
    });
  }

  return res.status(200).json({
    success: true,
    message: value
      ? 'Usuário aprovado.'
      : 'Usuário bloqueado.'
  });
}