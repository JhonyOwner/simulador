const {db,passwordHash,json}=require('./_lib/auth');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{message:'Método não permitido.'});
 try{
  const {name,cpf,email,phone,password}=req.body||{};
  if(!name||!cpf||!email||!phone||!password)return json(res,400,{message:'Preencha todos os campos.'});
  if(String(password).length<8)return json(res,400,{message:'A senha precisa ter pelo menos 8 caracteres.'});
  const cleanEmail=String(email).trim().toLowerCase();
  const exists=await db(`users?or=(email.eq.${encodeURIComponent(cleanEmail)},cpf.eq.${encodeURIComponent(String(cpf).replace(/\D/g,''))})&select=id&limit=1`);
  if(exists?.length)return json(res,409,{message:'Já existe um cadastro com este e-mail ou CPF.'});
  await db('users',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({name:String(name).trim(),cpf:String(cpf).replace(/\D/g,''),email:cleanEmail,phone:String(phone).trim(),password_hash:passwordHash(password),approved:false,active:true})});
  return json(res,201,{message:'Solicitação enviada. Aguarde a aprovação do administrador.'});
 }catch(e){return json(res,500,{message:e.message});}
};
