/** Optional loopback-only preview of exactly one HTML artifact. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function createPreviewServer(file) {
  if(!fs.statSync(file).isFile())throw new Error('Preview input must be a file');
  const server=http.createServer((request,response)=>{
    const port=server.address().port;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes((request.headers.host||'').toLowerCase())){response.writeHead(421);response.end();return;}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD'});response.end();return;}
    if(request.url!=='/'&&request.url!=='/index.html'){response.writeHead(404);response.end();return;}
    try{const body=fs.readFileSync(file);response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"});response.end(request.method==='HEAD'?undefined:body);}catch{response.writeHead(500);response.end('Preview unavailable. Rebuild the artifact.');}
  });
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  let file=path.join(root,'dist/index.html'),port=43127;
  try {
    const args=process.argv.slice(2);
    for(let i=0;i<args.length;i++){if(args[i]==='--file'&&args[i+1])file=path.resolve(args[++i]);else if(args[i]==='--port'&&args[i+1])port=Number(args[++i]);else throw new Error('Usage: node studio/serve.mjs [--file FILE.html] [--port PORT]');}
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port must be between 1024 and 65535');
    const server=createPreviewServer(file);
    server.on('error',error=>{console.error(error.message);process.exitCode=1;});
    server.listen(port,'127.0.0.1',()=>console.log(`Archify Studio preview: http://127.0.0.1:${port}`));
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
  }catch(error){console.error(error.message);process.exitCode=1;}
}
