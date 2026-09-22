const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
  '.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const ROOT=process.cwd();
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('404')}
  const ext=path.extname(f).toLowerCase();
  const body=fs.readFileSync(f);
  const h={'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':/\.(woff2|webp|png|jpe?g|svg)$/.test(ext)?'public,max-age=31536000,immutable':'no-cache'};
  // compressão como em produção, pra medir o que o navegador realmente recebe
  if(/^(text|application\/(javascript|json)|image\/svg)/.test(h['Content-Type'])&&/gzip/.test(req.headers['accept-encoding']||'')){
    h['Content-Encoding']='gzip';
    const gz=zlib.gzipSync(body,{level:9});
    res.writeHead(200,{...h,'Content-Length':gz.length});return res.end(gz);
  }
  res.writeHead(200,{...h,'Content-Length':body.length});res.end(body);
}).listen(4173,()=>console.log('http://127.0.0.1:4173'));
