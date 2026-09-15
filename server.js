// Servidor estático simples para o Simulador de Consórcio.
// Uso: node server.js  (porta padrão 8080, ou defina PORT no ambiente)
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 8080;
const root = __dirname;

function contentType(file){
  const ext = path.extname(file).toLowerCase();
  switch(ext){
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.csv': return 'text/csv; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

const srv = http.createServer((req,res)=>{
  try{
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if(urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const filePath = path.join(root, urlPath);
    if(!filePath.startsWith(root)) { res.statusCode = 403; return res.end('Forbidden'); }
    fs.stat(filePath, (err,stats)=>{
      if(err || !stats.isFile()){ res.statusCode = 404; return res.end('Not found'); }
      res.setHeader('Content-Type', contentType(filePath));
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  }catch(e){ res.statusCode=500; res.end('Server error'); }
});

srv.listen(port, '0.0.0.0', ()=>{
  console.log(`Servidor rodando em http://localhost:${port}/`);
  console.log(`Servindo a pasta: ${root}`);
});
