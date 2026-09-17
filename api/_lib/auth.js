const crypto = require('crypto');

const COOKIE = 'sim_session';
const DEVICE_COOKIE = 'sim_device';
const SESSION_DAYS = 30;

function env(name){
  const v=process.env[name];
  if(!v) throw new Error(`Variável ${name} não configurada.`);
  return v;
}

async function db(path, options={}){
  const base=env('SUPABASE_URL').replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  let r;
  try {
    r=await fetch(`${base}/rest/v1/${path}`,{
      ...options,
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(options.headers||{})}
    });
  } catch (error) {
    throw new Error(`Não foi possível conectar ao Supabase: ${error.message}`);
  }
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{}
  if(!r.ok) throw new Error(data?.message||data?.hint||text||'Erro no banco.');
  return data;
}

function parseCookies(req){
  const out={};
  for(const part of (req.headers.cookie||'').split(';')){
    const i=part.indexOf('='); if(i<0) continue;
    out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function cookie(name,value,maxAge,extra=''){return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax${extra}`;}
function clearCookie(name){return cookie(name,'',0);}
function randomToken(){return crypto.randomBytes(32).toString('hex');}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function passwordHash(password,salt=crypto.randomBytes(16).toString('hex')){
  const key=crypto.pbkdf2Sync(password,salt,210000,32,'sha256').toString('hex');
  return `${salt}:${key}`;
}
function passwordVerify(password,stored){
  const [salt,key]=String(stored||'').split(':'); if(!salt||!key) return false;
  const actual=crypto.pbkdf2Sync(password,salt,210000,32,'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(key,'hex'));
}
function json(res,status,payload,headers={}){res.statusCode=status;res.setHeader('Content-Type','application/json');for(const [k,v] of Object.entries(headers))res.setHeader(k,v);res.end(JSON.stringify(payload));}

async function getSession(req){
  const token=parseCookies(req)[COOKIE]; if(!token) return null;
const rows=await db(
  `sessions?token_hash=eq.${encodeURIComponent(hash(token))}&select=user_id,device_id,expires_at&limit=1`
);
  if(!rows?.[0]) return null;
  if(new Date(rows[0].expires_at)<=new Date()) return null;
  const users=await db(`users?id=eq.${encodeURIComponent(rows[0].user_id)}&select=id,name,email,cpf,phone,approved,active,device_id&limit=1`);
  const user=users?.[0];
  if(!user || !user.approved || user.active===false) return null;
  const device=parseCookies(req)[DEVICE_COOKIE];
  if(!device || user.device_id!==hash(device) || rows[0].device_id!==hash(device)) return {locked:true,user};
  return {user,session:rows[0]};
}

async function requireSession(req,res){
  try{
    const s=await getSession(req);
    if(!s) {json(res,401,{message:'Sessão expirada. Faça login novamente.'});return null;}
    if(s.locked){json(res,403,{message:'Esta conta está vinculada a outro dispositivo. Solicite ao administrador a liberação de um novo dispositivo.'});return null;}
    return s;
  }catch(e){json(res,500,{message:e.message});return null;}
}

async function login(req,res){
  try{
    const {email,password}=req.body||{};
    if(!email||!password) return json(res,400,{message:'E-mail e senha são obrigatórios.'});
    const users=await db(`users?email=eq.${encodeURIComponent(String(email).trim().toLowerCase())}&select=*&limit=1`);
    const user=users?.[0];
    if(!user || !passwordVerify(password,user.password_hash)) return json(res,401,{message:'E-mail ou senha inválidos.'});
    if(!user.approved || user.active===false) return json(res,403,{message:'Seu acesso ainda não foi aprovado ou está bloqueado.'});
    const cookies=parseCookies(req);
    let device=cookies[DEVICE_COOKIE];
    let newDevice=false;
    if(!device){device=randomToken();newDevice=true;}
    const deviceHash=hash(device);
    if(user.device_id && user.device_id!==deviceHash){
      return json(res,403,{message:'Acesso bloqueado: esta conta já está vinculada a outro dispositivo. Solicite ao administrador a troca do dispositivo.'});
    }
    if(!user.device_id){
      await db(`users?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({device_id:deviceHash,device_bound_at:new Date().toISOString(),last_login_at:new Date().toISOString(),last_login_ip:req.headers['x-forwarded-for']||req.socket?.remoteAddress||null})});
    }else{
      await db(`users?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_login_at:new Date().toISOString(),last_login_ip:req.headers['x-forwarded-for']||req.socket?.remoteAddress||null})});
    }
    const token=randomToken();
    const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
    await db('sessions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:user.id,token_hash:hash(token),device_id:deviceHash,expires_at:expires})});
    const set=[cookie(COOKIE,token,SESSION_DAYS*86400),cookie(DEVICE_COOKIE,device,31536000)];
    return json(res,200,{message:'Login realizado.',user:{id:user.id,name:user.name,email:user.email}},{'Set-Cookie':set});
  }catch(e){return json(res,500,{message:e.message});}
}

async function logout(req,res){
  try{
    const token=parseCookies(req)[COOKIE];
    if(token) await db(`sessions?token_hash=eq.${hash(token)}`,{method:'DELETE'});
  }catch{}
  return json(res,200,{message:'Sessão encerrada.'},{'Set-Cookie':[clearCookie(COOKIE),clearCookie(DEVICE_COOKIE)]});
}

module.exports={db,parseCookies,cookie,clearCookie,randomToken,hash,passwordHash,passwordVerify,json,getSession,requireSession,login,logout,COOKIE,DEVICE_COOKIE};
