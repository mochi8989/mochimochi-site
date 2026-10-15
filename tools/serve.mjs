import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
export function createServer(){return http.createServer(async(req,res)=>{
 try{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let base=root;
  if(pathname.startsWith('/published/mochimochi-site/')){base=path.join(root,'dist');pathname=pathname.slice('/published/mochimochi-site'.length);}
  else if(pathname.startsWith('/mochimochi-site/'))pathname=pathname.slice('/mochimochi-site'.length);
  if(pathname.endsWith('/'))pathname+='index.html';
  if(pathname.split('/').some(part=>part.startsWith('.'))||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
  const file=path.resolve(base,'.'+pathname);
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  const type=mime[path.extname(file)];if(!type){res.writeHead(404);res.end();return;}
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.argv[2]||4173);const server=createServer();server.listen(port,'127.0.0.1',()=>console.log(`Site: http://127.0.0.1:${port}/mochimochi-site/\nEditor: http://127.0.0.1:${port}/mochimochi-site/editor/\nStop: Ctrl+C`));
 server.on('error',error=>{console.error(error.message);process.exitCode=1;});
}
