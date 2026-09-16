const {logout,json}=require('./_lib/auth');
module.exports=async(req,res)=>{if(req.method!=='POST')return json(res,405,{message:'Método não permitido.'});return logout(req,res)};
