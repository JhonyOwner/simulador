const {db,json}=require('./_lib/auth');

module.exports=async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{message:'Método não permitido.'});
  const configured={
    SUPABASE_URL:Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ADMIN_KEY:Boolean(process.env.ADMIN_KEY)
  };
  if(!configured.SUPABASE_URL||!configured.SUPABASE_SERVICE_ROLE_KEY){
    return json(res,500,{ok:false,configured,message:'Variáveis do Supabase ausentes na Vercel.'});
  }
  if(req.headers['x-admin-key']!==process.env.ADMIN_KEY)return json(res,401,{message:'Chave administrativa inválida.',configured});
  try{
    await db('users?select=id&limit=1');
    return json(res,200,{ok:true,message:'Supabase conectado e tabela users acessível.'});
  }catch(error){
    return json(res,500,{ok:false,message:error.message});
  }
};